-- Pay now / pay after dinner, the restaurant's payment policy, and an optional emailed copy of the order.
-- Pay-now orders wait in 'awaiting_payment' and reach the kitchen, the till and the printer only once paid.
-- There is no real payment provider yet: confirm_payment is called by the dev-only simulator now, and by a
-- signed provider webhook later.

alter table restaurants add column payment_policy text not null default 'customer_choice'
  check (payment_policy in ('customer_choice', 'pay_now_only', 'pay_later_only'));

alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('awaiting_payment', 'submitted', 'accepted', 'preparing', 'ready', 'served', 'rejected', 'cancelled'));
alter table orders
  add column payment_choice text not null default 'pay_later' check (payment_choice in ('pay_later', 'pay_now')),
  add column payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  add column paid_at timestamptz,
  -- POPIA: optional, used only to send this order's copy, cleared after 30 days by purge_customer_emails().
  add column customer_email text check (customer_email is null or length(customer_email) <= 254);

-- ---------- Email outbox (sending service added later) ----------

create table email_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null unique,
  to_address text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, order_id) references orders (restaurant_id, id)
);
create index email_jobs_due on email_jobs (next_attempt_at) where status in ('pending', 'failed', 'sending');
alter table email_jobs enable row level security; -- no staff policy: addresses are for the sender only

-- ---------- Work that starts when an order reaches the kitchen ----------

-- The till now gets an order when it reaches the kitchen, not when a pay-now order is still unpaid.
drop trigger orders_queue_pos_sync on orders;
create or replace function queue_pos_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    insert into pos_sync_jobs (restaurant_id, order_id) values (new.restaurant_id, new.id) on conflict (order_id) do nothing;
  end if;
  return new;
end $$;
create trigger orders_queue_pos_sync after insert or update of status on orders for each row execute function queue_pos_sync();

