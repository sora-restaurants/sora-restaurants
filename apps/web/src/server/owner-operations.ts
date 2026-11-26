import QRCode from "qrcode";
import { z } from "zod";
import type { OwnerDashboardSnapshot, OwnerReport, OwnerStats } from "../owner/session-contract.ts";
import type { Deps } from "./deps.ts";

const Allergens = z.array(z.string().trim().min(1).max(40)).max(14);
const Command = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["open", "close", "rotate"]), tableId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("create"), restaurantId: z.string().uuid(), label: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("updateItem"), itemId: z.string().uuid(), name: z.string().trim().min(1).max(120),
    description: z.string().max(500), priceCents: z.number().int().min(0).max(100000000), imageUrl: z.string().max(500).nullable(),
    dietaryTags: z.array(z.string().max(40)).max(10), available: z.boolean(), soldOut: z.boolean(), allergens: Allergens.optional() }).strict(),
  z.object({ action: z.literal("createItem"), menuId: z.string().uuid(), name: z.string().trim().min(1).max(120),
    description: z.string().max(500), priceCents: z.number().int().min(0).max(100000000) }).strict(),
  z.object({ action: z.literal("createCategory"), restaurantId: z.string().uuid(), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal("addOption"), itemId: z.string().uuid(), label: z.string().trim().min(1).max(60).regex(/^[^,]+$/),
    priceCents: z.number().int().min(0).max(100000) }).strict(),
  z.object({ action: z.literal("deleteOption"), optionId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("setStation"), menuId: z.string().uuid(), station: z.enum(["kitchen", "bar", "auto"]) }).strict(),
  z.object({ action: z.literal("inviteStaff"), restaurantId: z.string().uuid(), email: z.string().trim().email().max(200),
    role: z.enum(["manager", "kitchen", "waiter"]) }).strict(),
  z.object({ action: z.literal("setStaffStatus"), membershipId: z.string().uuid(), status: z.enum(["active", "inactive"]) }).strict(),
]);

async function user(req: Request, deps: Deps) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  return bearer ? deps.verifyStaffToken(bearer) : null;
}

type Restaurant = { id: string; name: string; timezone: string; role: string };

/** Every restaurant the user owns or manages; the one asked for (?restaurant=) or the first. */
async function ownedRestaurants(req: Request, userId: string, deps: Deps) {
  const restaurants = await deps.db.asUser<Restaurant>(userId, `
    select r.id, r.name, r.timezone, m.role from restaurants r
      join staff_memberships m on m.restaurant_id = r.id and m.user_id = auth.uid() and m.status = 'active'
    where is_member(r.id, array['owner','manager']) order by r.name`);
  const wanted = new URL(req.url).searchParams.get("restaurant");
  return { restaurants, restaurant: restaurants.find((r) => r.id === wanted) ?? restaurants[0] };
}

