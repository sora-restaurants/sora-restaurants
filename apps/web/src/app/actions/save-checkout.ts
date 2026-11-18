"use server";

import { prodDeps } from "../../server/prod-deps.ts";

/** Records pay-now/pay-later, tip and split on the guest's own order (by its status token). Never marks it paid. */
export async function saveCheckoutAction(input: { statusToken: string; paymentChoice: string; tipPercent: number; splitWays: number }) {
  if (!/^[0-9a-f]{32}$/.test(String(input.statusToken))) return { ok: false };
  try {
    await prodDeps().db.asService("select set_order_checkout($1, $2, $3, $4)",
      [input.statusToken, input.paymentChoice, Number(input.tipPercent), Number(input.splitWays)]);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
