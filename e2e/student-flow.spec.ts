import { expect, test } from "@playwright/test";
import { signUpTestStudent } from "../e2e-auth/signIn";

// Teaching pages require a login: each test starts as a fresh, logged-in student.
test.beforeEach(async ({ page, baseURL }) => signUpTestStudent(page, baseURL));

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

  // Meet Pip, write a pre-session explanation, start with the offline demo Pip.
  await expect(page).toHaveURL(/\/learner\/independence-vs-mutual-exclusivity$/);
  await page.getByLabel(/Before you start/).fill("Independent means the events don't affect each other.");
  await page.getByRole("button", { name: "Use the offline demo Pip instead" }).click();

  // Workspace: Pip opens the conversation, and the page says nothing leaves the server.
  await expect(page).toHaveURL(/\/teach\/session_/);
  const log = page.getByRole("log");
  await expect(log.locator("[data-role=learner]").first()).toContainText("independent", { timeout: 10_000 });
  await expect(page.getByTestId("data-line")).toHaveAttribute("data-mode", "offline");
  await expect(page.getByTestId("data-line")).toContainText("nothing you type leaves our server");

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

  // Delete it from the dashboard: the confirmation says what goes, and "Keep it" keeps it.
  await page.goto("/sessions");
  const remove = page.getByRole("button", { name: "Delete session: Independence vs. Mutual Exclusivity" });
  await remove.click();
  const confirm = page.getByRole("group", { name: "Confirm deleting the session" });
  await expect(confirm).toContainText("permanently removes it from our database");
  await confirm.getByRole("button", { name: "Keep it" }).click();
  await expect(confirm).toHaveCount(0);
  await remove.click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByRole("heading", { name: "Nothing taught yet." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nothing taught yet." })).toBeVisible();
});

test("the start screen says where your words go, and remembers the last choice", async ({ page }) => {
  await page.goto("/learner/independence-vs-mutual-exclusivity");
  const card = page.getByTestId("ai-choice");
  await expect(card.getByRole("heading", { name: "Where your words go" })).toBeVisible();
  // The first time, the whole card is open: what's sent, what isn't, what Groq does, what we keep.
  await expect(card.getByText("Sent to Groq", { exact: true })).toBeVisible();
  await expect(card.getByText(/name, email and account aren.t sent/)).toBeVisible();
  await expect(card.getByText(/up to 30 days/)).toBeVisible();
  await expect(card.getByText(/delete it from My sessions/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Teach AI Pip" })).toBeVisible();

  // Full details: the complete explanation, with Groq's own pages.
  await card.getByRole("link", { name: "Full details" }).click();
  await expect(page).toHaveURL(/\/ai-data$/);
  await expect(page.getByRole("heading", { name: "What we never send" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Groq Services Agreement/ })).toHaveAttribute("href", "https://console.groq.com/docs/legal/services-agreement");

  // Choose the offline demo; next time the card is one line, with that choice highlighted.
  await page.goto("/learner/independence-vs-mutual-exclusivity");
  await page.getByRole("button", { name: "Use the offline demo Pip instead" }).click();
  await expect(page).toHaveURL(/\/teach\/session_/);
  await page.goto("/learner/independence-vs-mutual-exclusivity");
  await expect(card).toContainText("Last time you used the offline demo Pip");
  await expect(card.getByText("Sent to Groq", { exact: true })).toBeHidden();
  await card.getByText("What's sent, and what isn't").click();
  await expect(card.getByText("Sent to Groq", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Use the offline demo Pip instead" })).toHaveClass(/bg-forest/);
  await expect(card.getByRole("button", { name: "Teach AI Pip" })).not.toHaveClass(/bg-forest/);
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

test("the choice card and the details page fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ["/learner/independence-vs-mutual-exclusivity", "/ai-data"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  }
  await page.goto("/learner/independence-vs-mutual-exclusivity");
  for (const name of ["Teach AI Pip", "Use the offline demo Pip instead"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  }
});
