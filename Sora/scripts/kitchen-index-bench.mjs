// Measures the kitchen-board queries on a real PostgreSQL 17 server with production-like volume.
//   pnpm bench:kitchen     (takes a minute or two; everything is thrown away afterwards)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import startCluster, { DATABASE_STUB, REAL_PG_PORT } from '../supabase/tests/real-pg.ts';

const RESTAURANTS = 100;
const ORDERS_PER_RESTAURANT = 10_000;
const ACTIVE_PER_RESTAURANT = 200; // 2% open tickets; the rest are served history
const RUNS = 25;
const ACTIVE = "('submitted', 'accepted', 'preparing', 'ready')";

const stop = await startCluster();
const db = new pg.Client({ host: '127.0.0.1', port: REAL_PG_PORT, user: 'postgres', password: 'postgres', database: 'postgres' });
await db.connect();
try {
  await db.query(DATABASE_STUB);
  for (const file of fs.readdirSync('supabase/migrations').sort()) {
    await db.query(fs.readFileSync(path.join('supabase/migrations', file), 'utf8'));
  }

  console.log(`Seeding ${RESTAURANTS} restaurants × ${ORDERS_PER_RESTAURANT.toLocaleString()} orders...`);
  let started = Date.now();
  await db.query(`
    insert into restaurants (id, name, slug)
      select ('00000000-0000-0000-0000-' || lpad(r::text, 12, '0'))::uuid, 'R' || r, 'r' || r from generate_series(1, ${RESTAURANTS}) r;
    insert into tables (restaurant_id, label) select id, 'Table 1' from restaurants;
    -- Orders spread over a year; the newest few per restaurant are still open on the board.
    insert into orders (restaurant_id, table_id, public_ref, status, subtotal_cents, total_cents, created_at, updated_at)
      select t.restaurant_id, t.id, 'X', case when n > ${ORDERS_PER_RESTAURANT - ACTIVE_PER_RESTAURANT}
          then (array['submitted','accepted','preparing','ready'])[1 + n % 4] else 'served' end,
        12500, 12500, now() - (${ORDERS_PER_RESTAURANT} - n) * interval '50 minutes',
        now() - (${ORDERS_PER_RESTAURANT} - n) * interval '50 minutes'
      from tables t cross join generate_series(1, ${ORDERS_PER_RESTAURANT}) n;
    analyze;`);
  console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

  const target = '00000000-0000-0000-0000-000000000042';
  const queries = {
    'Board snapshot (active tickets, oldest first)':
      `select id from orders where restaurant_id = '${target}' and status in ${ACTIVE} order by created_at`,
    'Board poll (changes in the last 5 s)':
      `select id from orders where restaurant_id = '${target}' and updated_at > now() - interval '5 seconds'`,
  };
  const variants = {
    'no kitchen indexes': 'drop index idx_active_kitchen_orders; drop index idx_orders_board_poll',
    'old full index (restaurant_id, status, created_at)':
      'drop index idx_active_kitchen_orders; drop index idx_orders_board_poll; create index orders_kitchen on orders (restaurant_id, status, created_at)',
    'current: partial active index + poll index': '',
  };

  const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const indexNames = (plan) => {
    const names = new Set();
    const walk = (node) => {
      if (node['Index Name']) names.add(node['Index Name']);
      if (node['Node Type'] === 'Seq Scan') names.add('SEQ SCAN');
      (node.Plans ?? []).forEach(walk);
    };
    walk(plan);
    return [...names].join(', ');
  };

  const rows = [];
  for (const [variant, ddl] of Object.entries(variants)) {
    await db.query('begin');
    if (ddl) await db.query(ddl);
    await db.query('analyze orders');
    for (const [name, sql] of Object.entries(queries)) {
      const times = [];
      let plan;
      for (let i = 0; i < RUNS; i++) {
        const { rows: [{ 'QUERY PLAN': [result] }] } = await db.query(`explain (analyze, buffers, format json) ${sql}`);
        times.push(result['Execution Time']);
        plan = result.Plan;
      }
      rows.push({ query: name, variant, 'median ms': median(times).toFixed(3), 'buffers': plan['Shared Hit Blocks'] + (plan['Shared Read Blocks'] ?? 0), 'rows': plan['Actual Rows'], 'uses': indexNames(plan) });
    }
    const sizes = await db.query(`select indexrelid::regclass::text name, pg_size_pretty(pg_relation_size(indexrelid)) size
      from pg_index where indrelid = 'orders'::regclass and indexrelid::regclass::text in ('idx_active_kitchen_orders', 'orders_kitchen', 'idx_orders_board_poll')`);
    for (const s of sizes.rows) rows.push({ query: `size of ${s.name}`, variant, 'median ms': '', buffers: '', rows: '', uses: s.size });
    await db.query('rollback');
  }

  // The app's snapshot query, as a cached (generic) plan: the inline status list keeps the partial index usable.
  const { SNAPSHOT_SQL } = await import('../apps/web/src/server/kitchen-stream.ts');
  await db.query('set plan_cache_mode = force_generic_plan');
  await db.query(`prepare snap(uuid) as ${SNAPSHOT_SQL}`);
  const { rows: [{ 'QUERY PLAN': [generic] }] } = await db.query(`explain (analyze, format json) execute snap('${target}')`);
  rows.push({ query: "App's snapshot query, generic plan", variant: 'current', 'median ms': generic['Execution Time'].toFixed(3), buffers: '', rows: generic.Plan['Actual Rows'], uses: indexNames(generic.Plan) });

  console.table(rows);
} finally {
  await db.end();
  await stop();
}
