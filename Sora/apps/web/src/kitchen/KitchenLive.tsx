"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { KitchenBoard, LEAVES_BOARD, type Target } from "./KitchenBoard.tsx";
import { ServiceBoard } from "./ServiceBoard.tsx";
import { type StaffAuth, staffAuth } from "./staff-auth.ts";
import { useKitchenStream } from "./useKitchenStream.ts";

type Restaurant = { id: string; name: string };

/** Kitchen tablet: sign in, pick up the staff member's restaurant, show its live board. */
export function KitchenLive() {
  const auth = useMemo(staffAuth, []);
  if (!auth) {
    return <Screen>Kitchen board is not configured: set the Supabase variables, or the dev login for a local demo.</Screen>;
  }
  return <KitchenSession auth={auth} />;
}

function KitchenSession({ auth }: { auth: StaffAuth }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [restaurant, setRestaurant] = useState<Restaurant | null | "none">(null);

  useEffect(() => {
    const refresh = () => auth.getToken().then(setToken);
    refresh();
    return auth.onChange(refresh);
  }, [auth]);

  useEffect(() => {
    if (!token) return;
    // The server applies RLS and the kitchen-role check; a waiter gets an empty list.
    fetch("/api/kitchen/me", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : { restaurants: [] }))
      .then(({ restaurants }: { restaurants: Restaurant[] }) => setRestaurant(restaurants[0] ?? "none"));
  }, [token]);

  if (token === undefined) return <Screen>Loading…</Screen>;
  if (!token) return <SignIn auth={auth} />;
  if (restaurant === "none") return <Screen>This account has no kitchen access.</Screen>;
  if (!restaurant) return <Screen>Finding your restaurant…</Screen>;
  return <LiveBoard restaurant={restaurant} auth={auth} />;
}

function LiveBoard({ restaurant, auth }: { restaurant: Restaurant; auth: StaffAuth }) {
  // Always the current token, so reconnects after a refresh keep working.
  const getToken = useCallback(() => auth.getToken(), [auth]);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { void getToken().then(setToken); }, [getToken]);
  const { board, connection, dispatch } = useKitchenStream(restaurant.id, getToken);

  const advance = useCallback(
    async (order: KitchenOrder, to: Target) => {
      const token = await getToken();
      const res = await fetch(`/api/kitchen/orders/${order.id}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to }),
      });
      if (!res.ok && res.status !== 409) throw new Error(`advance ${res.status}`);
      // 409 means another tablet already moved it; the stream brings the true state either way.
      if (res.ok) {
        dispatch(
          LEAVES_BOARD.includes(to)
            ? { event: "order_removed", data: { id: order.id, status: to } }
            : { event: "order", data: { ...order, status: to } },
        );
      }
    },
    [dispatch, getToken],
  );

  return (
    <>
      <KitchenBoard restaurant={restaurant.name} board={board} connection={connection} onAdvance={advance} />
      {token && <ServiceBoard token={token} />}
    </>
  );
}

function SignIn({ auth }: { auth: StaffAuth }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const failure = await auth.signIn(String(form.get("email")), String(form.get("password")));
    setBusy(false);
    setError(failure);
  }

  const field = "min-h-16 w-full border-4 border-white bg-black px-4 text-2xl text-white";
  return (
    <Screen>
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 text-left">
        <h1 className="text-4xl uppercase">Kitchen sign in</h1>
        {auth.mode === "dev" ? (
          <p className="border-4 border-[oklch(82%_0.17_78)] p-3 text-xl text-[oklch(82%_0.17_78)]">
            Local demo login. Seeded staff accounts only.
          </p>
        ) : null}
        <label className="flex flex-col gap-2 text-xl uppercase">
          Email
          <input name="email" type="email" autoComplete="username" required className={field} />
        </label>
        <label className="flex flex-col gap-2 text-xl uppercase">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={field} />
        </label>
        {error ? (
          <p role="alert" className="bg-[oklch(55%_0.22_28)] p-3 text-xl">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-16 bg-white text-3xl uppercase text-black disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[oklch(13%_0_0)] p-6 text-center font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-white">
      {children}
    </main>
  );
}
