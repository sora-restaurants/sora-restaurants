import { prodDeps } from "../../../../server/prod-deps.ts";
import { listCalls } from "../../../../server/waiter-calls.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return listCalls(req, prodDeps());
}
