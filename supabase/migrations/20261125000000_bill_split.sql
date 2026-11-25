-- Split a table's bill into shares (evenly, and/or by who had what) that the waiter collects one by one at the
-- card machine, till or cash. Pay-after only: there is no payment provider, so nothing here takes money.
-- Staff mark each share paid; the table's orders become paid when the last share is.

alter table orders add column bill_split_id uuid;

create table bill_shares (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  table_session_id uuid not null,
  split_id uuid not null,
  share_no int not null,
  ways int not null check (ways between 2 and 12),
  amount_cents int not null check (amount_cents >= 0),
  items jsonb not null default '[]', -- dishes this person had, for their phone and the waiter
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz not null default now(),
  unique (split_id, share_no),
  check (share_no between 1 and ways),
  foreign key (restaurant_id, table_session_id) references table_sessions(restaurant_id, id)
);
create index bill_shares_session on bill_shares (table_session_id);
alter table bill_shares enable row level security;
create policy staff_read on bill_shares for select to authenticated using (is_member(restaurant_id));
revoke all on bill_shares from anon, authenticated;
grant select on bill_shares to authenticated;

-- Orders in a session still to collect and not yet in a split.
create function bill_open_orders(p_session_id uuid) returns setof orders
language sql stable security definer set search_path = public as $$
  select * from orders where table_session_id = p_session_id and payment_status = 'unpaid'
    and status not in ('rejected', 'cancelled') and bill_split_id is null
$$;

