import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: { PGLITE_DATA_DIR: ":memory:", DATABASE_URL: process.env.FINANCE_TEST_DATABASE_URL || "" },
  },
});
