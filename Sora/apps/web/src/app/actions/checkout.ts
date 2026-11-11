"use server";

import { checkout } from "../../server/checkout.ts";
import type { CheckoutResult } from "../../server/checkout.ts";
import { prodDeps } from "../../server/prod-deps.ts";

/** Customer checkout. Payment functions run here, never in the browser. */
export async function checkoutAction(input: unknown): Promise<CheckoutResult> {
  return checkout(input, prodDeps());
}
