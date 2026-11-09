import { getMenuAdmin } from "../../../server/menu-admin.ts";
import { prodDeps } from "../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return getMenuAdmin(req, prodDeps());
}
