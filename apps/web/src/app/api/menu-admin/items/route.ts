import { saveMenuItem } from "../../../../server/menu-admin.ts";
import { prodDeps } from "../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  return saveMenuItem(req, prodDeps());
}
