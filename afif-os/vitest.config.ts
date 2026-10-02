import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      // `server-only` throws outside a React Server Component; the tests run in
      // plain Node, so it is aliased to an empty module. The Next build still
      // resolves the real package and keeps the guard.
      "server-only": path.resolve(process.cwd(), "scripts/empty-module.js"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // The suite talks to a real PostgreSQL server; tests are serialised so
    // rate-limit and study-timer state cannot interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ["tests/setup.ts"],
  },
});
