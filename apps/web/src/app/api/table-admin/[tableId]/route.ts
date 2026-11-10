import { updateTable } from "../../../../server/table-admin.ts";
import { prodDeps } from "../../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  return updateTable(req, (await params).tableId, prodDeps());
}
