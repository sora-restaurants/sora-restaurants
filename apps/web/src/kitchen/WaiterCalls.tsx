"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRand } from "../lib/money.ts";
import { Screen, SignIn } from "./StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "./staff-auth.ts";

type Call = { id: string; table: string; createdAt: string };
type Unpaid = { id: string; publicRef: string; table: string; status: string; totalCents: number };
type Share = { id: string; table: string; shareNo: number; ways: number; amountCents: number; items: { name: string; quantity: number }[] };
type FloorTable = { id: string; label: string; openedAt: string | null; orders: number; inKitchen: number; unpaidCents: number; calling: boolean };
const POLL_MS = 3_000;

/** Floor staff screen: tables asking for a waiter, oldest first, one big tap to answer. */
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
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [unpaid, setUnpaid] = useState<Unpaid[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [floor, setFloor] = useState<FloorTable[]>([]);
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

  async function split(tableId: string, ways: number) {
    await fetch(`/api/staff/tables/${tableId}/split`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ ways }) }).catch(() => {});
    void load();
  }

  return (
    <main className="min-h-dvh bg-[#0a0a0a] p-4 font-[family-name:var(--font-geist)] font-bold text-white">
      <header className="mb-4 flex items-center justify-between gap-4 border-b-4 border-white pb-3">
        <h1 className="text-3xl uppercase">Waiter calls</h1>
        <p role="status" className={`px-3 py-1 text-xl uppercase ${offline ? "bg-[oklch(55%_0.22_28)]" : "bg-[oklch(80%_0.21_145)] text-black"}`}>
          {offline ? "Offline" : "● Live"}
        </p>
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
            return (
              <li key={call.id} className="flex flex-col gap-3 bg-white p-4 text-black rounded-[4px]">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-4xl">{call.table}</p>
                  <p className="shrink-0 text-3xl tabular-nums">{minutes}′</p>
                </div>
                <button type="button" onClick={() => answer(call)} className="min-h-16 bg-black text-3xl uppercase text-white rounded-[4px] active:scale-[0.97]">
                  On my way
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* The floor at a glance: seated tables first, with time seated, food still cooking and money owed. */}
      <h2 className="mb-3 mt-8 border-b-4 border-white pb-2 text-3xl uppercase">Tables</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {floor.map((t) => (
          <li key={t.id} className={`p-3 ${t.calling ? "bg-[oklch(82%_0.17_78)] text-black" : t.openedAt ? "border-4 border-white" : "border-2 border-[oklch(40%_0_0)] text-[oklch(60%_0_0)]"}`}>
            <p className="truncate text-2xl">{t.label}</p>
            {t.openedAt ? (
              <p className="text-base uppercase">
                {Math.max(0, Math.floor((now - Date.parse(t.openedAt)) / 60_000))}′ seated · {t.orders} orders
                {t.inKitchen ? ` · ${t.inKitchen} cooking` : ""}
                {t.unpaidCents ? ` · owes ${formatRand(t.unpaidCents)}` : ""}
                {t.calling ? " · calling" : ""}
              </p>
            ) : <p className="text-base uppercase">Closed</p>}
            {t.unpaidCents > 0 && (
              <div className="mt-2 flex items-center gap-1 text-sm uppercase">
                Split
                {[2, 3, 4].map((n) => (
                  <button key={n} type="button" onClick={() => split(t.id, n)} aria-label={`Split ${t.label} ${n} ways`} className="min-h-11 flex-1 border-2 border-current px-1 active:scale-[0.97]">÷{n}</button>
                ))}
              </div>
            )}
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
