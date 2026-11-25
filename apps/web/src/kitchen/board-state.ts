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

export type Station = "all" | "kitchen" | "bar";

/** Only the lines this screen cooks; tickets with nothing for this station are hidden. */
export function forStation(orders: KitchenOrder[], station: Station): KitchenOrder[] {
  if (station === "all") return orders;
  return orders
    .map((o) => ({ ...o, items: o.items.filter((i) => (i.station ?? "kitchen") === station) }))
    .filter((o) => o.items.length > 0);
}

/** The board's three columns, each oldest ticket first. */
export function columns(state: BoardState, station: Station = "all") {
  const all = forStation(Object.values(state.orders), station).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return COLUMNS.map((col) => ({ ...col, orders: all.filter((o) => col.statuses.includes(o.status)) }));
}
