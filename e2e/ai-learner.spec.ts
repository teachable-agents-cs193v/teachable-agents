import { expect, test } from "@playwright/test";
import { signUpTestStudent } from "../e2e-auth/signIn";

/**
 * The real AI learner in the browser. Opt-in, because it spends model quota:
 *
 *   E2E_AI_LEARNER=1 LLM_BASE_URL=… LLM_API_KEY=… LLM_MODEL=… npx playwright test ai-learner
 *
 * Model output varies, so this checks behavior (Pip answers, the session survives
 * a reload, nothing leaks into the browser), not exact wording.
 */
test.skip(process.env.E2E_AI_LEARNER !== "1", "Set E2E_AI_LEARNER=1 and LLM_* to run against a real model.");
test.setTimeout(240_000);

test.beforeEach(async ({ page, baseURL }) => signUpTestStudent(page, baseURL));

test("a student teaches the AI learner and the session survives a reload", async ({ page }) => {
  const turnResponses: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/turn")) turnResponses.push(await res.text());
  });

  await page.goto("/learner/independence-vs-mutual-exclusivity");
  await page.getByRole("button", { name: "Start Teaching" }).click();
  await expect(page).toHaveURL(/\/teach\/session_/);

  const log = page.getByRole("log");
  const learner = log.locator("[data-role=learner]");
  await expect(learner.first()).not.toBeEmpty({ timeout: 60_000 });
  await expect(page.getByText("AI learner", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo mode")).toHaveCount(0);

  const composer = page.getByLabel("Your message to Pip");
  await composer.fill("No, that's wrong. Just trust me.");
  await composer.press("Enter");
  await expect(learner).toHaveCount(2, { timeout: 90_000 });

  await composer.fill(
    "Independent means knowing one event happened doesn't change the chance of the other. A coin flip and a die roll can both happen, heads and a six, and getting heads doesn't change the 1/6 chance of a six.",
  );
  await composer.press("Enter");
  await expect(learner).toHaveCount(3, { timeout: 90_000 });

  // Every reply is short, in Pip's voice, and carries no hidden state.
  for (const text of await learner.allInnerTexts()) expect(text.length).toBeLessThan(700);
  for (const body of turnResponses) expect(body).not.toMatch(/notebook|taughtCorrectly|keyIdea|whyWrong|analysis/);

  await page.reload();
  await expect(page.getByRole("log").locator("[data-role=learner]")).toHaveCount(3);
  await expect(page.getByRole("log").locator("[data-role=student]")).toHaveCount(2);
});
