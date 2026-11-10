-- Dining sessions make a permanently enabled table temporarily orderable.
-- Checkout and session commands lock the same table row to serialize close vs submit.
create table table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_id uuid not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid not null,
  closed_by uuid,
  unique (restaurant_id, id),
  foreign key (restaurant_id, table_id) references tables(restaurant_id, id),
  check ((status = 'open' and closed_at is null and closed_by is null)
      or (status = 'closed' and closed_at is not null and closed_by is not null))
);
create unique index table_sessions_one_open_per_table on table_sessions (table_id) where status = 'open';

alter table orders add column table_session_id uuid;
alter table orders add constraint orders_table_session_fk
  foreign key (restaurant_id, table_session_id) references table_sessions(restaurant_id, id);

alter table table_sessions enable row level security;
create policy staff_read on table_sessions for select to authenticated using (is_member(restaurant_id));
revoke all on table_sessions from anon, authenticated;
grant select on table_sessions to authenticated;

create or replace function get_table_menu(p_table_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', t.name, 'table', tb.label,
    'orderingEnabled', exists(select 1 from table_sessions s where s.table_id = tb.id and s.status = 'open'),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'items', (
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name,
          'description', i.description, 'priceCents', i.price_cents) order by i.sort_order, i.name), '[]')
        from menu_items i where i.restaurant_id = c.restaurant_id and i.menu_id = c.id and i.available
      )) order by c.sort_order, c.name)
      from menus c where c.restaurant_id = t.id and c.available
    ), '[]'))
  from tables tb join restaurants t on t.id = tb.restaurant_id
  where tb.qr_token = p_table_token and tb.active and t.status = 'active'
$$;

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
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items';
  end if;
  insert into idempotency_keys (restaurant_id, key, request_hash) values (v_table.restaurant_id, p_idempotency_key, v_hash)
    on conflict do nothing;
  if not found then
    select * into v_key from idempotency_keys where restaurant_id = v_table.restaurant_id and key = p_idempotency_key;
    if v_key.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    select * into v_order from orders where id = v_key.order_id;
    return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', true);
  end if;
  insert into orders (restaurant_id, table_id, table_session_id, public_ref, subtotal_cents, total_cents)
    values (v_table.restaurant_id, v_table.id, v_session.id, upper(substr(md5(gen_random_uuid()::text), 1, 6)), 0, 0)
    returning * into v_order;
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'invalid_items'; end if;
    select i.* into v_item from menu_items i join menus c on c.restaurant_id = i.restaurant_id and c.id = i.menu_id
      where i.restaurant_id = v_table.restaurant_id and i.id = (v_line->>'menuItemId')::uuid and i.available and c.available;
    if not found then raise exception 'item_unavailable'; end if;
    insert into order_items (restaurant_id, order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes)
      values (v_table.restaurant_id, v_order.id, v_item.id, v_item.name, v_item.price_cents, v_qty,
              left(coalesce(v_line->>'notes', ''), 200));
    v_subtotal := v_subtotal + v_item.price_cents::bigint * v_qty;
    if v_subtotal > 100000000 then raise exception 'order_too_large'; end if;
  end loop;
  update orders o set subtotal_cents = v_subtotal, total_cents = v_subtotal,
    vat_cents = case when r.vat_registered
      then round(v_subtotal::numeric * r.vat_rate_bp / (10000 + r.vat_rate_bp))::int else 0 end
    from restaurants r where o.id = v_order.id and r.id = o.restaurant_id;
  update idempotency_keys set order_id = v_order.id where restaurant_id = v_table.restaurant_id and key = p_idempotency_key;
  insert into order_events (restaurant_id, order_id, to_status) values (v_table.restaurant_id, v_order.id, 'submitted');
  insert into print_jobs (restaurant_id, order_id) values (v_table.restaurant_id, v_order.id);
  return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', false);
end $$;

create function open_table_session(p_table_id uuid) returns table_sessions
language plpgsql security definer set search_path = public as $$
declare v_table tables; v_session table_sessions;
begin
  select * into v_table from tables where id = p_table_id for update;
  if not found or not is_member(v_table.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if not v_table.active then raise exception 'table_disabled'; end if;
  if exists(select 1 from table_sessions where table_id = p_table_id and status = 'open') then raise exception 'SESSION_ALREADY_OPEN'; end if;
  insert into table_sessions (restaurant_id, table_id, opened_by) values (v_table.restaurant_id, v_table.id, auth.uid()) returning * into v_session;
  return v_session;
end $$;

create function close_table_session(p_table_id uuid) returns table_sessions
language plpgsql security definer set search_path = public as $$
declare v_table tables; v_session table_sessions;
begin
  select * into v_table from tables where id = p_table_id for update;
  if not found or not is_member(v_table.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  select * into v_session from table_sessions where table_id = p_table_id and status = 'open';
  if not found then raise exception 'SESSION_ALREADY_CLOSED'; end if;
  update table_sessions set status = 'closed', closed_at = now(), closed_by = auth.uid()
    where id = v_session.id returning * into v_session;
  return v_session;
end $$;

create function rotate_table_qr(p_table_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_table tables; v_token text;
begin
  select * into v_table from tables where id = p_table_id for update;
  if not found or not is_member(v_table.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update tables set qr_token = v_token where id = p_table_id;
  return v_token;
end $$;

create function create_restaurant_table(p_restaurant_id uuid, p_label text) returns tables
language plpgsql security definer set search_path = public as $$
declare v_table tables;
begin
  if not is_member(p_restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if length(trim(p_label)) < 1 or length(trim(p_label)) > 80 then raise exception 'invalid_label'; end if;
  insert into tables (restaurant_id, label) values (p_restaurant_id, trim(p_label)) returning * into v_table;
  return v_table;
end $$;

revoke execute on function open_table_session, close_table_session, rotate_table_qr, create_restaurant_table from public, anon;
grant execute on function open_table_session, close_table_session, rotate_table_qr, create_restaurant_table to authenticated;
