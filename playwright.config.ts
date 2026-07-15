import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.PLAYWRIGHT_APP_PORT || 15173);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT || 18787);
const workers = Number(process.env.PLAYWRIGHT_WORKERS || 1);

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: process.env.PLAYWRIGHT_RECEIVING_DB === "true" ? "node scripts/browser-receiving-api.mjs" : "node scripts/browser-uat-api.mjs",
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "node scripts/browser-uat-vite.mjs",
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
