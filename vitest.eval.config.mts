import { defineConfig } from "vitest/config";

// Live model evaluation of Pip (eval/). Kept out of `npm test` and CI:
// it needs an API key and spends real quota. Run with `npm run eval`.
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
    testTimeout: 900_000,
  },
});
