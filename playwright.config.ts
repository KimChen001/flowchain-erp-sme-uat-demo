import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.PLAYWRIGHT_APP_PORT || 5173);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT || 8787);

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 10_000 },
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
      command: "node server/index.mjs",
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${appPort}`,
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
