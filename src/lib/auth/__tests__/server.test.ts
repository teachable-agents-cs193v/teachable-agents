// getCurrentUser / requireUser / requireApiUser against real sessions in the
// throwaway Postgres. next/headers is mocked to supply each test's cookie.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/lib/db/pool";
import { safeNextPath } from "../nextPath";
import { getCurrentUser, requireApiUser, requireUser } from "../server";
import { callAuth, hasDb, sessionCookie, signUp } from "./testHelpers";

vi.mock("../pwned", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pwned")>()),
  isPwned: vi.fn(async () => false),
}));

let requestCookie: string | undefined;
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestCookie ? { cookie: requestCookie } : {}),
}));
beforeEach(() => {
  requestCookie = undefined;
});

/** Next's redirect() throws an error whose digest is "NEXT_REDIRECT;<type>;<url>;<status>". */
async function redirectTarget(fn: () => Promise<unknown>): Promise<string | undefined> {
  const err: { digest?: string } | undefined = await fn().then(
    () => undefined,
    (e) => e,
  );
  return err?.digest?.split(";")[2];
}

describe.skipIf(!hasDb)("with a valid session", () => {
  it("all three helpers return the same AuthUser", async () => {
    const { res, email } = await signUp({ name: "Avery Kim" });
    requestCookie = sessionCookie(res);
    const expected = { id: expect.any(String), email, name: "Avery Kim" };
    expect(await getCurrentUser()).toEqual(expected);
    expect(await requireUser("/teach/abc")).toEqual(expected);
    expect(await requireApiUser()).toEqual(expected);
  });
});

describe.skipIf(!hasDb)("without a valid session", () => {
  const cases: [string, () => Promise<string | undefined>][] = [
    ["no cookie", async () => undefined],
    [
      "a forged token",
      async () => {
        // Use the real cookie name, with a made-up token and signature.
        const name = sessionCookie((await signUp()).res).split("=")[0];
        return `${name}=forged-token.forged-signature`;
      },
    ],
    [
      "a tampered signature",
      async () => {
        const cookie = sessionCookie((await signUp()).res);
        return cookie.slice(0, -3) + (cookie.endsWith("AAA") ? "BBB" : "AAA");
      },
    ],
    [
      "an expired session",
      async () => {
        const { res, email } = await signUp();
        await getPool().query(
          `UPDATE auth_session SET "expiresAt" = now() - interval '1 day'
           WHERE "userId" = (SELECT id FROM users WHERE email = $1)`,
          [email],
        );
        return sessionCookie(res);
      },
    ],
    [
      "a revoked session (after logout)",
      async () => {
        const cookie = sessionCookie((await signUp()).res);
        await callAuth("/sign-out", { body: {}, cookie });
        return cookie;
      },
    ],
  ];

  it.each(cases)("treats %s as logged out", async (_name, makeCookie) => {
    requestCookie = await makeCookie();
    expect(await getCurrentUser()).toBeNull();

    const res = (await requireApiUser()) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Not logged in." });

    expect(await redirectTarget(() => requireUser("/teach/abc"))).toBe("/login?next=%2Fteach%2Fabc");
  });

  it("redirects to plain /login when the next path isn't a safe relative path", async () => {
    for (const bad of ["//evil.example", "https://evil.example/x", "/\\evil.example", "/\t/evil.example", "evil", undefined]) {
      expect(await redirectTarget(() => requireUser(bad))).toBe("/login");
    }
  });
});

describe("safeNextPath", () => {
  it("allows same-site relative paths only", () => {
    expect(safeNextPath("/sessions?tab=done")).toBe("/sessions?tab=done");
    expect(safeNextPath("/teach/abc#end")).toBe("/teach/abc#end");
    // Percent-encoded slashes stay a same-site path.
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    // Dot segments are resolved, and the result is returned normalized.
    expect(safeNextPath("/a/../sessions")).toBe("/sessions");
    const bad = [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "/\t/evil.example", // browsers strip tabs: becomes //evil.example
      "/\n/evil.example",
      "/\r/evil.example",
      "/\t\\evil.example",
      "/..//evil.example", // normalizes to //evil.example
      "/a/..//evil.example",
      "/\u0000/evil.example",
      "javascript:alert(1)",
      "evil.example",
      "",
      null,
      undefined,
    ];
    for (const value of bad) expect(safeNextPath(value), JSON.stringify(value)).toBeUndefined();
  });
});
