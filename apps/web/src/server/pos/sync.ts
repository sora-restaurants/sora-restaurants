import type { Deps } from "../deps.ts";
import type { PosAdapter, PosOrder } from "./adapter.ts";

const MAX_ATTEMPTS = 8;
// A worker that crashed mid-send leaves a job in 'sending'; after this it is retried.
const STUCK_AFTER = "interval '5 minutes'";

/**
 * Sends due till jobs. Claims them with SKIP LOCKED so several workers never send the same job at once.
 * Failures back off exponentially (2 s, 4 s ... capped at 5 min) and stop after MAX_ATTEMPTS ('dead').
 */
export async function syncPendingOrders(deps: Deps, adapter: PosAdapter, limit = 20): Promise<{ sent: number; failed: number }> {
  const claimed = await deps.db.asService<{ id: string; order_id: string }>(
    `update pos_sync_jobs j set status = 'sending', attempts = attempts + 1, updated_at = now()
     where id in (
       select id from pos_sync_jobs
       where (status in ('pending', 'failed') and next_attempt_at <= now())
          or (status = 'sending' and updated_at < now() - ${STUCK_AFTER})
       order by created_at limit $1 for update skip locked)
     returning j.id, j.order_id`,
    [limit],
  );

  let sent = 0;
  let failed = 0;
  for (const job of claimed) {
    try {
      const [order] = await deps.db.asService<{ o: PosOrder }>(
        `select jsonb_build_object(
           'orderId', o.id, 'publicRef', o.public_ref, 'restaurant', r.name, 'table', t.label,
           'createdAt', o.created_at, 'totalCents', o.total_cents, 'vatCents', o.vat_cents,
           'lines', (select jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'quantity', i.quantity,
                      'unitPriceCents', i.unit_price_cents, 'notes', i.notes) order by i.name_snapshot)
                    from order_items i where i.order_id = o.id)) o
         from orders o
         join restaurants r on r.id = o.restaurant_id
         join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
         where o.id = $1`,
        [job.order_id],
      );
      const { externalRef } = await adapter.sendOrder(order.o);
      await deps.db.asService(
        "update pos_sync_jobs set status = 'sent', external_ref = $2, last_error = null, updated_at = now() where id = $1",
        [job.id, externalRef],
      );
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.db.asService(
        `update pos_sync_jobs set
           status = case when attempts >= ${MAX_ATTEMPTS} then 'dead' else 'failed' end,
           next_attempt_at = now() + least(300, power(2, attempts)) * interval '1 second',
           last_error = left($2, 500), updated_at = now()
         where id = $1`,
        [job.id, message],
      );
      failed++;
    }
  }
  return { sent, failed };
}
