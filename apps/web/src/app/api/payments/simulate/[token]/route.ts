import { simulatePayment } from "../../../../../server/payments.ts";
import { prodDeps } from "../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 404 unless DEV_SIMULATED_PAYMENTS=1 outside production (see payments.ts).
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return simulatePayment(token, prodDeps());
}
