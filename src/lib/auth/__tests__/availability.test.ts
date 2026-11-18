import { afterEach, describe, expect, it, vi } from "vitest";
import { authAvailable, authUnavailableResponse } from "../availability";

afterEach(() => vi.unstubAllEnvs());

describe("authAvailable", () => {
  it("is false in development without a DATABASE_URL, with one warning", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(authAvailable()).toBe(false);
    expect(authAvailable()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("is true whenever a DATABASE_URL is set", () => {
    vi.stubEnv("DATABASE_URL", "postgres://postgres@127.0.0.1:1/postgres");
    vi.stubEnv("NODE_ENV", "development");
    expect(authAvailable()).toBe(true);
  });

  it("never hides a missing database in production", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(authAvailable()).toBe(true); // so getAuth() runs and fails loudly
  });
});

describe("authUnavailableResponse", () => {
  it("reports nobody logged in to the session check", async () => {
    const res = authUnavailableResponse(new Request("http://localhost:3000/api/auth/get-session"));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("refuses everything else with 503 auth_unavailable", async () => {
    const res = authUnavailableResponse(new Request("http://localhost:3000/api/auth/sign-in/email", { method: "POST" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("auth_unavailable");
  });
});
