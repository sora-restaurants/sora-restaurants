import { markSharePaid } from "../../../../../../server/bill-split.ts";
import { prodDeps } from "../../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ shareId: string }> }) {
  return markSharePaid(req, (await params).shareId, prodDeps());
}
