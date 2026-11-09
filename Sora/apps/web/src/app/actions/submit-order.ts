"use server";

import type { SubmitResult } from "../../server/deps.ts";
import { prodDeps } from "../../server/prod-deps.ts";
import { submitOrder } from "../../server/submit-order.ts";

/** Checkout from the customer page. Accepts only qrToken, idempotencyKey and items; the server prices everything. */
export async function submitOrderAction(input: unknown): Promise<SubmitResult> {
  return submitOrder(input, prodDeps());
}
