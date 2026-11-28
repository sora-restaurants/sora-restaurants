"use client";

import { useEffect, useRef, useState } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { ColorModeToggle, useColorMode } from "../components/ColorModeToggle.tsx";
import { type BoardState, type ColumnId, type Station, type StationOrder, columns } from "./board-state.ts";
import { EYEBROW, STAFF_COLOR_KEY } from "./StaffSignIn.tsx";

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

// Sora owner palette; each stage has its own solid fill so a glance across the pass reads the state.
// New is terracotta (white text, 4.6:1 at this weight), cooking is the plain card, ready is deep green.
const CARD: Record<ColumnId, string> = {
  new: "kds-new bg-[#C45C26] text-white",
  cooking: "border border-[var(--owner-border)] bg-[var(--owner-card)] text-[var(--owner-text)]",
  ready: "bg-[#25451E] text-white",
};
const BUTTON: Record<ColumnId, string> = {
  new: "bg-white text-[#8B3F1D]",
  cooking: "bg-[#C45C26] text-white",
  ready: "bg-white text-[#25451E]",
};

type Props = {
  restaurant: string;
  board: BoardState;
  connection: Connection;
  /** station is set when a Kitchen or Bar screen moves only its own lines. */
  onAdvance: (order: KitchenOrder, to: Target, station?: "kitchen" | "bar") => Promise<void>;
  onSignOut?: () => void;
  /** Which lines this screen shows first: /kitchen opens on Kitchen, /bar on Bar. */
  screen?: "kitchen" | "bar";
};

export function KitchenBoard({ restaurant, board, connection, onAdvance, onSignOut, screen = "kitchen" }: Props) {
  const now = useNow(30_000);
  const [station, setStation] = useStation(screen);
  const cols = columns(board, station);
  const soundOn = useSoundUnlocked();
  const { mode, toggle } = useColorMode(STAFF_COLOR_KEY);
  useWakeLock();
  useNewOrderChime(cols.find((c) => c.id === "new")?.orders.length ?? 0);
  const [activeColumn, setActiveColumn] = useState<ColumnId>("new");

  return (
    <div data-mode={mode} className="owner-shell grid h-dvh grid-rows-[auto_auto_auto_minmax(0,1fr)] bg-[var(--owner-bg)] font-[family-name:var(--font-manrope)] text-[var(--owner-text)] md:grid-rows-[auto_auto_minmax(0,1fr)]">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--owner-border)] px-3 py-2 sm:px-6 sm:py-4">
        <div className="min-w-0">
          <p className={EYEBROW}>{screen === "bar" ? "Bar" : "Kitchen"}</p>
          <h1 className="truncate text-2xl font-black tracking-[-0.04em] sm:text-4xl">{restaurant}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="kds-station">Screen</label>
          <select id="kds-station" value={station} onChange={(e) => setStation(e.target.value as Station)} className="min-h-12 rounded-full border border-[var(--owner-border)] bg-[var(--owner-surface)] px-3 text-sm font-bold">
            <option value="all">All</option><option value="kitchen">Kitchen</option><option value="bar">Bar</option>
          </select>
          <ConnectionPill connection={connection} />
          <ColorModeToggle mode={mode} onToggle={toggle} className="border-[var(--owner-border)]" />
          <a href="/staff" className="grid min-h-12 place-items-center rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">Portals</a>
          {onSignOut && <button type="button" onClick={onSignOut} className="min-h-12 rounded-full border border-[var(--owner-border)] px-4 text-sm font-bold">Sign out</button>}
        </div>
      </header>

      {/* One grid row for both banners, so the stage tabs and columns keep their rows. */}
      <div>
        {!soundOn && <p role="status" className="mx-2 mt-2 rounded-xl bg-[#F5DFC1] px-4 py-2 font-bold text-[#70420F] sm:mx-3">Tap anywhere to turn on the new-order sound</p>}
        {connection === "reconnecting" && (
          <p role="alert" className="mx-2 mt-2 rounded-xl bg-[#8B3F1D] px-4 py-3 text-xl font-black text-white sm:mx-3">
            Connection lost — reconnecting. Tickets may be out of date.
          </p>
        )}
      </div>

      <nav aria-label="Kitchen stages" className="mx-2 mt-2 grid grid-cols-3 gap-1 rounded-full bg-[var(--owner-surface)] p-1 shadow-sm md:hidden">
        {cols.map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => setActiveColumn(col.id)}
            aria-pressed={activeColumn === col.id}
            className={`min-h-12 rounded-full px-2 text-sm font-black ${activeColumn === col.id ? "bg-[var(--owner-text)] text-[var(--owner-bg)]" : ""}`}
          >
            {col.title} <span className="tabular-nums">({col.orders.length})</span>
          </button>
        ))}
      </nav>

      {/* Phones show one stage at a time; larger kitchen screens keep three independently scrolling columns. */}
      <main className="min-h-0 overflow-hidden p-2 sm:p-3 md:grid md:grid-flow-col md:auto-cols-[minmax(20rem,1fr)] md:gap-3 md:overflow-x-auto">
        {cols.map((col) => (
          <section key={col.id} aria-labelledby={`col-${col.id}`} className={`${activeColumn === col.id ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-col rounded-3xl bg-[var(--owner-surface)] shadow-sm md:flex`}>
            <h2 id={`col-${col.id}`} className="hidden items-baseline justify-between px-5 pb-1 pt-4 text-3xl font-black tracking-tight md:flex">
              <span>{col.title}</span>
              <span className="tabular-nums" aria-label={`${col.orders.length} tickets`}>
                {col.orders.length}
              </span>
            </h2>
            <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-3">
              {col.orders.map((order) => (
                <Ticket key={order.id} order={order} column={col.id} now={now} onAdvance={(o, to) => onAdvance(o, to, station === "all" ? undefined : station)} />
              ))}
            </ol>
          </section>
        ))}
      </main>

      {board.revoked || connection === "denied" ? (
        <div role="alertdialog" aria-label="Signed out" className="fixed inset-0 grid place-items-center bg-black/80 p-6 text-center">
          <p className="rounded-3xl bg-[var(--owner-surface)] p-8 text-3xl font-black">This tablet no longer has kitchen access.</p>
        </div>
      ) : null}
    </div>
  );
}

