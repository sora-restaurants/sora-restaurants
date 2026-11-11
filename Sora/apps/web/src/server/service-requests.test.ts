import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { DEMO_USER, OTHER_USER, WAITER_USER } from "../../../../supabase/tests/fixtures";
import { createServiceRequest, listServiceRequests, updateServiceRequest } from "./service-requests";
import type { Deps } from "./deps";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

describe("service requests", () => {
  it("creates a table request from the QR token only", async () => {
    const result = await createServiceRequest({ qrToken: "demo-table-1-token", type: "waiter" }, deps);
    expect(result.ok).toBe(true);
    const row = (await db.query("select type, status, restaurant_id from service_requests")).rows[0];
    expect(row).toMatchObject({ type: "waiter", status: "open" });
    const event = (await db.query("select source, to_status from service_request_events")).rows[0];
    expect(event).toEqual({ source: "customer_request", to_status: "open" });
  });

  it("returns the existing active request instead of a duplicate", async () => {
    const first = await createServiceRequest({ qrToken: "demo-table-1-token", type: "bill" }, deps);
    const second = await createServiceRequest({ qrToken: "demo-table-1-token", type: "bill" }, deps);
    expect(first.ok && second.ok && first.id === second.id).toBe(true);
    expect((await db.query("select count(*)::int n from service_requests")).rows[0].n).toBe(1);
  });

  it("lets a waiter acknowledge and complete, and records the actor", async () => {
    const created = await createServiceRequest({ qrToken: "demo-table-1-token", type: "water" }, deps);
    if (!created.ok) throw new Error("create failed");
    expect(await updateServiceRequest(WAITER_USER, created.id, "acknowledged", deps)).toEqual({ ok: true });
    expect(await updateServiceRequest(WAITER_USER, created.id, "completed", deps)).toEqual({ ok: true });
    const row = (await db.query("select status, acknowledged_by, completed_by from service_requests")).rows[0];
    expect(row.status).toBe("completed");
    expect(row.acknowledged_by).toBe(WAITER_USER);
    expect(row.completed_by).toBe(WAITER_USER);
  });

  it("rejects an invalid transition and a cross-restaurant staff member", async () => {
    const created = await createServiceRequest({ qrToken: "demo-table-1-token", type: "other" }, deps);
    if (!created.ok) throw new Error("create failed");
    expect(await updateServiceRequest(OTHER_USER, created.id, "acknowledged", deps)).toEqual({ ok: false, error: "not_found" });
    expect(await updateServiceRequest(WAITER_USER, created.id, "acknowledged", deps)).toEqual({ ok: true });
    expect(await updateServiceRequest(WAITER_USER, created.id, "acknowledged", deps)).toEqual({ ok: false, error: "invalid_transition" });
  });

  it("lists only the staff member's restaurant", async () => {
    await createServiceRequest({ qrToken: "demo-table-1-token", type: "waiter" }, deps);
    await createServiceRequest({ qrToken: "other-table-1-token", type: "bill" }, deps);
    const mine = await listServiceRequests(DEMO_USER, deps);
    expect(mine).toHaveLength(1);
    expect(mine[0].type).toBe("waiter");
  });
});
