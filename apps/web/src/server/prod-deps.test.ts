import { afterAll, describe, expect, it, vi } from "vitest";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, DEMO, DEMO_USER, ROOIBOS } from "../../../../supabase/tests/fixtures";
import { submitOrder } from "./submit-order.ts";

// The production database code (postgres.js, SET ROLE service_role/authenticated) against a real server.
// PGlite and node-postgres encode parameters differently from postgres.js, so only this catches driver bugs.
describe.runIf(process.env.DB_ENGINE === "postgres")("prodDeps on a real PostgreSQL server", () => {
  afterAll(() => vi.unstubAllEnvs());

  async function realProdDeps() {
    const db = await freshDb();
    vi.stubEnv("DATABASE_URL", process.env.REAL_PG_LAST_DB_URL!);
    vi.resetModules(); // prodDeps keeps one connection pool per module instance
    const { prodDeps } = await import("./prod-deps.ts");
    return { db, deps: prodDeps() };
  }

  it("a QR checkout through the production code stores the order", async () => {
    const { db, deps } = await realProdDeps();
    const result = await submitOrder(
      {
        qrToken: "demo-table-4-token",
        idempotencyKey: "key-prod-0001",
        items: [{ menuItemId: BUNNY_CHOW, quantity: 2 }, { menuItemId: ROOIBOS, quantity: 1, notes: "no ice" }],
      },
      deps,
    );
    expect(result).toMatchObject({ ok: true });
    const { rows } = await db.query("select restaurant_id, total_cents, vat_cents from orders");
    expect(rows).toEqual([{ restaurant_id: DEMO, total_cents: 28500, vat_cents: 3717 }]);
  });

  it("staff queries through the production code run under RLS", async () => {
    const { deps } = await realProdDeps();
    const rows = await deps.db.asUser<{ id: string }>(DEMO_USER, "select id from restaurants");
    expect(rows).toEqual([{ id: DEMO }]);
  });
});
