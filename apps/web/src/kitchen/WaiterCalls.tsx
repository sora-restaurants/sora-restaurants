"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Screen, SignIn } from "./StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "./staff-auth.ts";

type Call = { id: string; table: string; createdAt: string };
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
  return <CallList token={token} />;
}

function CallList({ token }: { token: string }) {
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/calls", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setCalls((await res.json()).calls);
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

  return (
    <main className="min-h-dvh bg-[oklch(13%_0_0)] p-4 font-[family-name:var(--font-manrope)] font-extrabold text-white">
      <header className="mb-4 flex items-center justify-between gap-4 border-b-4 border-white pb-3">
        <h1 className="text-3xl uppercase">Waiter calls</h1>
        <p role="status" className={`px-3 py-1 text-xl uppercase ${offline ? "bg-[oklch(55%_0.22_28)]" : "bg-[oklch(80%_0.21_145)] text-black"}`}>
          {offline ? "Offline" : "● Live"}
        </p>
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
              <li key={call.id} className="flex flex-col gap-3 bg-[oklch(82%_0.17_78)] p-4 text-black">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-4xl">{call.table}</p>
                  <p className="shrink-0 text-3xl tabular-nums">{minutes}′</p>
                </div>
                <button type="button" onClick={() => answer(call)} className="min-h-16 bg-black text-3xl uppercase text-[oklch(82%_0.17_78)] active:scale-[0.97]">
                  On my way
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
