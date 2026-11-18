import { describe, expect, it } from "vitest";
import { POLL_SQL, SNAPSHOT_SQL } from "../../apps/web/src/server/kitchen-stream.ts";
import { freshDb } from "./db";
import { DEMO } from "./fixtures";

// Checks the planner CAN serve the kitchen board from its indexes, even with a cached (generic) plan.
// enable_seqscan=off removes the tiny-table shortcut, so the plan shows which indexes are usable at all.
async function indexesUsed(sql: string, params: unknown[]) {
  const db = await freshDb();
  // A day of history, so the planner compares indexes on realistic numbers rather than a cost tie on an empty table.
  await db.exec(`insert into orders (restaurant_id, table_id, public_ref, subtotal_cents, total_cents, status, created_at, updated_at)
    select t.restaurant_id, t.id, 'H' || g, 100, 100, 'served', now() - g * interval '1 minute', now() - g * interval '1 minute'
    from generate_series(1, 2000) g, (select restaurant_id, id from tables where restaurant_id = '${DEMO}' limit 1) t; analyze orders`);
  await db.exec("set plan_cache_mode = force_generic_plan; set enable_seqscan = off");
  const types = params.map((p) => (p instanceof Date ? "timestamptz" : "uuid")).join(", ");
  await db.exec(`prepare q(${types}) as ${sql}`);
  const literals = params.map((p) => `'${p instanceof Date ? p.toISOString() : p}'`).join(", ");
  const { rows } = await db.query<{ "QUERY PLAN": unknown }>(`explain (format json) execute q(${literals})`);
  return JSON.stringify(rows[0]["QUERY PLAN"]);
}

describe("kitchen board query plans", () => {
  it("snapshot uses the partial active-orders index even with a generic plan", async () => {
    expect(await indexesUsed(SNAPSHOT_SQL, [DEMO])).toContain("idx_active_kitchen_orders");
  });

  it("poll uses the (restaurant_id, updated_at) index", async () => {
    expect(await indexesUsed(POLL_SQL, [DEMO, new Date()])).toContain("idx_orders_board_poll");
  });
});
