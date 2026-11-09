import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, DEMO, OTHER, ROOIBOS } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps";
import { kitchenStream } from "./kitchen-stream";
import { readEvents } from "./sse-test-helpers";
import { submitOrder } from "./submit-order";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const T4 = () => ({
  qrToken: "demo-table-4-token",
  idempotencyKey: "key-t4-0001",
  items: [
    { menuItemId: BUNNY_CHOW, quantity: 2 },
    { menuItemId: ROOIBOS, quantity: 1, notes: "no ice" },
  ],
});

const orderCount = async () => (await db.query<{ n: number }>("select count(*)::int n from orders")).rows[0].n;

function board(restaurantId: string, token?: string, signal?: AbortSignal) {
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  return kitchenStream(new Request(`http://x/api/kitchen/${restaurantId}/stream`, { headers, signal }), restaurantId, deps);
}

describe("checkout", () => {
  it("Table 4 at Restaurant A places a multi-item order", async () => {
    const result = await submitOrder(T4(), deps);
    expect(result.ok).toBe(true);
    const { rows } = await db.query(
      "select o.restaurant_id, t.label, o.total_cents from orders o join tables t on t.id = o.table_id",
    );
    expect(rows).toEqual([{ restaurant_id: DEMO, label: "Table 4", total_cents: 28500 }]);
  });

  it("client-supplied price is rejected", async () => {
    const input = T4();
    (input.items[0] as Record<string, unknown>).priceCents = 1;
    expect(await submitOrder(input, deps)).toEqual({ ok: false, httpStatus: 400, error: "unexpected_field" });
    expect(await orderCount()).toBe(0);
  });

  it("client-supplied restaurant or table is rejected", async () => {
    for (const extra of [{ restaurantId: OTHER }, { tableId: "11111111-1111-1111-1111-111111111111" }]) {
      expect(await submitOrder({ ...T4(), ...extra }, deps)).toEqual({
        ok: false, httpStatus: 400, error: "unexpected_field",
      });
    }
    expect(await orderCount()).toBe(0);
  });

  it("unknown QR token is 404", async () => {
    expect(await submitOrder({ ...T4(), qrToken: "nope" }, deps)).toEqual({
      ok: false, httpStatus: 404, error: "table_not_found",
    });
  });

  it("malformed body is 400", async () => {
    const stringQty = { ...T4(), items: [{ menuItemId: BUNNY_CHOW, quantity: "2" }] };
    for (const input of ["{", stringQty, { ...T4(), items: [] }]) {
      expect(await submitOrder(input, deps)).toEqual({ ok: false, httpStatus: 400, error: "invalid_items" });
    }
    expect(await orderCount()).toBe(0);
  });
});

describe("kitchen board", () => {
  it("A's board shows Table 4's order", async () => {
    await submitOrder(T4(), deps);
    const [snapshot] = await readEvents(await board(DEMO, "token-A"), 1);
    expect(snapshot.event).toBe("snapshot");
    expect(snapshot.data.orders).toHaveLength(1);
    expect(snapshot.data.orders[0]).toMatchObject({ table: "Table 4", totalCents: 28500 });
    expect(snapshot.data.orders[0].items).toContainEqual({ name: "Rooibos iced tea", quantity: 1, notes: "no ice" });
  });

  it("Restaurant B credentials on A's board get 403 and no data", async () => {
    const placed = await submitOrder(T4(), deps);
    const res = await board(DEMO, "token-B");
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(body).not.toContain(placed.ok ? placed.publicRef : "unreachable");
    expect(body).not.toContain("Bunny");
  });

  it("B's own board does not include A's order", async () => {
    await submitOrder(T4(), deps);
    const [snapshot] = await readEvents(await board(OTHER, "token-B"), 1);
    expect(snapshot.data.orders).toEqual([]);
  });

  it("new order is pushed to an open board", async () => {
    const res = await board(DEMO, "token-A");
    const reading = readEvents(res, 2);
    await new Promise((r) => setTimeout(r, 100));
    const placed = await submitOrder(T4(), deps);
    const [snapshot, pushed] = await reading;
    expect(snapshot.data.orders).toEqual([]);
    expect(pushed.event).toBe("order");
    expect(pushed.data.publicRef).toBe(placed.ok && placed.publicRef);
  });

  it("no or bad token is 401", async () => {
    expect((await board(DEMO)).status).toBe(401);
    expect((await board(DEMO, "nope")).status).toBe(401);
  });

  it("inactive staff are refused", async () => {
    await db.query("update staff_memberships set status = 'inactive' where restaurant_id = $1 and role = 'kitchen'", [DEMO]);
    expect((await board(DEMO, "token-A")).status).toBe(403);
  });

  it("waiter is refused", async () => {
    expect((await board(DEMO, "token-waiter")).status).toBe(403);
  });

  it("garbage restaurant id is 403", async () => {
    expect((await board("not-a-uuid", "token-A")).status).toBe(403);
  });
});
