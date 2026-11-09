import { ownerStats } from "../../../../server/owner-stats.ts";
import { prodDeps } from "../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return ownerStats(req, prodDeps());
}
