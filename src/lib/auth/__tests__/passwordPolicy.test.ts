import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSignupPassword } from "../passwordPolicy";
import { BreachCheckUnavailable, isPwned } from "../pwned";

// The breach check is mocked, so these never touch the network.
vi.mock("../pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pwned")>()),
  isPwned: vi.fn(),
}));
const mockIsPwned = vi.mocked(isPwned);

// Test-only passwords; none of these is anyone's real password.
const STRONG = "lantern-quokka-marigold-zephyr";
const USER = { name: "Jordan Lee", email: "jordan.lee@example.com" };

afterEach(() => vi.resetAllMocks());

describe("checkSignupPassword", () => {
  it("accepts a strong password that isn't breached", async () => {
    mockIsPwned.mockResolvedValue(false);
    expect(await checkSignupPassword(STRONG, USER)).toEqual({ ok: true });
    expect(mockIsPwned).toHaveBeenCalledTimes(1);
  });

  it("rejects a weak password with 422 weak_password and feedback, without a breach lookup", async () => {
    const r = await checkSignupPassword("Password1", USER);
    expect(r).toMatchObject({ ok: false, status: 422, code: "weak_password" });
    if (r.ok || r.code !== "weak_password") throw new Error("expected weak_password");
    expect(r.score).toBeLessThan(3);
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(mockIsPwned).not.toHaveBeenCalled();
  });

  it("counts the user's own name and email against the password", async () => {
    const r = await checkSignupPassword("jordanlee2026!", USER);
    expect(r).toMatchObject({ ok: false, code: "weak_password" });
    expect(mockIsPwned).not.toHaveBeenCalled();
  });

  it("rejects a breached password with 422 breached_password", async () => {
    mockIsPwned.mockResolvedValue(true);
    expect(await checkSignupPassword(STRONG, USER)).toMatchObject({ ok: false, status: 422, code: "breached_password" });
  });

  it("fails closed with 503 breach_check_unavailable when the check can't complete", async () => {
    mockIsPwned.mockRejectedValue(new BreachCheckUnavailable("timed out"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await checkSignupPassword(STRONG, USER);
    expect(r).toMatchObject({ ok: false, status: 503, code: "breach_check_unavailable" });
    // The log line names the failure, never the password.
    expect(JSON.stringify(log.mock.calls)).not.toContain(STRONG);
  });

  it("rethrows unexpected errors instead of treating them as a pass", async () => {
    mockIsPwned.mockRejectedValue(new Error("bug"));
    await expect(checkSignupPassword(STRONG, USER)).rejects.toThrow("bug");
  });

  it("never includes the password in any result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const results: [string, unknown][] = [
      ["short", await checkSignupPassword("short", USER)],
      ["Password1", await checkSignupPassword("Password1", USER)],
    ];
    mockIsPwned.mockResolvedValue(true);
    results.push([STRONG, await checkSignupPassword(STRONG, USER)]);
    mockIsPwned.mockRejectedValue(new BreachCheckUnavailable("network error"));
    results.push([STRONG, await checkSignupPassword(STRONG, USER)]);
    for (const [pw, r] of results) expect(JSON.stringify(r).toLowerCase()).not.toContain(pw.toLowerCase());
  });
});
