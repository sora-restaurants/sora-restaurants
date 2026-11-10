import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import type { Deps } from "./deps.ts";
import { assertNoDevLoginInProduction, devStaffLoginEnabled, verifyDevToken } from "./dev-staff-login.ts";

let sql: postgres.Sql | undefined;
let supabase: SupabaseClient | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function databaseUrl(): string {
  // Supabase's Vercel integration names its pooled connection this way. Keep
  // DATABASE_URL as the explicit override for local and other hosted setups.
  return process.env.DATABASE_URL || env("POSTGRES_PRISMA_URL");
}

/** Staff identity: a Supabase Auth session, or a dev token on a local demo machine. */
async function verifyStaffToken(bearer: string): Promise<string | null> {
  if (bearer.startsWith("dev.")) {
    return devStaffLoginEnabled() ? verifyDevToken(bearer, process.env.DEV_STAFF_LOGIN_SECRET!) : null;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  supabase ??= createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  return (await supabase.auth.getUser(bearer)).data.user?.id ?? null;
}

/** Real dependencies. Same role switching as the PGlite test harness, so RLS behaves identically. */
export function prodDeps(): Deps {
  assertNoDevLoginInProduction();
  // prepare: false keeps this working behind Supabase's transaction-mode connection pooler.
  sql ??= postgres(databaseUrl(), { max: 10, prepare: false });
  const db = sql;

  return {
    db: {
      asService: async <T,>(query: string, params: unknown[] = []) =>
        (await db.begin(async (tx) => {
          await tx`set local role service_role`;
          return tx.unsafe(query, params as never[]);
        })) as unknown as T[],
      asUser: async <T,>(userId: string, query: string, params: unknown[] = []) =>
        (await db.begin(async (tx) => {
          const claims = JSON.stringify({ sub: userId, role: "authenticated" });
          await tx`select set_config('request.jwt.claims', ${claims}, true)`;
          await tx`set local role authenticated`;
          return tx.unsafe(query, params as never[]);
        })) as unknown as T[],
    },
    verifyStaffToken,
    pollMs: 2000,
  };
}
