import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests run outside React Server Components; let server-only modules (prod-deps) load.
  resolve: { alias: { "server-only": fileURLToPath(new URL("./apps/web/node_modules/server-only/empty.js", import.meta.url)) } },
  test: {
    include: ["supabase/tests/**/*.test.ts", "apps/web/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30000,
  },
});
