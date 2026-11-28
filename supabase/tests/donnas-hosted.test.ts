import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { freshDb } from "./db";
import { submitOrder } from "./fixtures";

// The one-off script for the live Supabase project must run on top of the hosted demo data and give a working menu.
describe("donnas-hosted.sql", () => {
  it("adds Donna's with its full menu and an orderable table", async () => {
    const db = await freshDb();
    await db.exec(readFileSync(join(__dirname, "..", "staging-seed.sql"), "utf8"));
    await db.exec(readFileSync(join(__dirname, "..", "donnas-hosted.sql"), "utf8"));
    await db.exec(readFileSync(join(__dirname, "..", "donnas-photos.sql"), "utf8"));
    const { m } = (await db.query<{ m: { restaurant: string; categories: { items: { options: unknown[]; imageUrl: string | null }[] }[] } }>(
      "select get_table_menu('donnas-table-4') m")).rows[0];
    const items = m.categories.flatMap((c) => c.items);
    expect(m.restaurant).toBe("Donna's");
    expect(m.categories).toHaveLength(22);
    expect(items).toHaveLength(348);
    expect(items.filter((i) => !i.imageUrl?.startsWith("https://images.unsplash.com/photo-"))).toEqual([]);
    expect(items.filter((i) => i.options.length).length).toBeGreaterThan(50);
    const r = await submitOrder(db, "donnas-table-4", "donna-key-0001", [{ menuItemId: "e2000000-0000-0000-0000-000000000001", quantity: 1 }]);
    expect(r.publicRef).toBeTruthy();
  });
});
