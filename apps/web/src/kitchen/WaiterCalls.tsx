"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { newCalls, playCallChime, useCallSound, useSoundUnlocked } from "./call-chime.ts";
import { EYEBROW, Screen, Shell, SignIn } from "./StaffSignIn.tsx";
import { formatRand } from "../lib/money.ts";
import { readChoice, saveChoice } from "./restaurant-choice.ts";
import { dropOn401, type StaffAuth, staffAuth } from "./staff-auth.ts";

type Call = { id: string; tableId: string; table: string; createdAt: string; restaurantId: string };
type Unpaid = { id: string; publicRef: string; table: string; status: string; totalCents: number; restaurantId: string };
type FloorTable = { id: string; label: string; restaurantId: string; restaurantName: string; openedAt: string | null; orders: number; inKitchen: number; unpaidCents: number; calling: boolean; ready: number; items: Line[] };
type Line = { ref: string; status: string; name: string; quantity: number; notes: string; priceCents: number };
const STATUS: Record<string, string> = { submitted: "New", accepted: "Accepted", preparing: "Cooking", ready: "Ready: take it out", served: "Served" };
const POLL_MS = 3_000;

/** Floor staff screen: tables asking for a waiter, oldest first, then every table with what it needs and has ordered. */
export function WaiterCalls() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <Screen>Waiter screen is not configured: set the Supabase variables, or the dev login.</Screen>;
  return <WaiterSession auth={auth} />;
}

function WaiterSession({ auth }: { auth: StaffAuth }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => auth.getToken().then(setToken);
    refresh();
    return auth.onChange(refresh);
  }, [auth]);

  if (token === undefined) return <Screen>Loading…</Screen>;
  if (!token) return <SignIn auth={auth} title="Waiter sign in" demo="waiter@demo.test / demo-waiter-pass" />;
  return <CallList token={token} auth={auth} />;
}

