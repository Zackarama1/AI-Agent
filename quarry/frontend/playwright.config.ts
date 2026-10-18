import { defineConfig, devices } from "@playwright/test";

// E2E runs against the full stack: the API serving the built SPA (single origin,
// as deployed), with PostgreSQL, Redis/Valkey and the worker running. See Makefile `e2e`.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:8000";
const chromiumPath = process.env.PW_CHROMIUM_PATH;
const withWebkit = process.env.E2E_WEBKIT === "1";

const ipad = devices["iPad Pro 11 landscape"];

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /ipad\.spec/,
    },
    {
      // iPad viewport + touch in Chromium (always available); real WebKit below in CI.
      name: "ipad-chromium",
      use: { ...ipad, browserName: "chromium", defaultBrowserType: "chromium" },
      testMatch: /ipad\.spec/,
    },
    ...(withWebkit ? [{ name: "ipad-webkit", use: { ...ipad }, testMatch: /ipad\.spec/ }] : []),
  ],
});
