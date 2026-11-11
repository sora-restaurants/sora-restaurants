-- Payment functions. Owned by sora_definer.
-- Existing order and kitchen functions are not replaced.
-- Lock order: always lock the parent order first (FOR SHARE), then the payment row.

create or replace function public.cancel_abandoned_demo(p_order_id uuid, p_restaurant_id uuid)
returns void
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments
    where restaurant_id = p_restaurant_id and order_id = p_order_id
      and method = 'online' and is_simulated and status = 'pending'
    for update;
  if not found then return; end if;
  update public.payments set status = 'cancelled', updated_at = now() where id = v_payment.id;
  insert into public.payment_audit (
    payment_id, restaurant_id, actor_user_id, previous_status, new_status, amount_cents, source
  ) values (
    v_payment.id, v_payment.restaurant_id, null, 'pending', 'cancelled', v_payment.amount_cents, 'system_reconciliation'
  );
end $$;

create or replace function public.create_counter_payment(p_order_id uuid, p_idempotency_key text)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_order public.orders;
  v_existing public.payments;
  v_id uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;

  if exists (
    select 1 from public.payments
    where restaurant_id = v_order.restaurant_id and order_id = p_order_id and status = 'succeeded'
  ) then raise exception 'order_already_paid'; end if;

  select * into v_existing from public.payments
    where restaurant_id = v_order.restaurant_id and idempotency_key = p_idempotency_key
    for update;
  if found then
    if v_existing.order_id = p_order_id and v_existing.method = 'counter'
       and v_existing.amount_cents = v_order.total_cents and v_existing.is_simulated = false then
      return v_existing.id;
    end if;
    raise exception 'idempotency_conflict';
  end if;

  -- A leftover pending demo must not block a counter payment. Cancel it in this transaction.
  perform public.cancel_abandoned_demo(p_order_id, v_order.restaurant_id);

  select * into v_existing from public.payments
    where restaurant_id = v_order.restaurant_id and order_id = p_order_id
      and status in ('pending', 'awaiting_collection')
    for update;
  if found then
    if v_existing.method = 'counter' and v_existing.status = 'awaiting_collection' then
      return v_existing.id;
    end if;
    raise exception 'payment_already_open';
  end if;

  begin
    insert into public.payments (
      order_id, restaurant_id, method, status, amount_cents, is_simulated, idempotency_key
    ) values (
      p_order_id, v_order.restaurant_id, 'counter', 'awaiting_collection', v_order.total_cents, false, p_idempotency_key
    ) returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.payments
      where restaurant_id = v_order.restaurant_id and idempotency_key = p_idempotency_key;
    if v_id is not null then return v_id; end if;
    raise exception 'payment_already_open';
  end;
  return v_id;
end $$;

create or replace function public.create_demo_payment(p_order_id uuid, p_idempotency_key text)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_order public.orders;
  v_existing public.payments;
  v_id uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'invalid_idempotency_key';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;

  if exists (
    select 1 from public.payments
    where restaurant_id = v_order.restaurant_id and order_id = p_order_id and status = 'succeeded'
  ) then raise exception 'order_already_paid'; end if;

  select * into v_existing from public.payments
    where restaurant_id = v_order.restaurant_id and idempotency_key = p_idempotency_key
    for update;
  if found then
    if v_existing.order_id = p_order_id and v_existing.method = 'online'
       and v_existing.amount_cents = v_order.total_cents and v_existing.is_simulated = true then
      return v_existing.id;
    end if;
    raise exception 'idempotency_conflict';
  end if;

  perform public.cancel_abandoned_demo(p_order_id, v_order.restaurant_id);

  select * into v_existing from public.payments
    where restaurant_id = v_order.restaurant_id and order_id = p_order_id
      and status in ('pending', 'awaiting_collection')
    for update;
  if found then
    raise exception 'payment_already_open';
  end if;

  begin
    insert into public.payments (
      order_id, restaurant_id, method, status, amount_cents, is_simulated, idempotency_key
    ) values (
      p_order_id, v_order.restaurant_id, 'online', 'pending', v_order.total_cents, true, p_idempotency_key
    ) returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.payments
      where restaurant_id = v_order.restaurant_id and idempotency_key = p_idempotency_key;
    if v_id is not null then return v_id; end if;
    raise exception 'payment_already_open';
  end;
  return v_id;
end $$;

create or replace function public.simulate_payment_success(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(
    (select order_id from public.payments where id = p_payment_id)::text, 0));
  select * into v_order from public.orders
    where id = (select order_id from public.payments where id = p_payment_id);
  if not found then raise exception 'not_found'; end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.restaurant_id <> v_order.restaurant_id then raise exception 'not_found'; end if;
  if v_payment.method <> 'online' or v_payment.is_simulated is not true or v_payment.status <> 'pending' then
    raise exception 'invalid_transition';
  end if;
  update public.payments set status = 'succeeded', updated_at = now() where id = p_payment_id;
  insert into public.payment_audit (
    payment_id, restaurant_id, actor_user_id, previous_status, new_status, amount_cents, source
  ) values (
    p_payment_id, v_payment.restaurant_id, null, 'pending', 'succeeded', v_payment.amount_cents, 'demo_simulation'
  );
end $$;

create or replace function public.mark_counter_collected(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_payment public.payments;
  v_order public.orders;
begin
  perform pg_catalog.pg_advisory_xact_lock(hashtextextended(
    (select order_id from public.payments where id = p_payment_id)::text, 0));
  select * into v_order from public.orders
    where id = (select order_id from public.payments where id = p_payment_id);
  if not found then raise exception 'not_found'; end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found or v_payment.restaurant_id <> v_order.restaurant_id then raise exception 'not_found'; end if;
  if not public.is_member(v_payment.restaurant_id, array['owner','manager','waiter']) then
    raise exception 'not_found';
  end if;
  if v_payment.method <> 'counter' or v_payment.status <> 'awaiting_collection' then
    raise exception 'invalid_transition';
  end if;
  update public.payments set status = 'succeeded', updated_at = now() where id = p_payment_id;
  insert into public.payment_audit (
    payment_id, restaurant_id, actor_user_id, previous_status, new_status, amount_cents, source
  ) values (
    p_payment_id, v_payment.restaurant_id, auth.uid(), 'awaiting_collection', 'succeeded',
    v_payment.amount_cents, 'staff_counter_collection'
  );
end $$;

alter function public.cancel_abandoned_demo(uuid, uuid) owner to sora_definer;
alter function public.create_counter_payment(uuid, text) owner to sora_definer;
alter function public.create_demo_payment(uuid, text) owner to sora_definer;
alter function public.simulate_payment_success(uuid) owner to sora_definer;
alter function public.mark_counter_collected(uuid) owner to sora_definer;

revoke execute on function public.cancel_abandoned_demo(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_counter_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_demo_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.simulate_payment_success(uuid) from public, anon, authenticated;
revoke execute on function public.mark_counter_collected(uuid) from public, anon;

grant execute on function public.cancel_abandoned_demo(uuid, uuid) to sora_definer;
grant execute on function public.create_counter_payment(uuid, text) to service_role;
grant execute on function public.create_demo_payment(uuid, text) to service_role;
grant execute on function public.simulate_payment_success(uuid) to service_role;
grant execute on function public.mark_counter_collected(uuid) to authenticated;
