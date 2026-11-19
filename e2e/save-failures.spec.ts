import { expect, test, type Page } from "@playwright/test";
import { signUpTestStudent } from "../e2e-auth/signIn";

// The server saves the transcript itself: the student's message, then Pip's reply
// (POST /api/sessions/<id>/turn). These tests make chosen turn requests fail, then
// check the student sees a friendly error and nothing is lost or duplicated (#34).
// Ending the session is still a PUT, so its failure is tested through PUT.
test.beforeEach(async ({ page, baseURL }) => signUpTestStudent(page, baseURL));

const SERVER_ERROR = "relation teaching_sessions does not exist"; // must never reach the screen

/** The app's alerts, not Next's route announcer (which also has role="alert"). */
const appAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/**
 * Fails the listed turn requests (1 = the first after this call).
 * "before": the request never reaches the server. "after": the server handles it,
 * but the browser never sees the answer (a dropped connection).
 */
async function failTurns(page: Page, failing: number[], when: "before" | "after") {
  let n = 0;
  await page.route("**/api/sessions/*/turn", async (route) => {
    n += 1;
    if (!failing.includes(n)) return route.continue();
    if (when === "after") await route.fetch();
    return route.fulfill({ status: 500, json: { error: SERVER_ERROR } });
  });
}

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
  await page.getByRole("button", { name: "Use the offline demo Pip instead" }).click();
  await expect(page).toHaveURL(/\/teach\/session_/);
  const log = page.getByRole("log");
  await expect(log.locator("[data-role=learner]")).toHaveCount(1, { timeout: 10_000 });
  return log;
}

async function send(page: Page, text: string) {
  await page.getByLabel("Your message to Pip").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

async function expectSaved(page: Page, students: number, learners: number) {
  await page.reload();
  await expect(page.getByRole("log").locator("[data-role=learner]")).toHaveCount(learners);
  await expect(page.getByRole("log").locator("[data-role=student]")).toHaveCount(students);
}

test("a turn that fails shows a friendly error, keeps the message, and sends it once on retry", async ({ page }) => {
  const log = await startTeaching(page);
  await failTurns(page, [1], "before");
  await send(page, "Independent events don't change each other's chances.");

  const alert = appAlert(page);
  await expect(alert).toContainText("couldn\u2019t respond");
  await expect(alert).toContainText("trouble thinking");
  await expect(alert).not.toContainText(SERVER_ERROR);
  await expect(log.locator("[data-role=student]")).toHaveCount(1); // still on screen

  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(log.locator("[data-role=learner]")).toHaveCount(2, { timeout: 10_000 });
  await expect(appAlert(page)).toHaveCount(0);
  await expectSaved(page, 1, 2);
});

test("when the answer is lost on the way back, retrying doesn't duplicate anything", async ({ page }) => {
  const log = await startTeaching(page);
  await failTurns(page, [1], "after"); // the server saved both messages; the browser never heard
  await send(page, "Independent events don't change each other's chances.");
  await expect(appAlert(page)).toContainText("trouble thinking", { timeout: 10_000 });

  await appAlert(page).getByRole("button", { name: "Try again" }).click();
  await expect(appAlert(page)).toHaveCount(0);
  await expect(log.locator("[data-role=learner]")).toHaveCount(2);
  await expect(log.locator("[data-role=student]")).toHaveCount(1);
  await expectSaved(page, 1, 2);
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
