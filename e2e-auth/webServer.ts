// The Playwright `webServer` for any browser tests that need auth: a throwaway
// Postgres, a mock Pwned Passwords API and `next dev` (see server.mts). Shared
// by playwright.auth.config.ts and playwright.config.ts (student flow).
import os from "node:os";
import path from "node:path";
import type { PlaywrightTestConfig } from "@playwright/test";
import { PASSWORDS, sha1 } from "./fixtures";

export function authTestServer({ appPort, mockPort }: { appPort: number; mockPort: number }) {
  const serverLog = path.join(os.tmpdir(), `teachable-e2e-server-${appPort}.log`);
  return {
    command: "node e2e-auth/server.mts",
    url: `http://localhost:${appPort}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Let server.mts stop Postgres and delete its temp directory before exiting.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    env: {
      E2E_APP_PORT: String(appPort),
      E2E_MOCK_PORT: String(mockPort),
      E2E_BREACHED_PREFIX: sha1(PASSWORDS.breached).slice(0, 5),
      E2E_BREACHED_SUFFIX: sha1(PASSWORDS.breached).slice(5),
      E2E_UNAVAILABLE_PREFIX: sha1(PASSWORDS.breachCheckDown).slice(0, 5),
      E2E_SERVER_LOG: serverLog,
    },
  } satisfies PlaywrightTestConfig["webServer"];
}
