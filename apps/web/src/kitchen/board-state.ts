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

/** A ticket as one screen sees it; `waitingOn` names the other screen when this part is ready and that one is not. */
export type StationOrder = KitchenOrder & { waitingOn?: "kitchen" | "bar" };

/** Only the lines this screen makes, in this screen's own stage; tickets with nothing for this station are hidden. */
export function forStation(orders: KitchenOrder[], station: Station): StationOrder[] {
  if (station === "all") return orders;
  return orders.flatMap((o) => {
    const items = o.items.filter((i) => (i.station ?? "kitchen") === station);
    if (items.length === 0) return [];
    // Lines from before per-station progress have no prep: they follow the order.
    const prep = (i: KitchenOrder["items"][number]) => i.prep ?? (o.status === "ready" ? "ready" : o.status === "preparing" ? "preparing" : "new");
    const status = o.status === "ready" || items.every((i) => prep(i) === "ready") ? "ready"
      : items.some((i) => prep(i) !== "new") ? "preparing" : "submitted";
    const waitingOn = status === "ready" && o.status !== "ready" ? (station === "bar" ? "kitchen" : "bar") : undefined;
    return [{ ...o, items, status, waitingOn }];
  });
}

/** The board's three columns, each oldest ticket first. */
export function columns(state: BoardState, station: Station = "all"): { id: ColumnId; title: string; statuses: string[]; orders: StationOrder[] }[] {
  const all = forStation(Object.values(state.orders), station).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return COLUMNS.map((col) => ({ ...col, orders: all.filter((o) => col.statuses.includes(o.status)) }));
}
