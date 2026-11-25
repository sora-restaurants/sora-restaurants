"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRand } from "../lib/money.ts";
import { BUTTON, CARD, ConnectionPill } from "./KitchenBoard.tsx";
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
  if (!token) return <SignIn auth={auth} title="Waiter sign in" />;
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

  const owed = unpaid.length + shares.length;
  return (
    // Same shell as the kitchen board: full-bleed header, white column bars, solid ticket blocks.
    <div className="min-h-dvh bg-[oklch(13%_0_0)] font-[family-name:var(--font-manrope)] font-extrabold text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-4 border-white bg-[oklch(13%_0_0)] px-3 py-2 sm:px-4 sm:py-3">
        <h1 className="truncate text-xl uppercase tracking-tight sm:text-3xl">Waiter</h1>
        <div className="flex items-center gap-2">
          <ConnectionPill connection={offline ? "reconnecting" : calls === null ? "connecting" : "live"} />
          <button type="button" onClick={onSignOut} className="min-h-12 border-2 border-white px-3 text-sm uppercase">Sign out</button>
        </div>
      </header>
      {offline && <p role="alert" className="bg-[oklch(55%_0.22_28)] px-4 py-3 text-2xl uppercase">Connection lost — retrying. Calls may be out of date.</p>}

      <main className="flex flex-col gap-3 p-2 sm:p-3">
        <Section title="Calls" count={calls?.length ?? 0}>
          {calls === null ? (
            <Empty>Loading…</Empty>
          ) : calls.length === 0 ? (
            <Empty>No tables waiting.</Empty>
          ) : (
            <ol className="grid gap-2 p-2 sm:grid-cols-2 sm:gap-3 sm:p-3">
              {calls.map((call) => {
                const minutes = Math.max(0, Math.floor((now - Date.parse(call.createdAt)) / 60_000));
                return (
                  <li key={call.id} className={`flex flex-col gap-3 p-3 sm:p-4 ${CARD.new}`}>
                    <TicketHead title={call.table} minutes={minutes} />
                    <button type="button" onClick={() => answer(call)} className={`${TAP} ${BUTTON.new}`}>
                      On my way
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        {/* Walk-out protection: everything still to collect, oldest first. */}
        <Section title="Unpaid" count={owed}>
          {owed === 0 ? (
            <Empty>Nothing to collect.</Empty>
          ) : (
            <ol className="grid gap-2 p-2 sm:grid-cols-2 sm:gap-3 sm:p-3">
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
        </Section>

        {/* The floor at a glance: seated tables first, with time seated, food still cooking and money owed. */}
        <Section title="Tables" count={floor.filter((t) => t.openedAt).length}>
          <ul className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3 sm:gap-3 sm:p-3 lg:grid-cols-4">
            {floor.map((t) => (
              <li key={t.id} className={`flex flex-col gap-2 p-3 ${t.calling ? CARD.new.replace("kds-new ", "") : t.openedAt ? "border-4 border-white" : "border-4 border-[oklch(40%_0_0)] text-[oklch(60%_0_0)]"}`}>
                <TicketHead title={t.label} minutes={t.openedAt ? Math.max(0, Math.floor((now - Date.parse(t.openedAt)) / 60_000)) : null} small />
                {t.openedAt ? (
                  <ul className="flex flex-col gap-1 border-t-4 border-current pt-2 text-base leading-tight">
                    <li>{t.orders} {t.orders === 1 ? "order" : "orders"}{t.inKitchen ? ` · ${t.inKitchen} cooking` : ""}</li>
                    {t.unpaidCents > 0 && <li className="tabular-nums">Owes {formatRand(t.unpaidCents)}</li>}
                    {t.calling && <li className="uppercase">» Calling</li>}
                  </ul>
                ) : <p className="text-base uppercase">Closed</p>}
                {t.unpaidCents > 0 && (
                  <div className="mt-auto grid grid-cols-3 gap-1" role="group" aria-label={`Split ${t.label}`}>
                    {[2, 3, 4].map((n) => (
                      <button key={n} type="button" onClick={() => split(t.id, n)} aria-label={`Split ${t.label} ${n} ways`} className="min-h-12 border-2 border-current text-lg uppercase transition-transform active:scale-[0.97]">÷{n}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}

// The kitchen ticket's main button, sized for a thumb.
const TAP = "min-h-14 w-full text-2xl uppercase transition-transform active:scale-[0.97] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white sm:min-h-16 sm:text-3xl";

/** A kitchen board column: white title bar with a count, bordered body. */
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border-4 border-white">
      <h2 className="flex items-baseline justify-between bg-white px-4 py-2 text-2xl uppercase text-black sm:text-3xl">
        <span>{title}</span>
        <span className="tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-xl uppercase text-[oklch(75%_0_0)]">{children}</p>;
}

/** Table name left, minutes right, as on a kitchen ticket. */
function TicketHead({ title, minutes, small = false }: { title: string; minutes: number | null; small?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <p className={`truncate leading-none ${small ? "text-2xl" : "text-3xl sm:text-4xl"}`}>{title}</p>
      {minutes !== null && <p className={`shrink-0 tabular-nums leading-none ${small ? "text-xl" : "text-2xl sm:text-3xl"}`} aria-label={`${minutes} minutes`}>{minutes}′</p>}
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
    <li className="flex flex-col gap-3 bg-white p-3 text-black sm:p-4">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-3xl leading-none sm:text-4xl">{table}</p>
        <p className="shrink-0 text-2xl tabular-nums leading-none sm:text-3xl">{formatRand(amountCents)}</p>
      </div>
      <p className="border-y-4 border-current py-3 text-xl leading-tight">{detail}</p>
      <button
        type="button"
        onClick={() => (confirming ? onPaid() : setConfirming(true))}
        className={`${TAP} ${confirming ? CARD.ready : "bg-black text-white"}`}
      >
        {confirming ? "Tap again: paid" : "Mark paid"}
      </button>
    </li>
  );
}
