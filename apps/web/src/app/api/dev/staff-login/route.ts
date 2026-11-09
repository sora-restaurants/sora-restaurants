import { devStaffLogin } from "../../../../server/dev-staff-login.ts";
import { prodDeps } from "../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 404 unless DEV_STAFF_LOGIN=1 outside production (see dev-staff-login.ts).
export async function POST(req: Request) {
  return devStaffLogin(req, prodDeps());
}
