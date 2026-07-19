import { defineConfig, devices } from "@playwright/test";

const e2eDatabasePath = `/tmp/kraftbuch-e2e-${process.pid}.sqlite`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_PATH: e2eDatabasePath,
      BACKUP_PATH: `/tmp/kraftbuch-e2e-backups-${process.pid}`,
      BETTER_AUTH_SECRET: "playwright-only-secret-that-is-long-enough-2026",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      NEXT_PUBLIC_ENABLE_PWA: "true",
    },
  },
});
