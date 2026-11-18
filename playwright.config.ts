import { defineConfig } from "@playwright/test";
import { authTestServer } from "./e2e-auth/webServer";

const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // Pages need a logged-in student now, so the server includes a throwaway database.
  // It serves a production build: `next dev` compiles each route on first visit and
  // can live-reload the page mid-test, which made the student flow flaky (#30).
  webServer: authTestServer({ appPort: PORT, mockPort: 3213, production: true }),
});
