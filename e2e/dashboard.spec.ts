import { expect, test, type Page } from "@playwright/test";
import { signUpTestStudent } from "../e2e-auth/signIn";

// The logged-in home: a first-time student sees how to start, and a returning
// one sees their unfinished and recent sessions, built from real saved data.
test.beforeEach(async ({ page, baseURL }) => signUpTestStudent(page, baseURL));

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

/** Creates a session through the real API, as the workspace would. */
async function createSession(page: Page, topicId: string) {
  const res = await page.request.post("/api/sessions", { headers: { "content-type": "application/json" }, data: { topicId } });
  expect(res.status(), "create session").toBe(201);
  return (await res.json()) as { id: string };
}

async function completeSession(page: Page, id: string) {
  const res = await page.request.put(`/api/sessions/${id}`, {
    headers: { "content-type": "application/json" },
    data: { status: "completed", endedAt: new Date().toISOString(), messages: [], learnerCursor: 0 },
  });
  expect(res.ok(), "complete session").toBe(true);
}

test("a logged-in student is sent from the homepage to the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  // exact: the wordmark is also a link named "Pip home".
  for (const name of ["Home", "Lessons", "My sessions", "Profile"]) await expect(nav(page).getByRole("link", { name, exact: true })).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
});

test("a first-time student sees a welcome, how a session works, and one way to start", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Welcome, Test!/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your first session" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New teaching session" })).toHaveAttribute("href", "/topics");
  await expect(page.getByRole("heading", { name: /Continue learning|Recent sessions/ })).toHaveCount(0);
  // Every lesson can be started from here.
  await expect(page.getByRole("link", { name: "Teach this" })).toHaveCount(5);
  await page.getByRole("link", { name: "Teach this" }).first().click();
  await expect(page).toHaveURL(/\/learner\//);
  await expect(page.getByRole("button", { name: "Start Teaching" })).toBeVisible();
});

test("unfinished and completed sessions show up from saved data", async ({ page }) => {
  const started = await createSession(page, "recursion");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /^Welcome back, Test!/ })).toBeVisible();
  const resume = page.getByRole("link", { name: /Continue your lesson Recursion/ });
  await expect(resume).toHaveAttribute("href", `/teach/${started.id}`);
  await expect(page.getByText("No completed sessions yet.")).toBeVisible();

  await completeSession(page, started.id);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Pick up where you left off." })).toHaveCount(0);
  const recent = page.getByRole("region", { name: "What you have taught so far." });
  await expect(recent.getByRole("heading", { name: "Recursion" })).toBeVisible();
  await expect(recent.getByRole("link", { name: "Review" })).toHaveAttribute("href", `/sessions/${started.id}`);
  await expect(page.getByText("Taught once")).toBeVisible();
  await expect(page.getByText("Sessions completed")).toBeVisible();
});

test("the profile shows the account and counts of what was taught", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Test Student" })).toBeVisible();
  await expect(page.getByText(/@example\.com$/)).toBeVisible();
  await expect(page.getByText("Not yet")).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Log out" })).toBeVisible();
});
