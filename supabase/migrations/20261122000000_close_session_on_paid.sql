-- Paying ends the guest's visit: once nothing in the table session is left to collect, the session closes,
-- so the next scan of that QR starts fresh instead of joining the previous guest's session.
create or replace function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  update orders set payment_status = 'paid', paid_at = now(), updated_at = now() where id = p_order_id;
  -- Lock the table row like submit_order does, so a racing checkout cannot slip in after the check.
  perform 1 from tables where id = v_order.table_id for update;
  update table_sessions set status = 'closed', closed_at = now(), closed_by = auth.uid()
    where id = v_order.table_session_id and status = 'open'
      and not exists (select 1 from orders o where o.table_session_id = v_order.table_session_id
                        and o.payment_status = 'unpaid' and o.status not in ('rejected', 'cancelled'));
end $$;

-- The guest's phone polls this; paymentStatus lets it switch to the "Paid, thank you" end state.
create or replace function get_order_status(p_status_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('publicRef', o.public_ref, 'status', o.status, 'paymentStatus', o.payment_status,
    'totalCents', o.total_cents, 'updatedAt', o.updated_at, 'items', (
      select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity) order by oi.name_snapshot)
      from order_items oi where oi.order_id = o.id))
  from orders o where o.status_token = p_status_token
$$;
