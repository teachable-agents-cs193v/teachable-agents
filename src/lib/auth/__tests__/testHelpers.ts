import { randomUUID } from "node:crypto";
import { getAuth } from "../auth";

/** True only when test/postgres.globalSetup.ts started a throwaway database. */
export const hasDb = process.env.TEST_THROWAWAY_DB === "1";

// Test-only password: strong enough for zxcvbn; the breach check is mocked in each file.
export const PASSWORD = "lantern-quokka-marigold-zephyr";

const ORIGIN = "http://localhost:3000";

/** A unique email per test, so test files can share the throwaway database. */
export const uniqueEmail = () => `student-${randomUUID()}@example.com`;

/** Calls a Better Auth endpoint through its real request handler. */
export async function callAuth(path: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = { origin: ORIGIN };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  return getAuth().handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

/** The session cookie from a response, as a `name=value` pair to send back. */
export function sessionCookie(res: Response): string {
  const cookie = res.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!cookie) throw new Error("no session cookie in response");
  return cookie.split(";")[0];
}

export async function signUp({ email = uniqueEmail(), password = PASSWORD, name = "Test Student" } = {}) {
  const res = await callAuth("/sign-up/email", { body: { email, password, name } });
  return { res, email };
}
