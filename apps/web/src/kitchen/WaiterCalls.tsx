"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRand } from "../lib/money.ts";
import { readChoice, saveChoice } from "./restaurant-choice.ts";
import { Screen, SignIn } from "./StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "./staff-auth.ts";

type Call = { id: string; tableId: string; table: string; createdAt: string; restaurantId: string };
type Unpaid = { id: string; publicRef: string; table: string; status: string; totalCents: number; restaurantId: string };
type Share = { id: string; table: string; restaurantId: string; shareNo: number; ways: number; amountCents: number; items: { name: string; quantity: number }[] };
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
  if (!token) return <SignIn auth={auth} />;
  return <CallList token={token} onSignOut={() => void auth.signOut()} />;
}

function CallList({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [allCalls, setCalls] = useState<Call[] | null>(null);
  const [allUnpaid, setUnpaid] = useState<Unpaid[]>([]);
  const [allShares, setShares] = useState<Share[]>([]);
  const [allFloor, setFloor] = useState<FloorTable[]>([]);
  const [chosen, setChosen] = useState<string | null>(() => readChoice());
  // Staff at several restaurants see one at a time: the one this device works for (shared with kitchen and owner).
  const restaurants = [...new Map(allFloor.map((t) => [t.restaurantId, t.restaurantName])).entries()];
  const active = restaurants.find(([id]) => id === chosen)?.[0] ?? restaurants[0]?.[0];
  const mine = <T extends { restaurantId: string }>(rows: T[]) => (active ? rows.filter((r) => r.restaurantId === active) : rows);
  const calls = allCalls && mine(allCalls);
  const unpaid = mine(allUnpaid);
  const shares = mine(allShares);
  const floor = mine(allFloor);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/calls", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setCalls((await res.json()).calls);
      const owed = await fetch("/api/staff/unpaid", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (owed.ok) {
        const body = await owed.json();
        setUnpaid(body.orders);
        setShares(body.shares ?? []);
      }
      const tables = await fetch("/api/staff/tables", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (tables.ok) setFloor((await tables.json()).tables);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setNow(Date.now());
  }, [token]);

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

  async function settleShare(share: Share) {
    setShares((list) => list.filter((s) => s.id !== share.id));
    await fetch(`/api/staff/shares/${share.id}/paid`, { method: "POST", headers: { authorization: `Bearer ${token}` } }).catch(() => {});
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0a] p-4 font-[family-name:var(--font-geist)] font-bold text-white">
      <header className="mb-4 flex items-center justify-between gap-4 border-b-4 border-white pb-3">
        <h1 className="text-3xl uppercase">Waiter calls</h1>
        <p role="status" className={`px-3 py-1 text-xl uppercase ${offline ? "bg-[oklch(55%_0.22_28)]" : "bg-[oklch(80%_0.21_145)] text-black"}`}>
          {offline ? "Offline" : "● Live"}
        </p>
        {restaurants.length > 1 && (
          <select aria-label="Restaurant" value={active} onChange={(e) => { saveChoice(e.target.value); setChosen(e.target.value); }}
            className="min-h-12 border-2 border-white bg-black px-2 text-sm uppercase">
            {restaurants.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        <a href="/staff" className="grid min-h-12 place-items-center border-2 border-white px-3 text-sm uppercase">Portals</a>
        <button type="button" onClick={onSignOut} className="min-h-12 border-2 border-white px-3 text-sm uppercase">Sign out</button>
      </header>
      {calls === null ? (
        <p className="text-2xl">Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-2xl text-[oklch(75%_0_0)]">No tables waiting.</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {calls.map((call) => {
            const minutes = Math.max(0, Math.floor((now - Date.parse(call.createdAt)) / 60_000));
            const t = floor.find((f) => f.id === call.tableId);
            return (
              <li key={call.id} className="flex flex-col gap-3 bg-white p-4 text-black rounded-[4px]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-4xl">{call.table}</p>
                  <p className="shrink-0 text-3xl tabular-nums">{ago(minutes)}</p>
                </div>
                {t && <Needs table={t} />}
                {t && <Lines items={t.items} />}
                <button type="button" onClick={() => answer(call)} className="min-h-16 bg-black text-3xl uppercase text-white rounded-[4px] active:scale-[0.97]">
                  On my way
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* The floor: seated tables first, each with what it needs and everything it has ordered. */}
      <h2 className="mb-3 mt-8 border-b-4 border-white pb-2 text-3xl uppercase">Tables</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {floor.map((t) => (
          <li key={t.id} className={`flex flex-col gap-2 p-4 rounded-[4px] ${t.calling ? "bg-[oklch(82%_0.17_78)] text-black" : t.openedAt ? "border-4 border-white" : "border-2 border-[oklch(40%_0_0)] text-[oklch(60%_0_0)]"}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-3xl">{t.label}</p>
              <p className="shrink-0 text-xl tabular-nums">
                {t.openedAt ? `${ago(Math.max(0, Math.floor((now - Date.parse(t.openedAt)) / 60_000)))} seated` : "Closed"}
              </p>
            </div>
            {t.openedAt && <Needs table={t} />}
            {t.openedAt && <Lines items={t.items} />}
          </li>
        ))}
      </ul>

      {/* Walk-out protection: everything still to collect, oldest first. */}
      <h2 className="mb-3 mt-8 border-b-4 border-white pb-2 text-3xl uppercase">
        Unpaid <span className="tabular-nums">{unpaid.length + shares.length}</span>
      </h2>
      {unpaid.length + shares.length === 0 ? (
        <p className="text-2xl text-[oklch(75%_0_0)]">Nothing to collect.</p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {unpaid.map((order) => (
            <UnpaidRow key={order.id} table={order.table} amountCents={order.totalCents} onPaid={() => settle(order)}
              detail={`#${order.publicRef} · ${order.status === "served" ? "served" : "still in the kitchen"}`} />
          ))}
          {shares.map((share) => (
            <UnpaidRow key={share.id} table={share.table} amountCents={share.amountCents} onPaid={() => settleShare(share)}
              detail={`Person ${share.shareNo} of ${share.ways}${share.items.length ? " · " + share.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") : ""}`} />
          ))}
        </ol>
      )}
    </main>
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
    <li className="flex flex-col gap-3 border-4 border-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-4xl">{table}</p>
        <p className="shrink-0 text-3xl tabular-nums">{formatRand(amountCents)}</p>
      </div>
      <p className="text-xl uppercase text-[oklch(75%_0_0)]">{detail}</p>
      <button
        type="button"
        onClick={() => (confirming ? onPaid() : setConfirming(true))}
        className={`min-h-16 text-3xl uppercase active:scale-[0.97] ${confirming ? "bg-[oklch(80%_0.21_145)] text-black" : "bg-white text-black"}`}
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
  if (!needs.length) return <p className="text-lg uppercase opacity-70">{t.items.length ? "All served, nothing owed" : "Seated, nothing ordered yet"}</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {needs.map((n) => <li key={n} className="bg-black px-2 py-1 text-base uppercase text-white rounded-[4px]">{n}</li>)}
    </ul>
  );
}

/** Every dish the table ordered this visit, with extras or notes and where it is. */
function Lines({ items }: { items: Line[] }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-current/20 border-t-2 border-current/30 text-lg">
      {items.map((i, n) => (
        <li key={n} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="min-w-0">
            <span className="tabular-nums">{i.quantity}×</span> {i.name}
            {i.notes && <span className="block text-base font-normal opacity-80">{i.notes}</span>}
          </span>
          <span className={`shrink-0 text-sm uppercase ${i.status === "ready" ? "bg-[oklch(80%_0.21_145)] px-1.5 text-black" : "opacity-70"}`}>{STATUS[i.status] ?? i.status}</span>
        </li>
      ))}
    </ul>
  );
}

const ago = (minutes: number) => (minutes < 60 ? `${minutes}′` : `${Math.floor(minutes / 60)}h ${minutes % 60}′`);
