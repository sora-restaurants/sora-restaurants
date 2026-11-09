import { z } from "zod";
import type { Deps } from "./deps.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ItemInput = z
  .object({
    id: z.string().uuid().optional(),
    menuId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(300).default(""),
    priceCents: z.number().int().min(0).max(10_000_000),
  })
  .strict()
  .refine((v) => Boolean(v.id) !== Boolean(v.menuId), "exactly one of id (edit) or menuId (add)");

export type AdminMenu = {
  restaurant: string;
  canEdit: boolean;
  menus: { id: string; name: string; items: { id: string; name: string; description: string; priceCents: number; available: boolean }[] }[];
};

async function staffUser(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

const fail = (status: number, error: string) => Response.json({ error }, { status });

function sqlError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "not_found") return fail(404, "not_found");
  if (message === "invalid_item") return fail(400, "invalid_item");
  throw error;
}

/** GET /api/menu-admin: the staff member's restaurant menu, sold-out dishes included. */
export async function getMenuAdmin(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  const [row] = await deps.db.asUser<{ m: AdminMenu | null }>(
    userId,
    `with r as (select id, name from restaurants where is_member(id, array['owner', 'manager', 'kitchen']) order by name limit 1)
     select case when exists (select 1 from r) then jsonb_build_object(
       'restaurant', (select name from r),
       'canEdit', (select is_member(id, array['owner', 'manager']) from r),
       'menus', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'items',
           (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description,
                     'priceCents', i.price_cents, 'available', i.available) order by i.sort_order, i.name), '[]')
            from menu_items i where i.menu_id = m.id)) order by m.sort_order, m.name), '[]')
         from menus m where m.restaurant_id = (select id from r))
     ) end as m`,
  );
  if (!row?.m) return fail(403, "forbidden");
  return Response.json(row.m, { headers: { "cache-control": "no-store" } });
}

/** POST /api/menu-admin/items  { id, name, description, priceCents } edits; { menuId, ... } adds. */
export async function saveMenuItem(req: Request, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  const parsed = ItemInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_item");
  const { id = null, menuId = null, name, description, priceCents } = parsed.data;
  try {
    const [row] = await deps.db.asUser<{ id: string }>(userId, "select save_menu_item($1, $2, $3, $4, $5) as id", [
      id,
      menuId,
      name,
      description,
      priceCents,
    ]);
    return Response.json({ id: row.id });
  } catch (error) {
    return sqlError(error);
  }
}

/** POST /api/menu-admin/items/:id/availability  { available } — sold out / back on. */
export async function setItemAvailable(req: Request, itemId: string, deps: Deps): Promise<Response> {
  const userId = await staffUser(req, deps);
  if (!userId) return fail(401, "unauthorized");
  if (!UUID.test(itemId)) return fail(404, "not_found");
  const body = await req.json().catch(() => null);
  if (typeof body?.available !== "boolean") return fail(400, "invalid_item");
  try {
    await deps.db.asUser(userId, "select set_menu_item_available($1, $2)", [itemId, body.available]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return sqlError(error);
  }
}
