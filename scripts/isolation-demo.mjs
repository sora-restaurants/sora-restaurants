// Proves Restaurant A's staff cannot read Restaurant B's active kitchen tickets.
// Runs the real migrations in PGlite (in-process Postgres). Exit code 0 = isolated, 1 = failure.
import { loadDb, queryAs as queryAsRole } from './pglite-db.mjs';

let db;
const queryAs = (role, userId, sql, params) => queryAsRole(db, role, userId, sql, params);
const queryAsUser = (userId, sql, params) => queryAs('authenticated', userId, sql, params);

const ACTIVE_FOR = `select id from orders
  where restaurant_id = $1 and status in ('submitted','accepted','preparing','ready')`;

async function runIsolationSuite() {
  console.log('⚡ Initialising In-Process PostgreSQL Isolation Test Suite...\n');

  console.log('📦 Discovering and combining database migrations...');
  db = await loadDb({ log: true });
  console.log('✅ Base schema, indexes, and RLS rules loaded successfully.');

  const insertRestaurant = async (name, slug, vatRegistered) => (await db.query(
    `insert into restaurants (name, slug, vat_registered) values ($1, $2, $3) returning id`,
    [name, slug, vatRegistered])).rows[0].id;
  const braaiId = await insertRestaurant('Braai Spot Johannesburg', 'braai-spot-jhb', true);
  const wineryId = await insertRestaurant('Stellenbosch Winery', 'stellenbosch-winery', false);

  const jhbStaffUserId = '00000000-0000-0000-0000-000000000001';
  const wineryStaffUserId = '00000000-0000-0000-0000-000000000002';
  await db.query(
    `insert into staff_memberships (restaurant_id, user_id, role) values ($1, $2, 'kitchen'), ($3, $4, 'kitchen')`,
    [braaiId, jhbStaffUserId, wineryId, wineryStaffUserId]);

  const insertTable = async (restaurantId, label, token) => (await db.query(
    `insert into tables (restaurant_id, label, qr_token) values ($1, $2, $3) returning id`,
    [restaurantId, label, token])).rows[0].id;
  const jhbTableId = await insertTable(braaiId, 'Table 4', 'qr-jhb-4');
  const wineryTableId = await insertTable(wineryId, 'Patio 2', 'qr-winery-2');

  // Prices are VAT-inclusive: R125.00 at 15% contains R16.30 VAT; the winery is not VAT-registered.
  await db.query(
    `insert into orders (restaurant_id, table_id, public_ref, status, subtotal_cents, vat_cents, total_cents) values
      ($1, $2, 'JHB001', 'submitted', 12500, 1630, 12500),
      ($3, $4, 'WIN001', 'preparing', 35000, 0, 35000)`,
    [braaiId, jhbTableId, wineryId, wineryTableId]);
  console.log('✅ Mock tenant datasets seeded successfully.');

  // ----- Step 1: prove the checks can fail -----
  console.log('\n🧪 Testing the Tester: momentarily disabling Row-Level Security...');
  await db.exec('alter table orders disable row level security');
  const leaked = await queryAsUser(jhbStaffUserId, ACTIVE_FOR, [wineryId]);
  await db.exec('alter table orders enable row level security');
  if (leaked.rows.length === 0) {
    throw new Error('The script is broken: it returned 0 rows even with RLS disabled.');
  }
  console.log('✅ Script caught cross-tenant reads when RLS was removed.');

  // ----- Step 2: real isolation checks -----
  console.log('\n🔒 Running Production Security Assertions...');

  const crossTenant = await queryAsUser(jhbStaffUserId, ACTIVE_FOR, [wineryId]);
  if (crossTenant.rows.length !== 0) {
    throw new Error('CRITICAL SECURITY BREACH: Braai Spot staff read Stellenbosch Winery tickets.');
  }
  console.log('🛡️  Check 1 Passed: Braai Spot staff see 0 Stellenbosch Winery tickets.');

  const ownTenant = await queryAsUser(wineryStaffUserId, ACTIVE_FOR, [wineryId]);
  if (ownTenant.rows.length !== 1) {
    throw new Error(`FUNCTIONAL FAILURE: Winery staff saw ${ownTenant.rows.length} of their own tickets, expected 1.`);
  }
  console.log('📦 Check 2 Passed: Winery staff see their own ticket.');

  // anon has no table privileges at all, so an error here is also a pass.
  for (const role of ['anon', 'authenticated']) {
    let rows = 0;
    try {
      rows = (await queryAs(role, null, 'select id from orders')).rows.length;
    } catch (error) {
      if (!/permission denied/.test(error.message)) throw error;
    }
    if (rows !== 0) throw new Error(`CRITICAL SECURITY BREACH: ${role} with no user read ${rows} orders.`);
  }
  console.log('🔒 Check 3 Passed: Sessions without a user see no orders.');

  console.log('\n🎉 Verification Complete: multi-tenant isolation confirmed.');
}

runIsolationSuite().catch((error) => {
  console.error(`\n❌ Script Assertion Error: ${error.message}`);
  process.exitCode = 1;
});
