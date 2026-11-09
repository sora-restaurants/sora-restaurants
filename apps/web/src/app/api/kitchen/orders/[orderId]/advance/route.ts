import { advanceOrder } from "../../../../../../server/advance-order.ts";
import { prodDeps } from "../../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return advanceOrder(req, orderId, prodDeps());
}
