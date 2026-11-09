import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, DEMO_USER, OTHER, OTHER_USER, ROOIBOS, RUMP } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { ownerStats } from "./owner-stats.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const order = async (qrToken: string, items: { menuItemId: string; quantity: number }[], key: string) => {
  const r = await submitOrder({ qrToken, idempotencyKey: key, items }, deps);
  if (!r.ok) throw new Error(r.error);
  return (await db.query<{ id: string }>("select id from orders where public_ref = $1", [r.publicRef])).rows[0].id;
};
const stats = (token: string, period = "today") =>
  ownerStats(new Request(`http://x/api/owner/stats?period=${period}`, { headers: { authorization: `Bearer ${token}` } }), deps);

describe("owner dashboard", () => {
  it("summarises today's QR orders for the owner's restaurant, excluding rejected ones", async () => {
    await order("demo-table-4-token", [{ menuItemId: BUNNY_CHOW, quantity: 2 }, { menuItemId: ROOIBOS, quantity: 1 }], "key-own-0001");
    await order("demo-table-1-token", [{ menuItemId: ROOIBOS, quantity: 3 }], "key-own-0002");
    const rejected = await order("demo-table-2-token", [{ menuItemId: BUNNY_CHOW, quantity: 5 }], "key-own-0003");
    await deps.db.asUser(DEMO_USER, "select kitchen_move($1, 'rejected')", [rejected]);
    await order("other-table-1-token", [{ menuItemId: RUMP, quantity: 1 }], "key-own-0004"); // another restaurant

    const res = await stats("token-owner");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      restaurant: "Demo Bistro",
      scope: "qr_orders_only",
      orders: 2,
      revenueCents: 28500 + 10500,
      averageOrderCents: Math.round((28500 + 10500) / 2),
      rejectedOrCancelled: 1,
      topItems: [
        { name: "Rooibos iced tea", quantity: 4, revenueCents: 14000 },
        { name: "Bunny chow", quantity: 2, revenueCents: 25000 },
      ],
    });
  });

  it("only owners and managers may see it", async () => {
    expect((await stats("token-A")).status).toBe(403); // kitchen
    expect((await stats("token-waiter")).status).toBe(403);
    expect((await stats("nope")).status).toBe(401);
  });

  it("an owner of another restaurant sees only their own numbers", async () => {
    await db.query("insert into staff_memberships (restaurant_id, user_id, role) values ($1, $2, 'owner') on conflict (restaurant_id, user_id) do update set role = 'owner'", [OTHER, OTHER_USER]);
    await order("demo-table-4-token", [{ menuItemId: BUNNY_CHOW, quantity: 1 }], "key-own-0005");
    await order("other-table-1-token", [{ menuItemId: RUMP, quantity: 1 }], "key-own-0006");
    expect(await (await stats("token-B")).json()).toMatchObject({ restaurant: "Other Grill", orders: 1, revenueCents: 21000 });
  });

  it("rejects an unknown period", async () => {
    expect((await stats("token-owner", "forever")).status).toBe(400);
  });
});
