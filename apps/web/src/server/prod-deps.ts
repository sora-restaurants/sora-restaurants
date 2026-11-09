import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import type { Deps } from "./deps.ts";

let sql: postgres.Sql | undefined;
let supabase: SupabaseClient | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Real dependencies. Same role switching as the PGlite test harness, so RLS behaves identically. */
export function prodDeps(): Deps {
  // prepare: false keeps this working behind Supabase's transaction-mode connection pooler.
  sql ??= postgres(env("DATABASE_URL"), { max: 10, prepare: false });
  supabase ??= createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
  });
  const db = sql;
  const auth = supabase.auth;

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
    verifyStaffToken: async (bearer) => (await auth.getUser(bearer)).data.user?.id ?? null,
    pollMs: 2000,
  };
}
