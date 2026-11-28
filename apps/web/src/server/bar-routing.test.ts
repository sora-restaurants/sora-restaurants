import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { PRIMAVERA, OWNER_USER, COKE } from "../../../../supabase/tests/fixtures";
import { columns } from "../kitchen/board-state";
import type { Deps } from "./deps";
import { advanceOrder } from "./advance-order";
import { submitOrder } from "./submit-order";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const DRINKS_MENU = "a1000000-0000-0000-0000-00000000000c"; // Soft drinks & juice (Coca-Cola)
const MAINS_MENU = "a1000000-0000-0000-0000-000000000002"; // Insalate (Primavera Salad)

async function order(items = [{ menuItemId: PRIMAVERA, quantity: 1 }, { menuItemId: COKE, quantity: 2 }]) {
  const placed = await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: `k-${Math.random()}`, items }, deps);
  if (!placed.ok) throw new Error(placed.error);
  return (await db.query<{ id: string }>("select id from orders where public_ref = $1", [placed.publicRef])).rows[0].id;
}
const move = (id: string, to: string, station?: string) =>
  advanceOrder(new Request("http://x", { method: "POST", headers: { authorization: "Bearer token-A" }, body: JSON.stringify({ to, station }) }), id, deps);
const lines = async (id: string) =>
  (await db.query<{ name_snapshot: string; station: string; prep_status: string }>(
    "select name_snapshot, station, prep_status from order_items where order_id = $1 order by name_snapshot", [id])).rows;
const status = async (id: string) => (await db.query<{ status: string }>("select status from orders where id = $1", [id])).rows[0].status;

describe("bar routing", () => {
  it("sends drinks to the bar and food to the kitchen", async () => {
    const id = await order();
    expect((await lines(id)).map((l) => [l.name_snapshot, l.station])).toEqual([["Coca-Cola", "bar"], ["Primavera Salad", "kitchen"]]);
  });

  it("guesses by whole words only", async () => {
    const guess = async (item: string, category: string) =>
      (await db.query<{ s: string }>("select guess_station($1, $2) s", [item, category])).rows[0].s;
    for (const drink of ["Castle Lager", "Rooibos iced tea", "Gin & tonic", "Flat white", "Chenin Blanc", "Espresso Martini"]) expect(await guess(drink, "Specials"), drink).toBe("bar");
    for (const food of ["Steak", "Ginger chicken", "Watermelon salad", "Barbecue ribs", "Kale bowl"]) expect(await guess(food, "Mains"), food).toBe("kitchen");
    expect(await guess("Anything", "Cocktails")).toBe("bar");
  });

  it("a category set to Kitchen or Bar overrides the name guess; Auto goes back to guessing", async () => {
    await db.query("update menus set station = 'kitchen' where id = $1", [DRINKS_MENU]);
    await db.query("update menus set station = 'bar' where id = $1", [MAINS_MENU]);
    expect((await lines(await order())).map((l) => l.station)).toEqual(["kitchen", "bar"]);

    await deps.db.asUser(OWNER_USER, "select set_menu_station($1, 'auto')", [DRINKS_MENU]);
    await deps.db.asUser(OWNER_USER, "select set_menu_station($1, 'auto')", [MAINS_MENU]);
    expect((await lines(await order())).map((l) => l.station)).toEqual(["bar", "kitchen"]);
  });

  it("each station moves its own part; the order is ready only when both are", async () => {
    const id = await order();
    expect((await move(id, "preparing", "bar")).status).toBe(200);
    expect(await status(id)).toBe("preparing");
    expect((await lines(id)).map((l) => l.prep_status)).toEqual(["preparing", "new"]);

    expect((await move(id, "ready", "bar")).status).toBe(200);
    expect(await status(id)).toBe("preparing");
    expect((await move(id, "ready", "bar")).status).toBe(409); // nothing left for the bar

    expect((await move(id, "ready", "kitchen")).status).toBe(200); // straight to Ready works too
    expect(await status(id)).toBe("ready");
    expect((await move(id, "served")).status).toBe(200);
  });

  it("the board shows each station its own lines and stage", async () => {
    const id = await order();
    await move(id, "ready", "bar");
    const items = (await lines(id)).map((l) => ({ name: l.name_snapshot, quantity: 1, notes: "", station: l.station as "bar", prep: l.prep_status as "new" }));
    const board = { revoked: false, orders: { [id]: { id, publicRef: "X", table: "T4", status: await status(id), totalCents: 0, createdAt: "", paid: false, payAtTable: false, items } } };
    const where = (station: "all" | "kitchen" | "bar") => Object.fromEntries(columns(board, station).map((c) => [c.id, c.orders.map((o) => o.items.map((i) => i.name))]));

    expect(where("bar")).toEqual({ new: [], cooking: [], ready: [["Coca-Cola"]] });
    expect(where("kitchen")).toEqual({ new: [["Primavera Salad"]], cooking: [], ready: [] }); // the kitchen has not started
    expect(where("all")).toEqual({ new: [], cooking: [["Coca-Cola", "Primavera Salad"]], ready: [] });
    expect(columns(board, "bar")[2].orders[0].waitingOn).toBe("kitchen");
  });

  it("a whole-order move from the All screen keeps every line in step", async () => {
    const id = await order();
    await move(id, "preparing");
    await move(id, "ready");
    expect((await lines(id)).map((l) => l.prep_status)).toEqual(["ready", "ready"]);
  });

  it("rejects an unknown station", async () => {
    expect((await move(await order(), "ready", "pizza")).status).toBe(400);
  });
});
