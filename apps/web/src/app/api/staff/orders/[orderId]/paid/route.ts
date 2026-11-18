import { prodDeps } from "../../../../../../server/prod-deps.ts";
import { markPaid } from "../../../../../../server/unpaid.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return markPaid(req, orderId, prodDeps());
}
