"use client";

import { useEffect, useReducer } from "react";
import type { KitchenOrder } from "../server/deps.ts";
import { applyBoardEvent, EMPTY_BOARD } from "./board-state.ts";
import { KitchenBoard, LEAVES_BOARD, type Target } from "./KitchenBoard.tsx";

const DISHES = [
  "Boerewors Roll with Chakalaka and Extra Cheese",
  "Lamb Chops with Rosemary Salt and Braaibroodjie on the Side",
  "Bunny Chow (Quarter Loaf, Mutton Curry, Extra Sambals)",
  "Pap and Sous",
  "Sosaties with Apricot Curry Glaze",
  "Peri-Peri Chicken Livers with Toasted Ciabatta",
  "Rump 300g Medium Rare with Monkey Gland Sauce",
  "Malva Pudding with Custard",
];
const NOTES = ["", "", "no onion", "extra chakalaka, sauce on the side please", "allergy: nuts", ""];

// Friday-night flood: 20 tickets spread across the stages, some with long names and notes.
function fridayNight(): KitchenOrder[] {
  const start = Date.now() - 40 * 60_000;
  return Array.from({ length: 20 }, (_, i) => ({
    id: `preview-${i}`,
    publicRef: (0xa1b2c3 + i * 7919).toString(16).toUpperCase().slice(0, 6),
    table: i % 5 === 0 ? `Patio ${i + 1}` : `Table ${i + 1}`,
    status: i < 9 ? "submitted" : i < 16 ? (i % 2 ? "accepted" : "preparing") : "ready",
    totalCents: 12500,
    createdAt: new Date(start + i * 2 * 60_000).toISOString(),
    items: Array.from({ length: 1 + (i % 4) }, (_, j) => ({
      name: DISHES[(i + j) % DISHES.length],
      quantity: 1 + ((i + j) % 3),
      notes: NOTES[(i + j) % NOTES.length],
    })),
  }));
}

export function KitchenPreview() {
  // Populate after hydration: Date.now() must not produce different server and browser HTML.
  const [board, dispatch] = useReducer(applyBoardEvent, EMPTY_BOARD);
  useEffect(() => dispatch({ event: "snapshot", data: { orders: fridayNight() } }), []);
  const advance = async (order: KitchenOrder, to: Target) => {
    await new Promise((r) => setTimeout(r, 250));
    dispatch(LEAVES_BOARD.includes(to) ? { event: "order_removed", data: { id: order.id } } : { event: "order", data: { ...order, status: to } });
  };
  return <KitchenBoard restaurant="Braai Spot Johannesburg" board={board} connection="live" onAdvance={advance} />;
}
