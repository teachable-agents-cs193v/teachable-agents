import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // `server-only` throws outside Next's server build; in tests use its no-op module.
      "server-only": new URL("./node_modules/server-only/empty.js", import.meta.url).pathname,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // A throwaway Postgres for database tests (see the file for details).
    globalSetup: ["./test/postgres.globalSetup.ts"],
    env: {
      // Test-only values; real ones live in .env.local or Vercel, never here.
      BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-else-0123456789",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
