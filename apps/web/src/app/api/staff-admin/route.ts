import { getStaff, inviteStaff } from "../../../server/staff-admin.ts";
import { prodDeps } from "../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return getStaff(req, prodDeps());
}

export async function POST(req: Request) {
  return inviteStaff(req, prodDeps());
}
