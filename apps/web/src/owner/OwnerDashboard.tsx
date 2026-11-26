"use client";

import { type FormEvent, useRef, useState } from "react";
import { ColorModeToggle, useColorMode } from "../components/ColorModeToggle.tsx";
import { createMockSessionAdapter } from "./mock-session-adapter.ts";
import { PrintableQrCard } from "./PrintableQrCard.tsx";
import type { OwnerDashboardSnapshot, OwnerMenuItem, OwnerReport, TableSessionAdapter } from "./session-contract.ts";

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
        <div className="flex flex-wrap items-center gap-2">{onSwitchBranch && (snapshot.restaurants?.length ?? 0) > 1 && <label className="text-sm font-bold">Branch <select value={snapshot.restaurantId} onChange={(e) => onSwitchBranch(e.target.value)} className="ml-1 min-h-11 rounded-full border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3">{snapshot.restaurants!.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>}<ColorModeToggle mode={mode} onToggle={toggle} className="border-[var(--owner-border)]" /><p className="rounded-full border border-[var(--owner-border)] px-4 py-2 text-sm text-[var(--owner-muted)]">{snapshot.timezone}</p>{onSignOut && <button type="button" onClick={onSignOut} className="min-h-11 rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">Sign out</button>}</div>
      </header>

      <section className="grid gap-4 py-7 sm:grid-cols-3" aria-label="Restaurant summary">
        <Summary label="Today's order value" value={zar.format(snapshot.acceptedOrderValueCents / 100)} note={`VAT-inclusive · excludes cancelled and rejected · ${zar.format(snapshot.paidTodayCents / 100)} marked paid`} />
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
        <div className="mt-6 space-y-7">{snapshot.menu.map((category) => <section key={category.id}><div className="mb-3 flex flex-wrap items-center gap-3"><h3 className="text-xl font-black">{category.name}</h3>{adapter.command && <label className="text-sm font-bold">Screen <select value={category.station ?? "auto"} onChange={async (e) => setSnapshot(await adapter.command!({ action: "setStation", menuId: category.id, station: e.target.value }))} className="ml-1 min-h-10 rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-2"><option value="auto">Auto (drinks to bar)</option><option value="kitchen">Kitchen</option><option value="bar">Bar</option></select></label>}</div><div className="grid gap-4 md:grid-cols-2">{category.items.map((item) => <MenuItemEditor key={item.id} item={item} adapter={adapter} onSaved={setSnapshot} />)}</div>{adapter.createItem && <QuickAdd label="Add a dish" withPrice onAdd={async (name, cents) => setSnapshot(await adapter.createItem!(category.id, name, cents))} />}</section>)}</div>
        {adapter.createCategory && <div className="mt-7"><QuickAdd label="Add a category" onAdd={async (name) => setSnapshot(await adapter.createCategory!(name))} /></div>}
      </section>

      {adapter.report && <Reports adapter={adapter} timezone={snapshot.timezone} name={snapshot.restaurantName} />}
      {adapter.command && snapshot.role === "owner" && snapshot.restaurantId && <Staff snapshot={snapshot} adapter={adapter} onSaved={setSnapshot} />}

      <section aria-labelledby="orders-heading" className="mt-7 rounded-3xl bg-[var(--owner-surface)] p-4 shadow-sm sm:p-7">
        <h2 id="orders-heading" className="text-3xl font-black tracking-tight">Today's orders</h2>
        {snapshot.orders.length === 0 ? <p className="mt-4 text-[var(--owner-muted)]">No orders yet today.</p> : <ul className="mt-4 divide-y divide-[var(--owner-border)]">{snapshot.orders.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-bold">{o.publicRef} · {o.table}</span><span className="text-sm text-[var(--owner-muted)]">{new Date(o.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: snapshot.timezone })} · {o.status} · {o.paymentStatus}</span><span className="font-bold tabular-nums">{zar.format(o.totalCents / 100)}</span></li>)}</ul>}
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
    <div className="space-y-3 p-4"><label className="block text-sm font-bold">Dish name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label><label className="block text-sm font-bold">Description<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] p-3 text-[var(--owner-text)]" /></label><label className="block text-sm font-bold">Price (rand)<input type="number" min="0" step="0.01" value={(editing.priceCents / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, priceCents: Math.round(Number(e.target.value) * 100) })} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label><div className="flex flex-wrap gap-4"><label className="flex min-h-12 items-center gap-2 font-bold"><input type="checkbox" checked={editing.available} onChange={(e) => setEditing({ ...editing, available: e.target.checked })} /> Available</label><label className="flex min-h-12 items-center gap-2 font-bold"><input type="checkbox" checked={editing.soldOut} onChange={(e) => setEditing({ ...editing, soldOut: e.target.checked })} /> Sold out</label></div><fieldset><legend className="text-sm font-bold">Allergens</legend><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{ALLERGENS.map((a) => <label key={a} className="flex min-h-9 items-center gap-1 text-sm"><input type="checkbox" checked={editing.allergens?.includes(a) ?? false} onChange={(e) => setEditing({ ...editing, allergens: e.target.checked ? [...(editing.allergens ?? []), a] : (editing.allergens ?? []).filter((x) => x !== a) })} />{a}</label>)}</div></fieldset>{adapter.updateItem && <button disabled={saving} className="min-h-12 w-full rounded-xl bg-[#C45C26] font-bold text-white">{saving ? "Saving…" : "Save dish"}</button>}{adapter.command && <ItemOptions item={item} adapter={adapter} onSaved={onSaved} />}</div>
  </form>;
}

function Summary({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-surface)] p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--owner-muted)]">{label}</p><p className="mt-3 text-3xl font-black tracking-tight">{value}</p><p className="mt-2 text-xs leading-relaxed text-[var(--owner-muted)]">{note}</p></article>;
}

