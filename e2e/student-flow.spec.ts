import { expect, test } from "@playwright/test";

/**
 * Walks the complete student journey against the scripted demo learner:
 * landing → library → meet Pip → teach → end → reflect → sessions dashboard → review.
 */
test("a student can teach Pip and reflect on the session", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The best way to learn is to teach." })).toBeVisible();

  await page.getByRole("link", { name: "Start Teaching" }).first().click();
  await expect(page).toHaveURL(/\/topics$/);

  // Filter, then pick the featured probability topic.
  await page.getByRole("button", { name: /^Probability/ }).click();
  await expect(page.getByRole("heading", { name: "Independence vs. Mutual Exclusivity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Supply and Demand" })).toHaveCount(0);
  await page.getByRole("link", { name: "Teach This Topic" }).click();

  // Meet Pip, write a pre-session explanation, start.
  await expect(page).toHaveURL(/\/learner\/independence-vs-mutual-exclusivity$/);
  await page.getByLabel(/Before you start/).fill("Independent means the events don't affect each other.");
  await page.getByRole("button", { name: "Start Teaching" }).click();

  // Workspace: Pip opens the conversation.
  await expect(page).toHaveURL(/\/teach\/session_/);
  const log = page.getByRole("log");
  await expect(log.locator("[data-role=learner]").first()).toContainText("independent", { timeout: 10_000 });

  const composer = page.getByLabel("Your message to Pip");
  const sendButton = page.getByRole("button", { name: "Send message" });

  // Empty submissions are blocked.
  await expect(sendButton).toBeDisabled();

  // Send a reply with Enter; Pip answers with the scripted misconception.
  await composer.fill("Independence means one event happening doesn't change the probability of the other.");
  await composer.press("Enter");
  await expect(log.locator("[data-role=student]")).toHaveCount(1);
  await expect(log.locator("[data-role=learner]").nth(1)).toContainText("can't happen at the same time", { timeout: 10_000 });

  // Shift+Enter inserts a newline instead of sending.
  await composer.fill("Line one");
  await composer.press("Shift+Enter");
  await composer.type("Line two");
  await expect(composer).toHaveValue("Line one\nLine two");
  await sendButton.click();
  await expect(log.locator("[data-role=student]")).toHaveCount(2);
  await expect(log.locator("[data-role=learner]")).toHaveCount(3, { timeout: 10_000 });

  // The session survives a reload.
  await page.reload();
  await expect(page.getByRole("log").locator("[data-role=student]")).toHaveCount(2);

  // End the session and reflect.
  await page.getByRole("button", { name: "End Session" }).click();
  await page.getByRole("button", { name: "Yes, end session" }).click();
  await expect(page).toHaveURL(/\/reflect\/session_/);
  await expect(page.getByRole("heading", { name: "You taught Pip." })).toBeVisible();
  await expect(page.getByText("Independent events cannot happen at the same time")).toBeVisible();

  // Validation blocks an empty reflection.
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();

  await page.getByLabel("Explain one key concept without notes").fill("Check whether P(A and B) equals P(A) times P(B).");
  await page.getByRole("radio", { name: /4/ }).check({ force: true });
  await page.getByLabel("What was hardest to explain?").fill("Why mutually exclusive events are dependent.");
  await page.getByRole("radio", { name: "Yes" }).check({ force: true });
  await page.getByPlaceholder("What did you notice?").fill("I had never checked independence with numbers before.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByRole("heading", { name: "Reflection saved." })).toBeVisible();

  // Dashboard lists the completed session and review shows the transcript + reflection.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My sessions" }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Review" }).first().click();
  await expect(page).toHaveURL(/\/sessions\/session_/);
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText("Check whether P(A and B) equals P(A) times P(B).")).toBeVisible();
});

test("the sessions dashboard shows an empty state for new students", async ({ page }) => {
  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Nothing taught yet." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse the library/ })).toBeVisible();
});

test("unknown topics and sessions get friendly not-found states", async ({ page }) => {
  await page.goto("/learner/not-a-topic");
  await expect(page.getByRole("heading", { name: /isn.t in the library/ })).toBeVisible();

  await page.goto("/teach/session_missing");
  await expect(page.getByRole("heading", { name: /couldn.t find that session/ })).toBeVisible();
});
