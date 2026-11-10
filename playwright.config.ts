import { defineConfig, devices } from "@playwright/test";

// Browser tests for the customer menu. Own throwaway Postgres (54331) and app (3100), so a running `pnpm demo` is untouched.
export const E2E_DB = "postgresql://postgres:postgres@127.0.0.1:54331/sora";
const APP = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "e2e",
  workers: 1, // tests count orders in one shared database
  timeout: 90_000,
  use: { baseURL: APP, ...devices["Pixel 7"] },
  projects: [{ name: "chromium" }],
  webServer: [
    {
      command: "node --experimental-strip-types scripts/local-db.mjs --reset",
      env: { SORA_DB_PORT: "54331", SORA_DB_DIR: ".local-pg-e2e" },
      port: 54331,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: "node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3100",
      cwd: "apps/web",
      env: { DATABASE_URL: E2E_DB, DEV_SIMULATED_PAYMENTS: "1" },
      url: `${APP}/t/demo-table-1-token`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
});
