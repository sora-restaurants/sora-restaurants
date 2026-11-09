-- Phase 0 home simulator schema.
-- Invariants: every row carries tenant_id; child rows reference parents by (tenant_id, id) so
-- cross-tenant links are impossible; money is integer cents; customers act only through
-- SECURITY DEFINER functions keyed by opaque tokens; staff read through RLS.

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended')),
  timezone text not null default 'Africa/Johannesburg',
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  created_at timestamptz not null default now()
);

create table staff_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null,
  role text not null check (role in ('owner', 'manager', 'kitchen', 'waiter')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  unique (tenant_id, user_id)
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  label text not null,
  active boolean not null default true,
  -- Opaque capability in the QR URL; rotate by updating this column.
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  unique (tenant_id, label),
  unique (tenant_id, id)
);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  sort_order int not null default 0,
  available boolean not null default true,
  unique (tenant_id, id)
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  category_id uuid not null,
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents >= 0),
  available boolean not null default true,
  sort_order int not null default 0,
  unique (tenant_id, id),
  foreign key (tenant_id, category_id) references menu_categories(tenant_id, id)
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  table_id uuid not null,
  public_ref text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'accepted', 'preparing', 'ready', 'served', 'rejected', 'cancelled')),
  subtotal_cents int not null check (subtotal_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  source text not null default 'qr' check (source = 'qr'),
  status_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, table_id) references tables(tenant_id, id)
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid not null,
  name_snapshot text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity int not null check (quantity between 1 and 50),
  notes text not null default '' check (length(notes) <= 200),
  foreign key (tenant_id, order_id) references orders(tenant_id, id),
  foreign key (tenant_id, menu_item_id) references menu_items(tenant_id, id)
);

create table order_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  order_id uuid not null,
  from_status text,
  to_status text not null,
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, order_id) references orders(tenant_id, id)
);

create table waiter_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  table_id uuid not null,
  status text not null default 'open' check (status in ('open', 'acknowledged')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  foreign key (tenant_id, table_id) references tables(tenant_id, id)
);

create table print_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  order_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'printed', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, order_id) references orders(tenant_id, id)
);

create table idempotency_keys (
  tenant_id uuid not null references tenants(id),
  key text not null check (length(key) between 8 and 100),
  request_hash text not null,
  order_id uuid,
  created_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ---------- Row-level security: staff read their own tenant only ----------

create function is_member(p_tenant uuid, p_roles text[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_memberships m
    join tenants t on t.id = m.tenant_id and t.status = 'active'
    where m.tenant_id = p_tenant and m.user_id = auth.uid() and m.status = 'active'
      and (p_roles is null or m.role = any(p_roles))
  )
$$;

do $$
declare t text;
begin
  foreach t in array array['tenants','staff_memberships','tables','menu_categories','menu_items',
    'orders','order_items','order_events','waiter_calls','print_jobs','idempotency_keys'] loop
    execute format('alter table %I enable row level security', t);
    if t = 'tenants' then
      execute 'create policy staff_read on tenants for select to authenticated using (is_member(id))';
    elsif t <> 'idempotency_keys' then
      execute format('create policy staff_read on %I for select to authenticated using (is_member(tenant_id))', t);
    end if;
  end loop;
end $$;

-- ---------- Customer commands (server calls these with the service role) ----------

create function get_table_menu(p_table_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', t.name,
    'table', tb.label,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'items', (
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name,
          'description', i.description, 'priceCents', i.price_cents) order by i.sort_order, i.name), '[]')
        from menu_items i where i.tenant_id = c.tenant_id and i.category_id = c.id and i.available
      )) order by c.sort_order, c.name)
      from menu_categories c where c.tenant_id = t.id and c.available
    ), '[]'))
  from tables tb join tenants t on t.id = tb.tenant_id
  where tb.qr_token = p_table_token and tb.active and t.status = 'active'
$$;

