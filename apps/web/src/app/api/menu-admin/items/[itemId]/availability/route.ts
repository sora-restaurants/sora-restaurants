import { setItemAvailable } from "../../../../../../server/menu-admin.ts";
import { prodDeps } from "../../../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return setItemAvailable(req, itemId, prodDeps());
}