-- p_assign maps order_item id -> share number (1..p_ways). Each share pays its own dishes plus an even part of
-- everything unassigned (shared dishes and tips). Integer cents; the leftover cents go to shares 1, 2, ... so the
-- shares always add up to the bill exactly. Callers lock the session row first.
create function split_bill(p_session table_sessions, p_ways int, p_assign jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_split uuid := gen_random_uuid();
  v_total bigint; v_rest bigint; v_line record; v_k int;
  v_own bigint[]; v_items jsonb[];
begin
  if p_ways is null or p_ways not between 2 and 12 then raise exception 'invalid'; end if;
  p_assign := coalesce(p_assign, '{}');
  if jsonb_typeof(p_assign) <> 'object' then raise exception 'invalid'; end if;

  -- A split nobody has paid towards can be redone; once a share is paid it stays until the rest is collected.
  for v_line in select split_id, bool_or(paid_at is not null) any_paid from bill_shares
      where table_session_id = p_session.id group by split_id having bool_or(paid_at is null) loop
    if v_line.any_paid then raise exception 'split_locked'; end if;
    update orders set bill_split_id = null where bill_split_id = v_line.split_id;
    delete from bill_shares where split_id = v_line.split_id;
  end loop;

  select coalesce(sum(total_cents + tip_cents), 0) into v_total from bill_open_orders(p_session.id);
  if v_total = 0 then raise exception 'nothing_to_split'; end if;

  if exists (select 1 from jsonb_each_text(p_assign) a
      where (case when a.value ~ '^[0-9]{1,2}$' then a.value::int else 0 end) not between 1 and p_ways)
    or (select count(*) from jsonb_object_keys(p_assign)) <> (select count(*) from jsonb_each_text(p_assign) a
      join order_items oi on oi.id::text = a.key join bill_open_orders(p_session.id) o on o.id = oi.order_id)
  then raise exception 'invalid'; end if;

  v_own := array_fill(0::bigint, array[p_ways]);
  v_items := array_fill('[]'::jsonb, array[p_ways]);
  for v_line in select a.value::int k, oi.name_snapshot, oi.quantity, oi.unit_price_cents::bigint * oi.quantity cents
      from jsonb_each_text(p_assign) a join order_items oi on oi.id::text = a.key order by oi.name_snapshot loop
    v_own[v_line.k] := v_own[v_line.k] + v_line.cents;
    v_items[v_line.k] := v_items[v_line.k] || jsonb_build_object('name', v_line.name_snapshot, 'quantity', v_line.quantity, 'cents', v_line.cents);
  end loop;

  v_rest := v_total - (select sum(x) from unnest(v_own) x);
  for v_k in 1..p_ways loop
    insert into bill_shares (restaurant_id, table_session_id, split_id, share_no, ways, amount_cents, items)
      values (p_session.restaurant_id, p_session.id, v_split, v_k, p_ways,
              v_own[v_k] + v_rest / p_ways + case when v_k <= v_rest % p_ways then 1 else 0 end, v_items[v_k]);
  end loop;
  update orders set bill_split_id = v_split where id in (select id from bill_open_orders(p_session.id));
  return v_split;
end $$;

-- Waiter splits the open bill of a table (evenly, or with an item map).
create function staff_split_bill(p_table_id uuid, p_ways int, p_assign jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_session table_sessions;
begin
  select * into v_session from table_sessions where table_id = p_table_id and status = 'open' for update;
  if not found or not is_member(v_session.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  return split_bill(v_session, p_ways, p_assign);
end $$;

-- A guest splits their table's open bill from their phone; their order's unguessable status token is the key.
create function guest_split_bill(p_status_token text, p_ways int, p_assign jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_session table_sessions;
begin
  select s.* into v_session from orders o join table_sessions s on s.id = o.table_session_id
    where o.status_token = p_status_token and s.status = 'open' for update of s;
  if not found then raise exception 'not_found'; end if;
  return split_bill(v_session, p_ways, p_assign);
end $$;

create function mark_share_paid(p_share_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_share bill_shares;
begin
  select * into v_share from bill_shares where id = p_share_id;
  if not found or not is_member(v_share.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  -- Lock the whole split so two waiters settling the last two shares can't both miss "all paid".
  perform 1 from bill_shares where split_id = v_share.split_id for update;
  update bill_shares set paid_at = now(), paid_by = auth.uid() where id = p_share_id and paid_at is null;
  if not exists (select 1 from bill_shares where split_id = v_share.split_id and paid_at is null) then
    update orders set payment_status = 'paid', paid_at = now(), updated_at = now()
      where bill_split_id = v_share.split_id and payment_status = 'unpaid';
  end if;
end $$;

-- A split order is collected share by share, not as a whole.
create or replace function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','waiter']) then raise exception 'not_found'; end if;
  if v_order.status in ('cancelled', 'rejected') or (v_order.bill_split_id is not null and v_order.payment_status = 'unpaid')
    then raise exception 'not_payable'; end if;
  update orders set payment_status = 'paid', paid_at = now(), updated_at = now() where id = p_order_id and payment_status = 'unpaid';
end $$;

-- The guest's bill: every share at their table, what is not yet split, and the dishes a new split would cover
-- (unsplit, or in a split nobody has paid towards yet) so the guest can say who had what.
create function get_table_bill(p_status_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shares', coalesce((select jsonb_agg(jsonb_build_object('shareNo', b.share_no, 'ways', b.ways,
        'amountCents', b.amount_cents, 'paid', b.paid_at is not null, 'items', b.items) order by b.created_at, b.share_no)
      from bill_shares b where b.table_session_id = s.id), '[]'),
    'openCents', (select coalesce(sum(total_cents + tip_cents), 0) from bill_open_orders(s.id)),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', oi.id, 'name', oi.name_snapshot, 'quantity', oi.quantity,
        'cents', oi.unit_price_cents * oi.quantity) order by oi.name_snapshot)
      from order_items oi join orders o on o.id = oi.order_id
      where o.table_session_id = s.id and o.payment_status = 'unpaid' and o.status not in ('rejected', 'cancelled')
        and (o.bill_split_id is null or not exists (select 1 from bill_shares b where b.split_id = o.bill_split_id and b.paid_at is not null))), '[]'))
  from orders o join table_sessions s on s.id = o.table_session_id
  where o.status_token = p_status_token and s.status = 'open'
$$;

revoke execute on function bill_open_orders, split_bill, staff_split_bill, guest_split_bill, mark_share_paid, get_table_bill from public, anon, authenticated;
grant execute on function staff_split_bill, mark_share_paid to authenticated;
grant execute on function guest_split_bill, get_table_bill to service_role;
