// Ported from Anahi's A10 tests/unit/pwned.test.mjs. fetch is always mocked,
// so these never touch the network.
import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreachCheckUnavailable, clearPwnedCache, isPwned } from "../pwned";

// Test-only passwords; none of these is anyone's real password.
const BREACHED = "test-only-breached-passphrase-1";
const CLEAN = "test-only-clean-passphrase-2";
const sha1 = (s: string) => crypto.createHash("sha1").update(s).digest("hex").toUpperCase();

// A fake range response: some unrelated suffixes, plus whatever is passed in.
const fakeRange = (...lines: string[]) =>
  ["0018A45C4D1DEF81644B54AB7F969B88D65:3", "00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0", ...lines].join("\r\n");

function mockFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  return { calls, fetchImpl };
}
const ok = (body: string) => new Response(body, { status: 200 });

beforeEach(() => clearPwnedCache());
afterEach(() => vi.unstubAllEnvs());

describe("isPwned", () => {
  it("reports a breached password as pwned", async () => {
    const hash = sha1(BREACHED);
    const { fetchImpl } = mockFetch(() => ok(fakeRange(`${hash.slice(5)}:42`)));
    expect(await isPwned(BREACHED, { fetchImpl })).toBe(true);
  });

  it("reports a password that isn't in the range as not pwned", async () => {
    const { fetchImpl } = mockFetch(() => ok(fakeRange()));
    expect(await isPwned(CLEAN, { fetchImpl })).toBe(false);
  });

  it("doesn't count a padding entry (count 0) as a breach", async () => {
    const hash = sha1(CLEAN);
    const { fetchImpl } = mockFetch(() => ok(fakeRange(`${hash.slice(5)}:0`)));
    expect(await isPwned(CLEAN, { fetchImpl })).toBe(false);
  });

  it("sends only the 5-character hash prefix, with padding requested", async () => {
    const hash = sha1(CLEAN);
    const { calls, fetchImpl } = mockFetch(() => ok(fakeRange()));
    await isPwned(CLEAN, { fetchImpl });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    const headers = init.headers as Record<string, string>;
    expect(headers["Add-Padding"]).toBe("true");
    const sent = JSON.stringify({ url, headers });
    expect(sent).not.toContain(CLEAN);
    expect(sent).not.toContain(hash.slice(5));
    expect(sent.toLowerCase()).not.toContain(hash.toLowerCase());
  });

  it("uses PWNED_PASSWORDS_API_URL when set (for a local mock)", async () => {
    vi.stubEnv("PWNED_PASSWORDS_API_URL", "http://127.0.0.1:9/range/");
    const { calls, fetchImpl } = mockFetch(() => ok(fakeRange()));
    await isPwned(CLEAN, { fetchImpl });
    expect(calls[0].url).toBe(`http://127.0.0.1:9/range/${sha1(CLEAN).slice(0, 5)}`);
  });

  it("serves repeat checks for the same prefix from the cache", async () => {
    const { calls, fetchImpl } = mockFetch(() => ok(fakeRange()));
    await isPwned(CLEAN, { fetchImpl });
    await isPwned(CLEAN, { fetchImpl });
    await Promise.all([isPwned(BREACHED, { fetchImpl }), isPwned(BREACHED, { fetchImpl })]);
    // One request for CLEAN's prefix, one shared by the two simultaneous BREACHED checks.
    expect(calls).toHaveLength(sha1(CLEAN).slice(0, 5) === sha1(BREACHED).slice(0, 5) ? 1 : 2);
  });

  it("doesn't cache failures", async () => {
    let fail = true;
    const { calls, fetchImpl } = mockFetch(() => (fail ? new Response("", { status: 500 }) : ok(fakeRange())));
    await expect(isPwned(CLEAN, { fetchImpl })).rejects.toBeInstanceOf(BreachCheckUnavailable);
    fail = false;
    expect(await isPwned(CLEAN, { fetchImpl })).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it.each([
    ["network failure", () => Promise.reject(new TypeError("fetch failed"))],
    ["non-200 status", () => new Response("rate limited", { status: 429 })],
    ["malformed body", () => ok("<html>not a range response</html>")],
    ["partly malformed body", () => ok(fakeRange("NOTHEX:1"))],
    ["empty body", () => ok("")],
  ] as const)("fails closed with BreachCheckUnavailable on a %s", async (_name, respond) => {
    const { fetchImpl } = mockFetch(respond);
    await expect(isPwned(CLEAN, { fetchImpl })).rejects.toBeInstanceOf(BreachCheckUnavailable);
  });

  it("times out a request that hangs, and fails closed", async () => {
    // Never resolves until aborted, like an unresponsive API.
    const fetchImpl = (_url: string, { signal }: RequestInit) =>
      new Promise<Response>((_, reject) => signal!.addEventListener("abort", () => reject(signal!.reason)));
    const started = Date.now();
    const err = await isPwned(CLEAN, { fetchImpl, timeoutMs: 50 }).catch((e) => e);
    expect(err).toBeInstanceOf(BreachCheckUnavailable);
    expect(err.message).toBe("timed out");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("never puts the password or its hash in error messages", async () => {
    const hash = sha1(CLEAN);
    const { fetchImpl } = mockFetch(() => ok("garbage"));
    const err = await isPwned(CLEAN, { fetchImpl }).catch((e) => e);
    for (const s of [CLEAN, hash, hash.slice(0, 5), hash.slice(5)]) expect(String(err.stack)).not.toContain(s);
  });
});
