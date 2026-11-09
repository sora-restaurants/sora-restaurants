import { createSseParser, type SseEvent } from "../kitchen/sse.ts";

export type { SseEvent };

// Reads the response body until n SSE events are parsed, then cancels the stream.
export async function readEvents(res: Response, n: number, timeoutMs = 2000): Promise<SseEvent[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: SseEvent[] = [];
  const feed = createSseParser((event) => events.push(event));
  const deadline = setTimeout(() => reader.cancel("timeout"), timeoutMs);
  try {
    while (events.length < n) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`stream ended after ${events.length} of ${n} events`);
      feed(decoder.decode(value, { stream: true }));
    }
    return events.slice(0, n);
  } finally {
    clearTimeout(deadline);
    await reader.cancel().catch(() => {});
  }
}
