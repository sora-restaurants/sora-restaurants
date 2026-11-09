"use client";

import { useEffect, useMemo, useState } from "react";
import { Screen, SignIn } from "../../kitchen/StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "../../kitchen/staff-auth.ts";
import { formatRand } from "../../lib/money.ts";
import type { OwnerStats } from "../../server/owner-stats.ts";

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export function OwnerDashboard() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <Screen>Owner dashboard is not configured: set the Supabase variables, or the dev login.</Screen>;
  return <OwnerSession auth={auth} />;
}

function OwnerSession({ auth }: { auth: StaffAuth }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => auth.getToken().then(setToken);
    refresh();
    return auth.onChange(refresh);
  }, [auth]);
  if (token === undefined) return <Screen>Loading…</Screen>;
  if (!token) return <SignIn auth={auth} />;
  return <Stats token={token} />;
}

function Stats({ token }: { token: string }) {
  const [period, setPeriod] = useState("today");
  const [stats, setStats] = useState<OwnerStats | "forbidden" | null>(null);

  useEffect(() => {
    setStats(null);
    fetch(`/api/owner/stats?period=${period}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (res) => setStats(res.status === 403 ? "forbidden" : res.ok ? await res.json() : null));
  }, [period, token]);

  if (stats === "forbidden") return <Screen>This account is not an owner or manager.</Screen>;

  return (
    <main className="min-h-dvh bg-[oklch(97%_0.005_250)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)]">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[oklch(45%_0.02_260)]">QR orders only · not your total sales</p>
            <h1 className="text-4xl font-extrabold">{stats ? stats.restaurant : "Owner dashboard"}</h1>
          </div>
          <div role="group" aria-label="Period" className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                aria-pressed={period === p.id}
                className={`min-h-12 rounded-xl border-2 px-4 font-bold ${period === p.id ? "border-transparent bg-[oklch(18%_0.02_260)] text-white" : "border-[oklch(80%_0.01_260)] bg-white"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {!stats ? (
          <p className="text-xl font-bold">Loading…</p>
        ) : (
          <>
            <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label="QR orders" value={String(stats.orders)} />
              <Tile label="QR revenue" value={formatRand(stats.revenueCents)} note={`incl. ${formatRand(stats.vatCents)} VAT`} />
              <Tile label="Average order" value={formatRand(stats.averageOrderCents)} />
              <Tile label="Kitchen time" value={stats.avgPrepMinutes === null ? "–" : `${stats.avgPrepMinutes} min`} note="accepted to ready" />
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-2xl border-2 border-[oklch(85%_0.01_260)] bg-white p-5">
                <h2 className="mb-3 text-xl font-extrabold">Most ordered</h2>
                {stats.topItems.length === 0 ? (
                  <p className="text-[oklch(45%_0.02_260)]">No orders in this period yet.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {stats.topItems.map((item) => (
                      <li key={item.name} className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">
                          {item.quantity}× {item.name}
                        </span>
                        <span className="tabular-nums text-[oklch(45%_0.02_260)]">{formatRand(item.revenueCents)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className="rounded-2xl border-2 border-[oklch(85%_0.01_260)] bg-white p-5">
                <h2 className="mb-3 text-xl font-extrabold">Busiest hours</h2>
                {stats.busiestHours.length === 0 ? (
                  <p className="text-[oklch(45%_0.02_260)]">No orders in this period yet.</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {stats.busiestHours.map((h) => (
                      <li key={h.hour} className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold tabular-nums">
                          {String(h.hour).padStart(2, "0")}:00–{String((h.hour + 1) % 24).padStart(2, "0")}:00
                        </span>
                        <span className="tabular-nums text-[oklch(45%_0.02_260)]">{h.orders} orders</span>
                      </li>
                    ))}
                  </ol>
                )}
                {stats.rejectedOrCancelled > 0 ? (
                  <p className="mt-4 text-sm text-[oklch(45%_0.02_260)]">{stats.rejectedOrCancelled} rejected or cancelled (not counted above)</p>
                ) : null}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border-2 border-[oklch(85%_0.01_260)] bg-white p-4">
      <p className="text-sm font-bold text-[oklch(45%_0.02_260)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {note ? <p className="text-xs text-[oklch(45%_0.02_260)]">{note}</p> : null}
    </div>
  );
}
