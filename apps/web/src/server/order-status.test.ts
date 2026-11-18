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
    expect(await (await orderStatus(result.statusToken, deps)).json()).toEqual({ status: "submitted" });
    await db.query("update orders set status = 'served'");
    expect(await (await orderStatus(result.statusToken, deps)).json()).toEqual({ status: "served" });
    expect((await orderStatus("0".repeat(32), deps)).status).toBe(404);
    expect((await orderStatus("x'; drop", deps)).status).toBe(404);
  });
});
