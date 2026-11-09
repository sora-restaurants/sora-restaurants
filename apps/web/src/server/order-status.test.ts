import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, DEMO_USER, RUMP } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { orderStatus } from "./order-status.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const place = async (qrToken: string, menuItemId: string, key: string) => {
  const r = await submitOrder({ qrToken, idempotencyKey: key, items: [{ menuItemId, quantity: 2 }] }, deps);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe("orderStatus", () => {
  it("returns the order's progress for its own status token", async () => {
    const { statusToken, publicRef } = await place("demo-table-4-token", BUNNY_CHOW, "key-status-01");
    const res = await orderStatus(statusToken, deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      publicRef,
      status: "submitted",
      totalCents: 25000,
      items: [{ name: "Bunny chow", quantity: 2 }],
    });
  });

  it("follows the kitchen's moves", async () => {
    const { statusToken } = await place("demo-table-4-token", BUNNY_CHOW, "key-status-02");
    const [{ id }] = (await db.query<{ id: string }>("select id from orders")).rows;
    await deps.db.asUser(DEMO_USER, "select kitchen_move($1, 'preparing')", [id]);
    expect((await (await orderStatus(statusToken, deps)).json()).status).toBe("preparing");
  });

  it("an unknown or malformed token is 404 and reveals nothing", async () => {
    await place("other-table-1-token", RUMP, "key-status-03");
    for (const token of ["nope", "", "x".repeat(500)]) {
      const res = await orderStatus(token, deps);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain("Rump");
    }
  });
});
