import { addTable, listTables } from "../../../server/table-admin.ts";
import { prodDeps } from "../../../server/prod-deps.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  return listTables(req, prodDeps());
}

export async function POST(req: Request) {
  return addTable(req, prodDeps());
}
