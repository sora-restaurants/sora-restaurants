import { z } from "zod";
import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const Label = z.string().trim().min(1).max(40);
const AddInput = z.object({ label: Label }).strict();
const UpdateInput = z
  .object({ label: Label.optional(), active: z.boolean().optional() })
  .strict()
  .refine((v) => v.label !== undefined || v.active !== undefined, "label or active");

export type AdminTables = {
  restaurant: string;
  tables: { id: string; label: string; active: boolean; qrToken: string }[];
};

async function staffUser(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

const fail = (status: number, error: string) => Response.json({ error }, { status });

function sqlError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "not_found") return fail(404, "not_found");
  if (message === "invalid_table") return fail(400, "invalid_table");
  if (message === "duplicate_table") return fail(409, "duplicate_table");
  throw error;
}

/** GET /api/table-admin: the owner's or manager's tables, inactive ones included. */
export async function listTables(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  const [row] = await deps.db.asUser<{ t: AdminTables | null }>(
    userId,
    `with r as (select id, name from restaurants where is_member(id, array['owner', 'manager']) order by name limit 1)
     select case when exists (select 1 from r) then jsonb_build_object(
       'restaurant', (select name from r),
       'tables', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label, 'active', active, 'qrToken', qr_token)
                    order by active desc, length(label), label), '[]')
                  from tables where restaurant_id = (select id from r))
     ) end as t`,
  );
  if (!row?.t) return fail(403, "forbidden");
  return Response.json(row.t, { headers: { "cache-control": "no-store" } });
}

/** POST /api/table-admin  { label } adds a table. */
export async function addTable(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  const parsed = AddInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_table");
  try {
    const [row] = await deps.db.asUser<{ id: string }>(userId, "select save_table(null, $1, true) as id", [parsed.data.label]);
    return Response.json({ id: row.id });
  } catch (error) {
    // No owner/manager restaurant to add to: same answer as the list.
    if (error instanceof Error && error.message === "not_found") return fail(403, "forbidden");
    return sqlError(error);
  }
}

/** POST /api/table-admin/:id  { label?, active? } renames and/or (de)activates. */
export async function updateTable(req: Request, tableId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  if (!UUID.test(tableId)) return fail(404, "not_found");
  const parsed = UpdateInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_table");
  try {
    await deps.db.asUser(userId, "select save_table($1, $2, $3)", [tableId, parsed.data.label ?? null, parsed.data.active ?? null]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return sqlError(error);
  }
}

/** POST /api/table-admin/:id/rotate — new QR token; old printed codes stop working. */
export async function rotateTableQr(req: Request, tableId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  if (!UUID.test(tableId)) return fail(404, "not_found");
  try {
    const [row] = await deps.db.asUser<{ qr_token: string }>(userId, "select rotate_table_qr($1) as qr_token", [tableId]);
    return Response.json({ qrToken: row.qr_token });
  } catch (error) {
    return sqlError(error);
  }
}
