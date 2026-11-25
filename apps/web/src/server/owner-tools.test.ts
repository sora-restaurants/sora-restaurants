import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db.ts";
import { BUNNY_CHOW, DEMO, OTHER } from "../../../../supabase/tests/fixtures.ts";
import { forStation } from "../kitchen/board-state.ts";
import { lineExtraCents } from "../components/menu/customise-options.ts";
import type { Deps, KitchenOrder } from "./deps.ts";
import { kitchenStream } from "./kitchen-stream.ts";
import { ownerCommand, ownerReport, ownerSnapshot, ownerStats } from "./owner-operations.ts";
import { readEvents } from "./sse-test-helpers.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps.ts";
import { listTables } from "./unpaid.ts";

let db: PGlite;
let deps: Deps;
beforeEach(async () => { db = await freshDb(); deps = testDeps(db); });

const owner = (path = "", body?: object, token = "token-owner") => new Request(`http://sora.test/api/owner${path}`,
  body ? { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${token}` } } : { headers: { authorization: `Bearer ${token}` } });
const command = async (body: object, token?: string) => ownerCommand(owner("", body, token), deps);
const order = (notes?: string, key = "k-opt-0001") => submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: key,
  items: [{ menuItemId: BUNNY_CHOW, quantity: 2, ...(notes ? { notes } : {}) }] }, deps);
const one = async <T,>(sql: string) => (await db.query<T>(sql)).rows[0];

describe("owner-set options", () => {
  it("are priced by the server from the dish's own list, and the built-in list no longer applies", async () => {
    expect((await command({ action: "addOption", itemId: BUNNY_CHOW, label: "Extra cheese", priceCents: 1500 })).status).toBe(200);
    const base = (await one<{ price_cents: number }>(`select price_cents from menu_items where id = '${BUNNY_CHOW}'`)).price_cents;
    // "Bacon" is a built-in R20 add-on; on a dish with its own options it costs nothing.
    expect((await order("Extra cheese (+R 15,00), Bacon (+R 20,00)")).ok).toBe(true);
    expect(await one("select unit_price_cents, quantity from order_items")).toEqual({ unit_price_cents: base + 1500, quantity: 2 });
    expect(lineExtraCents({ options: [{ label: "Extra cheese", priceCents: 1500 }] }, ["Extra cheese (+R 15,00)", "Bacon (+R 20,00)"])).toBe(1500);
  });

  it("refuse commas, and only the owner's own restaurant can be changed", async () => {
    expect((await command({ action: "addOption", itemId: BUNNY_CHOW, label: "Salt, pepper", priceCents: 0 })).status).toBe(400);
    expect((await command({ action: "addOption", itemId: BUNNY_CHOW, label: "Hack", priceCents: 0 }, "token-B")).status).toBe(404);
  });

  it("show on the guest menu with allergens", async () => {
    await command({ action: "addOption", itemId: BUNNY_CHOW, label: "Large", priceCents: 2000 });
    const { name } = await one<{ name: string }>(`select name from menu_items where id = '${BUNNY_CHOW}'`);
    expect((await command({ action: "updateItem", itemId: BUNNY_CHOW, name, description: "", priceCents: 9000, imageUrl: null,
      dietaryTags: [], available: true, soldOut: false, allergens: ["Gluten", "Milk"] })).status).toBe(200);
    const menu = (await one<{ m: { categories: { items: { id: string; allergens: string[]; options: { label: string }[] }[] }[] } }>("select get_table_menu('demo-table-4-token') m")).m;
    const item = menu.categories.flatMap((c) => c.items).find((i) => i.id === BUNNY_CHOW)!;
    expect(item.allergens).toEqual(["Gluten", "Milk"]);
    expect(item.options.map((o) => o.label)).toEqual(["Large"]);
  });
});

describe("kitchen and bar", () => {
  it("each ticket line carries its category's station, and a bar screen sees only drinks", async () => {
    const { menu_id } = await one<{ menu_id: string }>(`select menu_id from menu_items where id = '${BUNNY_CHOW}'`);
    expect((await command({ action: "setStation", menuId: menu_id, station: "bar" })).status).toBe(200);
    await order();
    const ac = new AbortController();
    const res = await kitchenStream(new Request(`http://x/api/kitchen/${DEMO}/stream`, { headers: { authorization: "Bearer token-A" }, signal: ac.signal }), DEMO, deps);
    const [first] = await readEvents(res, 1);
    ac.abort();
    const orders = first.data.orders as KitchenOrder[];
    expect(orders[0].items[0].station).toBe("bar");
    expect(forStation(orders, "kitchen")).toEqual([]);
    expect(forStation(orders, "bar")).toHaveLength(1);
  });
});

describe("receipts", () => {
  it("one receipt per order", async () => {
    const result = await order();
    if (!result.ok) throw new Error("order failed");
    const claim = () => deps.db.asService<{ ok: boolean }>("select claim_receipt($1) ok", [result.statusToken]);
    expect((await claim())[0].ok).toBe(true);
    expect((await claim())[0].ok).toBe(false);
  });
});

