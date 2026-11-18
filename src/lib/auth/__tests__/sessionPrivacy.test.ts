// Session rows don't keep the IP address or user agent, and login rate limiting
// (which reads the IP from the request) still works. Uses the throwaway Postgres
// from test/postgres.globalSetup.ts.
import { betterAuth } from "better-auth";
import { describe, expect, it, vi } from "vitest";
import { getPool } from "@/lib/db/pool";
import { authOptions } from "../auth";
import { PASSWORD, callAuth, hasDb, signUp, uniqueEmail } from "./testHelpers";

vi.mock("../pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pwned")>()),
  isPwned: vi.fn(async () => false),
}));

// What a real browser behind Vercel would send; both would be stored without the hook.
const CLIENT_HEADERS = { "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (test browser)" };

async function sessionRows(email: string) {
  const { rows } = await getPool().query<{ ipAddress: string | null; userAgent: string | null }>(
    `SELECT s."ipAddress", s."userAgent" FROM auth_session s JOIN users u ON u.id = s."userId" WHERE u.email = $1`,
    [email],
  );
  return rows;
}

describe.skipIf(!hasDb)("auth_session privacy", () => {
  it("stores null ipAddress and userAgent for the session created at signup", async () => {
    const email = uniqueEmail();
    const res = await callAuth("/sign-up/email", {
      body: { email, password: PASSWORD, name: "Test Student" },
      extraHeaders: CLIENT_HEADERS,
    });
    expect(res.status).toBe(200);
    expect(await sessionRows(email)).toEqual([{ ipAddress: null, userAgent: null }]);
  });

  it("stores null ipAddress and userAgent for a session created at login", async () => {
    const { email } = await signUp();
    const res = await callAuth("/sign-in/email", { body: { email, password: PASSWORD }, extraHeaders: CLIENT_HEADERS });
    expect(res.status).toBe(200);
    const rows = await sessionRows(email);
    expect(rows).toHaveLength(2); // signup's session and login's
    expect(rows.every((r) => r.ipAddress === null && r.userAgent === null)).toBe(true);
  });
});

describe.skipIf(!hasDb)("login rate limiting with the session hook in place", () => {
  // Rate limiting is on by default only when NODE_ENV is production, so turn it on
  // explicitly here; everything else is the app's real config, hook included.
  const limitedAuth = () => betterAuth({ ...authOptions(), rateLimit: { enabled: true } });
  const wrongLogin = (auth: ReturnType<typeof limitedAuth>, email: string, ip: string) =>
    callAuth("/sign-in/email", { body: { email, password: "not-the-password" }, extraHeaders: { "x-forwarded-for": ip } }, auth);

  it("blocks the 4th login attempt within 10 seconds from one IP with 429", async () => {
    const auth = limitedAuth();
    const { email } = await signUp();
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await wrongLogin(auth, email, "198.51.100.10")).status);
    expect(statuses).toEqual([401, 401, 401, 429]);
  });

  it("still keys the limit by client IP, so another IP isn't blocked", async () => {
    const auth = limitedAuth();
    const { email } = await signUp();
    for (let i = 0; i < 4; i++) await wrongLogin(auth, email, "198.51.100.20");
    expect((await wrongLogin(auth, email, "198.51.100.20")).status).toBe(429);
    expect((await wrongLogin(auth, email, "198.51.100.21")).status).toBe(401);
  });
});
