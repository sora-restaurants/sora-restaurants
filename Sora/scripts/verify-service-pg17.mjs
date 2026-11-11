import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "postgres" });
await admin.connect();
await admin.query("drop database if exists sora_service");
await admin.query("create database sora_service");
await admin.end();
const db = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_service" });
await db.connect();
await db.query(`
  create schema extensions; create extension pgcrypto with schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, email_change text,
    email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  set search_path = public, extensions;
`);
for (const file of readdirSync(join(root, "supabase/migrations")).sort()) await db.query(readFileSync(join(root, "supabase/migrations", file), "utf8"));
await db.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
const fail = (n, e) => { console.error("FAIL", n, e.message); process.exitCode = 1; };
const ok = (n) => console.log("PASS", n);
try {
  const id = (await db.query("select create_service_request('demo-table-1-token','waiter','') id")).rows[0].id;
  const again = (await db.query("select create_service_request('demo-table-1-token','waiter','') id")).rows[0].id;
  if (id !== again) throw new Error("duplicate");
  ok("duplicate request returns the same id");
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub','c0000000-0000-0000-0000-000000000003',true)");
  await db.query("select update_service_request($1,'acknowledged')", [id]);
  await db.query("commit");
  const row = (await db.query("select status, acknowledged_by from service_requests where id=$1", [id])).rows[0];
  if (row.status !== "acknowledged") throw new Error(JSON.stringify(row));
  ok("waiter can acknowledge");
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub','c0000000-0000-0000-0000-000000000002',true)");
  try { await db.query("select update_service_request($1,'completed')", [id]); await db.query("commit"); throw new Error("other restaurant was allowed"); }
  catch (e) { await db.query("rollback"); if (!/not_found/.test(e.message)) throw e; }
  ok("other restaurant cannot update");
} catch (e) { fail("service", e); }
await db.end();
if (!process.exitCode) console.log("service requests verified on PostgreSQL 17");