-- p_items: [{"menuItemId": uuid, "quantity": int, "notes": text}]
-- Returns {statusToken, publicRef} or raises with a stable error code in the message.
create function submit_order(p_table_token text, p_idempotency_key text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table tables;
  v_hash text := md5(p_items::text);
  v_key idempotency_keys;
  v_order orders;
  v_line jsonb;
  v_item menu_items;
  v_qty int;
  v_subtotal int := 0;
begin
  select tb.* into v_table from tables tb join tenants t on t.id = tb.tenant_id
    where tb.qr_token = p_table_token and tb.active and t.status = 'active';
  if not found then raise exception 'table_not_found'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items';
  end if;

  -- The insert blocks a concurrent duplicate until this transaction ends, so only one order is created.
  insert into idempotency_keys (tenant_id, key, request_hash) values (v_table.tenant_id, p_idempotency_key, v_hash)
    on conflict do nothing;
  if not found then
    select * into v_key from idempotency_keys where tenant_id = v_table.tenant_id and key = p_idempotency_key;
    if v_key.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    select * into v_order from orders where id = v_key.order_id;
    return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', true);
  end if;

  insert into orders (tenant_id, table_id, public_ref, subtotal_cents, total_cents)
    values (v_table.tenant_id, v_table.id, upper(substr(md5(gen_random_uuid()::text), 1, 6)), 0, 0)
    returning * into v_order;

  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'invalid_items'; end if;
    select i.* into v_item from menu_items i join menu_categories c on c.tenant_id = i.tenant_id and c.id = i.category_id
      where i.tenant_id = v_table.tenant_id and i.id = (v_line->>'menuItemId')::uuid and i.available and c.available;
    if not found then raise exception 'item_unavailable'; end if;
    insert into order_items (tenant_id, order_id, menu_item_id, name_snapshot, unit_price_cents, quantity, notes)
      values (v_table.tenant_id, v_order.id, v_item.id, v_item.name, v_item.price_cents, v_qty,
              left(coalesce(v_line->>'notes', ''), 200));
    v_subtotal := v_subtotal + v_item.price_cents * v_qty;
  end loop;

  update orders set subtotal_cents = v_subtotal, total_cents = v_subtotal where id = v_order.id;
  update idempotency_keys set order_id = v_order.id where tenant_id = v_table.tenant_id and key = p_idempotency_key;
  insert into order_events (tenant_id, order_id, to_status) values (v_table.tenant_id, v_order.id, 'submitted');
  insert into print_jobs (tenant_id, order_id) values (v_table.tenant_id, v_order.id);

  return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', false);
end $$;

create function get_order_status(p_status_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('publicRef', o.public_ref, 'status', o.status, 'totalCents', o.total_cents,
    'updatedAt', o.updated_at, 'items', (
      select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity) order by oi.name_snapshot)
      from order_items oi where oi.order_id = o.id))
  from orders o where o.status_token = p_status_token
$$;

create function call_waiter(p_table_token text) returns void
language plpgsql security definer set search_path = public as $$
declare v_table tables;
begin
  select tb.* into v_table from tables tb join tenants t on t.id = tb.tenant_id
    where tb.qr_token = p_table_token and tb.active and t.status = 'active';
  if not found then raise exception 'table_not_found'; end if;
  -- One open call per table is enough; repeated taps do not spam staff.
  if not exists (select 1 from waiter_calls where table_id = v_table.id and status = 'open') then
    insert into waiter_calls (tenant_id, table_id) values (v_table.tenant_id, v_table.id);
  end if;
end $$;

-- ---------- Staff commands (called with the staff member's own session) ----------

create function advance_order(p_order_id uuid, p_to_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.tenant_id, array['owner','manager','kitchen']) then
    raise exception 'not_found';
  end if;
  if not (v_order.status, p_to_status) in (
    ('submitted','accepted'), ('submitted','rejected'), ('accepted','preparing'), ('accepted','cancelled'),
    ('preparing','ready'), ('ready','served')) then
    raise exception 'invalid_transition';
  end if;
  update orders set status = p_to_status, updated_at = now() where id = p_order_id;
  insert into order_events (tenant_id, order_id, from_status, to_status, actor_user_id)
    values (v_order.tenant_id, p_order_id, v_order.status, p_to_status, auth.uid());
end $$;

create function acknowledge_waiter_call(p_call_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_call waiter_calls;
begin
  select * into v_call from waiter_calls where id = p_call_id for update;
  if not found or not is_member(v_call.tenant_id) then raise exception 'not_found'; end if;
  update waiter_calls set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid()
    where id = p_call_id and status = 'open';
end $$;

-- Used by staff (retry) and later by the printer bridge (report result).
create function set_print_job_status(p_job_id uuid, p_status text, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_job print_jobs;
begin
  select * into v_job from print_jobs where id = p_job_id for update;
  if not found or not is_member(v_job.tenant_id) then raise exception 'not_found'; end if;
  if p_status not in ('pending','printed','failed') then raise exception 'invalid_status'; end if;
  update print_jobs set status = p_status, last_error = left(p_error, 500), updated_at = now(),
    attempts = attempts + case when p_status = 'pending' then 0 else 1 end
    where id = p_job_id;
end $$;

-- Functions default to PUBLIC execute; lock them down explicitly.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function get_table_menu, submit_order, get_order_status, call_waiter to service_role;
grant execute on function advance_order, acknowledge_waiter_call, set_print_job_status, is_member to authenticated;
