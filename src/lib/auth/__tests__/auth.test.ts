// Signup, login and logout through Better Auth's real handler, against the
// throwaway Postgres from test/postgres.globalSetup.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/lib/db/pool";
import { assertUsableSecret } from "../auth";
import { BreachCheckUnavailable, isPwned } from "../pwned";
import { PASSWORD, callAuth, hasDb, sessionCookie, signUp, uniqueEmail } from "./testHelpers";

vi.mock("../pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pwned")>()),
  isPwned: vi.fn(async () => false),
}));
const mockIsPwned = vi.mocked(isPwned);
afterEach(() => mockIsPwned.mockReset().mockResolvedValue(false));

const userCount = async (email: string) =>
  Number((await getPool().query("SELECT count(*) FROM users WHERE email = $1", [email.toLowerCase()])).rows[0].count);

describe.skipIf(!hasDb)("signup", () => {
  it("creates the user, stores the email lowercased, and starts a session", async () => {
    const email = uniqueEmail().replace("student", "Student");
    const { res } = await signUp({ email });
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/session_token=/);
    // userCount looks the row up by the lowercased email, so this also checks it was stored lowercased.
    expect(await userCount(email)).toBe(1);
  });

  it("never stores the password in plaintext", async () => {
    const { email } = await signUp();
    const { rows } = await getPool().query(
      `SELECT a.password FROM auth_account a JOIN users u ON u.id = a."userId" WHERE u.email = $1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    // Compare without printing the hash: only booleans reach the test output.
    expect(String(rows[0].password).includes(PASSWORD)).toBe(false);
  });

  it("rejects a weak password with 422 weak_password and creates no user", async () => {
    const email = uniqueEmail();
    const { res } = await signUp({ email, password: "Password1" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("weak_password");
    expect(body.message).toMatch(/harder to guess/);
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body).not.toHaveProperty("ok");
    expect(body).not.toHaveProperty("status");
    expect(await userCount(email)).toBe(0);
    expect(mockIsPwned).not.toHaveBeenCalled();
  });

  it("counts the student's own name against the password", async () => {
    const email = uniqueEmail();
    const res = await callAuth("/sign-up/email", { body: { email, password: "jordanlee2026!", name: "Jordan Lee" } });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("weak_password");
    expect(await userCount(email)).toBe(0);
  });

  it("rejects a breached password with 422 breached_password and creates no user", async () => {
    mockIsPwned.mockResolvedValue(true);
    const email = uniqueEmail();
    const { res } = await signUp({ email });
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("breached_password");
    expect(await userCount(email)).toBe(0);
  });

  it("fails closed with 503 when the breach check can't complete, and creates no user", async () => {
    mockIsPwned.mockRejectedValue(new BreachCheckUnavailable("timed out"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const email = uniqueEmail();
    const { res } = await signUp({ email });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("breach_check_unavailable");
    expect(await userCount(email)).toBe(0);
    log.mockRestore();
  });

  it("enforces Better Auth's minimum length of 8", async () => {
    const email = uniqueEmail();
    const { res } = await signUp({ email, password: "Ab1!xyz" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await userCount(email)).toBe(0);
  });

  it("rejects a second signup with the same email", async () => {
    const { email } = await signUp();
    const { res } = await signUp({ email: email.toUpperCase() });
    expect(res.status).toBe(422);
    expect(await userCount(email)).toBe(1);
  });

  it("never echoes the password in a response", async () => {
    for (const [pw, isBreached] of [[PASSWORD, false], ["Password1", false], [PASSWORD, true]] as const) {
      mockIsPwned.mockResolvedValue(isBreached);
      const { res } = await signUp({ password: pw });
      expect((await res.text()).toLowerCase()).not.toContain(pw.toLowerCase());
    }
  });
});

describe.skipIf(!hasDb)("login", () => {
  it("logs in with the right password", async () => {
    const { email } = await signUp();
    const res = await callAuth("/sign-in/email", { body: { email, password: PASSWORD } });
    expect(res.status).toBe(200);
    expect(sessionCookie(res)).toMatch(/session_token=/);
  });

  it("gives a wrong password and an unknown email the same generic 401", async () => {
    const { email } = await signUp();
    const wrong = await callAuth("/sign-in/email", { body: { email, password: "not-the-right-password-42" } });
    const unknown = await callAuth("/sign-in/email", { body: { email: uniqueEmail(), password: PASSWORD } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    const [a, b] = [await wrong.json(), await unknown.json()];
    expect(a).toEqual(b);
    expect(wrong.headers.getSetCookie().some((c) => /session_token=[^;]/.test(c))).toBe(false);
  });
});

describe.skipIf(!hasDb)("change password", () => {
  it("applies the same password policy, so a weak new password is rejected", async () => {
    const { res } = await signUp();
    const cookie = sessionCookie(res);
    const change = (newPassword: string) =>
      callAuth("/change-password", { body: { currentPassword: PASSWORD, newPassword }, cookie });

    const weak = await change("Password1");
    expect(weak.status).toBe(422);
    expect((await weak.json()).code).toBe("weak_password");

    mockIsPwned.mockResolvedValue(true);
    const breached = await change("another-lantern-quokka-meadow-9");
    expect(breached.status).toBe(422);
    expect((await breached.json()).code).toBe("breached_password");

    mockIsPwned.mockResolvedValue(false);
    expect((await change("another-lantern-quokka-meadow-9")).status).toBe(200);
  });
});

describe.skipIf(!hasDb)("logout", () => {
  it("ends the session, so replaying the old cookie is logged out", async () => {
    const { res } = await signUp();
    const cookie = sessionCookie(res);
    expect((await (await callAuth("/get-session", { cookie })).json())?.user).toBeTruthy();

    const out = await callAuth("/sign-out", { body: {}, cookie });
    expect(out.status).toBe(200);
    expect(await (await callAuth("/get-session", { cookie })).json()).toBeNull();
  });
});

describe("assertUsableSecret", () => {
  it("rejects a missing, placeholder or short secret", () => {
    expect(() => assertUsableSecret(undefined)).toThrow(/not set/);
    expect(() => assertUsableSecret("replace-with-output-of-openssl-rand-base64-32")).toThrow(/placeholder/);
    expect(() => assertUsableSecret("too-short")).toThrow(/at least 32/);
  });

  it("accepts a long random-looking secret", () => {
    expect(() => assertUsableSecret("x".repeat(16) + "9f2c1a7e5b3d4c6a8e0f")).not.toThrow();
  });
});
