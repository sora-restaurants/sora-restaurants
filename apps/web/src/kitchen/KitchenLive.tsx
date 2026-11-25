"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { KitchenBoard, LEAVES_BOARD, type Target } from "./KitchenBoard.tsx";
import { Screen, SignIn } from "./StaffSignIn.tsx";
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

  return <KitchenBoard restaurant={restaurant.name} board={board} connection={connection} onAdvance={advance} onSignOut={() => void auth.signOut()} />;
}