describe("reports and branches", () => {
  it("sums sales by day and ranks dishes", async () => {
    await order();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
    const res = await ownerReport(owner(`/report?from=${today}&to=${today}`), deps);
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report.days).toHaveLength(1);
    expect(report.days[0].orders).toBe(1);
    expect(report.topItems[0].quantity).toBe(2);
    expect((await ownerReport(owner("/report?from=2026-12-01&to=2026-01-01"), deps)).status).toBe(400);
  });

  it("dashboard stats for today, 7 and 30 days count QR orders by hour or by day, without rejected ones", async () => {
    for (const key of ["k-st-0001", "k-st-0002", "k-st-0003", "k-st-0004"]) expect((await order(undefined, key)).ok).toBe(true);
    const ids = (await db.query<{ id: string }>("select id from orders order by created_at")).rows.map((r) => r.id);
    await db.query(`update orders set created_at = now() - interval '3 days' where id = '${ids[1]}'`);
    await db.query(`update orders set created_at = now() - interval '10 days' where id = '${ids[2]}'`);
    await db.query(`update orders set status = 'rejected' where id = '${ids[3]}'`);
    await db.query(`update orders set tip_cents = 1000 where id = '${ids[0]}'`);
    const stats = async (period: string) => (await ownerStats(owner(`/stats?period=${period}`), deps)).json();
    const [today, week, month] = [await stats("today"), await stats("7d"), await stats("30d")];
    expect([today.orders, week.orders, month.orders]).toEqual([1, 2, 3]);
    expect(month.valueCents).toBe(3 * today.valueCents); // tips are not in the order value
    expect([today.tipCents, month.tipCents]).toEqual([1000, 1000]);
    expect(today.byTable).toEqual([{ table: expect.any(String), orders: 1, valueCents: today.valueCents, tipCents: 1000 }]);
    expect(today.series.at(-1).label).toMatch(/^\d\d:00$/);
    expect([week.series.length, month.series.length]).toEqual([7, 30]);
    expect(month.topItems).toEqual([{ name: expect.any(String), quantity: 6 }]);
    expect((await ownerStats(owner("/stats?period=year"), deps)).status).toBe(400);
    expect((await ownerStats(owner("/stats", undefined, "token-nobody"), deps)).status).toBe(401);
  });

  it("an owner can't open another company's branch by changing the id", async () => {
    const body = await (await ownerSnapshot(owner(`?restaurant=${OTHER}`), deps)).json();
    expect(body.restaurantId).toBe(DEMO);
    expect(body.snapshot.restaurants.map((r: { id: string }) => r.id)).toEqual([DEMO]);
  });
});

describe("staff", () => {
  it("owner adds an existing user, invites a new one, and removes access", async () => {
    await db.query("insert into auth.users (id, email) values ('d0000000-0000-0000-0000-000000000009', 'chef@demo.test')");
    expect((await command({ action: "inviteStaff", restaurantId: DEMO, email: "Chef@demo.test", role: "kitchen" })).status).toBe(200);
    expect((await command({ action: "inviteStaff", restaurantId: DEMO, email: "new@demo.test", role: "waiter" })).status).toBe(501);
    deps.inviteUser = async (email) => {
      await db.query("insert into auth.users (id, email) values ('d0000000-0000-0000-0000-000000000010', $1)", [email]);
      return "d0000000-0000-0000-0000-000000000010";
    };
    expect((await command({ action: "inviteStaff", restaurantId: DEMO, email: "new@demo.test", role: "waiter" })).status).toBe(200);
    const staff = (await (await ownerSnapshot(owner(), deps)).json()).snapshot.staff as { id: string; email: string; role: string; status: string }[];
    expect(staff.map((s) => s.email)).toEqual(expect.arrayContaining(["chef@demo.test", "new@demo.test"]));
    const chef = staff.find((s) => s.email === "chef@demo.test")!;
    expect((await command({ action: "setStaffStatus", membershipId: chef.id, status: "inactive" })).status).toBe(200);
    expect((await one<{ status: string }>(`select status from staff_memberships where id = '${chef.id}'`)).status).toBe("inactive");
    // The owner can't be switched off, and kitchen staff can't invite anyone.
    const self = staff.find((s) => s.role === "owner")!;
    expect((await command({ action: "setStaffStatus", membershipId: self.id, status: "inactive" })).status).toBe(400);
    expect((await command({ action: "inviteStaff", restaurantId: DEMO, email: "x@demo.test", role: "manager" }, "token-A")).status).toBe(404);
  });
});

describe("waiter floor", () => {
  it("lists the waiter's own tables with what's cooking and owed; kitchen staff see none", async () => {
    await order();
    const res = await listTables(new Request("http://x/api/staff/tables", { headers: { authorization: "Bearer token-waiter" } }), deps);
    const { tables } = await res.json();
    const t4 = tables.find((t: { label: string }) => t.label === "Table 4");
    expect(t4).toMatchObject({ orders: 1, inKitchen: 1, calling: false });
    expect(t4.unpaidCents).toBeGreaterThan(0);
    const kitchen = await (await listTables(new Request("http://x", { headers: { authorization: "Bearer token-A" } }), deps)).json();
    expect(kitchen.tables).toEqual([]);
  });
});
