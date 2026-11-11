-- Additive payment and service-request layer (Revision 6 + clarifications).
-- Does not alter submit_order, advance_order, kitchen_move, call_waiter,
-- the orders.status constraint, or kitchen SSE.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sora_definer') then
    create role sora_definer nologin noinherit;
  end if;
end $$;

grant execute on function public.is_member(uuid, text[]) to sora_definer;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  restaurant_id uuid not null,
  method text not null check (method in ('online', 'counter')),
  status text not null check (status in (
    'pending', 'awaiting_collection', 'succeeded', 'failed', 'cancelled', 'refunded'
  )),
  amount_cents int not null check (amount_cents >= 0),
  currency char(3) not null default 'ZAR' check (currency = 'ZAR'),
  is_simulated boolean not null default false,
  provider text,
  provider_reference text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, order_id) references public.orders (restaurant_id, id)
);

create table public.payment_audit (
  id bigint generated always as identity primary key,
  payment_id uuid not null,
  restaurant_id uuid not null,
  actor_user_id uuid,
  previous_status text,
  new_status text not null,
  amount_cents int,
  source text not null check (source in (
    'staff_counter_collection', 'demo_simulation', 'system_reconciliation'
  )),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, payment_id) references public.payments (restaurant_id, id)
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_id uuid not null,
  type text not null check (type in ('waiter', 'water', 'cutlery', 'bill', 'other')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'completed', 'cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  unique (restaurant_id, id),
  foreign key (restaurant_id, table_id) references public.tables (restaurant_id, id)
);

create table public.service_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  restaurant_id uuid not null,
  from_status text,
  to_status text not null,
  actor_user_id uuid,
  source text not null check (source in (
    'staff_counter_collection', 'demo_simulation', 'system_reconciliation'
  )),
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, request_id) references public.service_requests (restaurant_id, id)
);

create unique index payments_one_active
  on public.payments (restaurant_id, order_id)
  where status in ('pending', 'awaiting_collection', 'succeeded');

create unique index payments_idempotency
  on public.payments (restaurant_id, idempotency_key)
  where idempotency_key is not null;

create unique index payments_provider_ref
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

create unique index service_requests_one_open
  on public.service_requests (restaurant_id, table_id, type)
  where status = 'open';

alter table public.payments enable row level security;
alter table public.payment_audit enable row level security;
alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;

alter table public.payments force row level security;
alter table public.payment_audit force row level security;
alter table public.service_requests force row level security;
alter table public.service_request_events force row level security;

create policy staff_read on public.payments
  for select to authenticated using (public.is_member(restaurant_id));
create policy staff_read on public.payment_audit
  for select to authenticated using (public.is_member(restaurant_id));
create policy staff_read on public.service_requests
  for select to authenticated using (public.is_member(restaurant_id));
create policy staff_read on public.service_request_events
  for select to authenticated using (public.is_member(restaurant_id));

create policy definer_all on public.payments
  for all to sora_definer using (true) with check (true);
create policy definer_all on public.payment_audit
  for all to sora_definer using (true) with check (true);
create policy definer_all on public.service_requests
  for all to sora_definer using (true) with check (true);
create policy definer_all on public.service_request_events
  for all to sora_definer using (true) with check (true);

revoke all on public.payments, public.payment_audit,
  public.service_requests, public.service_request_events
  from public, anon, authenticated;
grant select on public.payments, public.payment_audit,
  public.service_requests, public.service_request_events to authenticated;

alter table public.payments owner to sora_definer;
alter table public.payment_audit owner to sora_definer;
alter table public.service_requests owner to sora_definer;
alter table public.service_request_events owner to sora_definer;

-- Minimum rights for sora_definer to read the parent order.
-- Order serialization uses pg_advisory_xact_lock, so UPDATE on orders is not granted.
-- No write access to orders. No access for anon. Authenticated keeps the existing staff_read policy only.
grant select on public.orders to sora_definer;
create policy definer_lock_orders on public.orders
  for select to sora_definer using (true);

-- is_member is SECURITY DEFINER owned by the migration role and already reads
-- staff_memberships / restaurants as that owner. sora_definer only needs EXECUTE.
grant execute on function public.is_member(uuid, text[]) to sora_definer;
