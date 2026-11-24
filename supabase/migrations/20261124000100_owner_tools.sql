-- Audit follow-up 2026-11: owner tools.
-- Allergens and owner-set paid options per dish, kitchen/bar station per category, one receipt per order,
-- and owner-managed staff memberships.

alter table menu_items add column allergens text[] not null default '{}';
alter table menus add column station text not null default 'kitchen' check (station in ('kitchen', 'bar'));
alter table orders add column receipt_sent_at timestamptz;

create table menu_item_options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  menu_item_id uuid not null,
  -- No commas: the guest's choices travel as a comma-separated note.
  label text not null check (length(label) between 1 and 60 and position(',' in label) = 0),
  price_cents int not null default 0 check (price_cents between 0 and 100000),
  sort_order int not null default 0,
  unique (menu_item_id, label),
  foreign key (restaurant_id, menu_item_id) references menu_items(restaurant_id, id) on delete cascade
);
alter table menu_item_options enable row level security;
create policy staff_read on menu_item_options for select to authenticated using (is_member(restaurant_id));
grant select on menu_item_options to authenticated;

create or replace function get_table_menu(p_table_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', t.name, 'theme', t.theme, 'table', tb.label,
    'orderingEnabled', exists(select 1 from table_sessions s where s.table_id = tb.id and s.status = 'open'),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'items', (
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name,
          'description', i.description, 'priceCents', i.price_cents, 'imageUrl', i.image_url,
          'dietaryTags', to_jsonb(i.dietary_tags), 'allergens', to_jsonb(i.allergens), 'soldOut', i.sold_out,
          'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'priceCents', o.price_cents)
                        order by o.sort_order, o.label), '[]') from menu_item_options o where o.menu_item_id = i.id)
        ) order by i.sort_order, i.name), '[]')
        from menu_items i where i.restaurant_id = c.restaurant_id and i.menu_id = c.id and i.available
      )) order by c.sort_order, c.name)
      from menus c where c.restaurant_id = t.id and c.available
    ), '[]'))
  from tables tb join restaurants t on t.id = tb.restaurant_id
  where tb.qr_token = p_table_token and tb.active and t.status = 'active'
$$;

drop function update_menu_item(uuid, text, text, int, text, text[], boolean, boolean);
create function update_menu_item(
  p_item_id uuid, p_name text, p_description text, p_price_cents int,
  p_image_url text, p_dietary_tags text[], p_available boolean, p_sold_out boolean, p_allergens text[] default null
) returns menu_items
language plpgsql security definer set search_path = public as $$
declare v_item menu_items;
begin
  select * into v_item from menu_items where id = p_item_id for update;
  if not found or not is_member(v_item.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if length(trim(p_name)) < 1 or length(trim(p_name)) > 120 or length(p_description) > 500
     or p_price_cents < 0 or p_price_cents > 100000000 or coalesce(array_length(p_allergens, 1), 0) > 14
     then raise exception 'invalid_item'; end if;
  update menu_items set name = trim(p_name), description = trim(p_description), price_cents = p_price_cents,
    image_url = nullif(trim(p_image_url), ''), dietary_tags = coalesce(p_dietary_tags, '{}'),
    allergens = coalesce(p_allergens, allergens), available = p_available, sold_out = p_sold_out
    where id = p_item_id returning * into v_item;
  return v_item;
end $$;

create function add_menu_item_option(p_item_id uuid, p_label text, p_price_cents int) returns menu_item_options
language plpgsql security definer set search_path = public as $$
declare v_item menu_items; v_option menu_item_options;
begin
  select * into v_item from menu_items where id = p_item_id;
  if not found or not is_member(v_item.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if length(trim(p_label)) < 1 or length(trim(p_label)) > 60 or position(',' in p_label) > 0
     or p_price_cents < 0 or p_price_cents > 100000 then raise exception 'invalid_item'; end if;
  insert into menu_item_options (restaurant_id, menu_item_id, label, price_cents, sort_order)
    values (v_item.restaurant_id, v_item.id, trim(p_label), p_price_cents,
      (select coalesce(max(sort_order), 0) + 1 from menu_item_options where menu_item_id = v_item.id))
    returning * into v_option;
  return v_option;
end $$;

create function delete_menu_item_option(p_option_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_option menu_item_options;
begin
  select * into v_option from menu_item_options where id = p_option_id;
  if not found or not is_member(v_option.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  delete from menu_item_options where id = p_option_id;
end $$;

create function set_menu_station(p_menu_id uuid, p_station text) returns void
language plpgsql security definer set search_path = public as $$
declare v_menu menus;
begin
  select * into v_menu from menus where id = p_menu_id;
  if not found or not is_member(v_menu.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if p_station not in ('kitchen', 'bar') then raise exception 'invalid_item'; end if;
  update menus set station = p_station where id = p_menu_id;
end $$;

-- True the first time only, so one order sends one receipt (stops receipts being used to spam an inbox).
create function claim_receipt(p_status_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update orders set receipt_sent_at = now() where status_token = p_status_token and receipt_sent_at is null;
  return found;
end $$;

-- Owners add staff (after the server has invited the auth user) and switch them on or off. Owners can't be changed here.
create function upsert_staff_membership(p_restaurant_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_restaurant_id, array['owner']) then raise exception 'not_found'; end if;
  if p_role not in ('manager', 'kitchen', 'waiter') or p_user_id = auth.uid() then raise exception 'invalid_role'; end if;
  insert into staff_memberships (restaurant_id, user_id, role) values (p_restaurant_id, p_user_id, p_role)
    on conflict (restaurant_id, user_id) do update set role = excluded.role, status = 'active'
    where staff_memberships.role <> 'owner';
end $$;

create function set_staff_status(p_membership_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_member staff_memberships;
begin
  select * into v_member from staff_memberships where id = p_membership_id for update;
  if not found or not is_member(v_member.restaurant_id, array['owner']) then raise exception 'not_found'; end if;
  if p_status not in ('active', 'inactive') or v_member.role = 'owner' then raise exception 'invalid_role'; end if;
  update staff_memberships set status = p_status where id = p_membership_id;
end $$;

revoke execute on function update_menu_item, add_menu_item_option, delete_menu_item_option, set_menu_station,
  claim_receipt, upsert_staff_membership, set_staff_status from public, anon;
grant execute on function update_menu_item, add_menu_item_option, delete_menu_item_option, set_menu_station,
  upsert_staff_membership, set_staff_status to authenticated;
grant execute on function claim_receipt to service_role;

-- submit_order: price owner-set options from the database.
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
    -- Dishes with owner-set options are priced only from those options, matched by label in the notes.
    if exists (select 1 from menu_item_options o where o.menu_item_id = v_item.id) then
      select coalesce(sum(o.price_cents), 0) into v_extra from menu_item_options o
        where o.menu_item_id = v_item.id and exists (
          select 1 from unnest(string_to_array(coalesce(v_line->>'notes', ''), ', ')) p
          where p = o.label or starts_with(p, o.label || ' (+'));
    end if;
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

-- Staff emails live in auth.users; these definer functions read them without opening that table to the API.
create function find_user_id(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

create function owner_staff(p_restaurant_id uuid) returns table (id uuid, email text, role text, status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_member(p_restaurant_id, array['owner']) then raise exception 'not_found'; end if;
  return query select m.id, u.email::text, m.role, m.status from staff_memberships m
    left join auth.users u on u.id = m.user_id where m.restaurant_id = p_restaurant_id order by m.role, u.email;
end $$;

revoke execute on function find_user_id, owner_staff from public, anon;
grant execute on function find_user_id to service_role;
grant execute on function owner_staff to authenticated;
