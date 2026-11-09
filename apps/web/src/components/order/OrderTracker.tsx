"use client";

import { useEffect, useState } from "react";
import { formatRand } from "../../lib/money.ts";
import type { OrderProgress } from "../../server/order-status.ts";

const STEPS = [
  { label: "Received", statuses: ["submitted"] },
  { label: "Being prepared", statuses: ["accepted", "preparing"] },
  { label: "Ready", statuses: ["ready"] },
  { label: "Served", statuses: ["served"] },
];
const FINAL = ["served", "rejected", "cancelled"];
const POLL_MS = 3_000;

export function OrderTracker({ token }: { token: string }) {
  const [order, setOrder] = useState<OrderProgress | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/status/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (res.status === 404) return setMissing(true);
        if (res.ok) {
          const next: OrderProgress = await res.json();
          setOrder(next);
          if (FINAL.includes(next.status)) return; // nothing more will change
        }
      } catch {
        // offline for a moment: keep the last known state and try again
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [token]);

  const stepIndex = order ? STEPS.findIndex((s) => s.statuses.includes(order.status)) : -1;
  const stopped = order && (order.status === "rejected" || order.status === "cancelled");
  const awaitingPayment = order?.status === "awaiting_payment";

  return (
    <main className="min-h-dvh bg-[oklch(98%_0.005_80)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        {missing ? (
          <p className="text-xl font-bold">We couldn&apos;t find this order. Please ask your waiter.</p>
        ) : !order ? (
          <p className="text-xl font-bold">Loading your order…</p>
        ) : (
          <>
            <header>
              <p className="text-sm font-bold uppercase tracking-wide text-[oklch(45%_0.02_260)]">Order {order.publicRef}</p>
              <h1 role="status" aria-live="polite" className="text-4xl font-extrabold">
                {stopped ? "Order cancelled" : awaitingPayment ? "Waiting for payment" : STEPS[stepIndex]?.label}
              </h1>
            </header>

            {awaitingPayment ? (
              <a href={`/pay/${token}`} className="flex min-h-14 items-center justify-center rounded-xl bg-[oklch(18%_0.02_260)] text-lg font-bold text-white">
                Pay now to send it to the kitchen
              </a>
            ) : null}
            {stopped ? (
              <p className="rounded-xl bg-[oklch(92%_0.06_30)] p-4 text-lg font-semibold">
                The kitchen couldn&apos;t make this order. Please ask your waiter.
              </p>
            ) : (
              <ol className="flex flex-col gap-3">
                {STEPS.map((step, i) => (
                  <li
                    key={step.label}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-4 text-lg font-bold ${
                      i < stepIndex
                        ? "border-transparent bg-[oklch(93%_0.04_145)] text-[oklch(30%_0.08_145)]"
                        : i === stepIndex
                          ? "border-[oklch(18%_0.02_260)] bg-white"
                          : "border-[oklch(88%_0.01_260)] text-[oklch(55%_0.02_260)]"
                    }`}
                  >
                    <span aria-hidden="true">{i < stepIndex ? "✓" : i === stepIndex ? "●" : "○"}</span>
                    {step.label}
                  </li>
                ))}
              </ol>
            )}

            <section className="rounded-xl border-2 border-[oklch(88%_0.01_260)] bg-white p-4">
              <ul className="flex flex-col gap-1">
                {order.items.map((item, i) => (
                  <li key={i}>
                    {item.quantity}× {item.name}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t-2 border-[oklch(88%_0.01_260)] pt-3 font-bold tabular-nums">
                Total {formatRand(order.totalCents)} · {order.paymentStatus === "paid" ? "paid, thank you" : "pay your waiter or at the till"}
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
