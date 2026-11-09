// In-process Postgres with the real migrations, for terminal demos. Same stand-ins as supabase/tests/db.ts.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal stand-in for what Supabase provides: API roles, auth tables the seed writes to,
// and auth.uid() reading the JWT claims. PGlite has no pgcrypto, so crypt/gen_salt are stubs (seed passwords only).
const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role;
  create function gen_salt(text) returns text language sql as $$ select 'stub' $$;
  create function crypt(text, text) returns text language sql as $$ select md5($1 || $2) $$;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, email_change text,
    email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

function migrationFiles(dir, log) {
  if (!fs.existsSync(dir)) throw new Error(`Migration directory not found at: ${dir}`);
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort() // timestamped names = chronological order
    .map((file) => {
      if (log) console.log(`   ↳ Reading migration: ${file}`);
      return fs.readFileSync(path.join(dir, file), 'utf8');
    });
}

/** Fresh database with every migration applied; `seed: true` also loads supabase/seed.sql. */
export async function loadDb({ seed = false, log = false } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const sql of migrationFiles(path.join(ROOT, 'supabase/migrations'), log)) await db.exec(sql);
  if (seed) await db.exec(fs.readFileSync(path.join(ROOT, 'supabase/seed.sql'), 'utf8'));
  return db;
}

/**
 * Runs a query as a Supabase API role. The default PGlite user is a superuser, and superusers bypass RLS,
 * so anything that checks isolation must go through here.
 */
export async function queryAs(db, role, userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`,
      [userId ? JSON.stringify({ sub: userId, role }) : '']);
    await tx.exec(`set local role ${role}`);
    return tx.query(sql, params);
  });
}
