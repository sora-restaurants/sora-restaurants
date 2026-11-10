"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { type StaffAuth, staffAuth } from "../kitchen/staff-auth.ts";
import { OwnerDashboard } from "./OwnerDashboard.tsx";
import type { ManagedTable, OwnerDashboardSnapshot, SessionCommandResult, TableSessionAdapter } from "./session-contract.ts";

export function OwnerLive() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <OwnerScreen>Owner dashboard is not configured.</OwnerScreen>;
  return <OwnerSession auth={auth} />;
}

function OwnerSession({ auth }: { auth: StaffAuth }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<OwnerDashboardSnapshot | null | "forbidden">(null);
  useEffect(() => { const refresh = () => auth.getToken().then(setToken); refresh(); return auth.onChange(refresh); }, [auth]);
  useEffect(() => {
    if (!token) return;
    fetch("/api/owner", { headers: { authorization: `Bearer ${token}` } })
      .then(async (res) => res.ok ? (await res.json()).snapshot : "forbidden").then(setSnapshot);
  }, [token]);
  if (token === undefined) return <OwnerScreen>Loading…</OwnerScreen>;
  if (!token) return <OwnerSignIn auth={auth} />;
  if (snapshot === "forbidden") return <OwnerScreen>This account has no owner or manager access.</OwnerScreen>;
  if (!snapshot) return <OwnerScreen>Loading your restaurant…</OwnerScreen>;

  const adapter: TableSessionAdapter = {
    getSnapshot: async () => loadSnapshot(auth),
    openSession: (tableId) => command(auth, "open", tableId),
    closeSession: (tableId) => command(auth, "close", tableId),
    rotateQr: async (tableId) => { await post(auth, { action: "rotate", tableId }); return loadSnapshot(auth); },
    createTable: async (label) => { await post(auth, { action: "create", restaurantId: snapshot.restaurantId, label }); return loadSnapshot(auth); },
    updateItem: async (item) => { await post(auth, { action: "updateItem", itemId: item.id, name: item.name, description: item.description, priceCents: item.priceCents, imageUrl: item.imageUrl, dietaryTags: item.dietaryTags, available: item.available, soldOut: item.soldOut }); return loadSnapshot(auth); },
  };
  return <OwnerDashboard initial={snapshot} sessionAdapter={adapter} />;
}

async function loadSnapshot(auth: StaffAuth): Promise<OwnerDashboardSnapshot> {
  const token = await auth.getToken();
  const res = await fetch("/api/owner", { headers: { authorization: `Bearer ${token}` } });
  return (await res.json()).snapshot;
}

async function command(auth: StaffAuth, action: "open" | "close", tableId: string): Promise<SessionCommandResult> {
  const token = await auth.getToken();
  const res = await fetch("/api/owner", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, tableId }),
  });
  if (res.ok) {
    const snapshot = await loadSnapshot(auth);
    return { ok: true, table: snapshot.tables.find((candidate) => candidate.id === tableId) as ManagedTable };
  }
  const { error } = await res.json();
  const code = error === "table_disabled" ? "TABLE_DISABLED" : error === "SESSION_ALREADY_OPEN" ? "SESSION_ALREADY_OPEN" : "SESSION_ALREADY_CLOSED";
  return { ok: false, code };
}

async function post(auth: StaffAuth, body: object) {
  const token = await auth.getToken();
  const res = await fetch("/api/owner", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json()).error ?? "owner_command_failed");
}

function OwnerSignIn({ auth }: { auth: StaffAuth }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    setError(await auth.signIn(String(form.get("email")), String(form.get("password")))); setBusy(false);
  }
  return <OwnerScreen><form onSubmit={submit} className="w-full max-w-md space-y-4 text-left"><h1 className="text-4xl font-black">Owner sign in</h1>{auth.mode === "dev" && <p className="rounded-xl bg-cyan-100 p-3 text-sm text-slate-900">Local demo: owner@demo.test / demo-owner-pass</p>}<label className="block font-bold">Email<input name="email" type="email" autoComplete="username" required className="mt-2 min-h-14 w-full rounded-xl border px-4 text-slate-950" /></label><label className="block font-bold">Password<input name="password" type="password" autoComplete="current-password" required className="mt-2 min-h-14 w-full rounded-xl border px-4 text-slate-950" /></label>{error && <p role="alert">{error}</p>}<button disabled={busy} className="min-h-14 w-full rounded-xl bg-cyan-300 font-black text-slate-950">{busy ? "Signing in…" : "Sign in"}</button></form></OwnerScreen>;
}

function OwnerScreen({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-center text-xl text-white">{children}</main>;
}