function Ticket({ order, column, now, onAdvance }: { order: StationOrder; column: ColumnId; now: number; onAdvance: (order: KitchenOrder, to: Target) => Promise<void> }) {
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
    <li className={`flex min-w-0 shrink-0 flex-col gap-3 rounded-2xl p-3 font-bold shadow-sm sm:p-4 ${CARD[column]}`}>
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <p className="truncate text-3xl font-black leading-none tracking-tight sm:text-4xl">{order.table}</p>
        <p className="shrink-0 text-2xl font-black tabular-nums leading-none sm:text-3xl" aria-label={`${minutes} minutes ago`}>
          {minutes}′
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg tabular-nums opacity-80">#{order.publicRef}</p>
        {/* Walk-out protection: staff see at a glance whether to collect payment. */}
        <p className="shrink-0 rounded-full border-2 border-current px-2 text-sm font-black uppercase">
          {order.paid ? "Paid" : "Pay at table"}
        </p>
      </div>
      <ul className="flex min-w-0 flex-col gap-2 border-y border-current py-3">
        {order.items.map((item, i) => (
          <li key={i} className="min-w-0 text-xl leading-tight sm:text-2xl">
            {/* Dish names and notes wrap in full, never cut: a hidden "allergy" is worse than a taller card.
                The column scrolls on its own, so a tall card cannot push the grid. */}
            <span className="block break-words">
              {item.quantity}× {item.name}
            </span>
            {item.notes ? <span className="mt-1 block break-words text-lg font-black uppercase sm:text-xl">» {item.notes}</span> : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => send(action.to)}
          disabled={state === "sending" || confirming || !!order.waitingOn}
          className={`min-h-14 min-w-14 w-full rounded-xl text-2xl font-black transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-16 sm:text-3xl ${BUTTON[column]}`}
        >
          {order.waitingOn ? `Waiting for ${order.waitingOn}` : state === "sending" ? "…" : state === "failed" ? `Retry ${action.label}` : action.label}
        </button>
        <button
          type="button"
          onClick={() => (confirming ? send(stop.to) : setConfirming(true))}
          disabled={state === "sending"}
          aria-label={confirming ? `Tap again to ${stop.label.toLowerCase()} ${order.table}` : `${stop.label} ${order.table}`}
          className={`min-h-14 min-w-14 w-full rounded-xl border-2 px-3 text-xl font-black transition-transform active:scale-[0.97] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-16 sm:text-2xl ${
            confirming ? "border-[#B42318] bg-[#B42318] text-white" : "border-current bg-transparent"
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
    <p role="status" className={`shrink-0 rounded-full px-4 py-2 text-sm font-black uppercase tracking-wide ${live ? "bg-[#DDE8D8] text-[#25451E]" : "bg-[#F5DFC1] text-[#70420F]"}`}>
      {live ? "● Live" : connection === "connecting" ? "Connecting…" : connection === "denied" ? "No access" : "○ Offline"}
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

/** Which lines this screen shows: the page's own station, unless this tablet picked another one on this page. */
function useStation(screen: "kitchen" | "bar"): [Station, (s: Station) => void] {
  const key = `sora-kds-station-${screen}`;
  const [station, set] = useState<Station>(screen);
  useEffect(() => { try { const s = localStorage.getItem(key); if (s === "all" || s === "kitchen" || s === "bar") set(s); } catch { /* storage blocked */ } }, [key]);
  return [station, (s) => { set(s); try { localStorage.setItem(key, s); } catch { /* storage blocked */ } }];
}

// One context for the whole board; browsers only allow sound after the first tap.
let audio: AudioContext | null = null;

/** False until the first tap unlocks audio, so the kitchen knows to tap once. */
function useSoundUnlocked() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const unlock = () => { try { audio ??= new AudioContext(); void audio.resume().then(() => setOn(audio?.state === "running")); } catch { /* no audio */ } };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return on;
}

/** Keeps the tablet screen awake while the board is open (re-taken when the tab comes back). */
function useWakeLock() {
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    const take = () => { if (document.visibilityState === "visible") (navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen").then((l) => { lock = l; }, () => {}); };
    take();
    document.addEventListener("visibilitychange", take);
    return () => { document.removeEventListener("visibilitychange", take); void lock?.release().catch(() => {}); };
  }, []);
}

/** A short two-tone chime whenever the number of new tickets goes up (not on first load). */
function useNewOrderChime(newCount: number) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== null && newCount > last.current) {
      try {
        const ctx = (audio ??= new AudioContext());
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
