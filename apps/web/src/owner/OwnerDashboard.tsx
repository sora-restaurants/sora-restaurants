"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ColorModeToggle, useColorMode } from "../components/ColorModeToggle.tsx";
import { createMockSessionAdapter } from "./mock-session-adapter.ts";
import { PrintableQrCard } from "./PrintableQrCard.tsx";
import type { OwnerDashboardSnapshot, OwnerMenuItem, OwnerReport, OwnerStats, TableSessionAdapter } from "./session-contract.ts";

// The 14 allergens food businesses are expected to declare (SA R146 / EU 1169 list).
export const ALLERGENS = ["Gluten", "Crustaceans", "Eggs", "Fish", "Peanuts", "Soy", "Milk", "Tree nuts", "Celery", "Mustard", "Sesame", "Sulphites", "Lupin", "Molluscs"];

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });

export function OwnerDashboard({ initial, sessionAdapter, onSignOut, onSwitchBranch }: { initial: OwnerDashboardSnapshot; sessionAdapter?: TableSessionAdapter; onSignOut?: () => void; onSwitchBranch?: (restaurantId: string) => void }) {
  const { mode, toggle } = useColorMode("sora-owner-color-mode");
  const fallback = useRef(createMockSessionAdapter(initial.tables)).current;
  const adapter = sessionAdapter ?? fallback;
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [printTableId, setPrintTableId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
      <header className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{snapshot.restaurantName}</h1>
        <div className="flex flex-wrap items-center gap-2">{onSwitchBranch && (snapshot.restaurants?.length ?? 0) > 1 && <label className="text-sm font-semibold">Branch <select value={snapshot.restaurantId} onChange={(e) => onSwitchBranch(e.target.value)} className="ml-1 min-h-11 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3">{snapshot.restaurants!.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}<button type="button" onClick={() => setMenuOpen(true)} className="min-h-11 rounded-lg bg-[var(--owner-text)] px-4 text-sm font-bold text-[var(--owner-surface)]">Edit menu</button><ColorModeToggle mode={mode} onToggle={toggle} className="border-[var(--owner-border)]" />{onSignOut && <button type="button" onClick={onSignOut} className="min-h-11 rounded-lg border border-[var(--owner-border)] px-4 text-sm font-semibold">Sign out</button>}</div>
      </header>

      {adapter.stats && <Takings adapter={adapter} />}

      <section aria-labelledby="tables-heading" className="mt-5 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><h2 id="tables-heading" className="text-lg font-bold">Tables</h2><p role="status" className="min-h-6 text-sm font-semibold text-[var(--owner-muted)]">{message}</p></div>
        {adapter.createTable && <form onSubmit={createTable} className="mt-5 flex max-w-md gap-2"><label className="sr-only" htmlFor="new-table-label">New table label</label><input id="new-table-label" name="label" required maxLength={80} placeholder="e.g. Patio 5" className="min-h-12 min-w-0 flex-1 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-4" /><button disabled={busy === "create"} className="min-h-12 rounded-lg bg-[var(--owner-text)] px-5 font-bold text-[var(--owner-surface)]">Add table</button></form>}
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {snapshot.tables.map((table) => <li key={table.id} className="rounded-lg border border-[var(--owner-border)] bg-[var(--owner-card)] p-4">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold">{table.label}</h3><p className="mt-1 text-sm text-[var(--owner-muted)]">{table.enabled ? "Table enabled" : "Table disabled"}</p></div><span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-wide ${table.sessionState === "open" ? "bg-[var(--owner-text)] text-[var(--owner-surface)]" : "border border-[var(--owner-border)] text-[var(--owner-muted)]"}`}>{table.sessionState === "open" ? "● Open" : "○ Closed"}</span></div>
            <div className="mt-6 grid gap-3">
              <button type="button" disabled={!table.enabled || busy === table.id} onClick={() => changeSession(table.id, table.sessionState === "open" ? "close" : "open")} className="min-h-12 rounded-lg bg-[var(--owner-text)] px-4 font-bold text-[var(--owner-surface)] disabled:bg-stone-300">{busy === table.id ? "Updating…" : table.sessionState === "open" ? "Close session" : "Start session"}</button>
              <button type="button" onClick={() => setPrintTableId(table.id)} className="min-h-12 rounded-lg border border-[var(--owner-border)] px-4 font-bold">Preview and print QR</button>
              {adapter.rotateQr && <button type="button" onClick={() => rotateQr(table.id)} className="min-h-12 rounded-lg px-4 text-sm font-bold text-[var(--owner-text)] underline underline-offset-4">Regenerate QR code</button>}
            </div>
          </li>)}
        </ul>
      </section>

      {adapter.report && <Reports adapter={adapter} timezone={snapshot.timezone} name={snapshot.restaurantName} />}
      {adapter.command && snapshot.role === "owner" && snapshot.restaurantId && <Staff snapshot={snapshot} adapter={adapter} onSaved={setSnapshot} />}

      <section aria-labelledby="orders-heading" className="mt-5 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] p-4 sm:p-6">
        <h2 id="orders-heading" className="text-lg font-bold">Today's orders</h2>
        {snapshot.orders.length === 0 ? <p className="mt-4 text-[var(--owner-muted)]">No orders yet today.</p> : <ul className="mt-4 divide-y divide-[var(--owner-border)]">{snapshot.orders.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-bold">{o.publicRef} · {o.table}</span><span className="text-sm text-[var(--owner-muted)]">{new Date(o.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: snapshot.timezone })} · {o.status} · {o.paymentStatus}</span><span className="font-bold tabular-nums">{zar.format(o.totalCents / 100)}</span></li>)}</ul>}
      </section>
    </div>

    {menuOpen && <MenuEditor snapshot={snapshot} adapter={adapter} onSaved={setSnapshot} onClose={() => setMenuOpen(false)} />}
    {printTable && <div role="dialog" aria-modal="true" aria-label={`Printable QR for ${printTable.label}`} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 sm:p-8"><div className="mx-auto max-w-sm"><div className="mb-3 flex justify-end gap-3 print:hidden"><button type="button" onClick={() => window.print()} className="min-h-12 rounded-full bg-white px-5 font-black text-black">Print</button><button type="button" onClick={() => setPrintTableId(null)} className="min-h-12 rounded-full border border-white/40 px-5 font-bold text-white">Close</button></div><PrintableQrCard restaurantName={snapshot.restaurantName} table={printTable} qrImageSrc={printTable.qrImageSrc} /></div></div>}
  </main>;
}

const PERIODS = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"]] as const;
const wholeRand = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "UTC" });

/** What the restaurant took: QR orders, order value and average, a bar chart and top dishes for today, 7 or 30 days. */
function Takings({ adapter }: { adapter: TableSessionAdapter }) {
  const [period, setPeriod] = useState<OwnerStats["period"]>("today");
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => adapter.stats!(period).then((s) => { if (live) { setStats(s); setFailed(false); } }, () => { if (live) setFailed(true); });
    void load();
    // Takings refresh on their own while the tab is open; a failed refresh keeps the last figures.
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    return () => { live = false; clearInterval(timer); };
  }, [adapter, period]);
  const kpis = stats && [[String(stats.orders), "QR orders"], [wholeRand.format(stats.valueCents / 100), "Order value"],
    [wholeRand.format(stats.orders ? stats.valueCents / stats.orders / 100 : 0), "Average order"], [wholeRand.format(stats.tipCents / 100), "Tips"]];
  const series = stats?.series ?? [];
  const max = Math.max(1, ...series.map((b) => b.orders));
  const byHour = stats?.period === "today";
  const label = (i: number) => byHour ? series[i].label : dayLabel(series[i].label);
  return <section aria-labelledby="takings-heading" className="overflow-hidden rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)]">
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <h2 id="takings-heading" className="font-bold">Owner dashboard <span className="ml-2 text-sm font-normal text-[var(--owner-muted)]">{PERIODS.find(([id]) => id === period)![1]}</span></h2>
      <div role="group" aria-label="Period" className="flex rounded-lg border border-[var(--owner-border)] p-0.5">{PERIODS.map(([id, name]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)} className={`min-h-10 rounded-md px-3 text-sm font-semibold ${period === id ? "bg-[var(--owner-text)] text-[var(--owner-surface)]" : "text-[var(--owner-muted)]"}`}>{name}</button>)}</div>
    </div>
    {!stats || !kpis ? <p role={failed ? "alert" : undefined} className="border-t border-[var(--owner-border)] px-4 py-6 text-sm text-[var(--owner-muted)]">{failed ? "Couldn't load the figures. Trying again every 30 seconds." : "Loading…"}</p>
      : <div aria-busy={stats.period !== period} className={stats.period !== period ? "opacity-50" : ""}>
        <dl className="grid grid-cols-2 border-y border-[var(--owner-border)] sm:grid-cols-4">
          {kpis.map(([value, name], i) =>
            <div key={name} className={`flex min-w-0 flex-col-reverse border-[var(--owner-border)] px-4 py-4 ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}><dt className="mt-1 text-xs text-[var(--owner-muted)] sm:text-sm">{name}</dt><dd className="text-[clamp(1.4rem,7vw,2.25rem)] font-bold leading-tight tracking-tight tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="px-4 pt-3 text-xs text-[var(--owner-muted)]">QR orders only, VAT included; tips are counted apart from order value. Cancelled and rejected orders are left out. Updates every 30 seconds{failed ? " (last update failed, showing earlier figures)" : ""}.</p>
        <div className="px-4 py-4">
          <p className="text-sm text-[var(--owner-muted)]">Orders by {byHour ? "hour" : "day"}</p>
          <div role="img" aria-label={`Orders by ${byHour ? "hour" : "day"}: ${series.map((b, i) => `${label(i)} ${b.orders}`).join(", ")}`} className="mt-3 flex h-32 items-end gap-1">
            {series.map((b) => <i key={b.label} className={`flex-1 rounded-t-[2px] ${b.orders ? "bg-[var(--owner-text)]" : "bg-[var(--owner-border)]"}`} style={{ height: `${b.orders ? Math.max(4, (b.orders / max) * 100) : 2}%` }} />)}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--owner-muted)]">{series.length > 1 && <span>{label(0)}</span>}{series.length > 2 && <span>{label(Math.floor(series.length / 2))}</span>}<span>{byHour ? "Now" : "Today"}</span></div>
        </div>
        {stats.topItems.length === 0 ? <p className="border-t border-[var(--owner-border)] px-4 py-3 text-sm text-[var(--owner-muted)]">No orders yet.</p>
          : <ul className="divide-y divide-[var(--owner-border)] border-t border-[var(--owner-border)]">{stats.topItems.map((i) => <li key={i.name} className="flex justify-between gap-3 px-4 py-3"><span>{i.name}</span><span className="text-sm text-[var(--owner-muted)] tabular-nums">{i.quantity} ordered</span></li>)}</ul>}
        {stats.byTable.length > 0 && <div className="border-t border-[var(--owner-border)]">
          <p className="px-4 pt-4 text-sm text-[var(--owner-muted)]">By table</p>
          <ul className="mt-2 divide-y divide-[var(--owner-border)] border-t border-[var(--owner-border)]">{stats.byTable.map((t) => <li key={t.table} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-3"><span className="font-semibold">{t.table}</span><span className="text-sm tabular-nums"><b>{wholeRand.format(t.valueCents / 100)}</b><span className="text-[var(--owner-muted)]"> · tips {wholeRand.format(t.tipCents / 100)} · {t.orders} {t.orders === 1 ? "order" : "orders"}</span></span></li>)}</ul>
        </div>}
      </div>}
  </section>;
}

/** Full-screen menu editor: one button per category, and only that category's dishes below it. */
function MenuEditor({ snapshot, adapter, onSaved, onClose }: { snapshot: OwnerDashboardSnapshot; adapter: TableSessionAdapter; onSaved: (snapshot: OwnerDashboardSnapshot) => void; onClose: () => void }) {
  const [categoryId, setCategoryId] = useState(snapshot.menu[0]?.id);
  const category = snapshot.menu.find((c) => c.id === categoryId);
  const input = "mt-1 min-h-11 w-full rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]";
  return <div role="dialog" aria-modal="true" aria-labelledby="menu-heading" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} className="fixed inset-0 z-40 overflow-y-auto bg-[var(--owner-bg)] px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3"><h2 id="menu-heading" className="text-2xl font-bold tracking-tight">Edit menu</h2><button type="button" autoFocus onClick={onClose} className="min-h-11 rounded-lg border border-[var(--owner-border)] px-4 font-semibold">Done</button></div>
      <div role="group" aria-label="Categories" className="mt-4 flex flex-wrap gap-2">{snapshot.menu.map((c) => <button key={c.id} type="button" aria-pressed={c.id === categoryId} onClick={() => setCategoryId(c.id)} className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${c.id === categoryId ? "border-[var(--owner-text)] bg-[var(--owner-text)] text-[var(--owner-surface)]" : "border-[var(--owner-border)] bg-[var(--owner-surface)]"}`}>{c.name} <span className="ml-1 font-normal opacity-60">{c.items.length}</span></button>)}</div>
      {adapter.createCategory && <details className="mt-3"><summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-semibold text-[var(--owner-muted)]">+ Add a category</summary><QuickAdd label="Category name" onAdd={async (name) => onSaved(await adapter.createCategory!(name))} /></details>}
      {category && <section aria-label={category.name} className="mt-4 overflow-hidden rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--owner-border)] px-4 py-3"><h3 className="font-bold">{category.name}</h3>{adapter.command && <label className="text-sm text-[var(--owner-muted)]">Sends to <select value={category.station ?? "kitchen"} onChange={async (e) => onSaved(await adapter.command!({ action: "setStation", menuId: category.id, station: e.target.value }))} className="ml-1 min-h-10 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-2 text-[var(--owner-text)]"><option value="kitchen">Kitchen</option><option value="bar">Bar</option></select></label>}</div>
        {category.items.length === 0 ? <p className="px-4 py-4 text-sm text-[var(--owner-muted)]">No dishes yet.</p> : <ul className="divide-y divide-[var(--owner-border)]">{category.items.map((item) => <li key={item.id}><MenuItemEditor item={item} adapter={adapter} onSaved={onSaved} input={input} /></li>)}</ul>}
        {adapter.createItem && <div className="border-t border-[var(--owner-border)] px-4 pb-4"><QuickAdd label="Add a dish" withPrice onAdd={async (name, cents) => onSaved(await adapter.createItem!(category.id, name, cents))} /></div>}
      </section>}
    </div>
  </div>;
}

function MenuItemEditor({ item, adapter, onSaved, input }: { item: OwnerMenuItem; adapter: TableSessionAdapter; onSaved: (snapshot: OwnerDashboardSnapshot) => void; input: string }) {
  const [editing, setEditing] = useState(item); const [saving, setSaving] = useState(false);
  async function save(next: OwnerMenuItem) { if (!adapter.updateItem) return; setSaving(true); try { onSaved(await adapter.updateItem(next)); } finally { setSaving(false); } }
  return <form onSubmit={(e) => { e.preventDefault(); void save(editing); }} className="px-4 py-3">
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <label className="min-w-0 grow basis-44 text-xs font-semibold text-[var(--owner-muted)]">Name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${input} text-base font-semibold`} /></label>
      <label className="w-28 text-xs font-semibold text-[var(--owner-muted)]">Price (R)<input type="number" min="0" step="0.01" value={(editing.priceCents / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })} className={`${input} tabular-nums`} /></label>
      {/* Sold out saves straight away: it is flipped mid-service. */}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" role="switch" checked={editing.soldOut} disabled={!adapter.updateItem || saving} onChange={(e) => { const next = { ...editing, soldOut: e.target.checked }; setEditing(next); void save(next); }} className="peer sr-only" /><span aria-hidden className="relative h-6 w-10 shrink-0 rounded-full bg-[var(--owner-border)] transition peer-checked:bg-[var(--owner-text)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-[var(--owner-surface)] after:shadow after:transition peer-checked:after:translate-x-4" />Sold out</label>
      {adapter.updateItem && <button disabled={saving} className="min-h-11 rounded-lg bg-[var(--owner-text)] px-4 text-sm font-bold text-[var(--owner-surface)]">{saving ? "Saving…" : "Save"}</button>}
    </div>
    <details className="mt-1"><summary className="inline-flex min-h-9 cursor-pointer items-center text-sm text-[var(--owner-muted)]">More: description, allergens, options</summary>
      <div className="space-y-3 pb-2 pt-1">
        <label className="block text-xs font-semibold text-[var(--owner-muted)]">Description<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={`${input} min-h-20 py-2`} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.available} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} /> Available</label>
        <fieldset><legend className="text-xs font-semibold text-[var(--owner-muted)]">Allergens</legend><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{ALLERGENS.map((a) => <label key={a} className="flex min-h-9 items-center gap-1 text-sm"><input type="checkbox" checked={editing.allergens?.includes(a) ?? false} onChange={(e) => setEditing({ ...editing, allergens: e.target.checked ? [...(editing.allergens ?? []), a] : (editing.allergens ?? []).filter((x) => x !== a) })} />{a}</label>)}</div></fieldset>
        {adapter.command && <ItemOptions item={item} adapter={adapter} onSaved={onSaved} />}
      </div>
    </details>
  </form>;
}

function QuickAdd({ label, withPrice = false, onAdd }: { label: string; withPrice?: boolean; onAdd: (name: string, priceCents: number) => Promise<void> }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); try { await onAdd(name, Math.round(Number(price || 0) * 100)); setName(""); setPrice(""); } catch { setError("Could not add it. Check the name and price."); } setBusy(false); }} className="mt-3 flex flex-wrap items-end gap-2">
    <label className="grow text-sm font-bold">{label}<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
    {withPrice && <label className="w-32 text-sm font-bold">Price (R)<input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>}
    <button disabled={busy} className="min-h-12 rounded-lg bg-[var(--owner-text)] px-4 font-bold text-[var(--owner-surface)]">{busy ? "Adding…" : "Add"}</button>
    {error && <p role="alert" className="w-full text-sm text-[var(--owner-text)]">{error}</p>}
  </form>;
}

/** Paid or free choices for one dish (sizes, extras). Guests pick them; the server prices them. Not a <form>: it sits inside the dish form. */
function ItemOptions({ item, adapter, onSaved }: { item: OwnerMenuItem; adapter: TableSessionAdapter; onSaved: (snapshot: OwnerDashboardSnapshot) => void }) {
  const [label, setLabel] = useState(""); const [price, setPrice] = useState(""); const [error, setError] = useState<string | null>(null);
  async function run(body: object) { setError(null); try { onSaved(await adapter.command!(body)); return true; } catch { setError("Could not save. Names can't contain commas or repeat."); return false; } }
  return <div className="border-t border-[var(--owner-border)] pt-3">
    <p className="text-sm font-bold">Options guests can add</p>
    <ul className="mt-1 space-y-1">{(item.options ?? []).map((o) => <li key={o.id} className="flex items-center justify-between gap-2 text-sm"><span>{o.label} {o.priceCents ? `(+${zar.format(o.priceCents / 100)})` : "(free)"}</span><button type="button" onClick={() => run({ action: "deleteOption", optionId: o.id })} className="min-h-9 px-2 font-bold text-[var(--owner-text)] underline">Remove</button></li>)}</ul>
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="grow text-xs font-bold">Option<input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Extra cheese" className="mt-1 min-h-11 w-full rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
      <label className="w-24 text-xs font-bold">+ Price (R)<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
      <button type="button" disabled={!label.trim()} onClick={async () => { if (await run({ action: "addOption", itemId: item.id, label: label.trim(), priceCents: Math.round(Number(price || 0) * 100) })) { setLabel(""); setPrice(""); } }} className="min-h-11 rounded-lg border-2 border-[var(--owner-text)] px-3 text-sm font-bold">Add option</button>
    </div>
    {error && <p role="alert" className="mt-1 text-sm text-[var(--owner-text)]">{error}</p>}
  </div>;
}

/** YYYY-MM-DD for "today" in the restaurant's time zone. */
function dayIn(timezone: string, offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: timezone });
}

const csvCell = (v: unknown) => `"${String(v).replaceAll("\"", "\"\"")}"`;

/** Sales by day and top dishes for a date range, with a CSV download for the accountant. */
function Reports({ adapter, timezone, name }: { adapter: TableSessionAdapter; timezone: string; name: string }) {
  const [from, setFrom] = useState(() => dayIn(timezone, -6)); const [to, setTo] = useState(() => dayIn(timezone));
  const [report, setReport] = useState<OwnerReport | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function load(event?: FormEvent) { event?.preventDefault(); setBusy(true); setError(null); try { setReport(await adapter.report!(from, to)); } catch { setError("Could not load the report. Check the dates (up to one year)."); } setBusy(false); }
  const rand = (c: number) => (c / 100).toFixed(2);
  function download() {
    if (!report) return;
    const rows: unknown[][] = [["Date", "Orders", "Sales (R, VAT incl.)", "Tips (R)", "Marked paid (R)"], ...report.days.map((d) => [d.day, d.orders, rand(d.totalCents), rand(d.tipCents), rand(d.paidCents)]),
      [], ["Dish", "Quantity", "Sales (R)"], ...report.topItems.map((i) => [i.name, i.quantity, rand(i.totalCents)])];
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${name} sales ${report.from} to ${report.to}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }
  const total = report?.days.reduce((s, d) => s + d.totalCents, 0) ?? 0; const orders = report?.days.reduce((s, d) => s + d.orders, 0) ?? 0;
  return <section aria-labelledby="reports-heading" className="mt-5 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] p-4 sm:p-6">
    <h2 id="reports-heading" className="text-lg font-bold">Sales reports</h2>
    <form onSubmit={load} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-bold">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block min-h-12 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3" /></label>
      <label className="text-sm font-bold">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block min-h-12 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3" /></label>
      <button disabled={busy} className="min-h-12 rounded-lg bg-[var(--owner-text)] px-5 font-bold text-[var(--owner-surface)]">{busy ? "Loading…" : "Show"}</button>
      {report && <button type="button" onClick={download} className="min-h-12 rounded-lg border border-[var(--owner-border)] px-5 font-bold">Download CSV</button>}
    </form>
    {error && <p role="alert" className="mt-3 text-[var(--owner-text)]">{error}</p>}
    {report && <div className="mt-5 grid gap-6 md:grid-cols-2">
      <div><p className="font-bold">{orders} orders · {zar.format(total / 100)}</p><table className="mt-2 w-full text-sm"><thead><tr className="text-left text-[var(--owner-muted)]"><th className="py-1">Date</th><th>Orders</th><th className="text-right">Sales</th><th className="text-right">Paid</th></tr></thead><tbody>{report.days.map((d) => <tr key={d.day} className="border-t border-[var(--owner-border)]"><td className="py-1">{d.day}</td><td>{d.orders}</td><td className="text-right tabular-nums">{zar.format(d.totalCents / 100)}</td><td className="text-right tabular-nums">{zar.format(d.paidCents / 100)}</td></tr>)}</tbody></table>{report.days.length === 0 && <p className="mt-2 text-[var(--owner-muted)]">No orders in these dates.</p>}</div>
      <div><p className="font-bold">Top dishes</p><ol className="mt-2 space-y-1 text-sm">{report.topItems.map((i) => <li key={i.name} className="flex justify-between gap-3 border-t border-[var(--owner-border)] py-1"><span>{i.quantity}× {i.name}</span><span className="tabular-nums">{zar.format(i.totalCents / 100)}</span></li>)}</ol></div>
    </div>}
  </section>;
}

/** Owner-only: invite waiters, kitchen staff and managers by email, and switch them off when they leave. */
function Staff({ snapshot, adapter, onSaved }: { snapshot: OwnerDashboardSnapshot; adapter: TableSessionAdapter; onSaved: (snapshot: OwnerDashboardSnapshot) => void }) {
  const [email, setEmail] = useState(""); const [role, setRole] = useState("waiter"); const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function run(body: object, done: string) {
    setBusy(true); setMessage(null);
    try { onSaved(await adapter.command!(body)); setMessage(done); return true; }
    catch (error) { setMessage(error instanceof Error && error.message === "invites_not_configured" ? "Invites aren't set up yet (the server needs its Supabase service key)." : "That didn't work. Check the email address."); return false; }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="staff-heading" className="mt-5 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] p-4 sm:p-6">
    <h2 id="staff-heading" className="text-lg font-bold">Staff</h2>
    <ul className="mt-4 divide-y divide-[var(--owner-border)]">{(snapshot.staff ?? []).map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-bold">{s.email ?? "(no email)"}</span><span className="text-sm text-[var(--owner-muted)]">{s.role} · {s.status}</span>{s.role !== "owner" && <button type="button" disabled={busy} onClick={() => run({ action: "setStaffStatus", membershipId: s.id, status: s.status === "active" ? "inactive" : "active" }, s.status === "active" ? "Access removed." : "Access restored.")} className="min-h-11 rounded-lg border border-[var(--owner-border)] px-3 text-sm font-bold">{s.status === "active" ? "Remove access" : "Restore access"}</button>}</li>)}</ul>
    <form onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "inviteStaff", restaurantId: snapshot.restaurantId, email: email.trim(), role }, `Invite sent to ${email.trim()}.`)) setEmail(""); }} className="mt-4 flex flex-wrap items-end gap-2">
      <label className="grow text-sm font-bold">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 min-h-12 w-full rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
      <label className="text-sm font-bold">Role<select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block min-h-12 rounded-lg border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3"><option value="waiter">Waiter</option><option value="kitchen">Kitchen</option><option value="manager">Manager</option></select></label>
      <button disabled={busy} className="min-h-12 rounded-lg bg-[var(--owner-text)] px-5 font-bold text-[var(--owner-surface)]">Invite</button>
    </form>
    <p role="status" className="mt-2 min-h-6 text-sm font-semibold">{message}</p>
  </section>;
}
