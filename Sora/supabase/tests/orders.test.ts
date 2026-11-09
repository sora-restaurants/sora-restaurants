import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./db";
import { BUNNY_CHOW, RUMP, submitOrder } from "./fixtures";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); });

const orderCount = async () => (await db.query<{ n: number }>("select count(*)::int n from orders")).rows[0].n;

describe("submit_order", () => {
  it("VAT-inclusive total at 15%", async () => {
    await submitOrder(db, "demo-table-1-token", "key-vat-0001", [{ menuItemId: BUNNY_CHOW, quantity: 1 }]);
    const { rows } = await db.query("select total_cents, vat_cents from orders");
    expect(rows).toEqual([{ total_cents: 12500, vat_cents: 1630 }]);
  });

  it("no VAT when not registered", async () => {
    await submitOrder(db, "other-table-1-token", "key-vat-0002", [{ menuItemId: RUMP, quantity: 1 }]);
    const { rows } = await db.query("select total_cents, vat_cents from orders");
    expect(rows).toEqual([{ total_cents: 21000, vat_cents: 0 }]);
  });

  it("foreign menu item rejected", async () => {
    await expect(
      submitOrder(db, "demo-table-1-token", "key-foreign1", [{ menuItemId: RUMP, quantity: 1 }]),
    ).rejects.toThrow(/item_unavailable/);
    expect(await orderCount()).toBe(0);
  });

  it("same key replays", async () => {
    const cart = [{ menuItemId: BUNNY_CHOW, quantity: 2 }];
    const first = await submitOrder(db, "demo-table-1-token", "key-replay01", cart);
    const second = await submitOrder(db, "demo-table-1-token", "key-replay01", cart);
    expect(await orderCount()).toBe(1);
    expect(second).toMatchObject({ replayed: true, statusToken: first.statusToken });
  });

  it("same key different cart conflicts", async () => {
    await submitOrder(db, "demo-table-1-token", "key-conflict", [{ menuItemId: BUNNY_CHOW, quantity: 1 }]);
    await expect(
      submitOrder(db, "demo-table-1-token", "key-conflict", [{ menuItemId: BUNNY_CHOW, quantity: 3 }]),
    ).rejects.toThrow(/idempotency_conflict/);
    expect(await orderCount()).toBe(1);
  });
});
