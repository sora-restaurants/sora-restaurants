-- The guest's receipt: line prices, tip and times on the same token-keyed order view. Existing keys are unchanged.
create or replace function get_order_status(p_status_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('publicRef', o.public_ref, 'status', o.status, 'paymentStatus', o.payment_status,
    'totalCents', o.total_cents, 'tipCents', o.tip_cents, 'createdAt', o.created_at, 'paidAt', o.paid_at,
    'updatedAt', o.updated_at, 'items', (
      select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity,
        'unitPriceCents', oi.unit_price_cents, 'notes', oi.notes) order by oi.name_snapshot)
      from order_items oi where oi.order_id = o.id))
  from orders o where o.status_token = p_status_token
$$;
