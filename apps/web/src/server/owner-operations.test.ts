import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db.ts";
import { ownerCommand, ownerSnapshot } from "./owner-operations.ts";
import { testDeps } from "./test-deps.ts";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); });
const request = (path = "", init: RequestInit = {}) => new Request(`http://sora.test/api/owner${path}`, { ...init, headers: { authorization: "Bearer token-owner", ...(init.headers ?? {}) } });

describe("owner operations", () => {
  it("returns only the owner's restaurant with real QR images", async () => {
    const response = await ownerSnapshot(request(), testDeps(db));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot.restaurantName).toBe("Demo Bistro");
    expect(body.snapshot.tables).toHaveLength(3);
    expect(body.snapshot.tables[0].qrUrl).toMatch(/^http:\/\/sora\.test\/t\//);
    expect(body.snapshot.tables[0].qrImageSrc).toMatch(/^data:image\/png;base64,/);
  });

  it("refuses kitchen staff and unauthenticated callers", async () => {
    expect((await ownerSnapshot(new Request("http://sora.test/api/owner"), testDeps(db))).status).toBe(401);
    expect((await ownerSnapshot(new Request("http://sora.test/api/owner", { headers: { authorization: "Bearer token-A" } }), testDeps(db))).status).toBe(403);
  });

  it("closes a table through the authenticated command endpoint", async () => {
    const [{ id }] = (await db.query<{ id: string }>("select id from tables where qr_token = 'demo-table-1-token'")).rows;
    const response = await ownerCommand(request("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "close", tableId: id }) }), testDeps(db));
    expect(response.status).toBe(200);
    expect((await db.query<{ n: number }>("select count(*)::int n from table_sessions where table_id = $1 and status = 'open'", [id])).rows[0].n).toBe(0);
  });

  it("updates a dish through an owner-only database function", async () => {
    const itemId = "a2000000-0000-0000-0000-000000000012";
    const response = await ownerCommand(request("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      action: "updateItem", itemId, name: "Charred Cauliflower", description: "New seasonal description", priceCents: 13200,
      imageUrl: "/menu/charred-cauliflower.jpg", dietaryTags: ["vegetarian"], available: true, soldOut: true,
    }) }), testDeps(db));
    expect(response.status).toBe(200);
    expect((await db.query("select price_cents, sold_out from menu_items where id = $1", [itemId])).rows)
      .toEqual([{ price_cents: 13200, sold_out: true }]);
  });
});
