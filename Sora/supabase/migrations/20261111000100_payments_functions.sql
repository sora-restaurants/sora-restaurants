-- Payment and service-request functions. Owned by sora_definer.
-- Existing order/kitchen functions are not replaced.

create or replace function public.create_counter_payment(p_order_id uuid, p_idempotency_key text)
returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_order public.orders;
  v_existing public.payments;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if exists (
    select 1 from public.payments
    where restaurant_id = v_order.restaurant_id and order_id = p_order_id and status = 'succeeded'
  ) then raise exception 'order_already_paid'; end if;

  select * into v_existing from public.payments
    where restaurant_id = v_order.restaurant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id = p_order_id and v_existing.method = 'counter'
       and v_existing.amount_cents = v_order.total_cents and v_existing.is_simulated = false then
      return v_existing.id;
    end if;
    raise exception 'idempotency_conflict';
  end if;

  insert into public.payments (
    order_id, restaurant_id, method, status, amount_cents, is_simulated, idempotency_key
  ) values (
    p_order_id, v_order.restaurant_id, 'counter', 'awaiting_collection', v_order.total_cents, false, p_idempotency_key
  ) returning id into v_id;
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
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if exists (
    select 1 from public.payments
    where restaurant_id = v_order.restaurant_id and order_id = p_order_id and status = 'succeeded'
  ) then raise exception 'order_already_paid'; end if;

  select * into v_existing from public.payments
    where restaurant_id = v_order.restaurant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.order_id = p_order_id and v_existing.method = 'online'
       and v_existing.amount_cents = v_order.total_cents and v_existing.is_simulated = true then
      return v_existing.id;
    end if;
    raise exception 'idempotency_conflict';
  end if;

  insert into public.payments (
    order_id, restaurant_id, method, status, amount_cents, is_simulated, idempotency_key
  ) values (
    p_order_id, v_order.restaurant_id, 'online', 'pending', v_order.total_cents, true, p_idempotency_key
  ) returning id into v_id;
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
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_order.restaurant_id <> v_payment.restaurant_id then raise exception 'not_found'; end if;
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
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found or v_order.restaurant_id <> v_payment.restaurant_id then raise exception 'not_found'; end if;
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

alter function public.create_counter_payment(uuid, text) owner to sora_definer;
alter function public.create_demo_payment(uuid, text) owner to sora_definer;
alter function public.simulate_payment_success(uuid) owner to sora_definer;
alter function public.mark_counter_collected(uuid) owner to sora_definer;

revoke execute on function public.create_counter_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_demo_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.simulate_payment_success(uuid) from public, anon, authenticated;
revoke execute on function public.mark_counter_collected(uuid) from public, anon;

grant execute on function public.create_counter_payment(uuid, text) to service_role;
grant execute on function public.create_demo_payment(uuid, text) to service_role;
grant execute on function public.simulate_payment_success(uuid) to service_role;
grant execute on function public.mark_counter_collected(uuid) to authenticated;
