"use client";

import { useEffect, useRef, useState } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { type BoardState, type ColumnId, columns } from "./board-state.ts";

export type Connection = "connecting" | "live" | "reconnecting" | "denied";
export type Target = "preparing" | "ready" | "served" | "rejected" | "cancelled";
/** Moves that take a ticket off the board. */
export const LEAVES_BOARD: Target[] = ["served", "rejected", "cancelled"];

// One tap per column. Labels are verbs a chef reads at a glance.
const ACTION: Record<ColumnId, { to: Target; label: string }> = {
  new: { to: "preparing", label: "Start" },
  cooking: { to: "ready", label: "Ready" },
  ready: { to: "served", label: "Served" },
};
// The destructive move per column; always needs a second tap.
const STOP: Record<ColumnId, { to: Target; label: string }> = {
  new: { to: "rejected", label: "Reject" },
  cooking: { to: "cancelled", label: "Cancel" },
  ready: { to: "cancelled", label: "Cancel" },
};

// SORA black and white: three stages told apart by fill (new = white, cooking = grey, ready = outlined), all high contrast.
const CARD: Record<ColumnId, string> = {
  new: "kds-new bg-white text-black",
  cooking: "bg-[#262626] text-white",
  ready: "border-2 border-white bg-[#0a0a0a] text-white",
};
const BUTTON: Record<ColumnId, string> = {
  new: "bg-black text-white",
  cooking: "bg-white text-black",
  ready: "bg-white text-black",
};

type Props = {
  restaurant: string;
  board: BoardState;
  connection: Connection;
  onAdvance: (order: KitchenOrder, to: Target) => Promise<void>;
  onSignOut?: () => void;
};

export function KitchenBoard({ restaurant, board, connection, onAdvance, onSignOut }: Props) {
  const now = useNow(30_000);
  const cols = columns(board);
  useNewOrderChime(cols.find((c) => c.id === "new")?.orders.length ?? 0);
  const [activeColumn, setActiveColumn] = useState<ColumnId>("new");

  return (
    <div className="grid h-dvh grid-rows-[auto_auto_auto_minmax(0,1fr)] bg-[#0a0a0a] font-[family-name:var(--font-geist)] font-bold text-white md:grid-rows-[auto_auto_minmax(0,1fr)]">
      <header className="flex items-center justify-between gap-3 border-b border-[#262626] px-3 py-2 sm:px-4 sm:py-3">
        <h1 className="truncate text-xl uppercase tracking-tight sm:text-3xl">{restaurant}</h1>
        <div className="flex items-center gap-2"><ConnectionPill connection={connection} /><a href="/staff" className="grid min-h-12 place-items-center border-2 border-white px-3 text-sm uppercase">Portals</a>{onSignOut && <button type="button" onClick={onSignOut} className="min-h-12 border-2 border-white px-3 text-sm uppercase">Sign out</button>}</div>
      </header>

      {connection === "reconnecting" ? (
        <p role="alert" className="bg-[oklch(55%_0.22_28)] px-4 py-3 text-2xl uppercase">
          Connection lost — reconnecting. Tickets may be out of date.
        </p>
      ) : (
        <div />
      )}

      <nav aria-label="Kitchen stages" className="grid grid-cols-3 border-b border-[#262626] md:hidden">
        {cols.map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => setActiveColumn(col.id)}
            aria-pressed={activeColumn === col.id}
            className={`min-h-14 border-r-2 border-white px-2 text-sm uppercase last:border-r-0 ${activeColumn === col.id ? "bg-white text-black" : "bg-black text-white"}`}
          >
            {col.title} <span className="tabular-nums">({col.orders.length})</span>
          </button>
        ))}
      </nav>

      {/* Phones show one stage at a time; larger kitchen screens keep three independently scrolling columns. */}
      <main className="min-h-0 overflow-hidden p-2 sm:p-3 md:grid md:grid-flow-col md:auto-cols-[minmax(20rem,1fr)] md:gap-3 md:overflow-x-auto">
        {cols.map((col) => (
          <section key={col.id} aria-labelledby={`col-${col.id}`} className={`${activeColumn === col.id ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-col border-4 border-white md:flex`}>
            <h2 id={`col-${col.id}`} className="hidden items-baseline justify-between bg-white px-4 py-2 text-3xl uppercase text-black md:flex">
              <span>{col.title}</span>
              <span className="tabular-nums" aria-label={`${col.orders.length} tickets`}>
                {col.orders.length}
              </span>
            </h2>
            <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-3">
              {col.orders.map((order) => (
                <Ticket key={order.id} order={order} column={col.id} now={now} onAdvance={onAdvance} />
              ))}
            </ol>
          </section>
        ))}
      </main>

      {board.revoked || connection === "denied" ? (
        <div role="alertdialog" aria-label="Signed out" className="fixed inset-0 grid place-items-center bg-black/90 p-6 text-center">
          <p className="text-4xl uppercase">This tablet no longer has kitchen access.</p>
        </div>
      ) : null}
    </div>
  );
}

