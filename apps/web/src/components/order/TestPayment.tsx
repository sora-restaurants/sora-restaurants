"use client";

import { useState } from "react";
import { formatRand } from "../../lib/money.ts";
import type { OrderProgress } from "../../server/order-status.ts";

export function TestPayment({ token, order }: { token: string; order: OrderProgress }) {
  const [state, setState] = useState<"idle" | "paying" | "failed">("idle");
  const alreadyPaid = order.paymentStatus === "paid";

  async function pay() {
    setState("paying");
    const res = await fetch(`/api/payments/simulate/${token}`, { method: "POST" }).catch(() => null);
    if (res?.ok) window.location.href = `/o/${token}`;
    else setState("failed");
  }

  return (
    <main className="min-h-dvh bg-[oklch(97%_0.005_250)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)]">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <p className="rounded-xl border-2 border-[oklch(70%_0.15_75)] bg-[oklch(95%_0.06_85)] p-3 text-sm font-bold">
          TEST PAYMENT · demo only. No card is charged. A real payment provider replaces this page.
        </p>
        <h1 className="text-3xl font-extrabold">Pay for order {order.publicRef}</h1>
        <ul className="flex flex-col gap-1 rounded-xl bg-white p-4">
          {order.items.map((item, i) => (
            <li key={i}>
              {item.quantity}× {item.name}
            </li>
          ))}
          <li className="mt-2 border-t-2 border-[oklch(88%_0.01_260)] pt-2 text-xl font-extrabold tabular-nums">Total {formatRand(order.totalCents)}</li>
        </ul>
        {alreadyPaid ? (
          <a href={`/o/${token}`} className="flex min-h-14 items-center justify-center rounded-xl bg-[oklch(18%_0.02_260)] text-lg font-bold text-white">
            Already paid · track your order
          </a>
        ) : (
          <button
            type="button"
            onClick={pay}
            disabled={state === "paying"}
            className="min-h-14 rounded-xl bg-[oklch(45%_0.18_150)] text-lg font-bold text-white disabled:opacity-70"
          >
            {state === "paying" ? "Paying…" : `Pay ${formatRand(order.totalCents)} (test)`}
          </button>
        )}
        {state === "failed" ? (
          <p role="alert" className="rounded-xl bg-[oklch(92%_0.06_30)] p-3 font-semibold">
            The payment didn&apos;t go through. Your order hasn&apos;t gone to the kitchen; please try again.
          </p>
        ) : null}
        <p className="text-sm text-[oklch(45%_0.02_260)]">Your order goes to the kitchen as soon as it is paid.</p>
      </div>
    </main>
  );
}
