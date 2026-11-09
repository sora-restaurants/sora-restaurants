import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, RUMP } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";
import { listUnpaid, markPaid } from "./unpaid.ts";

const DEV = { NODE_ENV: "development", DEV_SIMULATED_PAYMENTS: "1" };
let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const order = async (qrToken: string, menuItemId: string, key: string, paymentChoice = "pay_later") => {
  const r = await submitOrder({ qrToken, idempotencyKey: key, items: [{ menuItemId, quantity: 2 }], paymentChoice }, deps, DEV);
  if (!r.ok) throw new Error(r.error);
  return r;
};
const req = (token: string | null) => new Request("http://x", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });
const unpaid = async (token: string) => (await (await listUnpaid(req(token), deps)).json()).orders as { id: string; publicRef: string; table: string; totalCents: number }[];

describe("unpaid orders", () => {
  it("lists pay-after orders still to collect, with table and total; not unpaid pay-now orders", async () => {
    const later = await order("demo-table-4-token", BUNNY_CHOW, "key-unp-0001");
    await order("demo-table-4-token", BUNNY_CHOW, "key-unp-0002", "pay_now"); // waiting for payment, not in the kitchen
    expect(await unpaid("token-waiter")).toEqual([
      expect.objectContaining({ publicRef: later.publicRef, table: "Table 4", totalCents: 25000 }),
    ]);
  });

  it("marking an order paid takes it off the list", async () => {
    await order("demo-table-4-token", BUNNY_CHOW, "key-unp-0003");
    const [{ id }] = await unpaid("token-waiter");
    expect((await markPaid(req("token-waiter"), id, deps)).status).toBe(204);
    expect(await unpaid("token-waiter")).toEqual([]);
    expect((await db.query("select payment_status from orders")).rows).toEqual([{ payment_status: "paid" }]);
  });

  it("another restaurant's staff never see or settle it", async () => {
    await order("demo-table-4-token", BUNNY_CHOW, "key-unp-0004");
    await order("other-table-1-token", RUMP, "key-unp-0005");
    expect((await unpaid("token-B")).map((o) => o.table)).toEqual(["Table 1"]);
    const [{ id }] = await unpaid("token-waiter");
    expect((await markPaid(req("token-B"), id, deps)).status).toBe(404);
    expect(await unpaid("token-waiter")).toHaveLength(1);
  });

  it("needs a staff login and a real order id", async () => {
    expect((await listUnpaid(req(null), deps)).status).toBe(401);
    expect((await markPaid(req("token-waiter"), "not-a-uuid", deps)).status).toBe(404);
  });
});
