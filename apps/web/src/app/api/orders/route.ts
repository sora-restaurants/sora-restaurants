import { submitResultResponse } from "../../../server/http.ts";
import { prodDeps } from "../../../server/prod-deps.ts";
import { submitOrder } from "../../../server/submit-order.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Same checkout as the Server Action, over HTTP for the terminal simulator and other non-browser clients.
export async function POST(req: Request) {
  return submitResultResponse(await submitOrder(await req.text(), prodDeps()));
}
