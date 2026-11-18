-- Paid options (bacon, steak size...) are priced by the server: submit-order.ts computes extraCents per line
-- from its own option list, never from the client, and the order total includes them.
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

-- Checkout choices and payment status. "Pay now" in the app is a demo only, so nothing here marks an order
-- paid except staff (mark_order_paid); a real payment provider would call a confirm function later.
alter table orders
  add column payment_choice text not null default 'pay_later' check (payment_choice in ('pay_later', 'pay_now')),
  add column payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  add column paid_at timestamptz,
  add column tip_cents int not null default 0 check (tip_cents >= 0),
  add column split_ways int not null default 1 check (split_ways between 1 and 4);

-- The guest records their choices right after placing the order; the unguessable status token is the key.
create function set_order_checkout(p_status_token text, p_payment_choice text, p_tip_percent int, p_split_ways int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_payment_choice not in ('pay_later', 'pay_now') or p_tip_percent not in (0, 10, 15, 20) or p_split_ways not between 1 and 4
    then raise exception 'invalid'; end if;
  update orders set payment_choice = p_payment_choice, tip_cents = round(total_cents * p_tip_percent / 100.0)::int, split_ways = p_split_ways
    where status_token = p_status_token and payment_status = 'unpaid' and created_at > now() - interval '15 minutes';
  if not found then raise exception 'not_found'; end if;
end $$;

create function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  update orders set payment_status = 'paid', paid_at = now(), updated_at = now() where id = p_order_id;
end $$;

create view unpaid_orders with (security_invoker = true) as
  select id, restaurant_id, table_id, public_ref, status, total_cents + tip_cents as total_cents, payment_choice, created_at
  from orders where payment_status = 'unpaid' and status not in ('rejected', 'cancelled');

revoke execute on function set_order_checkout, mark_order_paid from public, anon;
grant execute on function set_order_checkout to service_role;
grant execute on function mark_order_paid to authenticated;
grant select on unpaid_orders to authenticated;

-- Owners add dishes to an existing category, and new categories.
create function create_menu_item(p_menu_id uuid, p_name text, p_description text, p_price_cents int) returns menu_items
language plpgsql security definer set search_path = public as $$
declare v_menu menus; v_item menu_items;
begin
  select * into v_menu from menus where id = p_menu_id;
  if not found or not is_member(v_menu.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 120 or length(p_description) > 500
     or p_price_cents < 0 or p_price_cents > 100000000 then raise exception 'invalid_item'; end if;
  insert into menu_items (restaurant_id, menu_id, name, description, price_cents, sort_order)
    values (v_menu.restaurant_id, p_menu_id, trim(p_name), trim(p_description), p_price_cents,
      (select coalesce(max(sort_order), 0) + 1 from menu_items where menu_id = p_menu_id)) returning * into v_item;
  return v_item;
end $$;

create function create_menu_category(p_restaurant_id uuid, p_name text) returns menus
language plpgsql security definer set search_path = public as $$
declare v_menu menus;
begin
  if not is_member(p_restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 80 then raise exception 'invalid_item'; end if;
  insert into menus (restaurant_id, name, sort_order)
    values (p_restaurant_id, trim(p_name), (select coalesce(max(sort_order), 0) + 1 from menus where restaurant_id = p_restaurant_id))
    returning * into v_menu;
  return v_menu;
end $$;

revoke execute on function create_menu_item, create_menu_category from public, anon;
grant execute on function create_menu_item, create_menu_category to authenticated;
