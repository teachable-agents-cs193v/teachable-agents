// Regression test: getCurrentUser() must read the request before creating the
// auth instance. During `next build`, headers() throws to mark a page as
// per-request; if getAuth() ran first, the build would instead crash on the
// missing secret/database (seen on /sessions when protecting pages, #16).
import { expect, it, vi } from "vitest";
import { getAuth } from "../auth";
import { getCurrentUser } from "../server";

vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error("headers() called during prerender");
  },
}));
vi.mock("../auth", () => ({ getAuth: vi.fn() }));

it("reads the request headers before creating the auth instance", async () => {
  await expect(getCurrentUser()).rejects.toThrow("headers() called during prerender");
  expect(vi.mocked(getAuth)).not.toHaveBeenCalled();
});
