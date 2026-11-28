"use client";

import { useEffect, useMemo, useState } from "react";
import { dropOn401, type StaffAuth, staffAuth } from "../kitchen/staff-auth.ts";
import { readChoice, saveChoice } from "../kitchen/restaurant-choice.ts";
import { SignIn } from "../kitchen/StaffSignIn.tsx";
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
  // Which branch is shown; empty means the server picks the first one.
  const [branch, setBranch] = useState("");
  const q = branch ? `?restaurant=${branch}` : "";
  useEffect(() => { const refresh = () => auth.getToken().then(setToken); refresh(); return auth.onChange(refresh); }, [auth]);
  useEffect(() => {
    if (!token) return;
    fetch(`/api/owner${q}`, { headers: { authorization: `Bearer ${token}` } }).then((res) => dropOn401(auth, res))
      .then(async (res) => res.ok ? (await res.json()).snapshot : "forbidden").then((s) => {
        // The kitchen and waiter screens on this device follow the branch shown here.
        if (s && s !== "forbidden") saveChoice(s.restaurantId);
        setSnapshot(s);
      });
  }, [token, q, auth]);
  if (token === undefined) return <OwnerScreen>Loading…</OwnerScreen>;
  if (!token) return <SignIn auth={auth} />;
  if (snapshot === "forbidden") return <OwnerScreen>This account has no owner or manager access.</OwnerScreen>;
  if (!snapshot) return <OwnerScreen>Loading your restaurant…</OwnerScreen>;

  const adapter: TableSessionAdapter = {
    getSnapshot: async () => loadSnapshot(auth, q),
    openSession: (tableId) => command(auth, "open", tableId, q),
    closeSession: (tableId) => command(auth, "close", tableId, q),
    rotateQr: async (tableId) => { await post(auth, { action: "rotate", tableId }); return loadSnapshot(auth, q); },
    createTable: async (label) => { await post(auth, { action: "create", restaurantId: snapshot.restaurantId, label }); return loadSnapshot(auth, q); },
    createItem: async (menuId, name, priceCents) => { await post(auth, { action: "createItem", menuId, name, description: "", priceCents }); return loadSnapshot(auth, q); },
    createCategory: async (name) => { await post(auth, { action: "createCategory", restaurantId: snapshot.restaurantId, name }); return loadSnapshot(auth, q); },
    updateItem: async (item) => { await post(auth, { action: "updateItem", itemId: item.id, name: item.name, description: item.description, priceCents: item.priceCents, imageUrl: item.imageUrl, dietaryTags: item.dietaryTags, allergens: item.allergens ?? [], available: item.available, soldOut: item.soldOut }); return loadSnapshot(auth, q); },
    command: async (body) => { await post(auth, body); return loadSnapshot(auth, q); },
    report: async (from, to) => {
      const token = await auth.getToken();
      const res = await fetch(`/api/owner/report?restaurant=${snapshot.restaurantId}&from=${from}&to=${to}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("report_failed");
      return res.json();
    },
    stats: async (period) => {
      const token = await auth.getToken();
      const res = await fetch(`/api/owner/stats?restaurant=${snapshot.restaurantId}&period=${period}`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("stats_failed");
      return res.json();
    },
  };
  // key: a branch switch starts the dashboard fresh with that branch's snapshot.
  return <OwnerDashboard key={snapshot.restaurantId} initial={snapshot} sessionAdapter={adapter} onSwitchBranch={(id) => { setSnapshot(null); setBranch(id); }} onSignOut={() => void auth.signOut()} />;
}

async function loadSnapshot(auth: StaffAuth, q = ""): Promise<OwnerDashboardSnapshot> {
  const token = await auth.getToken();
  const res = await fetch(`/api/owner${q}`, { headers: { authorization: `Bearer ${token}` } });
  return (await res.json()).snapshot;
}

async function command(auth: StaffAuth, action: "open" | "close", tableId: string, q: string): Promise<SessionCommandResult> {
  const token = await auth.getToken();
  const res = await fetch("/api/owner", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, tableId }),
  });
  if (res.ok) {
    const snapshot = await loadSnapshot(auth, q);
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

function OwnerScreen({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-[#0a0a0a] p-6 text-center text-xl text-white">{children}</main>;
}
