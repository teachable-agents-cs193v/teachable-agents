import { expect, test, type Page } from "@playwright/test";
import { signUpTestStudent } from "../e2e-auth/signIn";

/**
 * The AI learner's panels in the browser, with the fake model in
 * e2e-auth/fakeLlm.mts: message 1 adds an asserted idea and Pip voices a
 * misconception; message 2 explains an idea and corrects the misconception.
 */
test.beforeEach(async ({ page, baseURL }) => signUpTestStudent(page, baseURL));

/** The sidebar is in the page twice (phone and desktop layouts); only one is visible. */
const visible = (page: Page, testId: string) => page.getByTestId(testId).filter({ visible: true });

test("a student sees Pip's beliefs and misconceptions change, then reviews the session", async ({ page }) => {
  const turnBodies: string[] = [];
  page.on("response", async (res) => {
    if (res.url().includes("/turn") || res.url().includes("/progress")) turnBodies.push(await res.text());
  });

  await page.goto("/learner/independence-vs-mutual-exclusivity");
  await page.getByRole("button", { name: "Start Teaching" }).click();
  await expect(page).toHaveURL(/\/teach\/session_/);
  const log = page.getByRole("log");
  await expect(log.locator("[data-role=learner]").first()).toContainText("Fake Pip reply");

  const beliefs = visible(page, "pip-beliefs");
  const tracker = visible(page, "misconception-tracker");
  const strip = page.getByTestId("learning-strip");
  await expect(beliefs).toContainText("Nothing yet");
  await expect(tracker).toContainText("came in with a few wrong ideas");

  const composer = page.getByLabel("Your message to Pip");
  await composer.fill("Independent means one doesn't change the other's chance.");
  await composer.press("Enter");
  await expect(log.locator("[data-role=learner]")).toHaveCount(2);

  const first = beliefs.locator("li", { hasText: "doesn't change the other's chance" });
  await expect(first).toHaveAttribute("data-status", "heard");
  await expect(first).toHaveAttribute("data-changed", "true");
  await expect(tracker.locator("li")).toHaveAttribute("data-status", "believes");
  await expect(tracker).toContainText("can't happen at the same time");
  await expect(tracker.locator("li")).toContainText("Not right");
  // A side note says Pip's idea isn't right (Pip itself never does), without giving the answer.
  await expect(page.getByTestId("learning-flags")).toContainText("Catch it");
  await expect(strip).toContainText("Your last message: Pip heard, Pip said what it believes");

  await composer.fill("Heads and a six can both happen, and heads doesn't change the 1/6 chance of a six.");
  await composer.press("Enter");
  await expect(log.locator("[data-role=learner]")).toHaveCount(3);

  await expect(tracker.locator("li")).toHaveAttribute("data-status", "changed_mind");
  await expect(tracker).toContainText("1 of 1 changed");
  await expect(beliefs.locator("li", { hasText: "Heads and a six" })).toHaveAttribute("data-status", "understood");
  await expect(first).not.toHaveAttribute("data-changed", "true");
  await expect(strip).toContainText("Pip changed its mind");
  await expect(strip.locator("ol > li")).toHaveCount(2);

  // After a reload the panels come back from GET /pip and GET /progress.
  await page.reload();
  await expect(visible(page, "misconception-tracker").locator("li")).toHaveAttribute("data-status", "changed_mind");
  await expect(visible(page, "pip-beliefs").locator("li")).toHaveCount(3);

  // Phone width: no sideways scrolling; the strip is on screen and the notes open from the header.
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.getByTestId("learning-strip")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Pip's notes" }).click();
  await expect(visible(page, "pip-beliefs")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Nothing hidden reached the browser during the session.
  for (const body of turnBodies) expect(body).not.toMatch(/correctness|taughtCorrectly|keyIdea|whyWrong|analysis|same deck/);

  await page.getByRole("button", { name: "End Session" }).click();
  await page.getByRole("button", { name: "Yes, end session" }).click();
  await expect(page).toHaveURL(/\/reflect\/session_/);

  const review = page.getByTestId("learning-review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("1 of 3");
  await expect(review.locator("[data-outcome=corrected]")).toContainText("Independent events cannot happen at the same time");
  await expect(review.locator("[data-outcome=still_held]")).toHaveCount(2);
  await expect(review.locator("[data-correctness=correct]")).toHaveCount(2);
  await review.getByText("Message by message").click();
  await expect(review).toContainText("Pip changed its mind");
  // The scripted learner's cards don't show for the AI learner.
  await expect(page.getByText("From Pip’s script")).toHaveCount(0);
});
