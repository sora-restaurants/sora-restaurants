import { prodDeps } from "../../../../../../server/prod-deps.ts";
import { collectCounterPayment } from "../../../../../../server/collect-payment.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return collectCounterPayment(req, paymentId, prodDeps());
}
