import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, OTHER, OTHER_USER } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { getMenuAdmin, saveMenuItem, setItemAvailable } from "./menu-admin.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";

const MAINS = "a1000000-0000-0000-0000-000000000001";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const req = (token: string, body?: unknown) =>
  new Request("http://x", { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
const customerMenu = async () =>
  (await db.query<{ m: { categories: { items: { name: string; priceCents: number }[] }[] } }>("select get_table_menu('demo-table-4-token') m")).rows[0].m.categories.flatMap((c) => c.items);

describe("menu editing", () => {
  it("an owner adds a dish and changes a price; customers see both", async () => {
    const added = await saveMenuItem(req("token-owner", { menuId: MAINS, name: "Vetkoek with mince", description: "Two, with curried mince", priceCents: 7500 }), deps);
    expect(added.status).toBe(200);
    expect((await saveMenuItem(req("token-owner", { id: BUNNY_CHOW, name: "Bunny chow", description: "Quarter loaf, mutton curry", priceCents: 13000 }), deps)).status).toBe(200);
    const items = await customerMenu();
    expect(items).toContainEqual(expect.objectContaining({ name: "Vetkoek with mince", priceCents: 7500 }));
    expect(items).toContainEqual(expect.objectContaining({ name: "Bunny chow", priceCents: 13000 }));
  });

  it("the kitchen marks a dish sold out: it leaves the menu and cannot be ordered", async () => {
    expect((await setItemAvailable(req("token-A", { available: false }), BUNNY_CHOW, deps)).status).toBe(204);
    expect((await customerMenu()).map((i) => i.name)).not.toContain("Bunny chow");
    const order = await submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: "key-soldout-1", items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }] }, deps);
    expect(order).toMatchObject({ ok: false, error: "item_unavailable" });
    expect((await setItemAvailable(req("token-A", { available: true }), BUNNY_CHOW, deps)).status).toBe(204);
    expect((await customerMenu()).map((i) => i.name)).toContain("Bunny chow");
  });

  it("the kitchen may mark sold out but not change prices; waiters can do neither", async () => {
    expect((await saveMenuItem(req("token-A", { id: BUNNY_CHOW, name: "Bunny chow", description: "", priceCents: 1 }), deps)).status).toBe(404);
    expect((await setItemAvailable(req("token-waiter", { available: false }), BUNNY_CHOW, deps)).status).toBe(404);
    expect((await customerMenu()).find((i) => i.name === "Bunny chow")?.priceCents).toBe(12500);
  });

  it("another restaurant's owner cannot touch this menu", async () => {
    await db.query("update staff_memberships set role = 'owner' where restaurant_id = $1 and user_id = $2", [OTHER, OTHER_USER]);
    expect((await saveMenuItem(req("token-B", { id: BUNNY_CHOW, name: "Hacked", description: "", priceCents: 1 }), deps)).status).toBe(404);
    expect((await saveMenuItem(req("token-B", { menuId: MAINS, name: "Hacked", description: "", priceCents: 1 }), deps)).status).toBe(404);
    expect((await setItemAvailable(req("token-B", { available: false }), BUNNY_CHOW, deps)).status).toBe(404);
    expect((await customerMenu()).map((i) => i.name)).not.toContain("Hacked");
  });

  it("refuses nonsense prices and names", async () => {
    for (const body of [
      { menuId: MAINS, name: "", description: "", priceCents: 100 },
      { menuId: MAINS, name: "Free lunch", description: "", priceCents: -1 },
      { menuId: MAINS, name: "Gold", description: "", priceCents: 12.5 },
      { menuId: MAINS, name: "X", description: "", priceCents: 100, restaurantId: OTHER },
    ]) {
      expect((await saveMenuItem(req("token-owner", body), deps)).status).toBe(400);
    }
  });

  it("lists the whole menu, sold-out dishes included, with what the user may do", async () => {
    await setItemAvailable(req("token-A", { available: false }), BUNNY_CHOW, deps);
    const owner = await (await getMenuAdmin(req("token-owner"), deps)).json();
    expect(owner).toMatchObject({ restaurant: "Demo Bistro", canEdit: true });
    expect(owner.menus.flatMap((m: { items: { name: string; available: boolean }[] }) => m.items)).toContainEqual(
      expect.objectContaining({ name: "Bunny chow", available: false }),
    );
    expect(await (await getMenuAdmin(req("token-A"), deps)).json()).toMatchObject({ canEdit: false });
    expect((await getMenuAdmin(req("token-waiter"), deps)).status).toBe(403);
  });
});
