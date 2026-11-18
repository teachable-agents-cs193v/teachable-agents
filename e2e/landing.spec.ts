import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PASSWORDS } from "../e2e-auth/fixtures";
import { submitSignUpForm } from "../e2e-auth/signIn";

// The landing page is public, but teaching isn't: a visitor who clicks "Start
// teaching" is asked to make an account first and then lands in the library.
test("logged out, Start teaching asks you to sign up and then opens the library", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /You teach\.\s*Pip learns\./ })).toBeVisible();
  await page.getByRole("link", { name: "Start teaching" }).first().click();
  await expect(page).toHaveURL(/\/signup\?next=%2Ftopics$/);
  // A returning student can switch to logging in without losing the destination.
  await expect(page.getByRole("main").getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Ftopics");

  // Signing up through the form keeps the destination: the library, logged in.
  await page.getByLabel("Name").fill("Test Student");
  await page.getByLabel("Email").fill(`student-${randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORDS.strong);
  await submitSignUpForm(page);
  await expect(page).toHaveURL(/\/topics$/);
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My sessions" })).toBeVisible();
});

test("the closing call to action sends a visitor to sign up too", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("region", { name: /Teach Pip something today/ });
  await expect(cta.getByRole("link", { name: "Start teaching" })).toHaveAttribute("href", "/signup?next=%2Ftopics");
});
