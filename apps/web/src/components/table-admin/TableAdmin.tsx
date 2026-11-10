"use client";

import QRCode from "qrcode";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Screen, SignIn } from "../../kitchen/StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "../../kitchen/staff-auth.ts";
import type { AdminTables } from "../../server/table-admin.ts";

type Table = AdminTables["tables"][number];

export function TableAdmin() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <Screen>Table manager is not configured: set the Supabase variables, or the dev login.</Screen>;
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
  return <Manager token={token} />;
}

const btn = "min-h-12 rounded-xl border-2 border-[oklch(80%_0.01_260)] bg-white px-4 font-bold";
const field = "min-h-12 w-full rounded-xl border-2 border-[oklch(80%_0.01_260)] bg-white px-3";

function Manager({ token }: { token: string }) {
  const [data, setData] = useState<AdminTables | "forbidden" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const headers = useMemo(() => ({ authorization: `Bearer ${token}`, "content-type": "application/json" }), [token]);

  const load = useCallback(async () => {
    const res = await fetch("/api/table-admin", { headers, cache: "no-store" });
    setData(res.status === 403 ? "forbidden" : res.ok ? await res.json() : null);
  }, [headers]);
  useEffect(() => {
    load();
  }, [load]);

  async function post(url: string, body: unknown, done: string) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    setMessage(res.ok ? done : res.status === 409 ? "Another table already has that name." : res.status === 400 ? "Give the table a name of up to 40 characters." : "That change was not saved.");
    if (res.ok) await load();
    return res.ok;
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const label = String(new FormData(formEl).get("label"));
    if (await post("/api/table-admin", { label }, `Added ${label}.`)) formEl.reset();
  }

  if (data === "forbidden") return <Screen>Only owners and managers can manage tables.</Screen>;
  if (!data) return <Screen>Loading tables…</Screen>;
  const active = data.tables.filter((t) => t.active);

  return (
    <main className="min-h-dvh bg-[oklch(97%_0.005_250)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)] print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 print:hidden">
        <header>
          <p className="text-sm font-bold uppercase tracking-wide text-[oklch(45%_0.02_260)]">Tables · {data.restaurant}</p>
          <h1 className="text-4xl font-extrabold">Tables and QR codes</h1>
          <p className="mt-1 text-[oklch(45%_0.02_260)]">Each table has its own QR code. A new code makes the old printed one stop working.</p>
        </header>
        <p role="status" aria-live="polite" className={message ? "rounded-xl bg-white p-3 font-semibold" : "sr-only"}>
          {message}
        </p>
        <form onSubmit={add} className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 font-semibold">
            New table
            <input name="label" required maxLength={40} placeholder="Table 9" className={field} />
          </label>
          <button type="submit" className="mt-auto min-h-12 rounded-xl bg-[oklch(18%_0.02_260)] px-5 font-bold text-white">
            Add
          </button>
        </form>
        <ul className="divide-y-2 divide-[oklch(92%_0.005_260)] rounded-2xl border-2 border-[oklch(85%_0.01_260)] bg-white px-5">
          {data.tables.map((t) => (
            <TableRow key={t.id} table={t} post={post} />
          ))}
        </ul>
        <button type="button" onClick={() => window.print()} disabled={!active.length} className={`${btn} self-start`}>
          Print QR codes ({active.length})
        </button>
      </div>
      <PrintSheet restaurant={data.restaurant} tables={active} />
    </main>
  );
}

type Post = (url: string, body: unknown, done: string) => Promise<boolean>;

function TableRow({ table, post }: { table: Table; post: Post }) {
  const [editing, setEditing] = useState(false);
  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = String(new FormData(event.currentTarget).get("label"));
    if (await post(`/api/table-admin/${table.id}`, { label }, `Renamed to ${label}.`)) setEditing(false);
  }
  const rotate = () => {
    if (confirm(`Make a new QR code for ${table.label}? The printed code on the table will stop working.`)) {
      post(`/api/table-admin/${table.id}/rotate`, {}, `${table.label} has a new QR code. Print and replace it.`);
    }
  };
  if (editing) {
    return (
      <li className="py-3">
        <form onSubmit={rename} className="flex gap-2">
          <input name="label" aria-label="Table name" required maxLength={40} defaultValue={table.label} className={field} />
          <button type="submit" className="min-h-12 rounded-xl bg-[oklch(18%_0.02_260)] px-4 font-bold text-white">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={btn}>
            Cancel
          </button>
        </form>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p className={`font-bold ${table.active ? "" : "text-[oklch(55%_0.02_260)] line-through"}`}>
        {table.label}
        {table.active ? "" : " · off"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setEditing(true)} className={btn}>
          Rename
        </button>
        {table.active ? (
          <button type="button" onClick={rotate} className={btn}>
            New QR code
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => post(`/api/table-admin/${table.id}`, { active: !table.active }, table.active ? `${table.label} is off.` : `${table.label} is back on.`)}
          className={btn}
        >
          {table.active ? "Turn off" : "Turn on"}
        </button>
      </div>
    </li>
  );
}

/** Hidden on screen; one QR card per active table when printed. */
function PrintSheet({ restaurant, tables }: { restaurant: string; tables: Table[] }) {
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    Promise.all(tables.map(async (t) => [t.id, await QRCode.toString(`${window.location.origin}/t/${t.qrToken}`, { type: "svg", margin: 1 })] as const)).then(
      (pairs) => live && setSvgs(Object.fromEntries(pairs)),
    );
    return () => {
      live = false;
    };
  }, [tables]);
  return (
    <section aria-label="Printable QR codes" className="hidden print:grid print:grid-cols-2 print:gap-6">
      {tables.map((t) => (
        <figure key={t.id} className="flex break-inside-avoid flex-col items-center gap-2 border-2 border-black p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wide">{restaurant}</p>
          <div className="w-56" dangerouslySetInnerHTML={{ __html: svgs[t.id] ?? "" }} />
          <figcaption className="text-3xl font-extrabold">{t.label}</figcaption>
          <p className="text-sm">Scan to see the menu and order</p>
        </figure>
      ))}
    </section>
  );
}
