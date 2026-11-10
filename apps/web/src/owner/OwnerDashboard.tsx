"use client";

import { type FormEvent, useRef, useState } from "react";
import { ColorModeToggle, useColorMode } from "../components/ColorModeToggle.tsx";
import { createMockSessionAdapter } from "./mock-session-adapter.ts";
import { PrintableQrCard } from "./PrintableQrCard.tsx";
import type { OwnerDashboardSnapshot, OwnerMenuItem, TableSessionAdapter } from "./session-contract.ts";

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function OwnerDashboard({ initial, sessionAdapter }: { initial: OwnerDashboardSnapshot; sessionAdapter?: TableSessionAdapter }) {
  const { mode, toggle } = useColorMode("sora-owner-color-mode");
  const fallback = useRef(createMockSessionAdapter(initial.tables)).current;
  const adapter = sessionAdapter ?? fallback;
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [printTableId, setPrintTableId] = useState<string | null>(null);

  async function changeSession(tableId: string, action: "open" | "close") {
    setBusy(tableId); setMessage(null);
    const result = action === "open" ? await adapter.openSession(tableId) : await adapter.closeSession(tableId);
    if (result.ok) { setSnapshot(await adapter.getSnapshot()); setMessage(`${result.table.label} session ${action === "open" ? "started" : "closed"}.`); }
    else setMessage(`No change made (${result.code.toLowerCase().replaceAll("_", " ")}).`);
    setBusy(null);
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!adapter.createTable) return;
    const form = event.currentTarget; const label = String(new FormData(form).get("label")); setBusy("create");
    try { setSnapshot(await adapter.createTable(label)); setMessage(`${label} created with a unique QR code.`); form.reset(); }
    finally { setBusy(null); }
  }

  async function rotateQr(tableId: string) {
    if (!adapter.rotateQr || !window.confirm("New codes will replace the old ones. Any printed QR that still shows the previous code will stop working.")) return;
    setBusy(tableId); setSnapshot(await adapter.rotateQr(tableId)); setMessage("QR code regenerated. Reprint this table’s card."); setBusy(null);
  }

  const printTable = snapshot.tables.find((table) => table.id === printTableId);
  return <main data-mode={mode} className="owner-shell min-h-dvh bg-[var(--owner-bg)] px-4 py-6 font-[family-name:var(--font-manrope)] text-[var(--owner-text)] sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-black/10 pb-7">
        <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#C45C26]">Owner workspace</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] sm:text-6xl">{snapshot.restaurantName}</h1></div>
        <div className="flex items-center gap-2"><ColorModeToggle mode={mode} onToggle={toggle} className="border-[var(--owner-border)]" /><p className="rounded-full border border-[var(--owner-border)] px-4 py-2 text-sm text-[var(--owner-muted)]">{snapshot.timezone}</p></div>
      </header>

      <section className="grid gap-4 py-7 sm:grid-cols-3" aria-label="Restaurant summary">
        <Summary label="Accepted Order Value" value={zar.format(snapshot.acceptedOrderValueCents / 100)} note="VAT-inclusive · excludes cancelled and rejected · payment not verified" />
        <Summary label="Open table sessions" value={String(snapshot.tables.filter((table) => table.sessionState === "open").length)} note="Current dining sessions" />
        <Summary label="Enabled tables" value={`${snapshot.tables.filter((table) => table.enabled).length} / ${snapshot.tables.length}`} note="Permanent table availability" />
      </section>

      <section aria-labelledby="tables-heading" className="rounded-3xl bg-[var(--owner-surface)] p-4 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#C45C26]">Floor controls</p><h2 id="tables-heading" className="mt-1 text-3xl font-black tracking-tight">Tables</h2></div><p role="status" className="min-h-6 text-sm font-semibold text-[#57534E]">{message}</p></div>
        {adapter.createTable && <form onSubmit={createTable} className="mt-5 flex max-w-md gap-2"><label className="sr-only" htmlFor="new-table-label">New table label</label><input id="new-table-label" name="label" required maxLength={80} placeholder="e.g. Patio 5" className="min-h-12 min-w-0 flex-1 rounded-xl border border-black/20 px-4" /><button disabled={busy === "create"} className="min-h-12 rounded-xl bg-[#C45C26] px-5 font-bold text-white">Add table</button></form>}
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {snapshot.tables.map((table) => <li key={table.id} className="rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-card)] p-5">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-2xl font-black">{table.label}</h3><p className="mt-1 text-sm text-[#57534E]">{table.enabled ? "Table enabled" : "Table disabled"}</p></div><span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-wide ${table.sessionState === "open" ? "bg-[#DDE8D8] text-[#25451E]" : "bg-[#F5DFC1] text-[#70420F]"}`}>{table.sessionState === "open" ? "● Open" : "○ Closed"}</span></div>
            <div className="mt-6 grid gap-3">
              <button type="button" disabled={!table.enabled || busy === table.id} onClick={() => changeSession(table.id, table.sessionState === "open" ? "close" : "open")} className="min-h-12 rounded-xl bg-[#C45C26] px-4 font-bold text-white disabled:bg-stone-300">{busy === table.id ? "Updating…" : table.sessionState === "open" ? "Close session" : "Start session"}</button>
              <button type="button" onClick={() => setPrintTableId(table.id)} className="min-h-12 rounded-xl border-2 border-black/15 px-4 font-bold">Preview and print QR</button>
              {adapter.rotateQr && <button type="button" onClick={() => rotateQr(table.id)} className="min-h-12 rounded-xl px-4 text-sm font-bold text-[#8B3F1D] underline underline-offset-4">Regenerate QR code</button>}
            </div>
          </li>)}
        </ul>
      </section>

      <section aria-labelledby="menu-heading" className="mt-7 rounded-3xl bg-[var(--owner-surface)] p-4 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C45C26]">Guest experience</p><h2 id="menu-heading" className="mt-1 text-3xl font-black tracking-tight">Menu editor</h2>
        <div className="mt-6 space-y-7">{snapshot.menu.map((category) => <section key={category.id}><h3 className="mb-3 text-xl font-black">{category.name}</h3><div className="grid gap-4 md:grid-cols-2">{category.items.map((item) => <MenuItemEditor key={item.id} item={item} adapter={adapter} onSaved={setSnapshot} />)}</div></section>)}</div>
      </section>
    </div>

    {printTable && <div role="dialog" aria-modal="true" aria-label={`Printable QR for ${printTable.label}`} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-8"><div className="mx-auto max-w-sm"><div className="mb-3 flex justify-end gap-3 print:hidden"><button type="button" onClick={() => window.print()} className="min-h-12 rounded-full bg-[#C45C26] px-5 font-black text-white">Print</button><button type="button" onClick={() => setPrintTableId(null)} className="min-h-12 rounded-full border border-white/40 px-5 font-bold text-white">Close</button></div><PrintableQrCard restaurantName={snapshot.restaurantName} table={printTable} qrImageSrc={printTable.qrImageSrc} /></div></div>}
  </main>;
}

function MenuItemEditor({ item, adapter, onSaved }: { item: OwnerMenuItem; adapter: TableSessionAdapter; onSaved: (snapshot: OwnerDashboardSnapshot) => void }) {
  const [editing, setEditing] = useState(item); const [saving, setSaving] = useState(false);
  async function save(event: FormEvent) { event.preventDefault(); if (!adapter.updateItem) return; setSaving(true); onSaved(await adapter.updateItem(editing)); setSaving(false); }
  return <form onSubmit={save} className="overflow-hidden rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-card)]">
    {editing.imageUrl ? <img src={editing.imageUrl} alt="" className="h-40 w-full object-cover" /> : <div className="grid h-40 place-items-center bg-linear-to-br from-[#C45C26] to-[#F3D3BC] text-5xl font-black text-white">{editing.name.slice(0, 1)}</div>}
    <div className="space-y-3 p-4"><label className="block text-sm font-bold">Dish name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label><label className="block text-sm font-bold">Description<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] p-3 text-[var(--owner-text)]" /></label><label className="block text-sm font-bold">Price (rand)<input type="number" min="0" step="0.01" value={(editing.priceCents / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label><div className="flex flex-wrap gap-4"><label className="flex min-h-12 items-center gap-2 font-bold"><input type="checkbox" checked={editing.available} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} /> Available</label><label className="flex min-h-12 items-center gap-2 font-bold"><input type="checkbox" checked={editing.soldOut} onChange={(e) => setEditing({ ...editing, soldOut: e.target.checked })} /> Sold out</label></div>{adapter.updateItem && <button disabled={saving} className="min-h-12 w-full rounded-xl bg-[#C45C26] font-bold text-white">{saving ? "Saving…" : "Save dish"}</button>}</div>
  </form>;
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-surface)] p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--owner-muted)]">{label}</p><p className="mt-3 text-3xl font-black tracking-tight">{value}</p><p className="mt-2 text-xs leading-relaxed text-[var(--owner-muted)]">{note}</p></article>;
}
