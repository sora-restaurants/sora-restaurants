import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asStaff, freshDb } from "./db";
import { BUNNY_CHOW, DEMO_USER, submitOrder } from "./fixtures";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); });

describe("review fixes", () => {
  it("staff cannot truncate or write tables directly", async () => {
    await expect(asStaff(db, DEMO_USER, "truncate orders cascade")).rejects.toThrow(/permission denied/);
    await expect(asStaff(db, DEMO_USER, "delete from menu_items")).rejects.toThrow(/permission denied/);
  });

  it("only one open waiter call per table", async () => {
    await db.query("select call_waiter('demo-table-1-token')");
    await expect(
      db.query("insert into waiter_calls (restaurant_id, table_id) select restaurant_id, table_id from waiter_calls"),
    ).rejects.toThrow(/duplicate key/);
  });

  it("idempotency key replayed from another table conflicts", async () => {
    const cart = [{ menuItemId: BUNNY_CHOW, quantity: 1 }];
    await submitOrder(db, "demo-table-1-token", "key-xtable01", cart);
    await expect(submitOrder(db, "demo-table-2-token", "key-xtable01", cart)).rejects.toThrow(/idempotency_conflict/);
  });

  it("huge order gets a stable error, not overflow", async () => {
    await db.query("update menu_items set price_cents = 1000000000 where id = $1", [BUNNY_CHOW]);
    await expect(
      submitOrder(db, "demo-table-1-token", "key-huge-001", [{ menuItemId: BUNNY_CHOW, quantity: 3 }]),
    ).rejects.toThrow(/order_too_large/);
  });
});