function QuickAdd({ label, withPrice = false, onAdd }: { label: string; withPrice?: boolean; onAdd: (name: string, priceCents: number) => Promise<void> }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(null); try { await onAdd(name, Math.round(Number(price || 0) * 100)); setName(""); setPrice(""); } catch { setError("Could not add it. Check the name and price."); } setBusy(false); }} className="mt-3 flex flex-wrap items-end gap-2">
    <label className="grow text-sm font-bold">{label}<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
    {withPrice && <label className="w-32 text-sm font-bold">Price (R)<input required type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>}
    <button disabled={busy} className="min-h-12 rounded-xl bg-[#C45C26] px-4 font-bold text-white">{busy ? "Adding…" : "Add"}</button>
    {error && <p role="alert" className="w-full text-sm text-[#8B3F1D]">{error}</p>}
  </form>;
}

/** Paid or free choices for one dish (sizes, extras). Guests pick them; the server prices them. Not a <form>: it sits inside the dish form. */
function ItemOptions({ item, adapter, onSaved }: { item: OwnerMenuItem; adapter: TableSessionAdapter; onSaved: (snapshot: OwnerDashboardSnapshot) => void }) {
  const [label, setLabel] = useState(""); const [price, setPrice] = useState(""); const [error, setError] = useState<string | null>(null);
  async function run(body: object) { setError(null); try { onSaved(await adapter.command!(body)); return true; } catch { setError("Could not save. Names can't contain commas or repeat."); return false; } }
  return <div className="border-t border-[var(--owner-border)] pt-3">
    <p className="text-sm font-bold">Options guests can add</p>
    <ul className="mt-1 space-y-1">{(item.options ?? []).map((o) => <li key={o.id} className="flex items-center justify-between gap-2 text-sm"><span>{o.label} {o.priceCents ? `(+${zar.format(o.priceCents / 100)})` : "(free)"}</span><button type="button" onClick={() => run({ action: "deleteOption", optionId: o.id })} className="min-h-9 px-2 font-bold text-[#8B3F1D] underline">Remove</button></li>)}</ul>
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <label className="grow text-xs font-bold">Option<input value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Extra cheese" className="mt-1 min-h-11 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
      <label className="w-24 text-xs font-bold">+ Price (R)<input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
      <button type="button" disabled={!label.trim()} onClick={async () => { if (await run({ action: "addOption", itemId: item.id, label: label.trim(), priceCents: Math.round(Number(price || 0) * 100) })) { setLabel(""); setPrice(""); } }} className="min-h-11 rounded-xl border-2 border-[#C45C26] px-3 text-sm font-bold">Add option</button>
    </div>
    {error && <p role="alert" className="mt-1 text-sm text-[#8B3F1D]">{error}</p>}
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
  return <section aria-labelledby="reports-heading" className="mt-7 rounded-3xl bg-[var(--owner-surface)] p-4 shadow-sm sm:p-7">
    <h2 id="reports-heading" className="text-3xl font-black tracking-tight">Sales reports</h2>
    <form onSubmit={load} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-bold">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block min-h-12 rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3" /></label>
      <label className="text-sm font-bold">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block min-h-12 rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3" /></label>
      <button disabled={busy} className="min-h-12 rounded-xl bg-[#C45C26] px-5 font-bold text-white">{busy ? "Loading…" : "Show"}</button>
      {report && <button type="button" onClick={download} className="min-h-12 rounded-xl border-2 border-black/15 px-5 font-bold">Download CSV</button>}
    </form>
    {error && <p role="alert" className="mt-3 text-[#8B3F1D]">{error}</p>}
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
  return <section aria-labelledby="staff-heading" className="mt-7 rounded-3xl bg-[var(--owner-surface)] p-4 shadow-sm sm:p-7">
    <h2 id="staff-heading" className="text-3xl font-black tracking-tight">Staff</h2>
    <ul className="mt-4 divide-y divide-[var(--owner-border)]">{(snapshot.staff ?? []).map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="font-bold">{s.email ?? "(no email)"}</span><span className="text-sm text-[var(--owner-muted)]">{s.role} · {s.status}</span>{s.role !== "owner" && <button type="button" disabled={busy} onClick={() => run({ action: "setStaffStatus", membershipId: s.id, status: s.status === "active" ? "inactive" : "active" }, s.status === "active" ? "Access removed." : "Access restored.")} className="min-h-11 rounded-xl border-2 border-black/15 px-3 text-sm font-bold">{s.status === "active" ? "Remove access" : "Restore access"}</button>}</li>)}</ul>
    <form onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "inviteStaff", restaurantId: snapshot.restaurantId, email: email.trim(), role }, `Invite sent to ${email.trim()}.`)) setEmail(""); }} className="mt-4 flex flex-wrap items-end gap-2">
      <label className="grow text-sm font-bold">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-[var(--owner-text)]" /></label>
      <label className="text-sm font-bold">Role<select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block min-h-12 rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3"><option value="waiter">Waiter</option><option value="kitchen">Kitchen</option><option value="manager">Manager</option></select></label>
      <button disabled={busy} className="min-h-12 rounded-xl bg-[#C45C26] px-5 font-bold text-white">Invite</button>
    </form>
    <p role="status" className="mt-2 min-h-6 text-sm font-semibold">{message}</p>
  </section>;
}
