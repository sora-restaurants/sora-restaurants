-- POS sync outbox. Every order gets a job in the same transaction that saves it; a worker sends jobs to the
-- restaurant's till through an adapter. The order never waits on, or fails because of, the till.

create table pos_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  external_ref text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references orders (restaurant_id, id)
);

create index pos_sync_due on pos_sync_jobs (next_attempt_at) where status in ('pending', 'failed', 'sending');

alter table pos_sync_jobs enable row level security;
create policy staff_read on pos_sync_jobs for select to authenticated using (is_member(restaurant_id));
grant select on pos_sync_jobs to authenticated;

create function queue_pos_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pos_sync_jobs (restaurant_id, order_id) values (new.restaurant_id, new.id);
  return new;
end $$;
revoke execute on function queue_pos_sync() from public, anon, authenticated;

create trigger orders_queue_pos_sync after insert on orders for each row execute function queue_pos_sync();
