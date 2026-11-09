import type { Deps } from "./deps.ts";

/** Lower bound of each period, in the restaurant's own timezone for "today". */
const PERIODS: Record<string, string> = {
  today: "date_trunc('day', now() at time zone r.timezone) at time zone r.timezone",
  "7d": "now() - interval '7 days'",
  "30d": "now() - interval '30 days'",
};

export type OwnerStats = {
  restaurant: string;
  /** These figures cover orders placed through Sora's QR menu only, never the restaurant's total sales. */
  scope: "qr_orders_only";
  orders: number;
  revenueCents: number;
  averageOrderCents: number;
  vatCents: number;
  rejectedOrCancelled: number;
  avgPrepMinutes: number | null;
  topItems: { name: string; quantity: number; revenueCents: number }[];
  busiestHours: { hour: number; orders: number }[];
};

/** GET /api/owner/stats?period=today|7d|30d  for owners and managers; RLS limits every row to their restaurant. */
export async function ownerStats(req: Request, deps: Deps): Promise<Response> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await deps.verifyStaffToken(bearer) : null;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const period = new URL(req.url).searchParams.get("period") ?? "today";
  const since = PERIODS[period];
  if (!since) return Response.json({ error: "invalid_period" }, { status: 400 });

  const [row] = await deps.db.asUser<{ s: OwnerStats | null }>(
    userId,
    `with r as (
       select id, name, timezone from restaurants
       where is_member(id, array['owner', 'manager']) order by name limit 1),
     o as (
       select o.* from orders o, r where o.restaurant_id = r.id and o.created_at >= ${since}),
     kept as (select * from o where status not in ('rejected', 'cancelled'))
     select case when exists (select 1 from r) then jsonb_build_object(
       'restaurant', (select name from r),
       'scope', 'qr_orders_only',
       'orders', (select count(*) from kept),
       'revenueCents', (select coalesce(sum(total_cents), 0) from kept),
       'averageOrderCents', (select coalesce(round(avg(total_cents)), 0) from kept),
       'vatCents', (select coalesce(sum(vat_cents), 0) from kept),
       'rejectedOrCancelled', (select count(*) from o where status in ('rejected', 'cancelled')),
       'avgPrepMinutes', (select round(avg(extract(epoch from rd.created_at - st.created_at)) / 60)
                          from kept k
                          join order_events st on st.order_id = k.id and st.to_status = 'accepted'
                          join order_events rd on rd.order_id = k.id and rd.to_status = 'ready'),
       'topItems', (select coalesce(jsonb_agg(x), '[]') from (
                      select i.name_snapshot as name, sum(i.quantity)::int as quantity,
                             sum(i.quantity * i.unit_price_cents)::int as "revenueCents"
                      from order_items i join kept k on k.id = i.order_id
                      group by i.name_snapshot order by 2 desc, 1 limit 5) x),
       'busiestHours', (select coalesce(jsonb_agg(x), '[]') from (
                      select extract(hour from k.created_at at time zone (select timezone from r))::int as hour,
                             count(*)::int as orders
                      from kept k group by 1 order by 2 desc, 1 limit 3) x)
     ) end as s`,
  );
  if (!row?.s) return Response.json({ error: "forbidden" }, { status: 403 });
  return Response.json(row.s, { headers: { "cache-control": "no-store" } });
}
