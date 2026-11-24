import { ownerReport } from "../../../../server/owner-operations.ts";
import { prodDeps } from "../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = (req: Request) => ownerReport(req, prodDeps());
