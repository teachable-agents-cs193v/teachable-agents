// Browser tests for the AI learner's panels (`npm run test:e2e:learning`): what
// Pip believes, the misconception tracker, the progress strip and the review.
// Pip is the AI learner here, answered by a local fake model (e2e-auth/fakeLlm.mts),
// so nothing calls a real provider. Kept separate from playwright.config.ts, whose
// student flow uses the scripted learner.
import { defineConfig } from "@playwright/test";
import { authTestServer } from "./e2e-auth/webServer";

const PORT = 3220;

export default defineConfig({
  testDir: "./e2e-learning",
  timeout: 90_000,
  // next dev compiles pages on first visit, which can take several seconds.
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // The fake model answers from one script in order, so run one test at a time.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: authTestServer({ appPort: PORT, mockPort: 3221, fakeLlmPort: 3222 }),
});
