import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asStaff, freshDb } from "./db";
import { BUNNY_CHOW, DEMO, DEMO_USER, OTHER, OTHER_USER, RUMP, submitOrder } from "./fixtures";

let db: PGlite;
let demoOrderId: string;
let otherOrderId: string;

beforeEach(async () => {
  db = await freshDb();
  await submitOrder(db, "demo-table-1-token", "key-demo-001", [{ menuItemId: BUNNY_CHOW, quantity: 1 }]);
  await submitOrder(db, "other-table-1-token", "key-other-01", [{ menuItemId: RUMP, quantity: 1 }]);
  const ids = (await db.query<{ id: string; restaurant_id: string }>("select id, restaurant_id from orders")).rows;
  demoOrderId = ids.find((r) => r.restaurant_id === DEMO)!.id;
  otherOrderId = ids.find((r) => r.restaurant_id === OTHER)!.id;
});

describe("cross-restaurant isolation", () => {
  it("staff see own restaurant only", async () => {
    for (const table of ["orders", "tables", "menus", "menu_items", "order_items", "print_jobs"]) {
      const rows = await asStaff<{ restaurant_id: string }>(db, DEMO_USER, `select restaurant_id from ${table}`);
      expect(rows.length, table).toBeGreaterThan(0);
      expect(rows.every((r) => r.restaurant_id === DEMO), table).toBe(true);
    }
    expect(await asStaff(db, DEMO_USER, "select id from restaurants")).toEqual([{ id: DEMO }]);
  });

  it("other staff cannot read or advance", async () => {
    expect(await asStaff(db, OTHER_USER, "select id from orders where restaurant_id = $1", [DEMO])).toEqual([]);
    await expect(
      asStaff(db, OTHER_USER, "select advance_order($1, 'accepted')", [demoOrderId]),
    ).rejects.toThrow(/not_found/);
    // Own order still works, so the denial above is about the restaurant, not the function.
    await asStaff(db, OTHER_USER, "select advance_order($1, 'accepted')", [otherOrderId]);
  });

  it("inactive membership sees nothing", async () => {
    await db.query("update staff_memberships set status = 'inactive' where user_id = $1", [DEMO_USER]);
    expect(await asStaff(db, DEMO_USER, "select id from orders")).toEqual([]);
  });

  it("suspended restaurant sees nothing", async () => {
    await db.query("update restaurants set status = 'suspended' where id = $1", [DEMO]);
    expect(await asStaff(db, DEMO_USER, "select id from orders")).toEqual([]);
  });

  it("anon and authenticated cannot call customer functions", async () => {
    await expect(
      asStaff(db, DEMO_USER, "select submit_order('demo-table-1-token', 'key-staff-01', '[]'::jsonb)"),
    ).rejects.toThrow(/permission denied/);
  });

  it("cross-restaurant FK impossible", async () => {
    await expect(
      db.query(
        "insert into order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_cents, quantity) values ($1, $2, $3, 'x', 1, 1)",
        [DEMO, otherOrderId, BUNNY_CHOW],
      ),
    ).rejects.toThrow(/foreign key/);
  });
});
