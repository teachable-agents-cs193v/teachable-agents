// Browser tests for login, signup and logout (`npm run test:e2e:auth`). Kept
// separate from playwright.config.ts so the student-flow tests are unaffected.
// The server needs Postgres's binaries (initdb, postgres) and starts its own
// throwaway database and a mock breach API; see e2e-auth/server.mts.
import { defineConfig } from "@playwright/test";
import { APP_PORT, APP_URL, MOCK_PORT } from "./e2e-auth/fixtures";
import { authTestServer } from "./e2e-auth/webServer";

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
  webServer: authTestServer({ appPort: APP_PORT, mockPort: MOCK_PORT }),
});
