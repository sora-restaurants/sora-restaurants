import { describe, expect, it } from "vitest";
import { freshDb } from "./db";

describe("schema", () => {
  it("migration and seed load", async () => {
    const db = await freshDb();
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from restaurants");
    expect(rows[0].n).toBe(2);
  });

  it("every public table has RLS", async () => {
    const db = await freshDb();
    const { rows } = await db.query(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity",
    );
    expect(rows).toEqual([]);
  });

  it("restaurant currency is locked to ZAR", async () => {
    const db = await freshDb();
    await expect(db.query("insert into restaurants (name, slug, currency) values ('X', 'x', 'USD')")).rejects.toThrow();
  });
});
