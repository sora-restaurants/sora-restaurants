import { prodDeps } from "../../../../server/prod-deps.ts";
import { listTables } from "../../../../server/unpaid.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return listTables(req, prodDeps());
}
