import { z } from "zod";
import { addOnCost } from "../components/menu/customise-options.ts";
import type { Deps, SubmitResult } from "./deps.ts";

// .strict() rejects any field the client might use to steer price, restaurant or table.
const Item = z
  .object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
    notes: z.string().max(200).optional(),
  })
  .strict();

const Payload = z
  .object({
    qrToken: z.string().min(1).max(100),
    idempotencyKey: z.string().min(8).max(100),
    items: z.array(Item).min(1).max(50),
  })
  .strict();

// Stable error codes raised by the submit_order SQL function.
const SQL_ERRORS = {
  invalid_items: 400,
  table_not_found: 404,
  idempotency_conflict: 409,
  TABLE_SESSION_NOT_ACTIVE: 409,
  order_too_large: 413,
  item_unavailable: 422,
} as const;

type Failure = Extract<SubmitResult, { ok: false }>;
const fail = (httpStatus: Failure["httpStatus"], error: string): Failure => ({ ok: false, httpStatus, error });

/** Places a QR order. Restaurant, table and every price are resolved by the database, never the client. */
export async function submitOrder(input: unknown, deps: Deps): Promise<SubmitResult> {
  let data = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch {
      return fail(400, "invalid_items");
    }
  }

  const parsed = Payload.safeParse(data);
  if (!parsed.success) {
    const forged = parsed.error.issues.some((issue) => issue.code === "unrecognized_keys");
    return fail(400, forged ? "unexpected_field" : "invalid_items");
  }

  const { qrToken, idempotencyKey, items } = parsed.data;
  try {
    const [row] = await deps.db.asService<{ r: { statusToken: string; publicRef: string; replayed: boolean } }>(
      // ::text first: postgres.js would JSON-encode a string bound straight to jsonb a second time.
      "select submit_order($1, $2, $3::text::jsonb) r",
      // Paid options are priced here from the server's own list; the client never sends a price.
      [qrToken, idempotencyKey, JSON.stringify(items.map((i) => ({ ...i, extraCents: addOnCost(i.notes ? i.notes.split(", ") : []) })))],
    );
    return { ok: true, ...row.r };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message in SQL_ERRORS) return fail(SQL_ERRORS[message as keyof typeof SQL_ERRORS], message);
    console.error("submit_order failed", { error: message }); // payload deliberately not logged
    return fail(500, "internal");
  }
}
