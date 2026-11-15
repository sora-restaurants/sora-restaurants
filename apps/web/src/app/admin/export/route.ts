import { isAdmin } from "../../../server/admin-session.ts";
import { prodDeps } from "../../../server/prod-deps.ts";
import { listApplications, toCsv } from "../../../server/waitlist.ts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Sign in at /admin/login first.", { status: 401 });
  const p = new URL(req.url).searchParams;
  const rows = await listApplications(prodDeps().db, { q: p.get("q") ?? "", status: p.get("status") ?? "", city: p.get("city") ?? "", pos: p.get("pos") ?? "" });
  // The BOM makes Excel read names like Café correctly.
  return new Response(`﻿${toCsv(rows)}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="sora-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
  });
}
