import { orderStatus } from "../../../../../server/order-status.ts";
import { prodDeps } from "../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return orderStatus((await params).token, prodDeps());
}
