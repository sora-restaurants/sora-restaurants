import { prodDeps } from "../../../../server/prod-deps.ts";
import { listUnpaid } from "../../../../server/unpaid.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return listUnpaid(req, prodDeps());
}
