import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db.ts";
import { PRIMAVERA } from "../../../../supabase/tests/fixtures.ts";
import { sendReceiptAction } from "../app/actions/send-receipt.ts";
import { ownerCommand } from "./owner-operations.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps.ts";
import { markPaid } from "./unpaid.ts";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); });
const order = (n: number) => ({ qrToken: "demo-table-4-token", idempotencyKey: `flood-key-${n}`, items: [{ menuItemId: PRIMAVERA, quantity: 1 }] });
const staff = (path: string, token = "token-waiter") => new Request(`http://sora.test${path}`, { method: "POST", headers: { authorization: `Bearer ${token}` } });

describe("audit fixes", () => {
  it("caps a flood of orders from one table, but replays still work", async () => {
    const deps = testDeps(db);
    for (let n = 0; n < 10; n++) expect((await submitOrder(order(n), deps)).ok).toBe(true);
    expect(await submitOrder(order(10), deps)).toEqual({ ok: false, httpStatus: 429, error: "rate_limited" });
    expect((await submitOrder(order(3), deps)).ok).toBe(true); // retry of an order already placed
  });

  it("marks paid once, and never a cancelled order", async () => {
    const deps = testDeps(db);
    expect((await submitOrder(order(1), deps)).ok).toBe(true);
    const [{ id }] = (await db.query<{ id: string }>("select id from orders")).rows;
    expect((await markPaid(staff(`/api/staff/orders/${id}/paid`), id, deps)).status).toBe(204);
    const first = (await db.query<{ paid_at: string }>("select paid_at::text from orders")).rows[0].paid_at;
    expect((await markPaid(staff(`/api/staff/orders/${id}/paid`), id, deps)).status).toBe(204);
    expect((await db.query<{ paid_at: string }>("select paid_at::text from orders")).rows[0].paid_at).toBe(first);
    await db.query("update orders set status = 'cancelled', payment_status = 'unpaid'");
    expect((await markPaid(staff(`/api/staff/orders/${id}/paid`), id, deps)).status).toBe(409);
  });

  it("owner commands report real faults as 500, not 'not found'", async () => {
    const deps = testDeps(db);
    deps.db.asUser = async () => { throw new Error("connection terminated"); };
    const body = JSON.stringify({ action: "close", tableId: "00000000-0000-4000-8000-000000000000" });
    const res = await ownerCommand(new Request("http://sora.test/api/owner", { method: "POST", body, headers: { authorization: "Bearer token-owner" } }), deps);
    expect(res.status).toBe(500);
  });

  it("receipt accepts ordinary addresses that contain an 's'", async () => {
    // Past validation it stops at the missing key or order, never at "invalid".
    const result = await sendReceiptAction({ to: "james@sora.co.za", statusToken: "0".repeat(32), splitWays: 1, weeklySpecials: false });
    expect(result).not.toEqual({ ok: false, error: "invalid" });
    expect(await sendReceiptAction({ to: "not an email", statusToken: "0".repeat(32), splitWays: 1, weeklySpecials: false })).toEqual({ ok: false, error: "invalid" });
  });
});
