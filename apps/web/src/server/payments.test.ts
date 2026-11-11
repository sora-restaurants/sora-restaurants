import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "../../../../supabase/tests/db";
import { BUNNY_CHOW, DEMO, DEMO_USER } from "../../../../supabase/tests/fixtures";
import type { Deps } from "./deps.ts";
import { kitchenStream } from "./kitchen-stream.ts";
import { orderStatus } from "./order-status.ts";
import { simulatePayment } from "./payments.ts";
import { readEvents } from "./sse-test-helpers.ts";
import { submitOrder } from "./submit-order.ts";
import { testDeps } from "./test-deps";

const DEV = { NODE_ENV: "development", DEV_SIMULATED_PAYMENTS: "1" };

let db: PGlite;
let deps: Deps;
beforeEach(async () => {
  db = await freshDb();
  deps = testDeps(db);
});

const order = (extra: Record<string, unknown> = {}, key = "key-pay-0001") =>
  submitOrder({ qrToken: "demo-table-4-token", idempotencyKey: key, items: [{ menuItemId: BUNNY_CHOW, quantity: 2 }], ...extra }, deps, DEV);
const row = async () =>
  (await db.query<Record<string, unknown>>("select status, payment_choice, payment_status, customer_email from orders")).rows[0];
const boardIds = async () => {
  const [snap] = await readEvents(
    await kitchenStream(new Request("http://x", { headers: { authorization: "Bearer token-A" } }), DEMO, deps),
    1,
  );
  return snap.data.orders as { publicRef: string; paid: boolean; payAtTable: boolean }[];
};
const policy = (p: string) => db.query("update restaurants set payment_policy = $1 where id = $2", [p, DEMO]);

describe("pay after dinner", () => {
  it("goes straight to the kitchen, marked to collect at the table", async () => {
    const placed = await order();
    expect(placed).toMatchObject({ ok: true, payNow: false });
    expect(await row()).toMatchObject({ status: "submitted", payment_choice: "pay_later", payment_status: "unpaid" });
    expect(await boardIds()).toEqual([expect.objectContaining({ paid: false, payAtTable: true })]);
  });
});

describe("pay now", () => {
  it("waits for payment and stays off the kitchen board until paid", async () => {
    const placed = await order({ paymentChoice: "pay_now" });
    expect(placed).toMatchObject({ ok: true, payNow: true });
    expect(await row()).toMatchObject({ status: "awaiting_payment", payment_status: "unpaid" });
    expect(await boardIds()).toEqual([]);
    if (!placed.ok) throw new Error();
    expect((await (await orderStatus(placed.statusToken, deps)).json()).status).toBe("awaiting_payment");

    expect((await simulatePayment(placed.statusToken, deps, DEV)).status).toBe(200);
    expect(await row()).toMatchObject({ status: "submitted", payment_status: "paid" });
    expect(await boardIds()).toEqual([expect.objectContaining({ paid: true, payAtTable: false })]);
    expect((await db.query("select count(*)::int n from print_jobs")).rows[0]).toEqual({ n: 1 });
  });

  it("paying twice changes nothing; an unknown token is 404", async () => {
    const placed = await order({ paymentChoice: "pay_now" });
    if (!placed.ok) throw new Error();
    await simulatePayment(placed.statusToken, deps, DEV);
    expect((await simulatePayment(placed.statusToken, deps, DEV)).status).toBe(200);
    expect((await db.query("select count(*)::int n from order_events where to_status = 'submitted'")).rows[0]).toEqual({ n: 1 });
    expect((await simulatePayment("deadbeefdeadbeef", deps, DEV)).status).toBe(404);
  });

  it("allows hosted simulation only in a preview and for the configured demo table", async () => {
    const preview = {
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DEMO_PAYMENT_TABLE_TOKEN: "demo-table-4-token",
    };
    const payload = {
      qrToken: "demo-table-4-token",
      idempotencyKey: "key-preview",
      paymentChoice: "pay_now",
      items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }],
    };
    const production = { ...preview, VERCEL_ENV: "production" };
    const wrongTable = { ...preview, DEMO_PAYMENT_TABLE_TOKEN: "another-demo-table" };
    expect(await submitOrder(payload, deps, production)).toMatchObject({ ok: false, error: "pay_now_unavailable" });
    expect(await submitOrder(payload, deps, wrongTable)).toMatchObject({ ok: false, error: "pay_now_unavailable" });
    const placed = await submitOrder(payload, deps, preview);
    if (!placed.ok) throw new Error(placed.error);
    expect((await simulatePayment(placed.statusToken, deps, production)).status).toBe(404);
    expect((await simulatePayment(placed.statusToken, deps, wrongTable)).status).toBe(404);
    expect((await simulatePayment(placed.statusToken, deps, preview)).status).toBe(200);
    expect(await row()).toMatchObject({ status: "submitted", payment_status: "paid" });
  });

  it("the test payment page does not exist in production, and pay-now is refused without a payment provider", async () => {
    const placed = await order({ paymentChoice: "pay_now" });
    if (!placed.ok) throw new Error();
    expect((await simulatePayment(placed.statusToken, deps, { NODE_ENV: "production", DEV_SIMULATED_PAYMENTS: "1" })).status).toBe(404);
    const none = await submitOrder(
      { qrToken: "demo-table-4-token", idempotencyKey: "key-pay-0009", items: [{ menuItemId: BUNNY_CHOW, quantity: 1 }], paymentChoice: "pay_now" },
      deps,
      { NODE_ENV: "development" },
    );
    expect(none).toEqual({ ok: false, httpStatus: 400, error: "pay_now_unavailable" });
  });
});

