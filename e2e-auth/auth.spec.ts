// Login, signup and logout in a real browser, against e2e-auth/server.mts
// (throwaway Postgres, mock Pwned Passwords API, next dev).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { MOCK_URL, PASSWORDS, SERVER_LOG, sha1 } from "./fixtures";

const uniqueEmail = () => `student-${randomUUID()}@example.com`;

async function fillSignup(page: Page, { name = "Jordan Lee", email = uniqueEmail(), password = PASSWORDS.strong } = {}) {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  return email;
}

async function signUp(page: Page, opts: Parameters<typeof fillSignup>[1] = {}) {
  await page.goto("/signup");
  const email = await fillSignup(page, opts);
  await page.getByRole("button", { name: "Sign up" }).click();
  return email;
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
// The forms' own error boxes (Next also renders an empty role="alert" route announcer).
const loginError = (page: Page) => page.locator("#login-error");
const signupError = (page: Page) => page.locator("#signup-error");

// next dev compiles each route on first use; do that once up front.
test.beforeAll(async ({ request }) => {
  for (const path of ["/", "/login", "/signup", "/topics", "/sessions", "/api/auth/get-session"]) await request.get(path);
});

test.describe("signup, logout and login", () => {
  test("a new student can sign up, log out and log back in", async ({ page }) => {
    const email = await signUp(page);
    await expect(page).toHaveURL(/\/topics$/);
    await expect(nav(page).getByTestId("auth-greeting")).toHaveText("Hi, Jordan");

    await nav(page).getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(nav(page).getByRole("link", { name: "Log in" })).toBeVisible();

    await nav(page).getByRole("link", { name: "Log in" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORDS.strong);
    await page.getByRole("button", { name: "Log in" }).click();
    // The Navbar's "Log in" link carries the current page (home), so login returns there.
    await expect(page).toHaveURL(/localhost:3211\/$/);
    await expect(nav(page).getByTestId("auth-greeting")).toHaveText("Hi, Jordan");
  });

  test("a wrong password shows one generic error and stays logged out", async ({ page }) => {
    const email = await signUp(page);
    await expect(page).toHaveURL(/\/topics$/);
    await nav(page).getByRole("button", { name: "Log out" }).click();
    await expect(nav(page).getByRole("link", { name: "Log in" })).toBeVisible();

    for (const [who, password] of [
      [email, "not-the-right-password-42"],
      [uniqueEmail(), PASSWORDS.strong],
    ]) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(who);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(loginError(page)).toHaveText("That email and password don't match an account.");
      await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(nav(page).getByRole("link", { name: "Log in" })).toBeVisible();
  });
});

test.describe("password policy in the signup form", () => {
  test("shows live strength feedback while typing", async ({ page }) => {
    await page.goto("/signup");
    const field = page.getByLabel("Password", { exact: true });
    await field.fill(PASSWORDS.weak);
    await expect(page.getByTestId("password-strength")).toHaveText(/Very weak|Weak/);
    await field.fill(PASSWORDS.strong);
    await expect(page.getByTestId("password-strength")).toHaveText(/Strong|Very strong/);
  });

  test("a weak password is rejected with tips and no account is created", async ({ page }) => {
    const email = await signUp(page, { password: PASSWORDS.weak });
    const alert = signupError(page);
    await expect(alert).toContainText("too easy to guess");
    await expect(alert.getByRole("listitem").first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);

    // No account: logging in with that email fails.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORDS.weak);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(loginError(page)).toHaveText("That email and password don't match an account.");
  });

  test("a breached password is explained and rejected", async ({ page }) => {
    await signUp(page, { password: PASSWORDS.breached });
    await expect(signupError(page)).toContainText("known data breach");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("if the breach check is down, signup fails closed with a try-again message", async ({ page }) => {
    await signUp(page, { password: PASSWORDS.breachCheckDown });
    await expect(signupError(page)).toContainText("your account wasn't created");
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("an email that's already registered offers to log in instead", async ({ browser }) => {
    const first = await browser.newPage();
    const email = await signUp(first);
    await expect(first).toHaveURL(/\/topics$/);
    await first.close();

    const page = await browser.newPage();
    await signUp(page, { email });
    await expect(signupError(page)).toContainText("already exists");
    await page.getByRole("link", { name: "Log in instead?" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.close();
  });
});

test.describe("redirects", () => {
  test("login returns the student to a safe next path, and ignores an off-site one", async ({ browser }) => {
    const setup = await browser.newPage();
    const email = await signUp(setup);
    await expect(setup).toHaveURL(/\/topics$/);
    await setup.close();

    for (const [next, expected] of [
      ["/sessions", /\/sessions$/],
      ["//evil.example", /\/topics$/],
      ["/\t/evil.example", /\/topics$/], // a browser would strip the tab: //evil.example
    ] as const) {
      const page = await browser.newPage();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(PASSWORDS.strong);
      await page.getByRole("button", { name: "Log in" }).click();
      await expect(page).toHaveURL(expected);
      expect(new URL(page.url()).host).toBe("localhost:3211");
      await page.close();
    }
  });

  test("a logged-in student visiting /login or /signup is sent on", async ({ page }) => {
    await signUp(page);
    await expect(page).toHaveURL(/\/topics$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/topics$/);
    await page.goto("/signup?next=%2Fsessions");
    await expect(page).toHaveURL(/\/sessions$/);
  });
});

test.describe("form behaviour", () => {
  test("double-clicking Log in sends one request", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/auth/sign-in/email")) requests.push(r.url());
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("not-the-right-password-42");
    await page.getByRole("button", { name: "Log in" }).dblclick();
    await expect(loginError(page)).toBeVisible();
    expect(requests).toHaveLength(1);
  });

  test("the mobile menu has the same controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/topics");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.locator("#mobile-nav");
    await expect(menu.getByRole("link", { name: "Log in" })).toBeVisible();
    await menu.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup\?next=%2Ftopics$/);
  });
});

test.describe("privacy", () => {
  test("the breach API only ever received 5-character hash prefixes, with padding", async ({ request }) => {
    const received: { url: string; padding?: string }[] = await (await request.get(`${MOCK_URL}/__requests`)).json();
    expect(received.length).toBeGreaterThan(0);
    for (const r of received) {
      expect(r.url).toMatch(/^\/range\/[0-9A-F]{5}$/);
      expect(r.padding).toBe("true");
    }
    // The weak password never reached the breach check.
    expect(received.map((r) => r.url)).not.toContain(`/range/${sha1(PASSWORDS.weak).slice(0, 5)}`);
  });

  test("the server log contains no test password or password hash", () => {
    const log = readFileSync(SERVER_LOG, "utf8");
    expect(log.length).toBeGreaterThan(0);
    for (const pw of Object.values(PASSWORDS)) {
      expect(log).not.toContain(pw);
      expect(log).not.toContain(sha1(pw));
    }
  });
});
