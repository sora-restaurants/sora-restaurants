import type { Deps, KitchenOrder } from "./deps.ts";

const ACTIVE = ["submitted", "accepted", "preparing", "ready"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PING_MS = 15_000;
// Vercel functions are finite-lived. Closing deliberately makes the client reconnect to a fresh
// snapshot instead of depending on a never-ending process that the host will eventually terminate.
const STREAM_WINDOW_MS = 25_000;
const MEMBER_SQL = "select is_member($1, array['owner','manager','kitchen']) ok";
// Re-read a short window behind the cursor so a transaction that committed late is not missed;
// rows already sent with the same updated_at are skipped.
const OVERLAP = "interval '5 seconds'";

const orderQuery = (condition: string) => `
  select o.id, o.public_ref, t.label, o.status, o.total_cents, o.created_at, o.updated_at, o.payment_choice, o.payment_status,
    coalesce((select json_agg(json_build_object('name', oi.name_snapshot, 'quantity', oi.quantity, 'notes', oi.notes,
                                'station', oi.station, 'prep', oi.prep_status)
                              order by oi.name_snapshot)
              from order_items oi where oi.order_id = o.id), '[]') items
  from orders o join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
  where o.restaurant_id = $1 and ${condition}
  order by o.created_at`;

// The status list is written into the SQL, not passed as a parameter: only then can Postgres prove the
// query matches idx_active_kitchen_orders' WHERE clause when it reuses a cached (generic) plan.
export const SNAPSHOT_SQL = orderQuery(`o.status in (${ACTIVE.map((s) => `'${s}'`).join(", ")})`);
// No status filter, so orders leaving the active set are seen; served by idx_orders_board_poll.
export const POLL_SQL = orderQuery(`o.updated_at > $2::timestamptz - ${OVERLAP}`);

type OrderRow = {
  id: string;
  public_ref: string;
  label: string;
  status: string;
  total_cents: number;
  created_at: Date;
  updated_at: Date;
  payment_choice: string;
  payment_status: string;
  items: KitchenOrder["items"] | string;
};

const toOrder = (r: OrderRow): KitchenOrder => ({
  id: r.id,
  publicRef: r.public_ref,
  table: r.label,
  status: r.status,
  totalCents: r.total_cents,
  createdAt: new Date(r.created_at).toISOString(),
  paid: r.payment_status === "paid",
  payAtTable: r.payment_choice === "pay_later" && r.payment_status !== "paid",
  items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
});

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Live board of one restaurant's active tickets, as Server-Sent Events. */
export async function kitchenStream(req: Request, restaurantId: string, deps: Deps): Promise<Response> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const userId = bearer ? await deps.verifyStaffToken(bearer) : null;
  if (!userId) return json(401, { error: "unauthorized" });
  if (!UUID.test(restaurantId)) return json(403, { error: "forbidden" });

  const asUser = <T,>(sql: string, params: unknown[]) => deps.db.asUser<T>(userId, sql, params);
  const [{ ok }] = await asUser<{ ok: boolean }>(MEMBER_SQL, [restaurantId]);
  if (!ok) return json(403, { error: "forbidden" });

  const encoder = new TextEncoder();
  let closed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let windowTimer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    closed = true;
    clearInterval(pollTimer);
    clearInterval(pingTimer);
    clearTimeout(windowTimer);
  };

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // Queries run as the staff user: even if the membership check above were wrong, RLS returns nothing.
      const [{ now }] = await asUser<{ now: Date }>("select now()", []);
      let cursor = new Date(now);
      const sent = new Map<string, number>(); // order id -> updated_at last sent
      const snapshot = await asUser<OrderRow>(SNAPSHOT_SQL, [restaurantId]);
      for (const row of snapshot) sent.set(row.id, new Date(row.updated_at).getTime());
      send("snapshot", { orders: snapshot.map(toOrder) });

      let polling = false;
      pollTimer = setInterval(async () => {
        if (polling || closed) return;
        polling = true;
        try {
          // Re-check every poll: RLS alone would just go quiet, leaving a deactivated tablet showing a frozen board.
          const [{ ok: stillMember }] = await asUser<{ ok: boolean }>(MEMBER_SQL, [restaurantId]);
          if (!stillMember) {
            send("revoked", { error: "forbidden" });
            stop();
            controller.close();
            return;
          }
          // No status filter here, so orders leaving the active set are seen and removed from the board.
          const rows = await asUser<OrderRow>(POLL_SQL, [
            restaurantId,
            cursor.toISOString(),
          ]);
          for (const row of rows) {
            const updated = new Date(row.updated_at).getTime();
            if (updated > cursor.getTime()) cursor = new Date(updated);
            if (sent.get(row.id) === updated) continue;
            if (ACTIVE.includes(row.status)) {
              sent.set(row.id, updated);
              send("order", toOrder(row));
            } else if (sent.delete(row.id)) {
              send("order_removed", { id: row.id, status: row.status });
            }
          }
        } catch (error) {
          if (!closed) {
            stop();
            controller.error(error);
          }
        } finally {
          polling = false;
        }
      }, deps.pollMs);
      pingTimer = setInterval(() => write(": ping\n\n"), PING_MS);
      windowTimer = setTimeout(() => {
        if (!closed) {
          stop();
          controller.close();
        }
      }, STREAM_WINDOW_MS);
    },
    cancel: stop,
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
