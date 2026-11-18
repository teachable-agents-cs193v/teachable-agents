// The Playwright `webServer` for any browser tests that need auth: a throwaway
// Postgres, a mock Pwned Passwords API and Next (see server.mts). Shared by
// playwright.auth.config.ts (`next dev`) and playwright.config.ts (student flow,
// which opts into a production build with `production: true`; see #30).
import type { PlaywrightTestConfig } from "@playwright/test";
import { PASSWORDS, serverLogFor, sha1 } from "./fixtures";

export function authTestServer({
  appPort,
  mockPort,
  production = false,
}: {
  appPort: number;
  mockPort: number;
  /** Run `next build` then `next start` instead of `next dev`. Turns on Better Auth's rate limit. */
  production?: boolean;
}) {
  return {
    command: "node e2e-auth/server.mts",
    url: `http://localhost:${appPort}/login`,
    reuseExistingServer: false,
    // The production build takes about half a minute on the course container.
    timeout: production ? 300_000 : 180_000,
    // Let server.mts stop Postgres and delete its temp directory before exiting.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    env: {
      E2E_APP_PORT: String(appPort),
      E2E_MOCK_PORT: String(mockPort),
      E2E_PRODUCTION_BUILD: production ? "1" : "0",
      E2E_BREACHED_PREFIX: sha1(PASSWORDS.breached).slice(0, 5),
      E2E_BREACHED_SUFFIX: sha1(PASSWORDS.breached).slice(5),
      E2E_UNAVAILABLE_PREFIX: sha1(PASSWORDS.breachCheckDown).slice(0, 5),
      E2E_SERVER_LOG: serverLogFor(appPort),
    },
  } satisfies PlaywrightTestConfig["webServer"];
}
