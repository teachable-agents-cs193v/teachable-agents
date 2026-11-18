import { defineConfig } from "vitest/config";

// Live evaluation (eval/suite.eval.ts): the real pipeline on Groq, judged by Claude via Claude Code.
// Kept out of `npm test` and CI: it spends real quota. Run with `npm run eval -- --set=A` (eval/README.md).
export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": new URL("./node_modules/server-only/empty.js", import.meta.url).pathname,
    },
  },
  test: {
    include: ["eval/**/*.eval.ts"],
    environment: "node",
    // Scenarios run one at a time so they share the provider's rate limit politely.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 24 * 3600_000,
    // The judge preflight (one `claude -p` probe) runs in beforeAll.
    hookTimeout: 300_000,
  },
});
