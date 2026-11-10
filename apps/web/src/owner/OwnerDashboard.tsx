"use client";

import { useRef, useState } from "react";
import { PrintableQrCard } from "./PrintableQrCard.tsx";
import { createMockSessionAdapter } from "./mock-session-adapter.ts";
import type { OwnerDashboardSnapshot } from "./session-contract.ts";

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function OwnerDashboard({ initial }: { initial: OwnerDashboardSnapshot }) {
  const adapter = useRef(createMockSessionAdapter(initial.tables)).current;
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [printTableId, setPrintTableId] = useState<string | null>(null);

  async function changeSession(tableId: string, action: "open" | "close") {
    setBusy(tableId);
    setMessage(null);
    const result = action === "open" ? await adapter.openSession(tableId) : await adapter.closeSession(tableId);
    if (result.ok) {
      setSnapshot(await adapter.getSnapshot());
      setMessage(`${result.table.label} session ${action === "open" ? "started" : "closed"}.`);
    } else {
      setMessage(`No change made (${result.code.toLowerCase().replaceAll("_", " ")}).`);
    }
    setBusy(null);
  }

  const printTable = snapshot.tables.find((table) => table.id === printTableId);
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 font-[family-name:var(--font-manrope)] text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-white/15 pb-7">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Owner workspace · contract preview</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-6xl">{snapshot.restaurantName}</h1></div>
          <p className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/65">{snapshot.timezone}</p>
        </header>

        <section className="grid gap-4 py-7 sm:grid-cols-3" aria-label="Restaurant summary">
          <Summary label="Accepted Order Value" value={zar.format(snapshot.acceptedOrderValueCents / 100)} note="VAT-inclusive · excludes cancelled and rejected · payment not verified" />
          <Summary label="Open table sessions" value={String(snapshot.tables.filter((table) => table.sessionState === "open").length)} note="Mock session adapter; not live data" />
          <Summary label="Enabled tables" value={`${snapshot.tables.filter((table) => table.enabled).length} / ${snapshot.tables.length}`} note="Permanent table availability" />
        </section>

        <section aria-labelledby="tables-heading" className="rounded-3xl bg-white p-4 text-slate-950 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Floor controls</p><h2 id="tables-heading" className="mt-1 text-3xl font-black tracking-tight">Tables</h2></div><p role="status" className="min-h-6 text-sm font-semibold text-slate-600">{message}</p></div>
          <ul className="mt-6 grid gap-4 lg:grid-cols-2">
            {snapshot.tables.map((table) => <li key={table.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">{table.label}</h3><p className="mt-1 text-sm text-slate-500">{table.enabled ? "Table enabled" : "Table disabled"}</p></div><span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-wide ${table.sessionState === "open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{table.sessionState}</span></div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button type="button" disabled={!table.enabled || busy === table.id} onClick={() => changeSession(table.id, table.sessionState === "open" ? "close" : "open")} className="min-h-12 rounded-xl bg-blue-700 px-4 font-bold text-white disabled:bg-slate-300">{busy === table.id ? "Updating…" : table.sessionState === "open" ? "Close session" : "Start session"}</button>
                <button type="button" onClick={() => setPrintTableId(table.id)} className="min-h-12 rounded-xl border-2 border-slate-300 px-4 font-bold">Preview QR print</button>
              </div>
            </li>)}
          </ul>
        </section>
      </div>

      {printTable && <div role="dialog" aria-modal="true" aria-label={`Printable QR for ${printTable.label}`} className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 sm:p-8"><div className="mx-auto max-w-sm"><div className="mb-3 flex justify-end gap-3 print:hidden"><button type="button" onClick={() => window.print()} className="min-h-11 rounded-full bg-cyan-300 px-5 font-black text-slate-950">Print</button><button type="button" onClick={() => setPrintTableId(null)} className="min-h-11 rounded-full border border-white/40 px-5 font-bold">Close</button></div><PrintableQrCard restaurantName={snapshot.restaurantName} table={printTable} /></div></div>}
    </main>
  );
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="rounded-2xl border border-white/15 bg-white/5 p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/55">{label}</p><p className="mt-3 text-3xl font-black tracking-tight">{value}</p><p className="mt-2 text-xs leading-relaxed text-white/50">{note}</p></article>;
}