create function queue_order_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_email is not null and new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    insert into email_jobs (restaurant_id, order_id, to_address) values (new.restaurant_id, new.id, new.customer_email)
      on conflict (order_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function queue_order_email() from public, anon, authenticated;
create trigger orders_queue_email after insert or update of status on orders for each row execute function queue_order_email();

-- ---------- Checkout ----------

drop function submit_order(text, text, jsonb);

-- p_pay_now_available is decided by the server (is a payment provider configured?); only service_role calls this.
create function submit_order(p_table_token text, p_idempotency_key text, p_items jsonb,
  p_payment_choice text default 'pay_later', p_email text default null, p_pay_now_available boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table tables;
  v_policy text;
  v_hash text;
  v_key idempotency_keys;
  v_order orders;
  v_line jsonb;
  v_item menu_items;
  v_qty int;
  v_subtotal bigint := 0;
  v_status text;
begin
  select tb.* into v_table from tables tb join restaurants t on t.id = tb.restaurant_id
    where tb.qr_token = p_table_token and tb.active and t.status = 'active';
  if not found then raise exception 'table_not_found'; end if;
  select payment_policy into v_policy from restaurants where id = v_table.restaurant_id;

  if p_payment_choice not in ('pay_later', 'pay_now') then raise exception 'invalid_items'; end if;
  if (v_policy = 'pay_now_only' and p_payment_choice = 'pay_later')
     or (v_policy = 'pay_later_only' and p_payment_choice = 'pay_now') then
    raise exception 'payment_choice_not_allowed';
  end if;
  if p_payment_choice = 'pay_now' and not p_pay_now_available then raise exception 'pay_now_unavailable'; end if;

  -- Table and payment choice are part of the request, so a replay that changes either is a conflict.
  v_hash := md5(v_table.id::text || p_payment_choice || p_items::text);

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items';
  end if;

  insert into idempotency_keys (restaurant_id, key, request_hash) values (v_table.restaurant_id, p_idempotency_key, v_hash)
    on conflict do nothing;
  if not found then
    select * into v_key from idempotency_keys where restaurant_id = v_table.restaurant_id and key = p_idempotency_key;
    if v_key.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    select * into v_order from orders where id = v_key.order_id;
    return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', true,
      'payNow', v_order.payment_choice = 'pay_now');
  end if;

  v_status := case when p_payment_choice = 'pay_now' then 'awaiting_payment' else 'submitted' end;
  -- Created as awaiting_payment first so the kitchen/till/email triggers fire once, after totals are final.
  insert into orders (restaurant_id, table_id, public_ref, subtotal_cents, total_cents, status, payment_choice, customer_email)
    values (v_table.restaurant_id, v_table.id, upper(substr(md5(gen_random_uuid()::text), 1, 6)), 0, 0,
            'awaiting_payment', p_payment_choice, nullif(lower(trim(p_email)), ''))
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
    if v_subtotal > 100000000 then raise exception 'order_too_large'; end if; -- R1m cap
  end loop;

  -- Prices are VAT-inclusive, so VAT is the embedded portion: total * rate / (1 + rate).
  update orders o set subtotal_cents = v_subtotal, total_cents = v_subtotal, status = v_status,
    vat_cents = case when r.vat_registered
      then round(v_subtotal::numeric * r.vat_rate_bp / (10000 + r.vat_rate_bp))::int else 0 end
    from restaurants r where o.id = v_order.id and r.id = o.restaurant_id;
  update idempotency_keys set order_id = v_order.id where restaurant_id = v_table.restaurant_id and key = p_idempotency_key;
  insert into order_events (restaurant_id, order_id, to_status) values (v_table.restaurant_id, v_order.id, v_status);
  if v_status = 'submitted' then
    insert into print_jobs (restaurant_id, order_id) values (v_table.restaurant_id, v_order.id);
  end if;

  return jsonb_build_object('statusToken', v_order.status_token, 'publicRef', v_order.public_ref, 'replayed', false,
    'payNow', p_payment_choice = 'pay_now');
end $$;
revoke execute on function submit_order(text, text, jsonb, text, text, boolean) from public, anon, authenticated;
grant execute on function submit_order(text, text, jsonb, text, text, boolean) to service_role;

-- ---------- Payment ----------

-- Marks a pay-now order paid and sends it to the kitchen. Safe to call twice (providers resend webhooks).
create function confirm_payment(p_status_token text, p_provider_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where status_token = p_status_token for update;
  if not found then raise exception 'not_found'; end if;
  if v_order.payment_status = 'paid' then return jsonb_build_object('status', v_order.status); end if;
  if v_order.status <> 'awaiting_payment' then raise exception 'invalid_transition'; end if;
  update orders set status = 'submitted', payment_status = 'paid', paid_at = now(), updated_at = now() where id = v_order.id;
  insert into order_events (restaurant_id, order_id, from_status, to_status)
    values (v_order.restaurant_id, v_order.id, 'awaiting_payment', 'submitted');
  insert into print_jobs (restaurant_id, order_id) values (v_order.restaurant_id, v_order.id);
  return jsonb_build_object('status', 'submitted', 'providerRef', p_provider_ref);
end $$;
revoke execute on function confirm_payment(text, text) from public, anon, authenticated;
grant execute on function confirm_payment(text, text) to service_role;

-- Staff record a pay-after order as paid at the table or till.
create function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id) then raise exception 'not_found'; end if;
  update orders set payment_status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now() where id = p_order_id;
end $$;
revoke execute on function mark_order_paid(uuid) from public, anon;
grant execute on function mark_order_paid(uuid) to authenticated;

-- Walk-out check: orders still unpaid. security_invoker keeps RLS: staff see only their restaurants.
create view unpaid_orders with (security_invoker = true) as
  select o.id, o.restaurant_id, o.public_ref, o.table_id, o.status, o.total_cents, o.created_at
  from orders o
  where o.payment_status = 'unpaid' and o.status in ('submitted', 'accepted', 'preparing', 'ready', 'served');
grant select on unpaid_orders to authenticated;

-- The customer's status page also shows payment.
create or replace function get_order_status(p_status_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('publicRef', o.public_ref, 'status', o.status, 'totalCents', o.total_cents,
    'paymentChoice', o.payment_choice, 'paymentStatus', o.payment_status, 'updatedAt', o.updated_at, 'items', (
      select jsonb_agg(jsonb_build_object('name', oi.name_snapshot, 'quantity', oi.quantity) order by oi.name_snapshot)
      from order_items oi where oi.order_id = o.id))
  from orders o where o.status_token = p_status_token
$$;

-- POPIA retention: run daily (pg_cron in Supabase; the demo worker calls it).
create function purge_customer_emails() returns void
language sql security definer set search_path = public as $$
  update orders set customer_email = null where customer_email is not null and created_at < now() - interval '30 days';
  update email_jobs set to_address = null where to_address is not null and created_at < now() - interval '30 days';
$$;
revoke execute on function purge_customer_emails() from public, anon, authenticated;
grant execute on function purge_customer_emails() to service_role;

-- The QR menu needs the restaurant's payment policy to offer the right choices.
create or replace function get_table_menu(p_table_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', t.name,
    'theme', t.theme,
    'paymentPolicy', t.payment_policy,
    'table', tb.label,
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
