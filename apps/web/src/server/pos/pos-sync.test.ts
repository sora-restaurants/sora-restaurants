import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../../supabase/tests/db";
import { PRIMAVERA, COKE } from "../../../../../supabase/tests/fixtures";
import type { Deps } from "../deps.ts";
import { submitOrder } from "../submit-order.ts";
import { testDeps } from "../test-deps";
import type { PosAdapter, PosOrder } from "./adapter.ts";
import { syncPendingOrders } from "./sync.ts";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const order = (key: string) =>
  submitOrder(
    { qrToken: "demo-table-4-token", idempotencyKey: key, items: [{ menuItemId: PRIMAVERA, quantity: 2 }, { menuItemId: COKE, quantity: 1 }] },
    deps,
  );
const jobs = async () => (await db.query("select status, attempts, external_ref from pos_sync_jobs order by created_at")).rows;
const till = (fail = false) => {
  const received: PosOrder[] = [];
  const adapter: PosAdapter = {
    name: "test",
    async sendOrder(o) {
      if (fail) throw new Error("till offline");
      received.push(o);
      return { externalRef: `TILL-${received.length}` };
    },
  };
  return { adapter, received };
};
// Make failed jobs due again without waiting for the backoff.
const fastForward = () => db.query("update pos_sync_jobs set next_attempt_at = now() - interval '1 second'");

describe("POS sync", () => {
  it("every new order gets a pending till job", async () => {
    await order("key-pos-0001");
    expect(await jobs()).toEqual([{ status: "pending", attempts: 0, external_ref: null }]);
  });

  it("sends the priced order to the till once and records the till's reference", async () => {
    await order("key-pos-0002");
    const { adapter, received } = till();
    expect(await syncPendingOrders(deps, adapter)).toEqual({ sent: 1, failed: 0 });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ table: "Table 4", totalCents: 28500, vatCents: 3717, restaurant: "Donna's" });
    expect(received[0].lines).toEqual([
      { name: "Coca-Cola", quantity: 1, unitPriceCents: 3500, notes: "" },
      { name: "Primavera Salad", quantity: 2, unitPriceCents: 12500, notes: "" },
    ]);
    expect(await jobs()).toEqual([{ status: "sent", attempts: 1, external_ref: "TILL-1" }]);
    await syncPendingOrders(deps, adapter);
    expect(received).toHaveLength(1); // never sent twice
  });

  it("a till outage never touches the order, and the job retries later", async () => {
    await order("key-pos-0003");
    expect(await syncPendingOrders(deps, till(true).adapter)).toEqual({ sent: 0, failed: 1 });
    expect(await jobs()).toEqual([{ status: "failed", attempts: 1, external_ref: null }]);
    expect((await db.query("select status from orders")).rows).toEqual([{ status: "submitted" }]);
    expect(await syncPendingOrders(deps, till().adapter)).toEqual({ sent: 0, failed: 0 }); // backing off
    await fastForward();
    expect(await syncPendingOrders(deps, till().adapter)).toEqual({ sent: 1, failed: 0 });
  });

  it("gives up after 8 attempts so a broken order cannot loop forever", async () => {
    await order("key-pos-0004");
    for (let i = 0; i < 9; i++) {
      await syncPendingOrders(deps, till(true).adapter);
      await fastForward();
    }
    expect(await jobs()).toEqual([{ status: "dead", attempts: 8, external_ref: null }]);
  });
});
