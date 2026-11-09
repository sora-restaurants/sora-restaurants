"use client";

import { useEffect, useState } from "react";
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

// Solid, high-contrast blocks (WCAG: amber/green carry black text, blue carries white).
const CARD: Record<ColumnId, string> = {
  new: "kds-new bg-[oklch(82%_0.17_78)] text-black",
  cooking: "bg-[oklch(42%_0.2_262)] text-white",
  ready: "bg-[oklch(80%_0.21_145)] text-black",
};
const BUTTON: Record<ColumnId, string> = {
  new: "bg-black text-[oklch(82%_0.17_78)]",
  cooking: "bg-white text-[oklch(32%_0.2_262)]",
  ready: "bg-black text-[oklch(80%_0.21_145)]",
};

type Props = {
  restaurant: string;
  board: BoardState;
  connection: Connection;
  onAdvance: (order: KitchenOrder, to: Target) => Promise<void>;
};

export function KitchenBoard({ restaurant, board, connection, onAdvance }: Props) {
  const now = useNow(30_000);
  const cols = columns(board);

  return (
    <div className="grid h-dvh grid-rows-[auto_auto_minmax(0,1fr)] bg-[oklch(13%_0_0)] font-[family-name:var(--font-manrope)] font-extrabold text-white">
      <header className="flex items-center justify-between gap-4 border-b-4 border-white px-4 py-3">
        <h1 className="truncate text-3xl uppercase tracking-tight">{restaurant}</h1>
        <ConnectionPill connection={connection} />
      </header>

      {connection === "reconnecting" ? (
        <p role="alert" className="bg-[oklch(55%_0.22_28)] px-4 py-3 text-2xl uppercase">
          Connection lost — reconnecting. Tickets may be out of date.
        </p>
      ) : (
        <div />
      )}

      {/* Rigid columns: each scrolls on its own, nothing can push the grid off screen. */}
      <main className="grid min-h-0 snap-x snap-mandatory auto-cols-[minmax(20rem,1fr)] grid-flow-col gap-3 overflow-x-auto p-3">
        {cols.map((col) => (
          <section key={col.id} aria-labelledby={`col-${col.id}`} className="flex min-h-0 min-w-0 snap-start flex-col border-4 border-white">
            <h2 id={`col-${col.id}`} className="flex items-baseline justify-between bg-white px-4 py-2 text-3xl uppercase text-black">
              <span>{col.title}</span>
              <span className="tabular-nums" aria-label={`${col.orders.length} tickets`}>
                {col.orders.length}
              </span>
            </h2>
            <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
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
    <li className={`flex min-w-0 shrink-0 flex-col gap-3 p-4 ${CARD[column]}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-4xl leading-none">{order.table}</p>
        <p className="shrink-0 text-3xl tabular-nums leading-none" aria-label={`${minutes} minutes ago`}>
          {minutes}′
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xl tabular-nums">#{order.publicRef}</p>
        {/* Walk-out protection: staff see at a glance whether to collect payment. */}
        <p className={`shrink-0 border-4 border-current px-2 text-lg uppercase ${order.paid ? "" : "bg-black text-white"}`}>
          {order.paid ? "Paid" : "Pay at table"}
        </p>
      </div>
      <ul className="flex min-w-0 flex-col gap-2 border-y-4 border-current py-3">
        {order.items.map((item, i) => (
          <li key={i} className="min-w-0 text-2xl leading-tight">
            {/* Dish names and notes wrap in full, never cut: a hidden "allergy" is worse than a taller card.
                The column scrolls on its own, so a tall card cannot push the grid. */}
            <span className="block break-words">
              {item.quantity}× {item.name}
            </span>
            {item.notes ? <span className="mt-1 block break-words text-xl uppercase">» {item.notes}</span> : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => send(action.to)}
          disabled={state === "sending" || confirming}
          className={`min-h-16 min-w-16 w-full text-3xl uppercase transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white ${BUTTON[column]}`}
        >
          {state === "sending" ? "…" : state === "failed" ? `Retry ${action.label}` : action.label}
        </button>
        <button
          type="button"
          onClick={() => (confirming ? send(stop.to) : setConfirming(true))}
          disabled={state === "sending"}
          aria-label={confirming ? `Tap again to ${stop.label.toLowerCase()} ${order.table}` : `${stop.label} ${order.table}`}
          className={`min-h-16 min-w-16 w-full border-4 px-3 text-2xl uppercase transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white ${
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
    <p role="status" className={`shrink-0 px-3 py-1 text-xl uppercase ${live ? "bg-[oklch(80%_0.21_145)] text-black" : "bg-[oklch(55%_0.22_28)] text-white"}`}>
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
