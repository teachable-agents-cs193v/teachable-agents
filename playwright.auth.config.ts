// Browser tests for login, signup and logout (`npm run test:e2e:auth`). Kept
// separate from playwright.config.ts so the student-flow tests are unaffected.
// The server needs Postgres's binaries (initdb, postgres) and starts its own
// throwaway database and a mock breach API; see e2e-auth/server.mts.
import { defineConfig } from "@playwright/test";
import { APP_PORT, APP_URL, MOCK_PORT, PASSWORDS, SERVER_LOG, sha1 } from "./e2e-auth/fixtures";

export default defineConfig({
  testDir: "./e2e-auth",
  timeout: 60_000,
  // next dev compiles pages on first visit, which can take several seconds.
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: APP_URL, trace: "retain-on-failure" },
  webServer: {
    command: "node e2e-auth/server.mts",
    url: `${APP_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Let server.mts stop Postgres and delete its temp directory before exiting.
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    env: {
      E2E_APP_PORT: String(APP_PORT),
      E2E_MOCK_PORT: String(MOCK_PORT),
      E2E_BREACHED_PREFIX: sha1(PASSWORDS.breached).slice(0, 5),
      E2E_BREACHED_SUFFIX: sha1(PASSWORDS.breached).slice(5),
      E2E_UNAVAILABLE_PREFIX: sha1(PASSWORDS.breachCheckDown).slice(0, 5),
      E2E_SERVER_LOG: SERVER_LOG,
    },
  },
});
