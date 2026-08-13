import { defineConfig } from "@playwright/test";

const baseURL = process.env.HANDWERK_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const startServer = process.env.HANDWERK_E2E_START_SERVER === "1";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "../../test-results/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [
        ["line"],
        ["html", { outputFolder: "../../playwright-report", open: "never" }],
      ]
    : "list",
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    acceptDownloads: true,
  },
  webServer: startServer
    ? {
        command: process.env.HANDWERK_E2E_WEB_SERVER_COMMAND ?? "npm run dev",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: "fixture-contract",
      testMatch: "**/fixture-pack.spec.ts",
    },
    {
      name: "mobile-chromium",
      testIgnore: "**/fixture-pack.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "desktop-chromium",
      testIgnore: "**/fixture-pack.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
});
