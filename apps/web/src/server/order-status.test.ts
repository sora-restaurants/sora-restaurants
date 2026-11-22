import { describe, expect, it } from "vitest";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW } from "../../../../supabase/tests/fixtures";
import { orderStatus } from "./order-status.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";

describe("orderStatus", () => {
  it("returns the live status for the guest's token and 404 for anything else", async () => {
    const db = await freshDb();
    const deps = testDeps(db);
    const result = await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "key-status-01", items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }] }, deps);
    if (!result.ok) throw new Error(result.error);
    expect(await (await orderStatus(result.statusToken, deps)).json()).toEqual({ status: "submitted", paid: false });
    await db.query("update orders set status = 'served'");
    expect(await (await orderStatus(result.statusToken, deps)).json()).toEqual({ status: "served", paid: false });
    expect((await orderStatus("0".repeat(32), deps)).status).toBe(404);
    expect((await orderStatus("x'; drop", deps)).status).toBe(404);
  });
});

describe("paid options", () => {
  it("are priced by the server from its own list, and a client-sent price is refused", async () => {
    const db = await freshDb();
    const deps = testDeps(db);
    const ok = await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "key-addon-001", items: [{ menuItemId: BUNNY_CHOW, quantity: 2, notes: "Bacon, Extra hot sauce" }] }, deps);
    expect(ok.ok).toBe(true);
    const { rows } = await db.query<{ unit: number; total: number; base: number }>(
      "select oi.unit_price_cents unit, o.total_cents total, mi.price_cents base from orders o join order_items oi on oi.order_id = o.id join menu_items mi on mi.id = oi.menu_item_id");
    expect(rows[0].unit).toBe(rows[0].base + 2000 + 1200);
    expect(rows[0].total).toBe(rows[0].unit * 2);
    const forged = await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "key-addon-002", items: [{ menuItemId: BUNNY_CHOW, quantity: 1, extraCents: -5000 }] }, deps);
    expect(forged).toMatchObject({ ok: false, error: "unexpected_field" });
  });
});
