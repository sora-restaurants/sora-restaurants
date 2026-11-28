import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asStaff, freshDb } from "./db";
import { PRIMAVERA, OWNER_USER, WAITER_USER, submitOrder } from "./fixtures";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); });

async function demoTableId() {
  return (await db.query<{ id: string }>("select id from tables where qr_token = 'demo-table-1-token'" )).rows[0].id;
}

describe("table sessions", () => {
  it("enforces at most one open session per table", async () => {
    const tableId = await demoTableId();
    await expect(db.query(
      "insert into table_sessions (restaurant_id, table_id, opened_by) values ($1, $2, $3)",
      ["a0000000-0000-0000-0000-000000000001", tableId, OWNER_USER],
    )).rejects.toThrow(/table_sessions_one_open_per_table/);
  });

  it("rejects checkout after closure and keeps accepted orders linked", async () => {
    const tableId = await demoTableId();
    const accepted = await submitOrder(db, "demo-table-1-token", "session-before-close", [{ menuItemId: PRIMAVERA, quantity: 1 }]);
    await asStaff(db, OWNER_USER, "select close_table_session($1)", [tableId]);
    await expect(submitOrder(db, "demo-table-1-token", "session-after-close", [{ menuItemId: PRIMAVERA, quantity: 1 }]))
      .rejects.toThrow(/TABLE_SESSION_NOT_ACTIVE/);
    const rows = (await db.query<{ public_ref: string; table_session_id: string }>("select public_ref, table_session_id from orders")).rows;
    expect(rows).toEqual([{ public_ref: accepted.publicRef, table_session_id: expect.any(String) }]);
  });

  it("paying closes the table session once nothing is unpaid, and the next guest gets a new session", async () => {
    const tableId = await demoTableId();
    const sessions = () => db.query<{ id: string; status: string }>("select id, status from table_sessions where table_id = $1 order by opened_at", [tableId]);
    await submitOrder(db, "demo-table-1-token", "session-paid-a", [{ menuItemId: PRIMAVERA, quantity: 1 }]);
    await submitOrder(db, "demo-table-1-token", "session-paid-b", [{ menuItemId: PRIMAVERA, quantity: 1 }]);
    const ids = (await db.query<{ id: string; status_token: string }>("select id, status_token from orders order by created_at, id")).rows;
    await asStaff(db, WAITER_USER, "select mark_order_paid($1)", [ids[0].id]);
    expect((await sessions()).rows.map((r) => r.status)).toEqual(["open"]); // the other order is still unpaid
    await asStaff(db, WAITER_USER, "select mark_order_paid($1)", [ids[1].id]);
    const closed = (await sessions()).rows;
    expect(closed.map((r) => r.status)).toEqual(["closed"]);
    expect((await db.query<{ s: { paymentStatus: string } }>("select get_order_status($1) s", [ids[1].status_token])).rows[0].s.paymentStatus).toBe("paid");
    await expect(submitOrder(db, "demo-table-1-token", "session-paid-after", [{ menuItemId: PRIMAVERA, quantity: 1 }])).rejects.toThrow(/TABLE_SESSION_NOT_ACTIVE/);
    await asStaff(db, OWNER_USER, "select open_table_session($1)", [tableId]);
    await submitOrder(db, "demo-table-1-token", "session-next-guest", [{ menuItemId: PRIMAVERA, quantity: 1 }]);
    const fresh = (await sessions()).rows[1];
    expect(fresh.id).not.toBe(closed[0].id);
    expect((await db.query("select 1 from orders where table_session_id = $1", [fresh.id])).rows).toHaveLength(1);
  });

  it("owner can close and reopen, but a waiter cannot", async () => {
    const tableId = await demoTableId();
    await asStaff(db, OWNER_USER, "select close_table_session($1)", [tableId]);
    await asStaff(db, OWNER_USER, "select open_table_session($1)", [tableId]);
    await expect(asStaff(db, "c0000000-0000-0000-0000-000000000003", "select close_table_session($1)", [tableId]))
      .rejects.toThrow(/not_found/);
  });

  it("rotating a QR invalidates the old token and resolves the new token", async () => {
    const tableId = await demoTableId();
    const [rotated] = await asStaff<{ rotate_table_qr: string }>(db, OWNER_USER, "select rotate_table_qr($1)", [tableId]);
    expect((await db.query<{ m: unknown }>("select get_table_menu('demo-table-1-token') m")).rows[0].m).toBeNull();
    expect((await db.query<{ m: { table: string } }>("select get_table_menu($1) m", [rotated.rotate_table_qr])).rows[0].m.table).toBe("Table 1");
  });

  it("shows sold-out dishes but refuses them at checkout", async () => {
    await db.query("update menu_items set sold_out = true where id = $1", [PRIMAVERA]);
    const menu = (await db.query<{ m: { categories: { items: { id: string; soldOut: boolean }[] }[] } }>("select get_table_menu('demo-table-1-token') m")).rows[0].m;
    expect(menu.categories.flatMap((category) => category.items).find((item) => item.id === PRIMAVERA)?.soldOut).toBe(true);
    await expect(submitOrder(db, "demo-table-1-token", "sold-out-dish", [{ menuItemId: PRIMAVERA, quantity: 1 }]))
      .rejects.toThrow(/item_unavailable/);
  });
});
