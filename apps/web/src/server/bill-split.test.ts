import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db.ts";
import { BUNNY_CHOW, ROOIBOS } from "../../../../supabase/tests/fixtures.ts";
import { guestBill, guestSplit, markSharePaid, staffSplit } from "./bill-split.ts";
import type { Deps } from "./deps.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps.ts";
import { listTables, listUnpaid, markPaid } from "./unpaid.ts";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

type Share = { id: string; table: string; shareNo: number; amountCents: number };
type Bill = { shares: { shareNo: number; amountCents: number; paid: boolean; items: { name: string }[] }[]; openCents: number; items: { id: string; name: string; cents: number }[] };

// Bunny chow R125 + rooibos R35 = R160 at Table 4.
async function seatedTable() {
  const r = await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "split-key-0001",
    items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }, { menuItemId: ROOIBOS, quantity: 1 }] }, deps);
  if (!r.ok) throw new Error(r.error);
  const [{ id: tableId }] = (await db.query<{ id: string }>("select id from tables where qr_token = 'demo-table-4-token'")).rows;
  return { token: r.statusToken, tableId };
}
const staff = (token = "token-waiter", body?: unknown) =>
  new Request("http://sora.test", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
const guest = (body: unknown) => new Request("http://sora.test", { method: "POST", body: JSON.stringify(body) });
const bill = async (token: string) => (await (await guestBill(token, deps)).json()) as Bill;
const unpaid = async (token = "token-waiter") => (await (await listUnpaid(staff(token), deps)).json()) as { orders: unknown[]; shares: Share[] };
const orderPaid = async () => (await db.query<{ payment_status: string }>("select payment_status from orders")).rows[0].payment_status;

describe("bill splitting", () => {
  it("splits evenly in integer cents; the leftover cent goes to person 1", async () => {
    const { token, tableId } = await seatedTable();
    expect((await staffSplit(staff("token-waiter", { ways: 3 }), tableId, deps)).status).toBe(204);
    expect((await bill(token)).shares.map((s) => s.amountCents)).toEqual([5334, 5333, 5333]);
    const list = await unpaid();
    expect(list.orders).toEqual([]); // the order is now collected share by share
    expect(list.shares.map((s) => [s.table, s.shareNo, s.amountCents])).toEqual([["Table 4", 1, 5334], ["Table 4", 2, 5333], ["Table 4", 3, 5333]]);
  });

  it("splits by item: each pays their own dishes plus an even part of the rest", async () => {
    const { token } = await seatedTable();
    const bunny = (await bill(token)).items.find((i) => i.name === "Bunny chow")!;
    expect((await guestSplit(guest({ ways: 3, assign: { [bunny.id]: 1 } }), token, deps)).status).toBe(204);
    const { shares, openCents, items } = await bill(token);
    // R35 rooibos shared 3 ways: 1167 + 1167 + 1166.
    expect(shares.map((s) => s.amountCents)).toEqual([12500 + 1167, 1167, 1166]);
    expect(shares.reduce((sum, s) => sum + s.amountCents, 0)).toBe(16000);
    expect(shares[0].items.map((i) => i.name)).toEqual(["Bunny chow"]);
    expect(openCents).toBe(0);
    expect(items).toHaveLength(2); // still re-assignable: nobody has paid yet
  });

  it("can be redone until someone pays; refuses bad input", async () => {
    const { token, tableId } = await seatedTable();
    expect((await guestSplit(guest({ ways: 2 }), token, deps)).status).toBe(204);
    expect((await guestSplit(guest({ ways: 4 }), token, deps)).status).toBe(204);
    expect((await bill(token)).shares).toHaveLength(4);
    expect((await guestSplit(guest({ ways: 1 }), token, deps)).status).toBe(400);
    expect((await guestSplit(guest({ ways: 2, assign: { [crypto.randomUUID()]: 1 } }), token, deps)).status).toBe(400);
    const [first] = (await unpaid()).shares;
    expect((await markSharePaid(staff(), first.id, deps)).status).toBe(204);
    expect((await staffSplit(staff("token-waiter", { ways: 2 }), tableId, deps)).status).toBe(409);
  });

  it("marks each share paid; the table clears only when the last share is paid", async () => {
    const { token, tableId } = await seatedTable();
    await staffSplit(staff("token-waiter", { ways: 2 }), tableId, deps);
    const [a, b] = (await unpaid()).shares;
    const [{ id: orderId }] = (await db.query<{ id: string }>("select id from orders")).rows;
    expect((await markPaid(staff(), orderId, deps)).status).toBe(409); // split orders are paid share by share

    expect((await markSharePaid(staff(), a.id, deps)).status).toBe(204);
    expect((await markSharePaid(staff(), a.id, deps)).status).toBe(204); // a second tap is a no-op
    expect(await orderPaid()).toBe("unpaid");
    expect((await unpaid()).shares.map((s) => s.id)).toEqual([b.id]);
    const owes = async () => ((await (await listTables(staff(), deps)).json()).tables as { id: string; unpaidCents: number }[]).find((t) => t.id === tableId)!.unpaidCents;
    expect(await owes()).toBe(8000);

    expect((await markSharePaid(staff(), b.id, deps)).status).toBe(204);
    expect(await orderPaid()).toBe("paid");
    expect(await unpaid()).toEqual({ orders: [], shares: [] });
    expect(await owes()).toBe(0);
    // Everything is paid, so the table session closes (next scan starts a fresh visit) and the bill is gone.
    expect((await db.query<{ status: string }>("select status from table_sessions where table_id = $1", [tableId])).rows.map((r) => r.status)).toEqual(["closed"]);
    expect((await guestBill(token, deps)).status).toBe(404);
  });

  it("another restaurant's staff can't split, see or settle the bill", async () => {
    const { tableId } = await seatedTable();
    expect((await staffSplit(staff("token-B", { ways: 2 }), tableId, deps)).status).toBe(404);
    await staffSplit(staff("token-waiter", { ways: 2 }), tableId, deps);
    expect((await unpaid("token-B")).shares).toEqual([]);
    const [share] = (await unpaid()).shares;
    expect((await markSharePaid(staff("token-B"), share.id, deps)).status).toBe(404);
    expect((await unpaid()).shares).toHaveLength(2);
    expect((await markSharePaid(new Request("http://sora.test", { method: "POST" }), share.id, deps)).status).toBe(401);
  });
});
