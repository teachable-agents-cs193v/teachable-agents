import { defineConfig } from "@playwright/test";

const PORT = 3210;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    // Run against a production build rather than `next dev`: dev compiles each
    // route on first visit and can live-reload the page mid-test, which made
    // the student flow flaky on a cold `.next` (#30).
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
