"use client";

import { useEffect, useReducer, useState } from "react";
import { applyBoardEvent, EMPTY_BOARD } from "./board-state.ts";
import type { Connection } from "./KitchenBoard.tsx";
import { createSseParser, type SseEvent } from "./sse.ts";

const RETRY_MS = [1_000, 2_000, 5_000, 10_000];

/**
 * Live board for one restaurant. EventSource cannot send an Authorization header, so this reads the
 * SSE stream with fetch and reconnects with backoff; each reconnect starts from a fresh snapshot.
 */
export function useKitchenStream(restaurantId: string, getToken: () => Promise<string | null>) {
  const [board, dispatch] = useReducer(applyBoardEvent, EMPTY_BOARD);
  const [connection, setConnection] = useState<Connection>("connecting");

  useEffect(() => {
    const controller = new AbortController();
    let attempt = 0;

    async function connect() {
      while (!controller.signal.aborted) {
        try {
          const token = await getToken();
          const res = await fetch(`/api/kitchen/${restaurantId}/stream`, {
            headers: token ? { authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
            cache: "no-store",
          });
          if (res.status === 401 || res.status === 403) {
            setConnection("denied");
            return;
          }
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const feed = createSseParser((event: SseEvent) => {
            if (event.event === "snapshot") {
              attempt = 0;
              setConnection("live");
            }
            if (event.event === "revoked") setConnection("denied");
            dispatch(event);
          });
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            feed(decoder.decode(value, { stream: true }));
          }
        } catch {
          if (controller.signal.aborted) return;
        }
        setConnection("reconnecting");
        await new Promise((r) => setTimeout(r, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]));
      }
    }
    connect();
    return () => controller.abort();
  }, [restaurantId, getToken]);

  return { board, connection, dispatch };
}
