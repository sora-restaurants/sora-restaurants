import { removeStaff } from "../../../../../server/staff-admin.ts";
import { prodDeps } from "../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  return removeStaff(req, (await params).membershipId, prodDeps());
}
