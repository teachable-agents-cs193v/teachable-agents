// Signs a fresh test student up (and so in) through the real auth API, for
// browser tests that need a logged-in user. The session cookie lands in the
// page's browser context. Test-only values.
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { PASSWORDS } from "./fixtures";

/** Returns the new student's email (the password is PASSWORDS.strong). */
export async function signUpTestStudent(page: Page, baseURL: string | undefined): Promise<string> {
  if (!baseURL) throw new Error("signUpTestStudent needs the config's baseURL");
  const email = `student-${randomUUID()}@example.com`;
  const res = await page.request.post("/api/auth/sign-up/email", {
    headers: { origin: baseURL },
    data: { name: "Test Student", email, password: PASSWORDS.strong },
  });
  expect(res.ok(), `test sign-up failed with ${res.status()}`).toBe(true);
  return email;
}
