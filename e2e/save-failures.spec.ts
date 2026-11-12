import { expect, test, type Page } from "@playwright/test";
import { signUpTestStudent } from "../e2e-auth/signIn";

// Saves go over the network now (#32), so they can fail. Each test makes chosen
// PUT /api/sessions/<id> requests fail with a 500, then checks the student sees
// a friendly error and nothing is lost or duplicated (#34).
test.beforeEach(async ({ page, baseURL }) => signUpTestStudent(page, baseURL));

const SERVER_ERROR = "relation teaching_sessions does not exist"; // must never reach the screen

/** The app's alerts, not Next's route announcer (which also has role="alert"). */
const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Fails the listed PUT saves (1 = the first save after this call), lets the rest through. */
async function failSaves(page: Page, failing: number[]) {
  let n = 0;
  await page.route("**/api/sessions/*", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    n += 1;
    if (failing.includes(n)) return route.fulfill({ status: 500, json: { error: SERVER_ERROR } });
    return route.continue();
  });
}

async function startTeaching(page: Page) {
  await page.goto("/learner/independence-vs-mutual-exclusivity");
  await page.getByRole("button", { name: "Start Teaching" }).click();
  await expect(page).toHaveURL(/\/teach\/session_/);
  const log = page.getByRole("log");
  await expect(log.locator("[data-role=learner]")).toHaveCount(1, { timeout: 10_000 });
  return log;
}

test("a student message that fails to save shows a friendly error and is saved on retry", async ({ page }) => {
  const log = await startTeaching(page);
  await failSaves(page, [1]);

  await page.getByLabel("Your message to Pip").fill("Independent events don't change each other's chances.");
  await page.getByRole("button", { name: "Send message" }).click();

  const alert = appAlert(page);
  await expect(alert).toContainText("Not saved yet.");
  await expect(alert).toContainText("couldn't be saved or loaded");
  await expect(alert).not.toContainText(SERVER_ERROR);
  await expect(log.locator("[data-role=student]")).toHaveCount(1); // still on screen

  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(log.locator("[data-role=learner]")).toHaveCount(2, { timeout: 10_000 });
  await expect(appAlert(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("log").locator("[data-role=student]")).toHaveCount(1);
  await expect(page.getByRole("log").locator("[data-role=learner]")).toHaveCount(2);
});

test("when Pip's reply fails to save, retrying saves it without asking Pip again", async ({ page }) => {
  const log = await startTeaching(page);
  await failSaves(page, [2]); // 1 = the student's message, 2 = Pip's reply

  await page.getByLabel("Your message to Pip").fill("Independent events don't change each other's chances.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(appAlert(page)).toContainText("Not saved yet.", { timeout: 10_000 });
  await expect(log.locator("[data-role=learner]")).toHaveCount(2);

  await appAlert(page).getByRole("button", { name: "Try again" }).click();
  await expect(appAlert(page)).toHaveCount(0);
  await expect(log.locator("[data-role=learner]")).toHaveCount(2); // no duplicate reply

  await page.reload();
  await expect(page.getByRole("log").locator("[data-role=learner]")).toHaveCount(2);
});

test("ending a session that fails to save keeps the student in the session", async ({ page }) => {
  await startTeaching(page);
  await failSaves(page, [1]);

  await page.getByRole("button", { name: "End Session" }).click();
  await page.getByRole("button", { name: "Yes, end session" }).click();
  await expect(appAlert(page)).toContainText("couldn't be saved or loaded");
  await expect(page).toHaveURL(/\/teach\/session_/);
  await expect(page.getByLabel("Your message to Pip")).toBeEnabled();

  await page.getByRole("button", { name: "Yes, end session" }).click();
  await expect(page).toHaveURL(/\/reflect\/session_/);
});

test("logged out, the landing page loads without session errors", async ({ page }) => {
  await page.context().clearCookies();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const listed = page.waitForResponse((r) => r.url().endsWith("/api/sessions"));
  await page.goto("/");
  expect((await listed).status()).toBe(401);
  await expect(page.getByRole("heading", { name: "The best way to learn is to teach." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your recent sessions" })).toHaveCount(0);
  await page.waitForTimeout(500); // let the rejected request settle
  expect(errors).toEqual([]);
});
