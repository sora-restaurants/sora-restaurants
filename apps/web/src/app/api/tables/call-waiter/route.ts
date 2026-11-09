import { MAX_ORDER_BODY_BYTES, readCappedBody } from "../../../../server/http.ts";
import { prodDeps } from "../../../../server/prod-deps.ts";
import { callWaiter } from "../../../../server/waiter-calls.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await readCappedBody(req, MAX_ORDER_BODY_BYTES);
  let input: unknown = null;
  try {
    input = body ? JSON.parse(body) : null;
  } catch {
    // invalid JSON is rejected by callWaiter's validation
  }
  return callWaiter(input, prodDeps());
}
