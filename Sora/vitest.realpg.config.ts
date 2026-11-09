import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

// Same suite, real PostgreSQL 17 server instead of PGlite: pnpm test:realpg
export default mergeConfig(
  base,
  defineConfig({
    test: {
      env: { DB_ENGINE: "postgres" },
      globalSetup: ["supabase/tests/real-pg.ts"],
      fileParallelism: false,
    },
  }),
);
