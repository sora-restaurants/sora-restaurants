import type { Deps } from "../deps.ts";

export type OrderEmail = { to: string; subject: string; html: string; text: string };

/** One implementation per provider (Resend planned). send must be safe to retry for the same order. */
export interface EmailSender {
  name: string;
  send(email: OrderEmail, idempotencyKey: string): Promise<void>;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const rand = (c: number) => `R ${(c / 100).toFixed(2).replace(".", ",")}`;

type Row = {
  id: string;
  to_address: string | null;
  o: {
    restaurant: string; table: string; publicRef: string; createdAt: string; totalCents: number; vatCents: number;
    vatRegistered: boolean; paymentChoice: string; paymentStatus: string;
    lines: { name: string; quantity: number; unitPriceCents: number; notes: string }[];
  };
};

/** The order summary. It is not a tax invoice: payment happens at the till, which issues that. */
export function renderOrderEmail(o: Row["o"], to: string): OrderEmail {
  const paid = o.paymentStatus === "paid" ? "Paid in the app." : "Please pay your waiter or at the till.";
  const lines = o.lines.map((l) => `${l.quantity} × ${l.name} — ${rand(l.unitPriceCents * l.quantity)}`);
  const vat = o.vatRegistered ? `Includes VAT of ${rand(o.vatCents)}.` : "";
  const text = [
    `Your order at ${o.restaurant} (${o.table}), reference ${o.publicRef}`,
    "",
    ...lines,
    "",
    `Total ${rand(o.totalCents)}. ${vat}`,
    paid,
    "",
    "This is a copy of your order, not a tax invoice.",
    "We only use your email address to send this copy and delete it after 30 days.",
  ].join("\n");
  const html = `<!doctype html><html lang="en-ZA"><body style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:16px;color:#1b1f2a">
<h1 style="font-size:20px">Your order at ${esc(o.restaurant)}</h1>
<p>${esc(o.table)} · reference <strong>${esc(o.publicRef)}</strong></p>
<table style="width:100%;border-collapse:collapse">${o.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 0">${l.quantity} × ${esc(l.name)}${l.notes ? `<br><small>${esc(l.notes)}</small>` : ""}</td><td style="text-align:right">${rand(l.unitPriceCents * l.quantity)}</td></tr>`,
    )
    .join("")}</table>
<p style="border-top:2px solid #1b1f2a;padding-top:8px"><strong>Total ${rand(o.totalCents)}</strong>${vat ? `<br><small>${esc(vat)}</small>` : ""}</p>
<p>${esc(paid)}</p>
<p style="color:#5b6170;font-size:12px">This is a copy of your order, not a tax invoice. We only use your email address to send this copy and delete it after 30 days.</p>
</body></html>`;
  return { to, subject: `Your order at ${o.restaurant} (${o.publicRef})`, html, text };
}

const MAX_ATTEMPTS = 8;

/** Sends due order emails; same claim/backoff pattern as the till sync. Never touches the order. */
export async function sendPendingEmails(deps: Deps, sender: EmailSender, limit = 20): Promise<{ sent: number; failed: number }> {
  const claimed = await deps.db.asService<{ id: string; order_id: string }>(
    `update email_jobs j set status = 'sending', attempts = attempts + 1, updated_at = now()
     where id in (
       select id from email_jobs
       where to_address is not null and ((status in ('pending', 'failed') and next_attempt_at <= now())
          or (status = 'sending' and updated_at < now() - interval '5 minutes'))
       order by created_at limit $1 for update skip locked)
     returning j.id, j.order_id`,
    [limit],
  );
  let sent = 0;
  let failed = 0;
  for (const job of claimed) {
    try {
      const [row] = await deps.db.asService<Row>(
        `select j.id, j.to_address, jsonb_build_object(
           'restaurant', r.name, 'table', t.label, 'publicRef', o.public_ref, 'createdAt', o.created_at,
           'totalCents', o.total_cents, 'vatCents', o.vat_cents, 'vatRegistered', r.vat_registered,
           'paymentChoice', o.payment_choice, 'paymentStatus', o.payment_status,
           'lines', (select jsonb_agg(jsonb_build_object('name', i.name_snapshot, 'quantity', i.quantity,
                       'unitPriceCents', i.unit_price_cents, 'notes', i.notes) order by i.name_snapshot)
                     from order_items i where i.order_id = o.id)) o
         from email_jobs j join orders o on o.id = j.order_id
         join restaurants r on r.id = o.restaurant_id
         join tables t on t.restaurant_id = o.restaurant_id and t.id = o.table_id
         where j.id = $1`,
        [job.id],
      );
      if (!row.to_address) throw new Error("address already deleted");
      await sender.send(renderOrderEmail(row.o, row.to_address), `order-${job.order_id}`);
      await deps.db.asService("update email_jobs set status = 'sent', last_error = null, updated_at = now() where id = $1", [job.id]);
      sent++;
    } catch (error) {
      await deps.db.asService(
        `update email_jobs set status = case when attempts >= ${MAX_ATTEMPTS} then 'dead' else 'failed' end,
           next_attempt_at = now() + least(300, power(2, attempts)) * interval '1 second',
           last_error = left($2, 500), updated_at = now() where id = $1`,
        [job.id, error instanceof Error ? error.message : String(error)],
      );
      failed++;
    }
  }
  return { sent, failed };
}
