"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { KitchenBoard, type Target } from "./KitchenBoard.tsx";
import { useKitchenStream } from "./useKitchenStream.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let client: SupabaseClient | undefined;
// Created on first use in the browser, never at import, so a build without env vars still succeeds.
const supabase = () => (client ??= createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!));

/** Kitchen tablet: sign in, pick up the staff member's restaurant, show its live board. */
export function KitchenLive() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return <Screen>Kitchen board is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</Screen>;
  }
  return <KitchenSession />;
}

function KitchenSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase().auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    // RLS returns only restaurants this user works at.
    supabase()
      .from("restaurants")
      .select("id, name")
      .order("name")
      .limit(1)
      .then(({ data }) => setRestaurant(data?.[0] ?? null));
  }, [session]);

  if (session === undefined) return <Screen>Loading…</Screen>;
  if (!session) return <SignIn />;
  if (!restaurant) return <Screen>Finding your restaurant…</Screen>;
  return <LiveBoard restaurant={restaurant} />;
}

function LiveBoard({ restaurant }: { restaurant: { id: string; name: string } }) {
  // Always the current access token, so reconnects after a refresh keep working.
  const getToken = useCallback(async () => (await supabase().auth.getSession()).data.session?.access_token ?? null, []);
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
          to === "served"
            ? { event: "order_removed", data: { id: order.id, status: to } }
            : { event: "order", data: { ...order, status: to } },
        );
      }
    },
    [dispatch, getToken],
  );

  return <KitchenBoard restaurant={restaurant.name} board={board} connection={connection} onAdvance={advance} />;
}

function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const { error } = await supabase().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    setError(error ? "That email and password did not match." : null);
  }

  const field = "min-h-16 w-full border-4 border-white bg-black px-4 text-2xl text-white";
  return (
    <Screen>
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-4 text-left">
        <h1 className="text-4xl uppercase">Kitchen sign in</h1>
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