function Ticket({ order, column, now, onAdvance }: { order: KitchenOrder; column: ColumnId; now: number; onAdvance: Props["onAdvance"] }) {
  const [state, setState] = useState<"idle" | "sending" | "failed">("idle");
  const [confirming, setConfirming] = useState(false);
  const minutes = Math.max(0, Math.floor((now - Date.parse(order.createdAt)) / 60_000));
  const action = ACTION[column];
  const stop = STOP[column];

  // A destructive tap only arms the button; a second tap within 4 s confirms. Wet hands, crowded counter.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4_000);
    return () => clearTimeout(id);
  }, [confirming]);

  async function send(to: Target) {
    setState("sending");
    setConfirming(false);
    try {
      await onAdvance(order, to);
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <li className={`flex min-w-0 shrink-0 flex-col gap-3 p-3 sm:p-4 ${CARD[column]}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-3xl leading-none sm:text-4xl">{order.table}</p>
        <p className="shrink-0 text-2xl tabular-nums leading-none sm:text-3xl" aria-label={`${minutes} minutes ago`}>
          {minutes}′
        </p>
      </div>
      <p className="text-xl tabular-nums">#{order.publicRef}</p>
      <ul className="flex min-w-0 flex-col gap-2 border-y-4 border-current py-3">
        {order.items.map((item, i) => (
          <li key={i} className="min-w-0 text-xl leading-tight sm:text-2xl">
            {/* Dish names and notes wrap in full, never cut: a hidden "allergy" is worse than a taller card.
                The column scrolls on its own, so a tall card cannot push the grid. */}
            <span className="block break-words">
              {item.quantity}× {item.name}
            </span>
            {item.notes ? <span className="mt-1 block break-words text-lg uppercase sm:text-xl">» {item.notes}</span> : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => send(action.to)}
          disabled={state === "sending" || confirming}
          className={`min-h-14 min-w-14 w-full text-2xl uppercase transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white sm:min-h-16 sm:text-3xl ${BUTTON[column]}`}
        >
          {state === "sending" ? "…" : state === "failed" ? `Retry ${action.label}` : action.label}
        </button>
        <button
          type="button"
          onClick={() => (confirming ? send(stop.to) : setConfirming(true))}
          disabled={state === "sending"}
          aria-label={confirming ? `Tap again to ${stop.label.toLowerCase()} ${order.table}` : `${stop.label} ${order.table}`}
          className={`min-h-14 min-w-14 w-full border-4 px-3 text-xl uppercase transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white sm:min-h-16 sm:text-2xl ${
            confirming ? "border-white bg-[oklch(50%_0.22_28)] text-white" : "border-current bg-transparent"
          }`}
        >
          {confirming ? `Tap again to ${stop.label}` : `✕ ${stop.label}`}
        </button>
      </div>
    </li>
  );
}

function ConnectionPill({ connection }: { connection: Connection }) {
  const live = connection === "live";
  return (
    <p role="status" className={`shrink-0 px-2 py-1 text-sm uppercase sm:px-3 sm:text-xl ${live ? "bg-[oklch(80%_0.21_145)] text-black" : "bg-[oklch(55%_0.22_28)] text-white"}`}>
      {live ? "● Live" : connection === "connecting" ? "Connecting…" : connection === "denied" ? "No access" : "Offline"}
    </p>
  );
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** A short two-tone chime whenever the number of new tickets goes up (not on first load). */
function useNewOrderChime(newCount: number) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== null && newCount > last.current) {
      try {
        const ctx = new AudioContext();
        [880, 1320].forEach((hz, i) => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.frequency.value = hz; gain.gain.value = 0.2;
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.18); osc.stop(ctx.currentTime + i * 0.18 + 0.15);
        });
      } catch { /* audio blocked until the tablet is tapped once; the yellow card still shows */ }
    }
    last.current = newCount;
  }, [newCount]);
}
