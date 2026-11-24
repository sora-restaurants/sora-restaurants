-- Audit 2026-11: a QR token sits on a public table, so cap how fast one table session can place orders,
-- and stop staff marking cancelled orders paid or overwriting the original paid time.
create or replace function submit_order(p_table_token text, p_idempotency_key text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table tables; v_session table_sessions; v_hash text; v_key idempotency_keys; v_order orders;
  v_line jsonb; v_item menu_items; v_qty int; v_extra int; v_subtotal bigint := 0;
begin
  select tb.* into v_table from tables tb join restaurants t on t.id = tb.restaurant_id
    where tb.qr_token = p_table_token and tb.active and t.status = 'active' for update of tb;
  if not found then raise exception 'table_not_found'; end if;
  select * into v_session from table_sessions where table_id = v_table.id and status = 'open';
  if not found then raise exception 'TABLE_SESSION_NOT_ACTIVE'; end if;
  v_hash := md5(v_table.id::text || p_items::text);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then raise exception 'invalid_items'; end if;
  insert into idempotency_keys (restaurant_id, key, request_hash) values (v_table.restaurant_id, p_idempotency_key, v_hash) on conflict do nothing;
  if not found then
    select * into v_key from idempotency_keys where restaurant_id = v_table.restaurant_id and key = p_idempotency_key;
    if v_key.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    select * into v_order from orders where id = v_key.order_id;
    return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', true);
  end if;
  -- Replays above stay allowed; only new orders count. 10 per session per 5 minutes is far above a real table.
  if (select count(*) from orders where table_session_id = v_session.id and created_at > now() - interval '5 minutes') >= 10
    then raise exception 'rate_limited'; end if;
  insert into orders (restaurant_id, table_id, table_session_id, public_ref, subtotal_cents, total_cents)
    values (v_table.restaurant_id, v_table.id, v_session.id, upper(substr(md5(gen_random_uuid()::text), 1, 6)), 0, 0) returning * into v_order;
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'invalid_items'; end if;
    v_extra := coalesce((v_line->>'extraCents')::int, 0);
    if v_extra < 0 or v_extra > 100000 then raise exception 'invalid_items'; end if;
    select i.* into v_item from menu_items i join menus c on c.restaurant_id = i.restaurant_id and c.id = i.menu_id
      where i.restaurant_id = v_table.restaurant_id and i.id = (v_line->>'menuItemId')::uuid
        and i.available and not i.sold_out and c.available;
    if not found then raise exception 'item_unavailable'; end if;
    insert into order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes)
      values (v_table.restaurant_id, v_order.id, v_item.id, v_item.name, v_item.price_cents + v_extra, v_qty, left(coalesce(v_line->>'notes', ''), 200));
    v_subtotal := v_subtotal + (v_item.price_cents + v_extra)::bigint * v_qty;
    if v_subtotal > 100000000 then raise exception 'order_too_large'; end if;
  end loop;
  update orders o set subtotal_cents = v_subtotal, total_cents = v_subtotal,
    vat_cents = case when r.vat_registered then round(v_subtotal::numeric * r.vat_rate_bp / (10000 + r.vat_rate_bp))::int else 0 end
    from restaurants r where o.id = v_order.id and r.id = o.restaurant_id;
  update idempotency_keys set order_id = v_order.id where restaurant_id = v_table.restaurant_id and key = p_idempotency_key;
  insert into order_events (restaurant_id, order_id, to_status) values (v_table.restaurant_id, v_order.id, 'submitted');
  insert into print_jobs (restaurant_id, order_id) values (v_table.restaurant_id, v_order.id);
  return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', false);
end $$;

create or replace function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  if v_order.status in ('cancelled', 'rejected') then raise exception 'not_payable'; end if;
  -- A second tap is a no-op: keep the first paid_at for the cash-up.
  update orders set payment_status = 'paid', paid_at = now(), updated_at = now() where id = p_order_id and payment_status = 'unpaid';
end $$;
