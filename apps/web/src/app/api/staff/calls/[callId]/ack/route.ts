import { prodDeps } from "../../../../../../server/prod-deps.ts";
import { acknowledgeCall } from "../../../../../../server/waiter-calls.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  return acknowledgeCall(req, callId, prodDeps());
}
