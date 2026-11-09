import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["supabase/tests/**/*.test.ts", "apps/web/**/*.test.ts", "scripts/**/*.test.ts"], exclude: ["**/node_modules/**"], testTimeout: 30000 } });
