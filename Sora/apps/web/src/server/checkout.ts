import { z } from "zod";
import type { Deps } from "./deps.ts";
import { submitOrder } from "./submit-order.ts";

const Payload = z
  .object({
    qrToken: z.string().min(1).max(100),
    idempotencyKey: z.string().min(8).max(80),
    method: z.enum(["counter", "online_demo"]),
    items: z
      .array(
        z.object({
          menuItemId: z.string().uuid(),
          quantity: z.number().int().min(1).max(50),
          notes: z.string().max(200).optional(),
        }).strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export type CheckoutResult =
  | {
      ok: true;
      statusToken: string;
      publicRef: string;
      replayed: boolean;
      method: "counter" | "online_demo";
      paymentStatus: "awaiting_collection" | "succeeded";
      simulated: boolean;
    }
  | {
      ok: false;
      httpStatus: 400 | 404 | 409 | 413 | 422 | 500;
      error: string;
      statusToken?: string;
      publicRef?: string;
    };

const fail = (
  httpStatus: CheckoutResult extends infer R ? R extends { ok: false } ? R["httpStatus"] : never : never,
  error: string,
  extra: { statusToken?: string; publicRef?: string } = {},
): CheckoutResult => ({ ok: false, httpStatus, error, ...extra });

/** Customer checkout. Amount, restaurant and table come from the database. Simulation never leaves the server. */
export async function checkout(input: unknown, deps: Deps): Promise<CheckoutResult> {
  const parsed = Payload.safeParse(input);
  if (!parsed.success) {
    const forged = parsed.error.issues.some((issue) => issue.code === "unrecognized_keys");
    return fail(400, forged ? "unexpected_field" : "invalid_items");
  }
  const { qrToken, idempotencyKey, method, items } = parsed.data;

  const order = await submitOrder({ qrToken, idempotencyKey, items }, deps);
  if (!order.ok) return order;

  const [owned] = await deps.db.asService<{ id: string }>(
    `select o.id
       from orders o
       join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
      where o.status_token = $1 and t.qr_token = $2`,
    [order.statusToken, qrToken],
  );
  if (!owned) return fail(404, "order_not_found", { statusToken: order.statusToken, publicRef: order.publicRef });

  const paymentKey = `${idempotencyKey}:${method}`;
  try {
    if (method === "counter") {
      await deps.db.asService("select create_counter_payment($1, $2)", [owned.id, paymentKey]);
      return {
        ok: true,
        statusToken: order.statusToken,
        publicRef: order.publicRef,
        replayed: order.replayed,
        method,
        paymentStatus: "awaiting_collection",
        simulated: false,
      };
    }

    const [created] = await deps.db.asService<{ id: string }>("select create_demo_payment($1, $2) id", [owned.id, paymentKey]);
    const [payment] = await deps.db.asService<{ status: string }>("select status from payments where id = $1", [created.id]);
    if (payment.status === "pending") {
      await deps.db.asService("select simulate_payment_success($1)", [created.id]);
    }
    return {
      ok: true,
      statusToken: order.statusToken,
      publicRef: order.publicRef,
      replayed: order.replayed,
      method,
      paymentStatus: "succeeded",
      simulated: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("checkout payment failed", { error: message });
    return fail(500, "payment_incomplete", { statusToken: order.statusToken, publicRef: order.publicRef });
  }
}
