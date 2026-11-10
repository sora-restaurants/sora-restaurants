import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import type { Deps } from "./deps.ts";
import { type AdminTables, addTable, listTables, rotateTableQr, updateTable } from "./table-admin.ts";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const req = (token: string, body?: unknown) =>
  new Request("http://x", { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
const menuFor = async (qrToken: string) => (await db.query<{ m: unknown }>("select get_table_menu($1) m", [qrToken])).rows[0].m;
const tables = async (token = "token-owner") => (await (await listTables(req(token), deps)).json()) as AdminTables;
const table4 = async () => (await tables()).tables.find((t) => t.qrToken === "demo-table-4-token")!;

describe("table management", () => {
  it("an owner adds, renames and deactivates a table; customers follow", async () => {
    const added = await addTable(req("token-owner", { label: "Patio 1" }), deps);
    expect(added.status).toBe(200);
    const patio = (await tables()).tables.find((t) => t.label === "Patio 1")!;
    expect(await menuFor(patio.qrToken)).not.toBeNull();

    expect((await updateTable(req("token-owner", { label: "Patio A" }), patio.id, deps)).status).toBe(204);
    expect((await tables()).tables.map((t) => t.label)).toContain("Patio A");

    expect((await updateTable(req("token-owner", { active: false }), patio.id, deps)).status).toBe(204);
    expect(await menuFor(patio.qrToken)).toBeNull();
  });

  it("rotating a QR token makes the old QR URL stop working", async () => {
    const t = await table4();
    const res = await rotateTableQr(req("token-owner", {}), t.id, deps);
    expect(res.status).toBe(200);
    const { qrToken } = await res.json();
    expect(qrToken).not.toBe("demo-table-4-token");
    expect(await menuFor("demo-table-4-token")).toBeNull();
    expect(await menuFor(qrToken)).not.toBeNull();
  });

  it("kitchen and waiter staff cannot manage tables", async () => {
    const t = await table4();
    for (const token of ["token-A", "token-waiter"]) {
      expect((await listTables(req(token), deps)).status).toBe(403);
      expect((await addTable(req(token, { label: "Sneaky" }), deps)).status).toBe(403);
      expect((await updateTable(req(token, { label: "Sneaky" }), t.id, deps)).status).toBe(404);
      expect((await rotateTableQr(req(token, {}), t.id, deps)).status).toBe(404);
    }
    expect(await menuFor("demo-table-4-token")).not.toBeNull();
  });

  it("another restaurant's owner gets 404 for this restaurant's tables", async () => {
    const t = await table4();
    expect((await updateTable(req("token-B", { active: false }), t.id, deps)).status).toBe(404);
    expect((await rotateTableQr(req("token-B", {}), t.id, deps)).status).toBe(404);
    expect(await menuFor("demo-table-4-token")).not.toBeNull();
  });

  it("rejects bad input and duplicate labels", async () => {
    expect((await addTable(req("token-owner", { label: "  " }), deps)).status).toBe(400);
    expect((await addTable(req("token-owner", { label: (await table4()).label }), deps)).status).toBe(409);
    expect((await listTables(new Request("http://x"), deps)).status).toBe(401);
  });
});
