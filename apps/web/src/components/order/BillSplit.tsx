"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRand } from "../../lib/money.ts";

type Line = { name: string; quantity: number; cents: number };
type Bill = {
  shares: { shareNo: number; ways: number; amountCents: number; paid: boolean; items: Line[] }[];
  openCents: number;
  items: (Line & { id: string })[];
};

/** Pay-after bill split: the table's bill shared evenly and/or by who had what. Each person pays the waiter. */
export function BillSplit({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [bill, setBill] = useState<Bill | null>(null);
  const [ways, setWays] = useState(2);
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetch(`/api/orders/status/${token}/bill`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null)).then((b: Bill | null) => b && setBill(b)).catch(() => {}), [token]);
  useEffect(() => {
    if (!open) return;
    void load();
    const id = setInterval(load, 4000); // the waiter marks shares paid; show it here
    return () => clearInterval(id);
  }, [open, load]);

  async function split() {
    setBusy(true);
    setError("");
    const kept = Object.fromEntries(Object.entries(assign).filter(([, n]) => n <= ways));
    const r = await fetch(`/api/orders/status/${token}/bill`, { method: "POST", body: JSON.stringify({ ways, assign: kept }) }).catch(() => null);
    if (!r?.ok) setError(r?.status === 409 ? "Someone has already paid a share. Ask your waiter to change it." : "Couldn't split the bill. Try again.");
    await load();
    setBusy(false);
  }

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="min-h-tap shrink-0 rounded-full border border-bg/30 px-4 font-semibold">Split bill</button>;
  }

  const chip = (on: boolean) => `min-h-10 min-w-10 rounded-theme border-2 text-sm font-bold ${on ? "border-accent bg-accent text-on-accent" : "border-line"}`;
  return (
    <div role="dialog" aria-modal="true" aria-label="Split the bill" className="fixed inset-0 z-40 overflow-y-auto bg-bg p-4 text-ink">
      <div className="mx-auto max-w-(--t-max)">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="display text-2xl">Split the bill</h2>
          <button type="button" onClick={() => setOpen(false)} className="min-h-tap rounded-full border-2 border-line px-4 font-semibold">Close</button>
        </div>
        {!bill ? <p className="text-muted">Loading…</p> : (
          <>
            {bill.shares.length > 0 && (
              <section className="mb-6">
                <p className="mb-2 text-sm text-muted">Tell your waiter your person number and pay at the card machine, till or in cash.</p>
                <ul className="grid gap-2">
                  {bill.shares.map((s) => (
                    <li key={`${s.ways}-${s.shareNo}-${s.amountCents}`} className="rounded-theme border-2 border-line p-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-bold">Person {s.shareNo} of {s.ways}</span>
                        <span className="tabular-nums font-bold">{formatRand(s.amountCents)}</span>
                      </div>
                      <p className="text-sm text-muted">
                        {s.paid ? "✓ Paid" : "To pay"}
                        {s.items.length ? ` · ${s.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")} + share of the rest` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {bill.items.length > 0 ? (
              <section>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{bill.shares.length ? "Change the split" : "How many people?"}</p>
                <div className="mb-4 flex items-center gap-3">
                  <button type="button" aria-label="Fewer people" onClick={() => setWays((n) => Math.max(2, n - 1))} className={chip(false)}>−</button>
                  <span className="min-w-16 text-center text-lg font-bold">{ways} people</span>
                  <button type="button" aria-label="More people" onClick={() => setWays((n) => Math.min(8, n + 1))} className={chip(false)}>+</button>
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Who had what? (optional)</p>
                <p className="mb-2 text-sm text-muted">Tap a person for each dish. Dishes you leave are shared evenly, with any tip.</p>
                <ul className="mb-4 grid gap-3">
                  {bill.items.map((item) => (
                    <li key={item.id}>
                      <div className="flex justify-between gap-3 text-sm"><span>{item.quantity}× {item.name}</span><span className="tabular-nums">{formatRand(item.cents)}</span></div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Array.from({ length: ways }, (_, i) => i + 1).map((n) => (
                          <button key={n} type="button" aria-pressed={assign[item.id] === n} aria-label={`${item.name}: person ${n}`}
                            onClick={() => setAssign((a) => { const next = { ...a }; if (next[item.id] === n) delete next[item.id]; else next[item.id] = n; return next; })}
                            className={chip(assign[item.id] === n)}>{n}</button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                {error && <p role="alert" className="mb-2 text-sm font-bold">{error}</p>}
                <button type="button" disabled={busy} onClick={split} className="min-h-14 w-full rounded-theme bg-accent font-bold text-on-accent disabled:opacity-50">
                  Split {ways} ways
                </button>
              </section>
            ) : bill.openCents > 0 ? (
              <p className="text-sm text-muted">Orders placed after the split ({formatRand(bill.openCents)}) are paid separately.</p>
            ) : bill.shares.length === 0 ? <p className="text-muted">Nothing to pay yet.</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
