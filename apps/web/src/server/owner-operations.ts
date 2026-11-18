import QRCode from "qrcode";
import { z } from "zod";
import type { OwnerDashboardSnapshot } from "../owner/session-contract.ts";
import type { Deps } from "./deps.ts";

const Command = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["open", "close", "rotate"]), tableId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("create"), restaurantId: z.string().uuid(), label: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("updateItem"), itemId: z.string().uuid(), name: z.string().trim().min(1).max(120),
    description: z.string().max(500), priceCents: z.number().int().min(0).max(100000000), imageUrl: z.string().max(500).nullable(),
    dietaryTags: z.array(z.string().max(40)).max(10), available: z.boolean(), soldOut: z.boolean() }).strict(),
  z.object({ action: z.literal("createItem"), menuId: z.string().uuid(), name: z.string().trim().min(1).max(120),
    description: z.string().max(500), priceCents: z.number().int().min(0).max(100000000) }).strict(),
  z.object({ action: z.literal("createCategory"), restaurantId: z.string().uuid(), name: z.string().trim().min(1).max(80) }).strict(),
]);

async function user(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

export async function ownerSnapshot(req: Request, deps: Deps): Promise<Response> {
  const userId = await user(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const [restaurant] = await deps.db.asUser<{ id: string; name: string; timezone: string }>(userId,
    "select id, name, timezone from restaurants where is_member(id, array['owner','manager']) order by name limit 1");
  if (!restaurant) return Response.json({ error: "forbidden" }, { status: 403 });
  const tables = await deps.db.asUser<{ id: string; label: string; active: boolean; qr_token: string; session_state: "open" | "closed"; opened_at: string | null }>(userId, `
    select t.id, t.label, t.active, t.qr_token,
      case when s.id is null then 'closed' else 'open' end session_state, s.opened_at::text
    from tables t left join table_sessions s on s.table_id = t.id and s.status = 'open'
    where t.restaurant_id = $1 order by t.label`, [restaurant.id]);
  // Today in the restaurant's own time zone.
  const [value] = await deps.db.asUser<{ cents: number; paid: number }>(userId, `
    select coalesce(sum(total_cents), 0)::int cents, coalesce(sum(total_cents) filter (where payment_status = 'paid'), 0)::int paid from orders
    where restaurant_id = $1 and status not in ('cancelled','rejected')
      and created_at >= (date_trunc('day', now() at time zone $2) at time zone $2)`, [restaurant.id, restaurant.timezone]);
  const menuRows = await deps.db.asUser<{ category_id: string; category_name: string; item_id: string | null; item_name: string | null; description: string | null; price_cents: number | null; image_url: string | null; dietary_tags: string[] | null; available: boolean | null; sold_out: boolean | null }>(userId, `
    select m.id category_id, m.name category_name, i.id item_id, i.name item_name, i.description,
      i.price_cents, i.image_url, i.dietary_tags, i.available, i.sold_out
    from menus m left join menu_items i on i.menu_id = m.id and i.restaurant_id = m.restaurant_id
    where m.restaurant_id = $1 order by m.sort_order, m.name, i.sort_order, i.name`, [restaurant.id]);
  const origin = new URL(req.url).origin;
  const mapped = await Promise.all(tables.map(async (table) => {
    const qrUrl = `${origin}/t/${table.qr_token}`;
    return { id: table.id, label: table.label, enabled: table.active, sessionState: table.session_state,
      openedAt: table.opened_at, qrUrl,
      qrImageSrc: await QRCode.toDataURL(qrUrl, { margin: 1, width: 512, errorCorrectionLevel: "M" }) };
  }));
  const menu = [...new Map(menuRows.map((row) => [row.category_id, { id: row.category_id, name: row.category_name,
    items: menuRows.filter((item) => item.category_id === row.category_id && item.item_id).map((item) => ({ id: item.item_id!, name: item.item_name!, description: item.description ?? "", priceCents: item.price_cents!, imageUrl: item.image_url, dietaryTags: item.dietary_tags ?? [], available: item.available!, soldOut: item.sold_out! })) }])).values()];
  const orders = await deps.db.asUser<OwnerDashboardSnapshot["orders"][number]>(userId, `
    select o.id, o.public_ref "publicRef", t.label "table", o.status, o.total_cents + o.tip_cents "totalCents",
      o.payment_status "paymentStatus", o.created_at "createdAt"
    from orders o join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
    where o.restaurant_id = $1 and o.created_at >= (date_trunc('day', now() at time zone $2) at time zone $2)
    order by o.created_at desc limit 100`, [restaurant.id, restaurant.timezone]);
  const snapshot: OwnerDashboardSnapshot = { restaurantId: restaurant.id, restaurantName: restaurant.name, timezone: restaurant.timezone,
    acceptedOrderValueCents: value?.cents ?? 0, paidTodayCents: value?.paid ?? 0, tables: mapped, menu, orders };
  return Response.json({ restaurantId: restaurant.id, snapshot });
}

export async function ownerCommand(req: Request, deps: Deps): Promise<Response> {
  const userId = await user(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Command.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_command" }, { status: 400 });
  const command = parsed.data;
  try {
    if (command.action === "create") await deps.db.asUser(userId, "select create_restaurant_table($1, $2)", [command.restaurantId, command.label]);
    else if (command.action === "updateItem") await deps.db.asUser(userId,
      "select update_menu_item($1,$2,$3,$4,$5,$6,$7,$8)", [command.itemId, command.name, command.description, command.priceCents, command.imageUrl ?? "", command.dietaryTags, command.available, command.soldOut]);
    else if (command.action === "createItem") await deps.db.asUser(userId, "select create_menu_item($1,$2,$3,$4)", [command.menuId, command.name, command.description, command.priceCents]);
    else if (command.action === "createCategory") await deps.db.asUser(userId, "select create_menu_category($1,$2)", [command.restaurantId, command.name]);
    else if (command.action === "open") await deps.db.asUser(userId, "select open_table_session($1)", [command.tableId]);
    else if (command.action === "close") await deps.db.asUser(userId, "select close_table_session($1)", [command.tableId]);
    else await deps.db.asUser(userId, "select rotate_table_qr($1)", [command.tableId]);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal";
    const conflict = ["SESSION_ALREADY_OPEN", "SESSION_ALREADY_CLOSED", "table_disabled"].find((code) => message.includes(code));
    return Response.json({ error: conflict ?? "not_found" }, { status: conflict ? 409 : 404 });
  }
}

