import { defineConfig } from "@playwright/test";
import { authTestServer } from "./e2e-auth/webServer";

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
  // Pages need a logged-in student now, so the server includes a throwaway database.
  webServer: authTestServer({ appPort: PORT, mockPort: 3213 }),
});
