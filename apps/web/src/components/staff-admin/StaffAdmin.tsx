"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Screen, SignIn } from "../../kitchen/StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "../../kitchen/staff-auth.ts";
import type { StaffOverview } from "../../server/staff-admin.ts";

const ROLES = ["owner", "manager", "kitchen", "waiter"] as const;
const ERRORS: Record<number, string> = {
  400: "Check the email and role, then try again.",
  403: "Only an owner can make or change owners.",
  409: "Not saved: that person is already on the team, or they are the last owner.",
};

export function StaffAdmin() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <Screen>Staff page is not configured: set the Supabase variables, or the dev login.</Screen>;
  return <Session auth={auth} />;
}

function Session({ auth }: { auth: StaffAuth }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const refresh = () => auth.getToken().then(setToken);
    refresh();
    return auth.onChange(refresh);
  }, [auth]);
  if (token === undefined) return <Screen>Loading…</Screen>;
  if (!token) return <SignIn auth={auth} />;
  return <Team token={token} />;
}

function Team({ token }: { token: string }) {
  const [data, setData] = useState<StaffOverview | "forbidden" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const headers = useMemo(() => ({ authorization: `Bearer ${token}`, "content-type": "application/json" }), [token]);

  const load = useCallback(async () => {
    const res = await fetch("/api/staff-admin", { headers, cache: "no-store" });
    setData(res.status === 403 ? "forbidden" : res.ok ? await res.json() : null);
  }, [headers]);
  useEffect(() => {
    load();
  }, [load]);

  async function post(url: string, body: unknown, done: string) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    setMessage(res.ok ? done : (ERRORS[res.status] ?? "That change was not saved."));
    if (res.ok) await load();
    return res.ok;
  }

  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (await post("/api/staff-admin", { email: f.get("email"), role: f.get("role") }, "Invite saved. They will get an email to join.")) form.reset();
  }

  if (data === "forbidden") return <Screen>Only owners and managers can manage staff.</Screen>;
  if (!data) return <Screen>Loading staff…</Screen>;
  const roles = data.canManageOwners ? ROLES : ROLES.filter((r) => r !== "owner");
  const card = "rounded-2xl border-2 border-[oklch(85%_0.01_260)] bg-white p-5";

  return (
    <main className="min-h-dvh bg-[oklch(97%_0.005_250)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header>
          <p className="text-sm font-bold uppercase tracking-wide text-[oklch(45%_0.02_260)]">Staff · {data.restaurant}</p>
          <h1 className="text-4xl font-extrabold">Your team</h1>
        </header>
        <p role="status" aria-live="polite" className={message ? "rounded-xl bg-white p-3 font-semibold" : "sr-only"}>
          {message}
        </p>

        <section aria-labelledby="team" className={card}>
          <h2 id="team" className="mb-3 text-2xl font-extrabold">
            People
          </h2>
          <ul className="flex flex-col divide-y-2 divide-[oklch(92%_0.005_260)]">
            {data.staff.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1 break-all font-semibold">
                  {s.email}
                  {s.status !== "active" ? <span className="ml-2 text-sm text-[oklch(45%_0.02_260)]">({s.status})</span> : null}
                </span>
                {s.status === "inactive" ? (
                  <span className="text-sm">{s.role}</span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor={`role-${s.id}`}>
                      Role for {s.email}
                    </label>
                    <select
                      id={`role-${s.id}`}
                      value={s.role}
                      disabled={s.role === "owner" && !data.canManageOwners}
                      onChange={(e) => post(`/api/staff-admin/${s.id}/role`, { role: e.target.value }, `${s.email} is now ${e.target.value}.`)}
                      className="min-h-11 rounded-lg border-2 border-[oklch(80%_0.01_260)] px-2"
                    >
                      {(s.role === "owner" ? ROLES : roles).map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={s.role === "owner" && !data.canManageOwners}
                      onClick={() => confirm(`Remove ${s.email}?`) && post(`/api/staff-admin/${s.id}/remove`, {}, `${s.email} removed.`)}
                      className="min-h-11 rounded-lg border-2 border-[oklch(80%_0.01_260)] px-3 font-semibold disabled:opacity-50"
                    >
                      {s.status === "invited" ? "Cancel invite" : "Remove"}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-1 flex-col text-sm font-semibold">
              Invite by email
              <input name="email" type="email" required className="min-h-11 rounded-lg border-2 border-[oklch(80%_0.01_260)] px-3" />
            </label>
            <label className="flex flex-col text-sm font-semibold">
              Role
              <select name="role" defaultValue="waiter" className="min-h-11 rounded-lg border-2 border-[oklch(80%_0.01_260)] px-2">
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <button className="min-h-11 rounded-lg bg-[oklch(30%_0.05_260)] px-4 font-bold text-white">Invite</button>
          </form>
        </section>

        <section aria-labelledby="log" className={card}>
          <h2 id="log" className="mb-3 text-2xl font-extrabold">
            Recent changes
          </h2>
          {data.events.length === 0 ? <p>No changes yet.</p> : null}
          <ol className="flex flex-col divide-y-2 divide-[oklch(92%_0.005_260)] text-sm">
            {data.events.map((e, i) => (
              <li key={i} className="py-2">
                <span className="font-semibold">{e.action}</span> {e.target ? <span className="break-all">· {e.target}</span> : null}
                <span className="block text-[oklch(45%_0.02_260)]">
                  {e.actor ?? "system"} · {new Date(e.at).toLocaleString("en-ZA")}
                  {e.before || e.after ? ` · ${JSON.stringify(e.before)} → ${JSON.stringify(e.after)}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