describe("restaurant payment policy (walk-out protection)", () => {
  it("pay_now_only refuses pay-after orders; pay_later_only refuses pay-now", async () => {
    await policy("pay_now_only");
    expect(await order({ paymentChoice: "pay_later" }, "key-pol-0001")).toMatchObject({ ok: false, error: "payment_choice_not_allowed" });
    expect(await order({ paymentChoice: "pay_now" }, "key-pol-0002")).toMatchObject({ ok: true });
    await policy("pay_later_only");
    expect(await order({ paymentChoice: "pay_now" }, "key-pol-0003")).toMatchObject({ ok: false, error: "payment_choice_not_allowed" });
  });

  it("staff can see which served orders are still unpaid", async () => {
    const placed = await order();
    if (!placed.ok) throw new Error();
    const [{ id }] = (await db.query<{ id: string }>("select id from orders")).rows;
    for (const s of ["preparing", "ready", "served"]) await deps.db.asUser(DEMO_USER, "select kitchen_move($1, $2)", [id, s]);
    const unpaid = await deps.db.asUser<{ public_ref: string }>(DEMO_USER, "select public_ref from unpaid_orders");
    expect(unpaid).toEqual([{ public_ref: placed.publicRef }]);
  });
});

describe("email copy (POPIA)", () => {
  it("stores the address only when given, and queues one email once the order reaches the kitchen", async () => {
    await order({ email: "Guest@Example.com " }, "key-mail-0001");
    expect((await row()).customer_email).toBe("guest@example.com");
    expect((await db.query("select count(*)::int n from email_jobs")).rows[0]).toEqual({ n: 1 });
  });

  it("a pay-now order is emailed only after payment", async () => {
    const placed = await order({ email: "guest@example.com", paymentChoice: "pay_now" }, "key-mail-0002");
    expect((await db.query("select count(*)::int n from email_jobs")).rows[0]).toEqual({ n: 0 });
    if (!placed.ok) throw new Error();
    await simulatePayment(placed.statusToken, deps, DEV);
    expect((await db.query("select count(*)::int n from email_jobs")).rows[0]).toEqual({ n: 1 });
  });

  it("refuses a malformed address", async () => {
    expect(await order({ email: "not-an-email" }, "key-mail-0003")).toEqual({ ok: false, httpStatus: 400, error: "invalid_email" });
  });

  it("deletes addresses after 30 days; the order itself stays", async () => {
    await order({ email: "guest@example.com" }, "key-mail-0004");
    await db.query("update orders set created_at = now() - interval '31 days'");
    await db.query("update email_jobs set created_at = now() - interval '31 days'");
    await db.query("select purge_customer_emails()");
    expect((await row()).customer_email).toBeNull();
    expect((await db.query("select to_address from email_jobs")).rows).toEqual([{ to_address: null }]);
    expect((await db.query("select count(*)::int n from orders")).rows[0]).toEqual({ n: 1 });
  });
});
