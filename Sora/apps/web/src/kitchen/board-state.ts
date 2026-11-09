import type { KitchenOrder } from "../server/deps.ts";
import type { SseEvent } from "./sse.ts";

export type BoardState = { orders: Record<string, KitchenOrder>; revoked: boolean };
export const EMPTY_BOARD: BoardState = { orders: {}, revoked: false };

/** Applies one stream event. The server is the source of truth: a snapshot always replaces local state. */
export function applyBoardEvent(state: BoardState, { event, data }: SseEvent): BoardState {
  switch (event) {
    case "snapshot":
      return { ...state, orders: Object.fromEntries((data.orders as KitchenOrder[]).map((o) => [o.id, o])) };
    case "order":
      return { ...state, orders: { ...state.orders, [data.id]: data as KitchenOrder } };
    case "order_removed": {
      const { [data.id as string]: _removed, ...rest } = state.orders;
      return { ...state, orders: rest };
    }
    case "revoked":
      return { ...state, revoked: true };
    default:
      return state;
  }
}

export type ColumnId = "new" | "cooking" | "ready";
export const COLUMNS: { id: ColumnId; title: string; statuses: string[] }[] = [
  { id: "new", title: "New", statuses: ["submitted"] },
  { id: "cooking", title: "Cooking", statuses: ["accepted", "preparing"] },
  { id: "ready", title: "Ready", statuses: ["ready"] },
];

/** The board's three columns, each oldest ticket first. */
export function columns(state: BoardState) {
  const all = Object.values(state.orders).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return COLUMNS.map((col) => ({ ...col, orders: all.filter((o) => col.statuses.includes(o.status)) }));
}
