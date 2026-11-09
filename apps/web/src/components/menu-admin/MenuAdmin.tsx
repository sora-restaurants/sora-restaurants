"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Screen, SignIn } from "../../kitchen/StaffSignIn.tsx";
import { type StaffAuth, staffAuth } from "../../kitchen/staff-auth.ts";
import { formatRand } from "../../lib/money.ts";
import type { AdminMenu } from "../../server/menu-admin.ts";

type Item = AdminMenu["menus"][number]["items"][number];

export function MenuAdmin() {
  const auth = useMemo(staffAuth, []);
  if (!auth) return <Screen>Menu editor is not configured: set the Supabase variables, or the dev login.</Screen>;
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
  return <Editor token={token} />;
}

/** Rands typed by staff ("89", "89.50", "89,50") to integer cents, or null if not a price. */
function parseRands(text: string): number | null {
  const match = /^\s*(?:R\s*)?(\d{1,6})(?:[.,](\d{1,2}))?\s*$/i.exec(text);
  return match ? Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0")) : null;
}
const toRands = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

function Editor({ token }: { token: string }) {
  const [menu, setMenu] = useState<AdminMenu | "forbidden" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const headers = useMemo(() => ({ authorization: `Bearer ${token}`, "content-type": "application/json" }), [token]);

  const load = useCallback(async () => {
    const res = await fetch("/api/menu-admin", { headers, cache: "no-store" });
    setMenu(res.status === 403 ? "forbidden" : res.ok ? await res.json() : null);
  }, [headers]);
  useEffect(() => {
    load();
  }, [load]);

  async function post(url: string, body: unknown, done: string) {
    if (body === BAD_PRICE) {
      setMessage(BAD_PRICE);
      return false;
    }
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    setMessage(res.ok ? done : res.status === 400 ? "Check the name and price, then try again." : "That change was not saved.");
    if (res.ok) await load();
    return res.ok;
  }

  if (menu === "forbidden") return <Screen>This account cannot edit the menu.</Screen>;
  if (!menu) return <Screen>Loading menu…</Screen>;

  return (
    <main className="min-h-dvh bg-[oklch(97%_0.005_250)] px-4 py-8 font-[family-name:var(--font-manrope)] text-[oklch(18%_0.02_260)]">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header>
          <p className="text-sm font-bold uppercase tracking-wide text-[oklch(45%_0.02_260)]">Menu · {menu.restaurant}</p>
          <h1 className="text-4xl font-extrabold">{menu.canEdit ? "Edit menu" : "Sold out today"}</h1>
          <p className="mt-1 text-[oklch(45%_0.02_260)]">
            Changes show on the QR menu straight away. Past orders keep the price they were placed at.
          </p>
        </header>
        <p role="status" aria-live="polite" className={message ? "rounded-xl bg-white p-3 font-semibold" : "sr-only"}>
          {message}
        </p>
        {menu.menus.map((section) => (
          <section key={section.id} aria-labelledby={`m-${section.id}`} className="rounded-2xl border-2 border-[oklch(85%_0.01_260)] bg-white p-5">
            <h2 id={`m-${section.id}`} className="mb-3 text-2xl font-extrabold">
              {section.name}
            </h2>
            <ul className="flex flex-col divide-y-2 divide-[oklch(92%_0.005_260)]">
              {section.items.map((item) => (
                <ItemRow key={item.id} item={item} canEdit={menu.canEdit} post={post} />
              ))}
            </ul>
            {menu.canEdit ? <AddItem menuId={section.id} post={post} /> : null}
          </section>
        ))}
      </div>
    </main>
  );
}

type Post = (url: string, body: unknown, done: string) => Promise<boolean>;
const BAD_PRICE = "Enter a price like 89 or 89.50.";

function ItemRow({ item, canEdit, post }: { item: Item; canEdit: boolean; post: Post }) {
  const [editing, setEditing] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const priceCents = parseRands(String(form.get("price")));
    if (priceCents === null) return post("", BAD_PRICE, "");
    if (await post("/api/menu-admin/items", { id: item.id, name: form.get("name"), description: form.get("description"), priceCents }, `Saved ${form.get("name")}.`)) {
      setEditing(false);
    }
  }

  const toggle = () =>
    post(`/api/menu-admin/items/${item.id}/availability`, { available: !item.available }, item.available ? `${item.name} is sold out.` : `${item.name} is back on the menu.`);

  if (editing) {
    return (
      <li className="py-3">
        <ItemForm onSubmit={save} item={item} onCancel={() => setEditing(false)} submitLabel="Save" />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className={`font-bold ${item.available ? "" : "text-[oklch(55%_0.02_260)] line-through"}`}>{item.name}</p>
        <p className="text-sm tabular-nums text-[oklch(45%_0.02_260)]">
          {formatRand(item.priceCents)}
          {item.available ? "" : " · sold out"}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={!item.available}
          className={`min-h-12 rounded-xl border-2 px-4 font-bold ${item.available ? "border-[oklch(80%_0.01_260)] bg-white" : "border-transparent bg-[oklch(50%_0.18_28)] text-white"}`}
        >
          {item.available ? "Mark sold out" : "Back on menu"}
        </button>
        {canEdit ? (
          <button type="button" onClick={() => setEditing(true)} className="min-h-12 rounded-xl border-2 border-[oklch(80%_0.01_260)] bg-white px-4 font-bold">
            Edit
          </button>
        ) : null}
      </div>
    </li>
  );
}

function AddItem({ menuId, post }: { menuId: string; post: Post }) {
  const [open, setOpen] = useState(false);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const priceCents = parseRands(String(form.get("price")));
    if (priceCents === null) return post("", BAD_PRICE, "");
    if (await post("/api/menu-admin/items", { menuId, name: form.get("name"), description: form.get("description"), priceCents }, `Added ${form.get("name")}.`)) {
      setOpen(false);
    }
  }
  return open ? (
    <div className="mt-3 border-t-2 border-[oklch(92%_0.005_260)] pt-3">
      <ItemForm onSubmit={add} onCancel={() => setOpen(false)} submitLabel="Add dish" />
    </div>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-12 rounded-xl border-2 border-dashed border-[oklch(70%_0.01_260)] px-4 font-bold">
      + Add a dish
    </button>
  );
}

function ItemForm({ item, onSubmit, onCancel, submitLabel }: { item?: Item; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: () => void; submitLabel: string }) {
  const field = "min-h-12 w-full rounded-xl border-2 border-[oklch(80%_0.01_260)] bg-white px-3";
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_8rem]">
      <label className="flex flex-col gap-1 font-semibold">
        Name
        <input name="name" required maxLength={80} defaultValue={item?.name} className={field} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Price (R)
        <input name="price" required inputMode="decimal" defaultValue={item ? toRands(item.priceCents) : ""} placeholder="89.00" className={`${field} tabular-nums`} />
      </label>
      <label className="flex flex-col gap-1 font-semibold sm:col-span-2">
        Description
        <input name="description" maxLength={300} defaultValue={item?.description} className={field} />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="min-h-12 rounded-xl bg-[oklch(18%_0.02_260)] px-5 font-bold text-white">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border-2 border-[oklch(80%_0.01_260)] px-5 font-bold">
          Cancel
        </button>
      </div>
    </form>
  );
}
