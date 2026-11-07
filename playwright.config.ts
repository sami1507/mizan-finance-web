import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "3100";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run ${process.env.PLAYWRIGHT_USE_PRODUCTION === "true" ? "start" : "dev"} -- --port ${port}`,
    url: baseURL,
    // Never run mutation tests against an already-running, potentially real database.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: "",
      PGLITE_DATA_DIR: "data/e2e",
      ALLOW_LOCAL_DB: "true",
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-only-not-a-production-secret-000000000000",
      SMTP_URL: "",
      MAIL_FROM: "",
    },
  },
});
