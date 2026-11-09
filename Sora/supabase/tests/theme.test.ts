import { describe, expect, it } from "vitest";
import { freshDb } from "./db";
import { DEMO } from "./fixtures";

describe("restaurant theme", () => {
  it("defaults to fast-casual-vibrant and rejects unknown themes", async () => {
    const db = await freshDb();
    const { rows } = await db.query("insert into restaurants (name, slug) values ('X', 'x') returning theme");
    expect(rows).toEqual([{ theme: "fast-casual-vibrant" }]);
    await expect(db.query("update restaurants set theme = 'neon' where slug = 'x'")).rejects.toThrow();
  });

  it("the QR menu carries the restaurant's theme", async () => {
    const db = await freshDb();
    await db.query("update restaurants set theme = 'luxury-minimal' where id = $1", [DEMO]);
    const { rows } = await db.query<{ m: { theme: string } }>("select get_table_menu('demo-table-4-token') m");
    expect(rows[0].m.theme).toBe("luxury-minimal");
  });
});
