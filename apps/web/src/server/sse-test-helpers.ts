export type SseEvent = { event: string; data: any };

// Reads the response body until n SSE events are parsed, then cancels the stream.
export async function readEvents(res: Response, n: number, timeoutMs = 2000): Promise<SseEvent[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: SseEvent[] = [];
  let buffer = "";
  const deadline = setTimeout(() => reader.cancel("timeout"), timeoutMs);
  try {
    while (events.length < n) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`stream ended after ${events.length} of ${n} events`);
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0 && events.length < n) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = "message";
        let data = "";
        for (const line of frame.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7);
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (data) events.push({ event, data: JSON.parse(data) });
      }
    }
    return events;
  } finally {
    clearTimeout(deadline);
    await reader.cancel().catch(() => {});
  }
}
