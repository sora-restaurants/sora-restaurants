import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW } from "../../../../supabase/tests/fixtures";
import { checkout } from "./checkout";
import type { Deps } from "./deps";
import { testDeps } from "./test-deps";

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const base = (method: "counter" | "online_demo", key = "checkout-key-1") => ({
  qrToken: "demo-table-1-token",
  idempotencyKey: key,
  method,
  items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }],
});

describe("checkout", () => {
  it("counter creates an awaiting_collection payment and leaves the order submitted", async () => {
    const result = await checkout(base("counter"), deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentStatus).toBe("awaiting_collection");
    expect(result.simulated).toBe(false);
    const payment = (await db.query("select method, status, is_simulated, amount_cents from payments")).rows[0];
    const order = (await db.query("select status, total_cents from orders")).rows[0];
    expect(payment).toEqual({ method: "counter", status: "awaiting_collection", is_simulated: false, amount_cents: order.total_cents });
    expect(order.status).toBe("submitted");
  });

  it("online demo succeeds only through the server simulation and is labelled simulated", async () => {
    const result = await checkout(base("online_demo", "checkout-demo-1"), deps);
    expect(result).toMatchObject({ ok: true, paymentStatus: "succeeded", simulated: true });
    const payment = (await db.query("select status, is_simulated, method from payments")).rows[0];
    expect(payment).toEqual({ status: "succeeded", is_simulated: true, method: "online" });
    const audit = (await db.query("select source from payment_audit")).rows[0];
    expect(audit.source).toBe("demo_simulation");
  });

  it("rejects a client-supplied amount or status", async () => {
    const forged = { ...base("counter"), amountCents: 1, status: "succeeded", is_simulated: false };
    expect(await checkout(forged, deps)).toEqual({ ok: false, httpStatus: 400, error: "unexpected_field" });
    expect((await db.query("select count(*)::int n from orders")).rows[0].n).toBe(0);
  });

  it("retries the same key without a second order or payment", async () => {
    const first = await checkout(base("counter", "checkout-retry"), deps);
    const second = await checkout(base("counter", "checkout-retry"), deps);
    expect(first.ok && second.ok).toBe(true);
    expect((await db.query("select count(*)::int n from orders")).rows[0].n).toBe(1);
    expect((await db.query("select count(*)::int n from payments")).rows[0].n).toBe(1);
  });

  it("does not collect a counter payment automatically", async () => {
    await checkout(base("counter", "checkout-open"), deps);
    const row = (await db.query("select status from payments")).rows[0];
    expect(row.status).toBe("awaiting_collection");
  });
});
