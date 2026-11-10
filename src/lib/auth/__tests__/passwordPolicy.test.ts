import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, checkSignupPassword } from "../passwordPolicy";
import { BreachCheckUnavailable } from "../pwned";

// Test-only passwords; none of these is anyone's real password.
const STRONG = "lantern-quokka-marigold-zephyr";
const USER = { name: "Jordan Lee", email: "jordan.lee@example.com" };

const notPwned = vi.fn(async () => false);
const pwned = vi.fn(async () => true);
const unavailable = vi.fn(async (): Promise<boolean> => {
  throw new BreachCheckUnavailable("timed out");
});

afterEach(() => vi.clearAllMocks());

describe("checkSignupPassword", () => {
  it("accepts a strong password that isn't breached", async () => {
    expect(await checkSignupPassword(STRONG, USER, { isPwnedImpl: notPwned })).toEqual({ ok: true });
    expect(notPwned).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["too short", "x".repeat(MIN_PASSWORD_LENGTH - 1)],
    ["too long", "x".repeat(MAX_PASSWORD_LENGTH + 1)],
  ])("rejects a password that is %s with 400, before any other check", async (_name, password) => {
    const r = await checkSignupPassword(password, USER, { isPwnedImpl: notPwned });
    expect(r).toMatchObject({ ok: false, status: 400, code: "invalid_password_length" });
    expect(notPwned).not.toHaveBeenCalled();
  });

  it("rejects a weak password with 422 weak_password and feedback, without a breach lookup", async () => {
    const r = await checkSignupPassword("Password1", USER, { isPwnedImpl: notPwned });
    expect(r).toMatchObject({ ok: false, status: 422, code: "weak_password" });
    if (r.ok || r.code !== "weak_password") throw new Error("expected weak_password");
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(3);
    expect(notPwned).not.toHaveBeenCalled();
  });

  it("counts the user's own name and email against the password", async () => {
    const r = await checkSignupPassword("jordanlee2026!", USER, { isPwnedImpl: notPwned });
    expect(r).toMatchObject({ ok: false, code: "weak_password" });
  });

  it("rejects a breached password with 422 breached_password", async () => {
    const r = await checkSignupPassword(STRONG, USER, { isPwnedImpl: pwned });
    expect(r).toMatchObject({ ok: false, status: 422, code: "breached_password" });
  });

  it("fails closed with 503 breach_check_unavailable when the check can't complete", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await checkSignupPassword(STRONG, USER, { isPwnedImpl: unavailable });
    expect(r).toMatchObject({ ok: false, status: 503, code: "breach_check_unavailable" });
    // The log line names the failure, never the password.
    expect(JSON.stringify(log.mock.calls)).not.toContain(STRONG);
    log.mockRestore();
  });

  it("rethrows unexpected errors instead of treating them as a pass", async () => {
    const boom = vi.fn(async (): Promise<boolean> => {
      throw new Error("bug");
    });
    await expect(checkSignupPassword(STRONG, USER, { isPwnedImpl: boom })).rejects.toThrow("bug");
  });

  it("never includes the password in any result", async () => {
    const cases = [
      await checkSignupPassword("short", USER, { isPwnedImpl: notPwned }),
      await checkSignupPassword("Password1", USER, { isPwnedImpl: notPwned }),
      await checkSignupPassword(STRONG, USER, { isPwnedImpl: pwned }),
      await checkSignupPassword(STRONG, USER, { isPwnedImpl: unavailable }),
    ];
    const pw = ["short", "Password1", STRONG, STRONG];
    cases.forEach((r, i) => expect(JSON.stringify(r).toLowerCase()).not.toContain(pw[i].toLowerCase()));
  });
});
