"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { KitchenBoard, LEAVES_BOARD, type Target } from "./KitchenBoard.tsx";
import { Screen, SignIn } from "./StaffSignIn.tsx";
import { dropOn401, type StaffAuth, staffAuth } from "./staff-auth.ts";
import { readChoice, saveChoice } from "./restaurant-choice.ts";
import { useKitchenStream } from "./useKitchenStream.ts";

type Restaurant = { id: string; name: string };

/** Kitchen tablet: sign in, pick up the staff member's restaurant, show its live board. */
export function KitchenLive({ screen = "kitchen" }: { screen?: "kitchen" | "bar" } = {}) {
  const auth = useMemo(staffAuth, []);
  if (!auth) {
    return <Screen>Kitchen board is not configured: set the Supabase variables, or the dev login for a local demo.</Screen>;
  }
  return <KitchenSession auth={auth} screen={screen} />;
}

function KitchenSession({ auth, screen }: { auth: StaffAuth; screen: "kitchen" | "bar" }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(() => readChoice());

  useEffect(() => {
    const refresh = () => auth.getToken().then(setToken);
    refresh();
    return auth.onChange(refresh);
  }, [auth]);

  useEffect(() => {
    if (!token) return;
    // The server applies RLS and the kitchen-role check; a waiter gets an empty list.
    fetch("/api/kitchen/me", { headers: { authorization: `Bearer ${token}` } })
      .then((res) => dropOn401(auth, res))
      .then((res) => (res.ok ? res.json() : { restaurants: [] }))
      .then(({ restaurants }: { restaurants: Restaurant[] }) => setRestaurants(restaurants));
  }, [token]);

  if (token === undefined) return <Screen>Loading…</Screen>;
  if (!token) return <SignIn auth={auth} />;
  if (!restaurants) return <Screen>Finding your restaurant…</Screen>;
  if (restaurants.length === 0) return <Screen>This account has no kitchen access.</Screen>;
  // One restaurant: straight in. Several: this tablet remembers which kitchen it stands in.
  const restaurant = restaurants.length === 1 ? restaurants[0] : restaurants.find((r) => r.id === chosen);
  if (!restaurant) {
    return (
      <Screen>
        <div className="flex w-full max-w-md flex-col gap-4">
          <h1 className="text-4xl uppercase">Which kitchen is this?</h1>
          {restaurants.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                saveChoice(r.id);
                setChosen(r.id);
              }}
              className="min-h-16 rounded-[4px] bg-white px-4 text-3xl uppercase text-black"
            >
              {r.name}
            </button>
          ))}
        </div>
      </Screen>
    );
  }
  const signOut = () => {
    // The next person to sign in on this tablet picks their own kitchen.
    saveChoice(null);
    setChosen(null);
    void auth.signOut();
  };
  return <LiveBoard key={restaurant.id} restaurant={restaurant} auth={auth} onSignOut={signOut} screen={screen} />;
}

function LiveBoard({ restaurant, auth, onSignOut, screen }: { restaurant: Restaurant; auth: StaffAuth; onSignOut: () => void; screen: "kitchen" | "bar" }) {
  // Always the current token, so reconnects after a refresh keep working.
  const getToken = useCallback(() => auth.getToken(), [auth]);
  const dropSession = useCallback(() => void auth.signOut(), [auth]);
  const { board, connection, dispatch } = useKitchenStream(restaurant.id, getToken, dropSession);

  const advance = useCallback(
    async (order: KitchenOrder, to: Target, station?: "kitchen" | "bar") => {
      const token = await getToken();
      const res = await dropOn401(auth, await fetch(`/api/kitchen/orders/${order.id}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to, station }),
      }));
      if (!res.ok && res.status !== 409) throw new Error(`advance ${res.status}`);
      // 409 means another tablet already moved it; the stream brings the true state either way.
      // A station move changes only some lines; the stream brings the result.
      if (res.ok && !(station && (to === "preparing" || to === "ready"))) {
        dispatch(
          LEAVES_BOARD.includes(to)
            ? { event: "order_removed", data: { id: order.id, status: to } }
            : { event: "order", data: { ...order, status: to } },
        );
      }
    },
    [dispatch, getToken, auth],
  );

  return <KitchenBoard restaurant={restaurant.name} board={board} connection={connection} onAdvance={advance} onSignOut={onSignOut} screen={screen} />;
}
