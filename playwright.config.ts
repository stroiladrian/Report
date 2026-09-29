import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
// Optional: route HTTPS (map tiles) through a proxy, e.g. PW_PROXY=127.0.0.1:8080
const proxyArgs = process.env.PW_PROXY ? [`--proxy-server=https=${process.env.PW_PROXY}`, "--ignore-certificate-errors"] : [];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ro-RO",
    launchOptions: { args: proxyArgs },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${PORT}`,
        url: `${baseURL}/api/statuses`,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { DEV_MAILBOX: "1", RATE_LIMIT_DISABLED: "1" },
      },
});
