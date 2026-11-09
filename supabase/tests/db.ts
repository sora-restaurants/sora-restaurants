import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createRealDb } from "./real-pg";

const dir = join(__dirname, "..");

// Stand-in for the parts of Supabase the migration and seed touch; local Supabase provides the real ones.
const supabaseStub = `
  create role anon; create role authenticated; create role service_role;
  -- PGlite has no pgcrypto; the seed only needs these to hash test passwords.
  create function gen_salt(text) returns text language sql as $$ select 'stub' $$;
  create function crypt(text, text) returns text language sql as $$ select md5($1 || $2) $$;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, email_change text,
    email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to authenticated, service_role;
  grant execute on function auth.uid() to authenticated, service_role;
  -- Mirrors Supabase: API roles get ALL on new public tables unless a migration revokes it.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

export async function freshDb(): Promise<PGlite> {
  const db = process.env.DB_ENGINE === "postgres" ? await createRealDb() : await PGlite.create();
  if (process.env.DB_ENGINE === "postgres") {
    // Real server: roles, auth schema and pgcrypto already come from real-pg.ts.
    await loadSchema(db);
    return db;
  }
  await db.exec(supabaseStub);
  await loadSchema(db);
  return db;
}

async function loadSchema(db: PGlite) {
  for (const file of readdirSync(join(dir, "migrations")).sort()) {
    await db.exec(readFileSync(join(dir, "migrations", file), "utf8"));
  }
  await db.exec(readFileSync(join(dir, "seed.sql"), "utf8"));
}

export async function asStaff<T>(db: PGlite, userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec("set local role authenticated");
    return (await tx.query<T>(sql, params)).rows;
  });
}
