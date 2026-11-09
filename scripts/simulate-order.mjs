// Guest checkout from the terminal, no browser needed.
//   pnpm demo:pipeline   in-memory: real checkout + real kitchen stream on PGlite, with boundary checks. Exit 0 = pass.
//   pnpm simulate:order  HTTP: POST /api/orders on a running dev server (--url, --table, --items, --tamper).
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';

const BUNNY_CHOW = 'a2000000-0000-0000-0000-000000000001';
const ROOIBOS = 'a2000000-0000-0000-0000-000000000003';
const DEMO_BISTRO = 'a0000000-0000-0000-0000-000000000001';
const STAFF_TOKENS = {
  'token-A': 'c0000000-0000-0000-0000-000000000001', // kitchen, Demo Bistro
  'token-B': 'c0000000-0000-0000-0000-000000000002', // kitchen, Other Grill
};

const { values: args } = parseArgs({
  options: {
    url: { type: 'string' },
    table: { type: 'string', default: 'demo-table-4-token' },
    items: { type: 'string' },
    tamper: { type: 'boolean', default: false },
  },
});

const rand = (cents) => `R${(cents / 100).toFixed(2)}`;

function parseItems(spec) {
  if (!spec) return [{ menuItemId: BUNNY_CHOW, quantity: 2 }, { menuItemId: ROOIBOS, quantity: 1 }];
  return spec.split(',').map((pair) => {
    const [menuItemId, quantity] = pair.split(':');
    return { menuItemId, quantity: Number(quantity) };
  });
}

function cart() {
  const items = parseItems(args.items);
  if (args.tamper) items[0] = { ...items[0], priceCents: 1 }; // the server must refuse this
  return { qrToken: args.table, idempotencyKey: randomUUID(), items };
}

async function httpMode() {
  const endpoint = new URL('/api/orders', args.url);
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cart()),
    });
  } catch {
    throw new Error(`Cannot reach ${args.url} — is "pnpm dev" running?`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body.error ?? 'unknown_error'}`);
  console.log(`✅ Order ${body.publicRef} placed at ${args.table} — status link token ${body.statusToken}`);
}

async function pipelineMode() {
  // Real server code, loaded from TypeScript by Node's built-in type stripping.
  const { submitOrder } = await import('../apps/web/src/server/submit-order.ts');
  const { kitchenStream } = await import('../apps/web/src/server/kitchen-stream.ts');
  const { readEvents } = await import('../apps/web/src/server/sse-test-helpers.ts');
  const { loadDb, queryAs } = await import('./pglite-db.mjs');

  console.log('⚡ In-memory order pipeline (PGlite, real checkout + real kitchen stream)\n');
  const db = await loadDb({ seed: true });
  const deps = {
    db: {
      // The database owner stands in for Supabase's service_role, which also bypasses RLS.
      asService: async (sql, params = []) => (await db.query(sql, params)).rows,
      asUser: async (userId, sql, params = []) => (await queryAs(db, 'authenticated', userId, sql, params)).rows,
    },
    verifyStaffToken: async (bearer) => STAFF_TOKENS[bearer] ?? null,
    pollMs: 100,
  };
  const simulateIncomingScan = (qrToken, items) =>
    submitOrder({ qrToken, idempotencyKey: randomUUID(), items }, deps);
  const board = (token, signal) => kitchenStream(
    new Request(`http://local/api/kitchen/${DEMO_BISTRO}/stream`, { headers: { authorization: `Bearer ${token}` }, signal }),
    DEMO_BISTRO, deps);
  const orderCount = async () => (await db.query('select count(*)::int n from orders')).rows[0].n;
  const expectRefused = async (name, items, error) => {
    const result = await simulateIncomingScan(args.table, items);
    if (result.ok || result.error !== error) throw new Error(`${name}: expected ${error}, got ${JSON.stringify(result)}`);
    console.log(`🛡️  Refused ${name} → ${result.httpStatus} ${result.error}`);
  };

  // Boundary checks first: none of these may create an order or leak a ticket.
  await expectRefused('negative quantity', [{ menuItemId: BUNNY_CHOW, quantity: -3 }], 'invalid_items');
  await expectRefused('quantity above 50', [{ menuItemId: BUNNY_CHOW, quantity: 5000 }], 'invalid_items');
  await expectRefused('forged price', [{ menuItemId: BUNNY_CHOW, quantity: 1, priceCents: 1 }], 'unexpected_field');
  if (await orderCount() !== 0) throw new Error('A refused checkout still created an order.');
  const foreign = await board('token-B');
  const foreignBody = await foreign.text();
  if (foreign.status !== 403 || foreignBody.includes('Bunny')) {
    throw new Error(`Restaurant B on Demo Bistro's board: expected 403 with no data, got ${foreign.status}`);
  }
  console.log("🛡️  Refused Restaurant B's staff on Demo Bistro's board → 403");

  // Happy path: open Demo Bistro's board, then a guest scans Table 4.
  const controller = new AbortController();
  const reading = readEvents(await board('token-A', controller.signal), 2, 5000);
  await new Promise((resolve) => setTimeout(resolve, 200));
  console.log('\n🛒 Guest scans Table 4: 2× Bunny chow, 1× Rooibos iced tea');
  const placed = await simulateIncomingScan(args.table, parseItems(args.items));
  if (!placed.ok) throw new Error(`Checkout failed: ${placed.httpStatus} ${placed.error}`);

  const [{ total_cents: total, vat_cents: vat }] = (await db.query(
    'select total_cents, vat_cents from orders where public_ref = $1', [placed.publicRef])).rows;
  if (total !== 28500) throw new Error(`Expected total 28500 cents, got ${total}`);
  if (vat !== 3717) throw new Error(`Expected VAT 3717 cents (15% inclusive), got ${vat}`);

  const [, pushed] = await reading;
  controller.abort();
  if (pushed.event !== 'order' || pushed.data.publicRef !== placed.publicRef) {
    throw new Error(`Kitchen stream did not push the order: ${JSON.stringify(pushed)}`);
  }
  const lines = pushed.data.items.map((item) => `${item.quantity}× ${item.name}`).join(', ');
  console.log(`🍳 Kitchen received ${pushed.data.publicRef} · ${pushed.data.table} · ${rand(pushed.data.totalCents)} `
    + `(incl. ${rand(vat)} VAT) · ${lines}`);
  await db.close();
  console.log('\n🎉 Pipeline verified.');
}

(args.url ? httpMode() : pipelineMode()).catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});
