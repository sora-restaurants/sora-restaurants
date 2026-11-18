import "server-only";
import { createClient } from "@supabase/supabase-js";
import { prodDeps } from "./prod-deps.ts";
import type { WaitlistDb } from "./waitlist.ts";

let database: WaitlistDb | undefined;

export function waitlistDb(): WaitlistDb {
  if (database) return database;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  database = url && key
    ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    })
    : prodDeps().db;
  return database;
}