export async function ownerSnapshot(req: Request, deps: Deps): Promise<Response> {
  const userId = await user(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { restaurants, restaurant } = await ownedRestaurants(req, userId, deps);
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
  const menuRows = await deps.db.asUser<{ category_id: string; category_name: string; station: "kitchen" | "bar" | "auto"; item_id: string | null; item_name: string | null; description: string | null; price_cents: number | null; image_url: string | null; dietary_tags: string[] | null; allergens: string[] | null; available: boolean | null; sold_out: boolean | null; options: { id: string; label: string; priceCents: number }[] | string | null }>(userId, `
    select m.id category_id, m.name category_name, coalesce(m.station, 'auto') station, i.id item_id, i.name item_name, i.description,
      i.price_cents, i.image_url, i.dietary_tags, i.allergens, i.available, i.sold_out,
      (select coalesce(json_agg(json_build_object('id', o.id, 'label', o.label, 'priceCents', o.price_cents) order by o.sort_order), '[]')
         from menu_item_options o where o.menu_item_id = i.id) options
    from menus m left join menu_items i on i.menu_id = m.id and i.restaurant_id = m.restaurant_id
    where m.restaurant_id = $1 order by m.sort_order, m.name, i.sort_order, i.name`, [restaurant.id]);
  const origin = new URL(req.url).origin;
  const mapped = await Promise.all(tables.map(async (table) => {
    const qrUrl = `${origin}/t/${table.qr_token}`;
    return { id: table.id, label: table.label, enabled: table.active, sessionState: table.session_state,
      openedAt: table.opened_at, qrUrl,
      qrImageSrc: await QRCode.toDataURL(qrUrl, { margin: 1, width: 512, errorCorrectionLevel: "M" }) };
  }));
  const menu = [...new Map(menuRows.map((row) => [row.category_id, { id: row.category_id, name: row.category_name, station: row.station,
    items: menuRows.filter((item) => item.category_id === row.category_id && item.item_id).map((item) => ({ id: item.item_id!, name: item.item_name!, description: item.description ?? "", priceCents: item.price_cents!, imageUrl: item.image_url, dietaryTags: item.dietary_tags ?? [], allergens: item.allergens ?? [], available: item.available!, soldOut: item.sold_out!,
      options: typeof item.options === "string" ? JSON.parse(item.options) : item.options ?? [] })) }])).values()];
  const orders = await deps.db.asUser<OwnerDashboardSnapshot["orders"][number]>(userId, `
    select o.id, o.public_ref "publicRef", t.label "table", o.status, o.total_cents + o.tip_cents "totalCents",
      o.payment_status "paymentStatus", o.created_at "createdAt"
    from orders o join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
    where o.restaurant_id = $1 and o.created_at >= (date_trunc('day', now() at time zone $2) at time zone $2)
    order by o.created_at desc limit 100`, [restaurant.id, restaurant.timezone]);
  // Only owners see and manage staff; managers get an empty list.
  const staff = restaurant.role === "owner"
    ? await deps.db.asUser<NonNullable<OwnerDashboardSnapshot["staff"]>[number]>(userId, "select id, email, role, status from owner_staff($1)", [restaurant.id])
    : [];
  const snapshot: OwnerDashboardSnapshot = { restaurantId: restaurant.id, restaurantName: restaurant.name, timezone: restaurant.timezone,
    role: restaurant.role, restaurants: restaurants.map(({ id, name }) => ({ id, name })),
    acceptedOrderValueCents: value?.cents ?? 0, paidTodayCents: value?.paid ?? 0, tables: mapped, menu, orders, staff };
  return Response.json({ restaurantId: restaurant.id, snapshot });
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/owner/report?restaurant=&from=YYYY-MM-DD&to=YYYY-MM-DD — sales by day and top dishes, restaurant time zone, `to` inclusive. */
export async function ownerReport(req: Request, deps: Deps): Promise<Response> {
  const userId = await user(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { restaurant } = await ownedRestaurants(req, userId, deps);
  if (!restaurant) return Response.json({ error: "forbidden" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const from = params.get("from") ?? "", to = params.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) {
    return Response.json({ error: "invalid_range" }, { status: 400 });
  }
  const range = `o.restaurant_id = $1 and o.status not in ('cancelled','rejected')
    and o.created_at >= ($2::date::timestamp at time zone $4) and o.created_at < (($3::date + 1)::timestamp at time zone $4)`;
  const args = [restaurant.id, from, to, restaurant.timezone];
  const days = await deps.db.asUser<OwnerReport["days"][number]>(userId, `
    select to_char(o.created_at at time zone $4, 'YYYY-MM-DD') "day", count(*)::int orders,
      sum(o.total_cents)::int "totalCents", coalesce(sum(o.tip_cents), 0)::int "tipCents",
      coalesce(sum(o.total_cents) filter (where o.payment_status = 'paid'), 0)::int "paidCents"
    from orders o where ${range} group by 1 order by 1`, args);
  const topItems = await deps.db.asUser<OwnerReport["topItems"][number]>(userId, `
    select oi.name_snapshot "name", sum(oi.quantity)::int quantity, sum(oi.quantity * oi.unit_price_cents)::int "totalCents"
    from order_items oi join orders o on o.restaurant_id = oi.restaurant_id and o.id = oi.order_id
    where ${range} group by 1 order by 2 desc, 1 limit 20`, args);
  const report: OwnerReport = { from, to, days, topItems };
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}

const PERIOD_DAYS = { today: 1, "7d": 7, "30d": 30 } as const;

/** GET /api/owner/stats?restaurant=&period=today|7d|30d — QR order count and value (excl. tips, cancelled, rejected),
 * a per-hour (today) or per-day chart and top dishes, in the restaurant's time zone. */
export async function ownerStats(req: Request, deps: Deps): Promise<Response> {
  const userId = await user(req, deps);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { restaurant } = await ownedRestaurants(req, userId, deps);
  if (!restaurant) return Response.json({ error: "forbidden" }, { status: 403 });
  const period = new URL(req.url).searchParams.get("period") ?? "today";
  if (!Object.hasOwn(PERIOD_DAYS, period)) return Response.json({ error: "invalid_period" }, { status: 400 });
  const days = PERIOD_DAYS[period as OwnerStats["period"]];
  const unit = period === "today" ? "hour" : "day";
  const start = "(date_trunc('day', now() at time zone $2) - ($3::int - 1) * interval '1 day')";
  const where = `o.restaurant_id = $1 and o.status not in ('cancelled','rejected') and o.created_at >= (${start} at time zone $2)`;
  const args = [restaurant.id, restaurant.timezone, days];
  // Today's chart starts at the first order's hour; 7 and 30 days show every day, empty ones as 0.
  const series = await deps.db.asUser<OwnerStats["series"][number] & { valueCents: number }>(userId, `
    with o as (select date_trunc($4, o.created_at at time zone $2) b, o.total_cents from orders o where ${where}),
    s as (select generate_series(case when $4 = 'hour' then coalesce((select min(b) from o), date_trunc('hour', now() at time zone $2)) else ${start} end,
      date_trunc($4, now() at time zone $2), ('1 ' || $4)::interval) b)
    select to_char(s.b, case when $4 = 'hour' then 'HH24:MI' else 'YYYY-MM-DD' end) "label", count(o.b)::int orders,
      coalesce(sum(o.total_cents), 0)::int "valueCents"
    from s left join o on o.b = s.b group by s.b order by s.b`, [...args, unit]);
  const topItems = await deps.db.asUser<OwnerStats["topItems"][number]>(userId, `
    select oi.name_snapshot "name", sum(oi.quantity)::int quantity
    from order_items oi join orders o on o.restaurant_id = oi.restaurant_id and o.id = oi.order_id
    where ${where} group by 1 order by 2 desc, 1 limit 5`, args);
  const byTable = await deps.db.asUser<OwnerStats["byTable"][number]>(userId, `
    select t.label "table", count(*)::int orders, sum(o.total_cents)::int "valueCents", sum(o.tip_cents)::int "tipCents"
    from orders o join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
    where ${where} group by t.label order by 3 desc, 1`, args);
  const stats: OwnerStats = { period: period as OwnerStats["period"],
    orders: series.reduce((n, b) => n + b.orders, 0), valueCents: series.reduce((n, b) => n + b.valueCents, 0),
    tipCents: byTable.reduce((n, t) => n + t.tipCents, 0),
    series: series.map(({ label, orders }) => ({ label, orders })), topItems, byTable };
  return Response.json(stats, { headers: { "cache-control": "no-store" } });
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
      "select update_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9)", [command.itemId, command.name, command.description, command.priceCents, command.imageUrl ?? "", command.dietaryTags, command.available, command.soldOut, command.allergens ?? null]);
    else if (command.action === "createItem") await deps.db.asUser(userId, "select create_menu_item($1,$2,$3,$4)", [command.menuId, command.name, command.description, command.priceCents]);
    else if (command.action === "createCategory") await deps.db.asUser(userId, "select create_menu_category($1,$2)", [command.restaurantId, command.name]);
    else if (command.action === "addOption") await deps.db.asUser(userId, "select add_menu_item_option($1,$2,$3)", [command.itemId, command.label, command.priceCents]);
    else if (command.action === "deleteOption") await deps.db.asUser(userId, "select delete_menu_item_option($1)", [command.optionId]);
    else if (command.action === "setStation") await deps.db.asUser(userId, "select set_menu_station($1,$2)", [command.menuId, command.station]);
    else if (command.action === "setStaffStatus") await deps.db.asUser(userId, "select set_staff_status($1,$2)", [command.membershipId, command.status]);
    else if (command.action === "inviteStaff") {
      // Check ownership before touching auth, so non-owners can't use this to create accounts.
      const [{ ok }] = await deps.db.asUser<{ ok: boolean }>(userId, "select is_member($1, array['owner']) ok", [command.restaurantId]);
      if (!ok) return Response.json({ error: "not_found" }, { status: 404 });
      const [found] = await deps.db.asService<{ id: string | null }>("select find_user_id($1) id", [command.email]);
      let staffId = found?.id ?? null;
      if (!staffId) {
        if (!deps.inviteUser) return Response.json({ error: "invites_not_configured" }, { status: 501 });
        staffId = await deps.inviteUser(command.email);
      }
      await deps.db.asUser(userId, "select upsert_staff_membership($1,$2,$3)", [command.restaurantId, staffId, command.role]);
    }
    else if (command.action === "open") await deps.db.asUser(userId, "select open_table_session($1)", [command.tableId]);
    else if (command.action === "close") await deps.db.asUser(userId, "select close_table_session($1)", [command.tableId]);
    else await deps.db.asUser(userId, "select rotate_table_qr($1)", [command.tableId]);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal";
    const conflict = ["SESSION_ALREADY_OPEN", "SESSION_ALREADY_CLOSED", "table_disabled"].find((code) => message.includes(code));
    if (conflict) return Response.json({ error: conflict }, { status: 409 });
    if (message.includes("not_found")) return Response.json({ error: "not_found" }, { status: 404 });
    if (/invalid_(item|label|role)|duplicate key/.test(message)) return Response.json({ error: "invalid_command" }, { status: 400 });
    // Anything else is a real fault (database down, bad migration): log it instead of pretending the row was missing.
    console.error("owner command failed", { action: command.action, error: message });
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
