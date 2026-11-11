// Acceptance audit for checkout against PostgreSQL 17.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "postgres" });
await admin.connect();
await admin.query(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  end $$;
`);
await admin.query("drop database if exists sora_accept");
await admin.query("create database sora_accept");
await admin.end();

const db = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_accept" });
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
}
await db.query(readFileSync(join(root, "supabase/seed.sql"), "utf8"));

const fail = (name, err) => { console.error("FAIL", name, err?.message || err); process.exitCode = 1; };
const ok = (name) => console.log("PASS", name);

async function asRole(role, uid, fn) {
  await db.query("begin");
  await db.query(`set local role ${role}`);
  if (uid) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
  try { const r = await fn(); await db.query("commit"); return r; }
  catch (e) { await db.query("rollback"); throw e; }
}

// Simulate the checkout server action against real PG.
async function checkout({ qrToken, key, method, items }) {
  await db.query("begin");
  await db.query("set local role service_role");
  try {
  const order = (await db.query("select submit_order($1,$2,$3::jsonb) r", [qrToken, key, JSON.stringify(items)])).rows[0].r;
  const owned = (await db.query(
    `select o.id, o.status from orders o join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
      where o.status_token = $1 and t.qr_token = $2`,
    [order.statusToken, qrToken],
  )).rows[0];
  if (!owned) throw new Error("order_not_owned");
  const payKey = `${key}:${method}`;
  if (method === "counter") {
    await db.query("select create_counter_payment($1,$2)", [owned.id, payKey]);
    const result = { ...order, paymentStatus: "awaiting_collection", simulated: false, orderStatus: owned.status };
  await db.query("commit");
  return result;
  }
  const created = (await db.query("select create_demo_payment($1,$2) id", [owned.id, payKey])).rows[0].id;
  const status = (await db.query("select status from payments where id = $1", [created])).rows[0].status;
  if (status === "pending") await db.query("select simulate_payment_success($1)", [created]);
  const result = { ...order, paymentStatus: "succeeded", simulated: true };
  await db.query("commit");
  return result;
  } catch (err) { await db.query("rollback"); throw err; }
}

const item = [{ menuItemId: "a2000000-0000-0000-0000-000000000001", quantity: 1 }];

try {
  const r = await checkout({ qrToken: "demo-table-1-token", key: "accept-counter-1", method: "counter", items: item });
  const pay = (await db.query("select status, method from payments")).rows[0];
  const visible = (await db.query("select count(*)::int n from orders where status = 'submitted'")).rows[0].n;
  if (r.paymentStatus !== "awaiting_collection" || pay.status !== "awaiting_collection" || visible !== 1) throw new Error(JSON.stringify({ r, pay, visible }));
  ok("counter order is submitted and awaiting collection");
} catch (e) { fail("counter", e); }

try {
  const first = await checkout({ qrToken: "demo-table-1-token", key: "accept-counter-1", method: "counter", items: item });
  const orders = (await db.query("select count(*)::int n from orders")).rows[0].n;
  const pays = (await db.query("select count(*)::int n from payments")).rows[0].n;
  if (!first.replayed || orders !== 1 || pays !== 1) throw new Error(`replayed=${first.replayed} orders=${orders} pays=${pays}`);
  ok("same key retry, including after a refresh, creates nothing new");
} catch (e) { fail("retry", e); }

try {
  const a = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_accept" });
  const b = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_accept" });
  await a.connect(); await b.connect();
  const results = await Promise.allSettled([
    a.query("select submit_order($1,$2,$3::jsonb)", ["demo-table-2-token", "accept-race", JSON.stringify(item)]),
    b.query("select submit_order($1,$2,$3::jsonb)", ["demo-table-2-token", "accept-race", JSON.stringify(item)]),
  ]);
  await a.end(); await b.end();
  const orders = (await db.query("select count(*)::int n from orders where table_id = (select id from tables where qr_token = 'demo-table-2-token')")).rows[0].n;
  if (orders !== 1) throw new Error(`orders=${orders} results=${results.map(r => r.status).join(",")}`);
  const id = (await db.query("select id from orders order by created_at desc limit 1")).rows[0].id;
  const c1 = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_accept" });
  const c2 = new pg.Client({ host: "127.0.0.1", port: 54329, user: "postgres", password: "postgres", database: "sora_accept" });
  await c1.connect(); await c2.connect();
  await Promise.allSettled([
    c1.query("select create_counter_payment($1,$2)", [id, "accept-race:counter"]),
    c2.query("select create_counter_payment($1,$2)", [id, "accept-race:counter"]),
  ]);
  await c1.end(); await c2.end();
  const pays = (await db.query("select count(*)::int n from payments where order_id = $1", [id])).rows[0].n;
  if (pays !== 1) throw new Error(`pays=${pays}`);
  ok("simultaneous checkout leaves one order and one payment");
} catch (e) { fail("simultaneous", e); }

try {
  await asRole("anon", null, () => db.query("select simulate_payment_success('00000000-0000-0000-0000-000000000001')"));
  fail("anon simulate", new Error("anon was allowed"));
} catch (e) {
  if (/permission denied/i.test(e.message)) ok("anon cannot call simulate_payment_success");
  else fail("anon simulate", e);
}

try {
  await asRole("authenticated", "c0000000-0000-0000-0000-000000000003", () =>
    db.query("select simulate_payment_success('00000000-0000-0000-0000-000000000001')"));
  fail("customer simulate", new Error("authenticated was allowed"));
} catch (e) {
  if (/permission denied/i.test(e.message)) ok("authenticated cannot call simulate_payment_success");
  else fail("customer simulate", e);
}

try {
  await db.query("select submit_order($1,$2,$3::jsonb)", ["demo-table-4-token", "accept-partial", JSON.stringify(item)]);
  const before = (await db.query("select count(*)::int n from orders")).rows[0].n;
  await db.query("revoke execute on function create_counter_payment(uuid, text) from service_role");
  let incomplete = false;
  try {
    await db.query("begin");
    await db.query("set local role service_role");
    const owned = (await db.query("select id from orders order by created_at desc limit 1")).rows[0].id;
    await db.query("select create_counter_payment($1,$2)", [owned, "accept-partial:counter"]);
    await db.query("commit");
  } catch (err) {
    await db.query("rollback");
    incomplete = true;
  }
  await db.query("grant execute on function create_counter_payment(uuid, text) to service_role");
  const recovered = await checkout({ qrToken: "demo-table-4-token", key: "accept-partial", method: "counter", items: item });
  const after = (await db.query("select count(*)::int n from orders")).rows[0].n;
  const pays = (await db.query("select count(*)::int n from payments where idempotency_key = 'accept-partial:counter'")).rows[0].n;
  if (!incomplete || after !== before || pays !== 1 || recovered.paymentStatus !== "awaiting_collection" || !recovered.replayed) {
    throw new Error(JSON.stringify({ incomplete, before, after, pays, recovered }));
  }
  ok("partial payment failure recovers on retry without a second order");
} catch (e) { fail("partial", e); }

await db.end();
if (!process.exitCode) console.log("checkout acceptance on PostgreSQL 17 complete");
