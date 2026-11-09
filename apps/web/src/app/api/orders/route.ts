import { MAX_ORDER_BODY_BYTES, readCappedBody, submitResultResponse } from "../../../server/http.ts";
import { prodDeps } from "../../../server/prod-deps.ts";
import { submitOrder } from "../../../server/submit-order.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same checkout as the Server Action, over HTTP for the terminal simulator and other non-browser clients.
export async function POST(req: Request) {
  const body = await readCappedBody(req, MAX_ORDER_BODY_BYTES);
  if (body === null) return Response.json({ error: "body_too_large" }, { status: 413 });
  return submitResultResponse(await submitOrder(body, prodDeps()));
}
