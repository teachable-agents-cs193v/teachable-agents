// Teaching pages require a login (#16): logged-out visits go to /login with the
// page as `next`, and logging in returns there.
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORDS } from "./fixtures";

const PROTECTED = ["/learner/independence-vs-mutual-exclusivity", "/teach/session_any", "/reflect/session_any", "/sessions", "/sessions/session_any"];
const PUBLIC = ["/", "/topics", "/login", "/signup"];

test.beforeAll(async ({ request }) => {
  for (const path of [...PUBLIC, ...PROTECTED, "/api/auth/get-session"]) await request.get(path);
});

async function createAccount(page: Page) {
  const email = `student-${randomUUID()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Avery Kim");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORDS.strong);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/topics$/);
  await page.context().clearCookies(); // log out again, for the tests below
  return email;
}

async function logIn(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORDS.strong);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("logged out, every teaching page redirects to login and comes back after it", async ({ page }) => {
  const email = await createAccount(page);
  for (const path of PROTECTED) {
    await page.context().clearCookies();
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    await logIn(page, email);
    // First render of each page after login: next dev may still be compiling it.
    await expect(page).toHaveURL(path, { timeout: 30_000 });
  }
});

test("public pages stay public", async ({ page }) => {
  for (const path of PUBLIC) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page).toHaveURL(path);
  }
});

test("logged out, picking a topic asks you to log in, then opens that topic", async ({ page }) => {
  const email = await createAccount(page);
  await page.goto("/topics");
  await page.getByRole("button", { name: /^Probability/ }).click();
  await page.getByRole("link", { name: "Teach This Topic" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Flearner%2Findependence-vs-mutual-exclusivity$/);
  await logIn(page, email);
  await expect(page).toHaveURL(/\/learner\/independence-vs-mutual-exclusivity$/);
  await expect(page.getByRole("button", { name: "Start Teaching" })).toBeVisible();
});

test("after logging out, going back doesn't show the protected page", async ({ page }) => {
  const email = await createAccount(page);
  await page.goto("/login?next=%2Fsessions");
  await logIn(page, email);
  await expect(page).toHaveURL(/\/sessions$/);
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/localhost:3211\/$/);
  await page.goBack();
  await page.reload();
  await expect(page).toHaveURL(/\/login\?next=%2Fsessions$/);
});
