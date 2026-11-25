import { guestBill, guestSplit } from "../../../../../../server/bill-split.ts";
import { prodDeps } from "../../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return guestBill((await params).token, prodDeps());
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return guestSplit(req, (await params).token, prodDeps());
}
