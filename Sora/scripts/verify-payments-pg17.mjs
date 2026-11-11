// Verifies the payment layer against a running PostgreSQL 17.
// Usage: node scripts/verify-payments-pg17.mjs
// Expects a superuser on 127.0.0.1:54329 (user postgres / password postgres).
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "postgres" });
await admin.connect();
const version = (await admin.query("select version()")).rows[0].version;
if (!version.includes("PostgreSQL 17")) throw new Error(`expected PostgreSQL 17, got ${version}`);
console.log(version);

await admin.query(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$;
`);
await admin.query("drop database if exists sora_pay_verify");
await admin.query("create database sora_pay_verify");
await admin.end();

const db = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_pay_verify" });
await db.connect();
await db.query(`
  create schema extensions;
  create extension pgcrypto with schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  create schema auth;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, email_change text,
    email_change_token_new text, recovery_token text);
  create table auth.identities (id uuid primary key, user_id uuid, provider_id text, identity_data jsonb,
    provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  set search_path = public, extensions;
`);

for (const file of readdirSync(join(root, "supabase/migrations")).sort()) {
  await db.query(readFileSync(join(root, "supabase/migrations", file), "utf8"));
  console.log("applied", file);
}
await db.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
console.log("seeded");

const fail = (name, err) => { console.error("FAIL", name, err.message); process.exitCode = 1; };
const ok = (name) => console.log("PASS", name);

async function asRole(role, uid, fn) {
  await db.query("begin");
  await db.query(`set local role ${role}`);
  if (uid) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
  try {
    const result = await fn();
    await db.query("commit");
    return result;
  } catch (err) {
    await db.query("rollback");
    throw err;
  }
}

const order = (await db.query("select submit_order($1,$2,$3::jsonb) r", [
  "demo-table-1-token", "verify-order-1", JSON.stringify([{ menuItemId: "a2000000-0000-0000-0000-000000000001", quantity: 1 }]),
])).rows[0].r;
const orderId = (await db.query("select id, total_cents from orders")).rows[0];

try {
  const created = await asRole("service_role", null, async () =>
    (await db.query("select create_counter_payment($1,$2) id", [orderId.id, "counter-verify-1"])).rows[0].id);
  const row = (await db.query("select method, status, amount_cents, is_simulated from payments where id = $1", [created])).rows[0];
  if (row.amount_cents !== orderId.total_cents || row.status !== "awaiting_collection" || row.is_simulated !== false) {
    throw new Error(JSON.stringify(row));
  }
  ok("service_role creates counter payment from order total");
} catch (e) { fail("service_role creates counter payment", e); }

try {
  await asRole("authenticated", "c0000000-0000-0000-0000-000000000003", async () => {
    const id = (await db.query("select id from payments where method = 'counter'")).rows[0].id;
    await db.query("select mark_counter_collected($1)", [id]);
  });
  const audit = (await db.query("select source, actor_user_id, new_status from payment_audit")).rows[0];
  if (audit.source !== "staff_counter_collection" || audit.actor_user_id !== "c0000000-0000-0000-0000-000000000003") {
    throw new Error(JSON.stringify(audit));
  }
  ok("waiter of the same restaurant can collect");
} catch (e) { fail("waiter collection", e); }

try {
  const other = (await db.query("select submit_order($1,$2,$3::jsonb)", [
    "other-table-1-token", "verify-order-2", JSON.stringify([{ menuItemId: "b2000000-0000-0000-0000-000000000001", quantity: 1 }]),
  ]));
  const otherId = (await db.query("select id from orders where public_ref <> (select public_ref from orders where id = $1)", [orderId.id])).rows[0].id;
  await asRole("service_role", null, () => db.query("select create_counter_payment($1,$2)", [otherId, "counter-other-1"]));
  const seen = await asRole("authenticated", "c0000000-0000-0000-0000-000000000003", async () =>
    (await db.query("select count(*)::int n from payments")).rows[0].n);
  if (seen !== 1) throw new Error(`waiter saw ${seen} payments`);
  ok("waiter cannot see the other restaurant payment");
} catch (e) { fail("cross-restaurant", e); }

try {
  await asRole("anon", null, () => db.query("select count(*) from payments"));
  fail("anon select", new Error("anon was allowed to select"));
} catch (e) {
  if (/permission denied/i.test(e.message)) ok("anon cannot select payments");
  else fail("anon select", e);
}

try {
  await db.query("select submit_order($1,$2,$3::jsonb)", [
    "demo-table-2-token", "verify-order-3", JSON.stringify([{ menuItemId: "a2000000-0000-0000-0000-000000000001", quantity: 1 }]),
  ]);
  const fresh = (await db.query("select id from orders order by created_at desc limit 1")).rows[0].id;
  const a = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_pay_verify" });
  const b = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_pay_verify" });
  await a.connect(); await b.connect();
  const results = await Promise.allSettled([
    a.query("select create_counter_payment($1,$2) id", [fresh, "race-key-a"]),
    b.query("select create_counter_payment($1,$2) id", [fresh, "race-key-b"]),
  ]);
  await a.end(); await b.end();
  const rejected = results.filter((r) => r.status === "rejected");
  const count = (await db.query("select count(*)::int n from payments where order_id = $1 and status = 'awaiting_collection'", [fresh])).rows[0].n;
  if (count !== 1) throw new Error(`active count ${count}; rejected ${rejected.map(r => r.reason.message).join(" | ")}`);
  ok("concurrent counter creates leave one active payment");
} catch (e) { fail("concurrent create", e); }

try {
  await db.query("select submit_order($1,$2,$3::jsonb)", [
    "demo-table-4-token", "verify-order-4", JSON.stringify([{ menuItemId: "a2000000-0000-0000-0000-000000000001", quantity: 1 }]),
  ]);
  const fresh = (await db.query("select id from orders order by created_at desc limit 1")).rows[0].id;
  const payment = (await db.query("select create_counter_payment($1,$2) id", [fresh, "collect-race"])).rows[0].id;
  const a = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_pay_verify" });
  const b = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_pay_verify" });
  await a.connect(); await b.connect();
  const run = async (client) => {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", ["c0000000-0000-0000-0000-000000000003"]);
    await client.query("select mark_counter_collected($1)", [payment]);
    await client.query("commit");
  };
  const results = await Promise.allSettled([run(a), run(b)]);
  await a.end(); await b.end();
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const status = (await db.query("select status from payments where id = $1", [payment])).rows[0].status;
  const audits = (await db.query("select count(*)::int n from payment_audit where payment_id = $1 and source = 'staff_counter_collection'", [payment])).rows[0].n;
  if (succeeded !== 1 || status !== "succeeded" || audits !== 1) {
    throw new Error(`succeeded=${succeeded} status=${status} audits=${audits}`);
  }
  ok("concurrent collection records one audit and one success");
} catch (e) { fail("concurrent collection", e); }

await db.end();
if (process.exitCode) process.exit(process.exitCode);
console.log("real PostgreSQL 17 verification complete");
