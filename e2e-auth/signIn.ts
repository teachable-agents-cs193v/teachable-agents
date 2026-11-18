// Signs a fresh test student up (and so in) through the real auth API, for
// browser tests that need a logged-in user. The session cookie lands in the
// page's browser context. Test-only values. Also submits the signup form for
// tests that go through the UI.
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { PASSWORDS } from "./fixtures";

/**
 * Against a production build (`npm run test:e2e`), Better Auth's rate limit is
 * on: 3 sign-ups per 10 seconds. The app keeps that limit; the tests wait it out.
 */
const MAX_RATE_LIMIT_WAITS = 5;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns the new student's email (the password is PASSWORDS.strong). */
export async function signUpTestStudent(page: Page, baseURL: string | undefined): Promise<string> {
  if (!baseURL) throw new Error("signUpTestStudent needs the config's baseURL");
  const email = `student-${randomUUID()}@example.com`;
  const signUp = () =>
    page.request.post("/api/auth/sign-up/email", {
      headers: { origin: baseURL },
      data: { name: "Test Student", email, password: PASSWORDS.strong },
    });
  let res = await signUp();
  for (let waits = 0; res.status() === 429 && waits < MAX_RATE_LIMIT_WAITS; waits++) {
    // Better Auth says how many seconds are left in the window. A rejected
    // attempt doesn't extend it, so one wait is normally enough.
    const retryAfter = Number(res.headers()["x-retry-after"]) || 10;
    await sleep(retryAfter * 1000 + 100);
    res = await signUp();
  }
  expect(res.ok(), `test sign-up failed with ${res.status()}`).toBe(true);
  return email;
}

/**
 * Clicks the signup form's "Sign up" button and waits to leave /signup. If the
 * form reports the rate limit instead, waits out the window and submits again
 * (the form clears its error on each submit).
 */
export async function submitSignUpForm(page: Page) {
  const limited = page.getByRole("alert").filter({ hasText: "Too many attempts" });
  const leftSignup = () => !new URL(page.url()).pathname.startsWith("/signup");
  for (let waits = 0; ; waits++) {
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect.poll(async () => leftSignup() || (await limited.isVisible()), { timeout: 30_000 }).toBe(true);
    if (leftSignup()) return;
    expect(waits, "sign-up form still rate limited").toBeLessThan(MAX_RATE_LIMIT_WAITS);
    await sleep(10_100);
  }
}
