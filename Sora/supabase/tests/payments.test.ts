import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./db";
import { BUNNY_CHOW, submitOrder } from "./fixtures";

let db: PGlite;
beforeEach(async () => { db = await freshDb(); });

async function place(key = "pay-order-1") {
  await submitOrder(db, "demo-table-1-token", key, [{ menuItemId: BUNNY_CHOW, quantity: 1 }]);
  const { rows } = await db.query<{ id: string; total_cents: number }>("select id, total_cents from orders order by created_at desc limit 1");
  return rows[0];
}

describe("payments", () => {
  it("counter payment uses the order total, not a client amount", async () => {
    const order = await place();
    const { rows } = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-key-1"]);
    const payment = (await db.query("select method, status, amount_cents, is_simulated from payments where id = $1", [rows[0].id])).rows[0];
    expect(payment).toEqual({ method: "counter", status: "awaiting_collection", amount_cents: order.total_cents, is_simulated: false });
  });

  it("does not create a second active counter payment", async () => {
    const order = await place();
    const first = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-key-1"]);
    const second = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-key-2"]);
    expect(second.rows[0].id).toBe(first.rows[0].id);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from payments");
    expect(rows[0].n).toBe(1);
  });

  it("replays the same counter idempotency key", async () => {
    const order = await place();
    const first = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-same-key"]);
    const second = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-same-key"]);
    expect(second.rows[0].id).toBe(first.rows[0].id);
  });

  it("demo payment is simulated and pending until simulate_payment_success", async () => {
    const order = await place();
    const created = await db.query<{ id: string }>("select create_demo_payment($1, $2) id", [order.id, "demo-key-1"]);
    const pending = (await db.query("select status, is_simulated from payments where id = $1", [created.rows[0].id])).rows[0];
    expect(pending).toEqual({ status: "pending", is_simulated: true });
    await db.query("select simulate_payment_success($1)", [created.rows[0].id]);
    const done = (await db.query("select status from payments where id = $1", [created.rows[0].id])).rows[0];
    const audit = (await db.query("select source, previous_status, new_status from payment_audit")).rows[0];
    expect(done).toEqual({ status: "succeeded" });
    expect(audit).toEqual({ source: "demo_simulation", previous_status: "pending", new_status: "succeeded" });
  });

  it("simulate_payment_success refuses a counter payment", async () => {
    const order = await place();
    const created = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-key-1"]);
    await expect(db.query("select simulate_payment_success($1)", [created.rows[0].id])).rejects.toThrow(/invalid_transition/);
  });

  it("mark_counter_collected refuses a non-member", async () => {
    const order = await place();
    const created = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-key-1"]);
    await expect(db.query("select mark_counter_collected($1)", [created.rows[0].id])).rejects.toThrow(/not_found/);
  });

  it("staff of another restaurant cannot read this payment", async () => {
    const order = await place();
    await db.query("select create_counter_payment($1, $2)", [order.id, "counter-key-1"]);
    await db.query("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', false)");
    const { rows } = await db.query("select count(*)::int n from payments");
    expect(rows[0].n).toBe(0);
    await db.query("reset role");
  });

  it("anon cannot select payments", async () => {
    const order = await place();
    await db.query("select create_counter_payment($1, $2)", [order.id, "counter-key-1"]);
    await db.query("set role anon");
    await expect(db.query("select count(*) from payments")).rejects.toThrow();
    await db.query("reset role");
  });

  it("an abandoned pending demo can be replaced", async () => {
    const order = await place();
    await db.query("select create_demo_payment($1, $2)", [order.id, "demo-old-key"]);
    const next = await db.query<{ id: string }>("select create_demo_payment($1, $2) id", [order.id, "demo-new-key"]);
    const rows = (await db.query("select status from payments order by created_at")).rows;
    expect(rows).toEqual([{ status: "cancelled" }, { status: "pending" }]);
    expect(next.rows[0].id).toBeTruthy();
  });

  it("idempotency key reused with a different method conflicts", async () => {
    const order = await place();
    await db.query("select create_counter_payment($1, $2)", [order.id, "same-key-01"]);
    await expect(db.query("select create_demo_payment($1, $2)", [order.id, "same-key-01"])).rejects.toThrow(/idempotency_conflict/);
  });

  it("authenticated cannot update a payment directly", async () => {
    const order = await place();
    const created = await db.query<{ id: string }>("select create_counter_payment($1, $2) id", [order.id, "counter-key-1"]);
    await db.query("set role authenticated");
    await expect(db.query("update payments set status = 'succeeded' where id = $1", [created.rows[0].id])).rejects.toThrow();
    await db.query("reset role");
  });
});
