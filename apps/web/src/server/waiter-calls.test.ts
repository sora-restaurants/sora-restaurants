import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import type { Deps } from "./deps.ts";
import { testDeps } from "./test-deps";
import { acknowledgeCall, callWaiter, listCalls } from "./waiter-calls.ts";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const auth = (token: string | null) => new Request("http://x", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });
const calls = async (token: string) => (await (await listCalls(auth(token), deps)).json()).calls as { id: string; table: string }[];

describe("waiter calls", () => {
  it("a customer call shows up for their restaurant's staff, once however often they tap", async () => {
    expect((await callWaiter({ qrToken: "demo-table-4-token" }, deps)).status).toBe(204);
    expect((await callWaiter({ qrToken: "demo-table-4-token" }, deps)).status).toBe(204);
    expect((await calls("token-waiter")).map((c) => c.table)).toEqual(["Table 4"]);
    expect((await calls("token-A")).map((c) => c.table)).toEqual(["Table 4"]);
  });

  it("another restaurant's staff never see it and cannot answer it", async () => {
    await callWaiter({ qrToken: "demo-table-4-token" }, deps);
    expect(await calls("token-B")).toEqual([]);
    const [{ id }] = await calls("token-waiter");
    expect((await acknowledgeCall(auth("token-B"), id, deps)).status).toBe(404);
    expect(await calls("token-waiter")).toHaveLength(1);
  });

  it("answering a call clears it, and the table can call again later", async () => {
    await callWaiter({ qrToken: "demo-table-4-token" }, deps);
    const [{ id }] = await calls("token-waiter");
    expect((await acknowledgeCall(auth("token-waiter"), id, deps)).status).toBe(204);
    expect(await calls("token-waiter")).toEqual([]);
    await callWaiter({ qrToken: "demo-table-4-token" }, deps);
    expect(await calls("token-waiter")).toHaveLength(1);
  });

  it("bad input is refused without detail", async () => {
    expect((await callWaiter({ qrToken: "nope" }, deps)).status).toBe(404);
    expect((await callWaiter({ qrToken: "demo-table-4-token", restaurantId: "x" }, deps)).status).toBe(400);
    expect((await listCalls(auth(null), deps)).status).toBe(401);
    expect((await acknowledgeCall(auth("token-waiter"), "not-a-uuid", deps)).status).toBe(404);
  });
});
