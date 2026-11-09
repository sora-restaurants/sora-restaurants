import type { SubmitResult } from "./deps.ts";

/** A 50-line cart with notes is well under 16 KB; anything bigger is refused before it is parsed. */
export const MAX_ORDER_BODY_BYTES = 16 * 1024;

/** Reads the body as text, or returns null once it exceeds maxBytes. Counts bytes as they arrive, since content-length can lie. */
export async function readCappedBody(req: Request, maxBytes: number): Promise<string | null> {
  if (Number(req.headers.get("content-length")) > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** HTTP form of a checkout result, shared by the API route and the terminal simulator's test server. */
export function submitResultResponse(result: SubmitResult): Response {
  if (!result.ok) return Response.json({ error: result.error }, { status: result.httpStatus });
  const { statusToken, publicRef, replayed } = result;
  return Response.json({ statusToken, publicRef, payNow: result.payNow }, { status: replayed ? 200 : 201 });
}
