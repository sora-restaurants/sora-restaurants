alter table menu_items add column image_url text;
alter table menu_items add column dietary_tags text[] not null default '{}';
alter table menu_items add column sold_out boolean not null default false;

create or replace function get_table_menu(p_table_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', t.name, 'theme', t.theme, 'table', tb.label,
    'orderingEnabled', exists(select 1 from table_sessions s where s.table_id = tb.id and s.status = 'open'),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'items', (
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name,
          'description', i.description, 'priceCents', i.price_cents, 'imageUrl', i.image_url,
          'dietaryTags', to_jsonb(i.dietary_tags), 'soldOut', i.sold_out) order by i.sort_order, i.name), '[]')
        from menu_items i where i.restaurant_id = c.restaurant_id and i.menu_id = c.id and i.available
      )) order by c.sort_order, c.name)
      from menus c where c.restaurant_id = t.id and c.available
    ), '[]'))
  from tables tb join restaurants t on t.id = tb.restaurant_id
  where tb.qr_token = p_table_token and tb.active and t.status = 'active'
$$;

create or replace function update_menu_item(
  p_item_id uuid, p_name text, p_description text, p_price_cents int,
  p_image_url text, p_dietary_tags text[], p_available boolean, p_sold_out boolean
) returns menu_items
language plpgsql security definer set search_path = public as $$
declare v_item menu_items;
begin
  select * into v_item from menu_items where id = p_item_id for update;
  if not found or not is_member(v_item.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 120 or length(p_description) > 500
     or p_price_cents < 0 or p_price_cents > 100000000 then raise exception 'invalid_item'; end if;
  update menu_items set name = trim(p_name), description = trim(p_description), price_cents = p_price_cents,
    image_url = nullif(trim(p_image_url), ''), dietary_tags = coalesce(p_dietary_tags, '{}'),
    available = p_available, sold_out = p_sold_out
    where id = p_item_id returning * into v_item;
  return v_item;
end $$;

revoke execute on function update_menu_item from public, anon;
grant execute on function update_menu_item to authenticated;

-- Sold-out dishes remain visible on the menu but cannot be ordered.
create or replace function submit_order(p_table_token text, p_idempotency_key text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table tables; v_session table_sessions; v_hash text; v_key idempotency_keys; v_order orders;
  v_line jsonb; v_item menu_items; v_qty int; v_subtotal bigint := 0;
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
    select i.* into v_item from menu_items i join menus c on c.restaurant_id = i.restaurant_id and c.id = i.menu_id
      where i.restaurant_id = v_table.restaurant_id and i.id = (v_line->>'menuItemId')::uuid
        and i.available and not i.sold_out and c.available;
    if not found then raise exception 'item_unavailable'; end if;
    insert into order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes)
      values (v_table.restaurant_id, v_order.id, v_item.id, v_item.name, v_item.price_cents, v_qty, left(coalesce(v_line->>'notes', ''), 200));
    v_subtotal := v_subtotal + v_item.price_cents::bigint * v_qty;
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
