"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ColorModeToggle, useColorMode } from "../components/ColorModeToggle.tsx";
import { formatRand } from "../lib/money.ts";
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
  if (!token) return <WaiterSignIn auth={auth} />;
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
          {toggle}
          <button type="button" onClick={onSignOut} className="min-h-12 rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">Sign out</button>
        </div>
      </header>
      {offline && <p role="alert" className="mt-4 rounded-xl bg-[#F5DFC1] p-3 font-bold text-[#70420F]">Connection lost, retrying. Calls may be out of date.</p>}

      <div className="mt-4 grid gap-4">
        <Section eyebrow="Needs you now" title="Calls" count={calls?.length ?? 0}>
          {calls === null ? (
            <Empty>Loading…</Empty>
          ) : calls.length === 0 ? (
            <Empty>No tables waiting.</Empty>
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2">
              {calls.map((call) => (
                <li key={call.id} className="flex flex-col gap-3 rounded-2xl bg-[#C45C26] p-4 text-white shadow-sm">
                  <CardHead title={call.table} right={`${minutesSince(call.createdAt, now)}′`} />
                  <button type="button" onClick={() => answer(call)} className={`${TAP} bg-white text-[#8B3F1D]`}>
                    On my way
                  </button>
                </li>
              ))}
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
              {shares.map((share) => (
                <UnpaidRow key={share.id} table={share.table} amountCents={share.amountCents} onPaid={() => settleShare(share)}
                  detail={`Person ${share.shareNo} of ${share.ways}${share.items.length ? " · " + share.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") : ""}`} />
              ))}
            </ol>
          )}
        </Section>

        {/* The floor at a glance: seated tables first, with time seated, food still cooking and money owed. */}
        <Section eyebrow="Floor" title="Tables" count={floor.filter((t) => t.openedAt).length}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {floor.map((t) => (
              <li key={t.id} className={`flex flex-col gap-2 rounded-2xl border border-[var(--owner-border)] bg-[var(--owner-card)] p-3 ${t.openedAt ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-xl font-black">{t.label}</h3>
                  {t.openedAt && <p className="shrink-0 font-bold tabular-nums text-[var(--owner-muted)]">{minutesSince(t.openedAt, now)}′</p>}
                </div>
                {t.calling && <p className="self-start rounded-full bg-[#F5DFC1] px-3 py-1 text-xs font-black uppercase tracking-wide text-[#70420F]">● Calling</p>}
                {t.openedAt ? (
                  <p className="text-sm text-[var(--owner-muted)]">
                    {t.orders} {t.orders === 1 ? "order" : "orders"}{t.inKitchen ? ` · ${t.inKitchen} cooking` : ""}
                    {t.unpaidCents > 0 && <span className="block font-bold tabular-nums text-[var(--owner-text)]">Owes {formatRand(t.unpaidCents)}</span>}
                  </p>
                ) : <p className="text-sm text-[var(--owner-muted)]">Closed</p>}
                {t.unpaidCents > 0 && (
                  <div className="mt-auto grid grid-cols-3 gap-1" role="group" aria-label={`Split ${t.label}`}>
                    {[2, 3, 4].map((n) => (
                      <button key={n} type="button" onClick={() => split(t.id, n)} aria-label={`Split ${t.label} ${n} ways`} className="min-h-12 rounded-xl border border-[var(--owner-border)] bg-[var(--owner-surface)] font-bold active:scale-[0.97]">÷{n}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>)}</Shell>
  );
}

const EYEBROW = "text-xs font-black uppercase tracking-[0.18em] text-[#C45C26]";
// Thumb-sized action in the owner dashboard's button shape.
const TAP = "min-h-14 w-full rounded-xl text-xl font-black transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2";

const minutesSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));

/** Owner-dashboard page shell, with its light/dark tokens and toggle. */
// Pass a function to place the light/dark toggle yourself; otherwise it sits top right.
function Shell({ children, center = false }: { children: ReactNode | ((toggle: ReactNode) => ReactNode); center?: boolean }) {
  const { mode, toggle } = useColorMode("sora-waiter-color-mode");
  const button = <ColorModeToggle mode={mode} onToggle={toggle} className="border-[var(--owner-border)]" />;
  return (
    <main data-mode={mode} className={`owner-shell min-h-dvh bg-[var(--owner-bg)] px-3 py-4 font-[family-name:var(--font-manrope)] text-[var(--owner-text)] sm:px-6 ${center ? "owner-login grid place-items-center" : ""}`}>
      <div className={`mx-auto w-full ${center ? "max-w-md" : "max-w-5xl"}`}>
        {typeof children === "function" ? children(button) : <><div className="mb-2 flex justify-end">{button}</div>{children}</>}
      </div>
    </main>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <Shell center><p className="rounded-3xl bg-[var(--owner-surface)] p-6 text-center text-xl font-bold shadow-sm">{children}</p></Shell>;
}

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

/** The owner sign-in card, worded for floor staff. */
function WaiterSignIn({ auth }: { auth: StaffAuth }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(await auth.signIn(String(form.get("email")), String(form.get("password"))));
    setBusy(false);
  }
  const field = "mt-2 min-h-14 w-full rounded-xl border border-[var(--owner-border)] bg-white px-4 text-[#1C1917] caret-[#1C1917]";
  return (
    <Shell center>
      <form onSubmit={submit} className="w-full space-y-4 rounded-3xl bg-[var(--owner-surface)] p-6 text-left shadow-xl sm:p-8">
        <h1 className="text-4xl font-black">Waiter sign in</h1>
        {auth.mode === "dev" && <p className="rounded-xl bg-[#F5DFC1] p-3 text-sm text-[#70420F]">Local demo: waiter@demo.test / demo-waiter-pass</p>}
        <label className="block font-bold">Email<input name="email" type="email" autoComplete="username" required className={field} /></label>
        <label className="block font-bold">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
        {error && <p role="alert" className="rounded-xl bg-[#F5DFC1] p-3 text-[#70420F]">{error}</p>}
        <button disabled={busy} className="min-h-14 w-full rounded-xl bg-[#C45C26] font-black text-white">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </Shell>
  );
}
