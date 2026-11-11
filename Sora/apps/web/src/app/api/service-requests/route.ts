import { prodDeps } from "../../../server/prod-deps.ts";
import { listServiceRequests, updateServiceRequest } from "../../../server/service-requests.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await prodDeps().verifyStaffToken(bearer) : null;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const requests = await listServiceRequests(userId, prodDeps());
  return Response.json({ requests });
}

export async function POST(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await prodDeps().verifyStaffToken(bearer) : null;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { id?: string; to?: string } | null;
  const result = await updateServiceRequest(userId, body?.id ?? "", body?.to ?? "", prodDeps());
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
