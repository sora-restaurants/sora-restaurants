import { describe, expect, it } from "vitest";
import type { KitchenOrder } from "../server/deps.ts";
import { applyBoardEvent, columns, EMPTY_BOARD, forStation, moveStation } from "./board-state.ts";
import { createSseParser } from "./sse.ts";

const order = (id: string, status: string, createdAt = "2026-11-09T18:00:00.000Z"): KitchenOrder => ({
  id, publicRef: id.toUpperCase(), table: "Table 4", status, totalCents: 12500, createdAt, paid: false, payAtTable: true, items: [],
});

describe("applyBoardEvent", () => {
  it("snapshot replaces, order upserts, order_removed deletes, revoked locks", () => {
    let board = applyBoardEvent(EMPTY_BOARD, { event: "snapshot", data: { orders: [order("a", "submitted")] } });
    board = applyBoardEvent(board, { event: "order", data: order("b", "preparing") });
    board = applyBoardEvent(board, { event: "order", data: order("a", "accepted") });
    expect(Object.values(board.orders).map((o) => [o.id, o.status])).toEqual([["a", "accepted"], ["b", "preparing"]]);
    board = applyBoardEvent(board, { event: "order_removed", data: { id: "b", status: "served" } });
    expect(Object.keys(board.orders)).toEqual(["a"]);
    expect(applyBoardEvent(board, { event: "revoked", data: {} }).revoked).toBe(true);
  });

  it("a new snapshot after a reconnect drops tickets that were served meanwhile", () => {
    const before = applyBoardEvent(EMPTY_BOARD, { event: "snapshot", data: { orders: [order("a", "ready")] } });
    expect(applyBoardEvent(before, { event: "snapshot", data: { orders: [] } }).orders).toEqual({});
  });
});

describe("columns", () => {
  it("groups by kitchen stage, oldest first", () => {
    const board = applyBoardEvent(EMPTY_BOARD, {
      event: "snapshot",
      data: {
        orders: [
          order("late", "submitted", "2026-11-09T18:10:00.000Z"),
          order("early", "submitted", "2026-11-09T18:00:00.000Z"),
          order("c", "accepted"),
          order("d", "preparing"),
          order("e", "ready"),
        ],
      },
    });
    const ids = columns(board).map((col) => [col.id, col.orders.map((o) => o.id)]);
    expect(ids).toEqual([["new", ["early", "late"]], ["cooking", ["c", "d"]], ["ready", ["e"]]]);
  });
});

describe("createSseParser", () => {
  it("handles frames split across chunks and ignores pings", () => {
    const seen: unknown[] = [];
    const feed = createSseParser((e) => seen.push(e));
    feed('event: snapshot\ndata: {"orders":[]}\n\n: ping\n\nevent: ord');
    feed('er\ndata: {"id":"a"}\n');
    feed("\n");
    expect(seen).toEqual([{ event: "snapshot", data: { orders: [] } }, { event: "order", data: { id: "a" } }]);
  });
});

describe("moveStation", () => {
  const ticket = { id: "t", publicRef: "X", table: "T1", status: "submitted", totalCents: 0, createdAt: "", paid: false, payAtTable: true,
    items: [{ name: "Coke", quantity: 1, notes: "", station: "bar", prep: "new" }, { name: "Pizza", quantity: 1, notes: "", station: "kitchen", prep: "new" }] } as KitchenOrder;
  it("moves only that screen's lines, at once, and keeps the other screen's lines", () => {
    const started = moveStation(ticket, "bar", "preparing");
    expect(started.items.map((i) => i.prep)).toEqual(["preparing", "new"]);
    expect(forStation([started], "bar")[0].status).toBe("preparing");
    expect(forStation([started], "kitchen")[0].status).toBe("submitted");
    const barDone = moveStation(started, "bar", "ready");
    expect(barDone.status).toBe("preparing"); // the kitchen part is still to come
    expect(moveStation(barDone, "kitchen", "ready").status).toBe("ready");
  });
});
