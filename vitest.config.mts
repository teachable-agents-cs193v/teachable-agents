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
  },
});
