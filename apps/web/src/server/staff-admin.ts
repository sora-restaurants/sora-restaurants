import { z } from "zod";
import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Role = z.enum(["owner", "manager", "kitchen", "waiter"]);

export type StaffMember = { id: string; email: string; role: string; status: "active" | "inactive" | "invited"; invitedAt: string | null };
export type AdminEvent = { action: string; target: string | null; actor: string | null; before: unknown; after: unknown; at: string };
export type StaffOverview = { restaurant: string; canManageOwners: boolean; staff: StaffMember[]; events: AdminEvent[] };

async function staffUser(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

const fail = (status: number, error: string) => Response.json({ error }, { status });
const STATUS: Record<string, number> = { not_found: 404, invalid_staff: 400, forbidden: 403, last_owner: 409, already_staff: 409 };

async function run(req: Request, deps: Deps, sql: string, params: unknown[], ok: (rows: { id?: string }[]) => Response) {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  try {
    return ok(await deps.db.asUser<{ id?: string }>(userId, sql, params));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (STATUS[message]) return fail(STATUS[message], message);
    throw error;
  }
}

/** GET /api/staff-admin: staff (invites included) and the latest 50 audit events. Owners and managers only. */
export async function getStaff(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  const [row] = await deps.db.asUser<{ s: StaffOverview | null }>(userId, "select list_staff() as s");
  if (!row?.s) return fail(403, "forbidden");
  return Response.json(row.s, { headers: { "cache-control": "no-store" } });
}

/** POST /api/staff-admin  { email, role } — stores a pending invite; the hosted flow sends the email. */
export async function inviteStaff(req: Request, deps: Deps): Promise<Response> {
  const parsed = z.object({ email: z.string().max(254), role: Role }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return (await staffUser(req, deps)) ? fail(400, "invalid_staff") : fail(401, "unauthorized");
  return run(req, deps, "select invite_staff($1, $2) as id", [parsed.data.email, parsed.data.role], ([row]) => Response.json({ id: row.id }));
}

/** POST /api/staff-admin/:id/role  { role } */
export async function setStaffRole(req: Request, membershipId: string, deps: Deps): Promise<Response> {
  const parsed = z.object({ role: Role }).strict().safeParse(await req.json().catch(() => null));
  if (!UUID.test(membershipId)) return fail(404, "not_found");
  if (!parsed.success) return fail(400, "invalid_staff");
  return run(req, deps, "select set_staff_role($1, $2)", [membershipId, parsed.data.role], () => new Response(null, { status: 204 }));
}

/** POST /api/staff-admin/:id/remove — deactivates a member or cancels an invite. */
export async function removeStaff(req: Request, membershipId: string, deps: Deps): Promise<Response> {
  if (!UUID.test(membershipId)) return fail(404, "not_found");
  return run(req, deps, "select remove_staff($1)", [membershipId], () => new Response(null, { status: 204 }));
}