function CallList({ token, auth }: { token: string; auth: StaffAuth }) {
  const onSignOut = () => void auth.signOut();
  const [allCalls, setCalls] = useState<Call[] | null>(null);
  const [allUnpaid, setUnpaid] = useState<Unpaid[]>([]);
  const [allFloor, setFloor] = useState<FloorTable[]>([]);
  const [chosen, setChosen] = useState<string | null>(() => readChoice());
  // Staff at several restaurants see one at a time: the one this device works for (shared with kitchen and owner).
  const restaurants = [...new Map(allFloor.map((t) => [t.restaurantId, t.restaurantName])).entries()];
  const active = restaurants.find(([id]) => id === chosen)?.[0] ?? restaurants[0]?.[0];
  const mine = <T extends { restaurantId: string }>(rows: T[]) => (active ? rows.filter((r) => r.restaurantId === active) : rows);
  const calls = allCalls && mine(allCalls);
  const unpaid = mine(allUnpaid);
  const floor = mine(allFloor);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sound, toggleSound] = useCallSound();
  const unlocked = useSoundUnlocked();
  const seen = useRef<Set<string> | null>(null);

  // One chime per poll that brings a call never shown before; silent on first load.
  useEffect(() => {
    if (!allCalls) return;
    const result = newCalls(seen.current, allCalls.map((c) => c.id));
    seen.current = result.seen;
    if (result.chime && sound) playCallChime();
  }, [allCalls, sound]);

  const load = useCallback(async () => {
    try {
      const res = await dropOn401(auth, await fetch("/api/staff/calls", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" }));
      if (res.status === 401) return; // session gone: the sign-in form takes over
      if (!res.ok) throw new Error(String(res.status));
      setCalls((await res.json()).calls);
      const owed = await fetch("/api/staff/unpaid", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (owed.ok) setUnpaid((await owed.json()).orders);
      const tables = await fetch("/api/staff/tables", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (tables.ok) setFloor((await tables.json()).tables);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setNow(Date.now());
  }, [token, auth]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function answer(call: Call) {
    setCalls((list) => list?.filter((c) => c.id !== call.id) ?? null); // the next poll brings the truth either way
    await fetch(`/api/staff/calls/${call.id}/ack`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }

  async function settle(order: Unpaid) {
    setUnpaid((list) => list.filter((o) => o.id !== order.id));
    await fetch(`/api/staff/orders/${order.id}/paid`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }



  const owed = unpaid.length;
  return (
    <Shell>{(toggle) => (<>
      {/* Same Sora shell as the owner dashboard: eyebrow + heading, rounded surfaces, terracotta actions. */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--owner-border)] pb-4">
        <div>
          <p className={EYEBROW}>Floor service</p>
          <h1 className="mt-1 text-4xl font-black tracking-[-0.04em] sm:text-5xl">Waiter</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className={`rounded-full px-4 py-2 text-sm font-black uppercase tracking-wide ${offline ? "bg-[#F5DFC1] text-[#70420F]" : "bg-[#DDE8D8] text-[#25451E]"}`}>
            {offline ? "○ Offline" : "● Live"}
          </p>
          <button type="button" onClick={toggleSound} aria-pressed={sound} className="min-h-12 rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">
            <span aria-hidden="true">{sound ? "🔔" : "🔕"}</span> {sound ? "Sound on" : "Sound off"}
          </button>
          {restaurants.length > 1 && (
            <select aria-label="Restaurant" value={active} onChange={(e) => { saveChoice(e.target.value); setChosen(e.target.value); }}
              className="min-h-12 rounded-full border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-sm font-bold">
              {restaurants.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
          {toggle}
          <a href="/staff" className="grid min-h-12 place-items-center rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">Portals</a>
          <button type="button" onClick={onSignOut} className="min-h-12 rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">Sign out</button>
        </div>
      </header>
      {/* Floats over the page so it can't move a button under a finger when it disappears. */}
      {sound && !unlocked && <p role="status" className="pointer-events-none fixed inset-x-3 bottom-3 z-20 mx-auto max-w-md rounded-xl bg-[#F5DFC1] p-3 text-center font-bold text-[#70420F] shadow-xl">Tap anywhere to turn on the call sound</p>}
      {offline && <p role="alert" className="mt-4 rounded-xl bg-[#F5DFC1] p-3 font-bold text-[#70420F]">Connection lost, retrying. Calls may be out of date.</p>}

      <div className="mt-4 grid gap-4">
        <Section eyebrow="Needs you now" title="Calls" count={calls?.length ?? 0}>
          {calls === null ? (
            <Empty>Loading…</Empty>
          ) : calls.length === 0 ? (
            <Empty>No tables waiting.</Empty>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2">
              {calls.map((call) => {
                const t = floor.find((f) => f.id === call.tableId);
                return (
                <li key={call.id} className="flex flex-col gap-3 rounded-2xl bg-[#C45C26] p-4 text-white shadow-sm">
                  <CardHead title={call.table} right={`${minutesSince(call.createdAt, now)}′`} />
                  {t && <Needs table={t} />}
                  {t && <Lines items={t.items} />}
                  <button type="button" onClick={() => answer(call)} className={`${TAP} bg-white text-[#8B3F1D]`}>
                    On my way
                  </button>
                </li>
                );
              })}
            </ol>
          )}
        </Section>

        {/* Walk-out protection: everything still to collect, oldest first. */}
        <Section eyebrow="Collect" title="Unpaid" count={owed}>
          {owed === 0 ? (
            <Empty>Nothing to collect.</Empty>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2">
              {unpaid.map((order) => (
                <UnpaidRow key={order.id} table={order.table} amountCents={order.totalCents} onPaid={() => settle(order)}
                  detail={`#${order.publicRef} · ${order.status === "served" ? "served" : "still in the kitchen"}`} />
              ))}
            </ol>
          )}
        </Section>

        {/* The floor: seated tables first, each with what it needs and everything it has ordered. */}
        <Section eyebrow="Floor" title="Tables" count={floor.filter((t) => t.openedAt).length}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {floor.map((t) => (
              <li key={t.id} className={`flex flex-col gap-2 rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-card)] p-3 ${t.openedAt ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-xl font-black">{t.label}</h3>
                  {t.openedAt && <p className="shrink-0 font-bold tabular-nums text-[var(--owner-muted)]">{minutesSince(t.openedAt, now)}′</p>}
                </div>
                {t.openedAt ? <><Needs table={t} /><Lines items={t.items} /></> : <p className="text-sm text-[var(--owner-muted)]">Closed</p>}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>)}</Shell>
  );
}

// Thumb-sized action in the owner dashboard's button shape.
const TAP = "min-h-14 w-full rounded-xl text-xl font-black transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2";

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));

/** Owner-dashboard page shell, with its light/dark tokens and toggle. */
/** An owner-dashboard section card: eyebrow, heading and a count. */
function Section({ eyebrow, title, count, children }: { eyebrow: string; title: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-3xl bg-[var(--owner-surface)] p-4 shadow-sm sm:p-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div><p className={EYEBROW}>{eyebrow}</p><h2 className="mt-1 text-3xl font-black tracking-tight">{title}</h2></div>
        <p className="text-3xl font-black tabular-nums">{count}</p>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-[var(--owner-border)] p-4 text-[var(--owner-muted)]">{children}</p>;
}

function CardHead({ title, right }: { title: string; right: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <p className="truncate text-3xl font-black tracking-tight">{title}</p>
      <p className="shrink-0 text-2xl font-black tabular-nums">{right}</p>
    </div>
  );
}

function UnpaidRow({ table, amountCents, detail, onPaid }: { table: string; amountCents: number; detail: string; onPaid: () => void }) {
  const [confirming, setConfirming] = useState(false);
  // A wrong "paid" tap would hide a walk-out, so it needs a second tap within 4 s.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4_000);
    return () => clearTimeout(id);
  }, [confirming]);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-card)] p-4">
      <CardHead title={table} right={formatRand(amountCents)} />
      <p className="text-[var(--owner-muted)]">{detail}</p>
      <button
        type="button"
        onClick={() => (confirming ? onPaid() : setConfirming(true))}
        className={`${TAP} ${confirming ? "bg-[#25451E] text-white" : "bg-[var(--owner-text)] text-[var(--owner-bg)]"}`}
      >
        {confirming ? "Tap again: paid" : "Mark paid"}
      </button>
    </li>
  );
}


/** What the table is waiting on, most urgent first. */
function Needs({ table: t }: { table: FloorTable }) {
  const needs = [
    t.calling && "Calling for a waiter",
    t.ready > 0 && `${t.ready} order${t.ready > 1 ? "s" : ""} ready: take out`,
    t.inKitchen - t.ready > 0 && `${t.inKitchen - t.ready} order${t.inKitchen - t.ready > 1 ? "s" : ""} cooking`,
    t.unpaidCents > 0 && `Owes ${formatRand(t.unpaidCents)}`,
  ].filter(Boolean) as string[];
  if (!needs.length) return <p className="text-sm opacity-80">{t.items.length ? "All served, nothing owed" : "Seated, nothing ordered yet"}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {needs.map((n) => <li key={n} className="rounded-full bg-[#F5DFC1] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#70420F]">{n}</li>)}
    </ul>
  );
}

/** Every dish the table ordered this visit, with extras or notes and where it is. */
function Lines({ items }: { items: Line[] }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-current/20 border-t border-current/30 text-base">
      {items.map((i, n) => (
        <li key={n} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="min-w-0">
            <span className="tabular-nums">{i.quantity}×</span> {i.name}
            {i.notes && <span className="block text-sm opacity-80">{i.notes}</span>}
          </span>
          <span className={`shrink-0 text-xs font-black uppercase ${i.status === "ready" ? "rounded-full bg-[#DDE8D8] px-2 text-[#25451E]" : "opacity-70"}`}>{STATUS[i.status] ?? i.status}</span>
        </li>
      ))}
    </ul>
  );
}
