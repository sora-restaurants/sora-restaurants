// Runs the same test suite against a real, disposable PostgreSQL 17 server (embedded-postgres: the official
// binaries, no Docker). Enabled by vitest.realpg.config.ts, which sets DB_ENGINE=postgres.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

export const REAL_PG_PORT = 54329;
const SUPERUSER = { user: "postgres", password: "postgres" };
// Local throwaway cluster only; mirrors Supabase's PostgREST login role.
const AUTHENTICATOR = { user: "authenticator", password: "authenticator-local-test" };

// Cluster-wide roles, set up the way Supabase does: API roles cannot log in, service_role bypasses RLS,
// and the API connects as the non-superuser `authenticator` and switches into them.
export const CLUSTER_ROLES = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  create role authenticator login noinherit password '${AUTHENTICATOR.password}';
  grant anon, authenticated, service_role to authenticator;
`;

// Per-database part of Supabase: the auth schema the seed writes to and auth.uid() as Supabase defines it.
export const DATABASE_STUB = `
  -- Like Supabase: extensions in their own schema, on everyone's search_path.
  create schema extensions;
  create extension pgcrypto with schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  set search_path = public, extensions;
  do $$ begin execute format('alter database %I set search_path = public, extensions', current_database()); end $$;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, email_change text,
    email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select on auth.users to service_role; -- server-side dev staff login checks passwords
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`;

/** Vitest globalSetup: start a fresh cluster in a temp folder, delete it afterwards. */
export default async function startCluster() {
  const databaseDir = mkdtempSync(join(tmpdir(), "sora-realpg-"));
  const server = new EmbeddedPostgres({
    databaseDir,
    port: REAL_PG_PORT,
    ...SUPERUSER,
    persistent: false,
    postgresFlags: ["-c", "max_connections=300"],
    onLog: () => {},
  });
  await server.initialise();
  await server.start();
  const admin = new pg.Client({ ...SUPERUSER, host: "127.0.0.1", port: REAL_PG_PORT, database: "postgres" });
  await admin.connect();
  await admin.query(CLUSTER_ROLES);
  const { rows } = await admin.query("select version()");
  console.log(`[real-pg] ${rows[0].version}`);
  await admin.end();
  return async () => {
    await server.stop();
    rmSync(databaseDir, { recursive: true, force: true });
  };
}

let counter = 0;
const open: pg.Client[] = [];

/**
 * A new database with the stub applied, exposing the small part of the PGlite API the tests use.
 * query/exec run as the superuser (test setup); transaction() connects as `authenticator`, so asStaff
 * exercises RLS exactly as Supabase's API would.
 */
export async function createRealDb(): Promise<PGlite> {
  // One live database per worker is enough; close the previous test's connections.
  await Promise.all(open.splice(0).map((c) => c.end().catch(() => {})));
  const name = `t_${process.pid}_${++counter}`;
  // Lets a test point the production database code (prodDeps, postgres.js) at this same database.
  process.env.REAL_PG_LAST_DB_URL = `postgresql://${SUPERUSER.user}:${SUPERUSER.password}@127.0.0.1:${REAL_PG_PORT}/${name}`;
  const connect = async (login: { user: string; password: string }, database: string) => {
    const client = new pg.Client({ ...login, host: "127.0.0.1", port: REAL_PG_PORT, database });
    await client.connect();
    open.push(client);
    return client;
  };
  const admin = await connect(SUPERUSER, "postgres");
  await admin.query(`create database ${name}`);
  const owner = await connect(SUPERUSER, name);
  await owner.query(DATABASE_STUB);
  const api = await connect(AUTHENTICATOR, name);

  const wrap = (client: pg.Client) => ({
    query: async (sql: string, params: unknown[] = []) => ({ rows: (await client.query(sql, params as unknown[])).rows }),
    exec: async (sql: string) => {
      await client.query(sql);
    },
  });

  let queue = Promise.resolve();
  const db = {
    ...wrap(owner),
    transaction: <T>(fn: (tx: ReturnType<typeof wrap>) => Promise<T>) => {
      // Serialise transactions on the single authenticator connection.
      const run = queue.then(async () => {
        await api.query("begin");
        try {
          const result = await fn(wrap(api));
          await api.query("commit");
          return result;
        } catch (error) {
          await api.query("rollback");
          throw error;
        }
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
    close: async () => {},
  };
  // shortcut: structural stand-in for the PGlite methods the tests call (query, exec, transaction); extend if a test needs more.
  return db as unknown as PGlite;
}
