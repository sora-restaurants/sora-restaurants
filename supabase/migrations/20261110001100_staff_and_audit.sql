-- Staff management and an append-only audit log for owners and managers.
-- Restaurant and role come from the session (is_member), never from the request.

-- ---------- Audit log ----------
create table admin_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id),
  actor_user_id uuid,
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index admin_events_recent on admin_events (restaurant_id, created_at desc);
alter table admin_events enable row level security;
create policy admin_read on admin_events for select to authenticated using (is_member(restaurant_id, array['owner', 'manager']));
-- Append-only: rows are written only by the SECURITY DEFINER functions below.
revoke all on admin_events from anon, authenticated, service_role;
grant select on admin_events to authenticated, service_role;

create function log_admin_event(p_restaurant uuid, p_action text, p_target text, p_before jsonb, p_after jsonb) returns void
language sql security definer set search_path = public as $$
  insert into admin_events (restaurant_id, actor_user_id, action, target, before, after)
  values (p_restaurant, auth.uid(), p_action, p_target, p_before, p_after)
$$;
revoke execute on function log_admin_event(uuid, text, text, jsonb, jsonb) from public, anon, authenticated, service_role;

-- ---------- Pending invites live in staff_memberships ----------
-- An invite has no user yet; the hosted flow sends the Supabase Auth email and fills user_id on accept.
-- is_member matches user_id = auth.uid(), so an invited row never grants access.
alter table staff_memberships alter column user_id drop not null;
alter table staff_memberships add column invite_email text;
alter table staff_memberships add column invited_at timestamptz;
alter table staff_memberships drop constraint staff_memberships_status_check;
alter table staff_memberships add constraint staff_memberships_status_check check (status in ('active', 'inactive', 'invited'));
alter table staff_memberships add constraint staff_memberships_invite_check
  check ((status = 'invited') = (user_id is null) and (status <> 'invited' or invite_email is not null));
create unique index staff_memberships_one_invite on staff_memberships (restaurant_id, lower(invite_email)) where status = 'invited';

-- The restaurant an owner/manager administers (first by name, like the menu editor).
create function admin_restaurant() returns uuid
language sql stable security definer set search_path = public as $$
  select id from restaurants where is_member(id, array['owner', 'manager']) order by name limit 1
$$;

create function list_staff() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when admin_restaurant() is not null then jsonb_build_object(
    'restaurant', (select name from restaurants where id = admin_restaurant()),
    'canManageOwners', is_member(admin_restaurant(), array['owner']),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id, 'email', coalesce(u.email, m.invite_email), 'role', m.role, 'status', m.status, 'invitedAt', m.invited_at)
        order by m.status, m.role, coalesce(u.email, m.invite_email)), '[]')
      from staff_memberships m left join auth.users u on u.id = m.user_id
      where m.restaurant_id = admin_restaurant()),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
        'action', e.action, 'target', e.target, 'actor', u.email, 'before', e.before, 'after', e.after, 'at', e.created_at)
        order by e.created_at desc), '[]')
      from (select * from admin_events where restaurant_id = admin_restaurant() order by created_at desc limit 50) e
      left join auth.users u on u.id = e.actor_user_id)
  ) end
$$;

create function invite_staff(p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid := admin_restaurant();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if v_restaurant is null then raise exception 'not_found'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254
     or p_role is null or p_role not in ('owner', 'manager', 'kitchen', 'waiter') then
    raise exception 'invalid_staff';
  end if;
  if p_role = 'owner' and not is_member(v_restaurant, array['owner']) then raise exception 'forbidden'; end if;
  if exists (select 1 from staff_memberships m left join auth.users u on u.id = m.user_id
             where m.restaurant_id = v_restaurant and lower(coalesce(u.email, m.invite_email)) = v_email) then
    raise exception 'already_staff';
  end if;
  insert into staff_memberships (restaurant_id, user_id, role, status, invite_email, invited_at)
    values (v_restaurant, null, p_role, 'invited', v_email, now()) returning id into v_id;
  perform log_admin_event(v_restaurant, 'staff.invite', v_id::text, null, jsonb_build_object('email', v_email, 'role', p_role));
  return v_id;
end $$;

-- Shared checks for changing someone's membership. Returns the row, locked.
create function admin_membership(p_membership_id uuid) returns staff_memberships
language plpgsql security definer set search_path = public as $$
declare v_m staff_memberships;
begin
  select * into v_m from staff_memberships where id = p_membership_id;
  if not found or not is_member(v_m.restaurant_id, array['owner', 'manager']) then raise exception 'not_found'; end if;
  -- Serialise owner changes per restaurant so two owners cannot remove each other at once.
  perform 1 from restaurants where id = v_m.restaurant_id for update;
  select * into v_m from staff_memberships where id = p_membership_id for update;
  if v_m.role = 'owner' and not is_member(v_m.restaurant_id, array['owner']) then raise exception 'forbidden'; end if;
  return v_m;
end $$;

create function is_last_active_owner(p_m staff_memberships) returns boolean
language sql stable security definer set search_path = public as $$
  select p_m.role = 'owner' and p_m.status = 'active' and not exists (
    select 1 from staff_memberships where restaurant_id = p_m.restaurant_id and role = 'owner' and status = 'active' and id <> p_m.id)
$$;

create function set_staff_role(p_membership_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_m staff_memberships;
begin
  if p_role is null or p_role not in ('owner', 'manager', 'kitchen', 'waiter') then raise exception 'invalid_staff'; end if;
  v_m := admin_membership(p_membership_id);
  if p_role = 'owner' and not is_member(v_m.restaurant_id, array['owner']) then raise exception 'forbidden'; end if;
  if p_role = v_m.role then return; end if;
  if is_last_active_owner(v_m) then raise exception 'last_owner'; end if;
  update staff_memberships set role = p_role where id = p_membership_id;
  perform log_admin_event(v_m.restaurant_id, 'staff.role', p_membership_id::text,
    jsonb_build_object('role', v_m.role), jsonb_build_object('role', p_role));
end $$;

-- Deactivates an active member; cancels (deletes) a pending invite.
create function remove_staff(p_membership_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_m staff_memberships;
begin
  v_m := admin_membership(p_membership_id);
  if v_m.status = 'inactive' then return; end if;
  if is_last_active_owner(v_m) then raise exception 'last_owner'; end if;
  if v_m.status = 'invited' then
    delete from staff_memberships where id = p_membership_id;
  else
    update staff_memberships set status = 'inactive' where id = p_membership_id;
  end if;
  perform log_admin_event(v_m.restaurant_id, 'staff.remove', p_membership_id::text,
    jsonb_build_object('role', v_m.role, 'status', v_m.status, 'email', v_m.invite_email), null);
end $$;

create function set_payment_policy(p_policy text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid := admin_restaurant();
  v_old text;
begin
  if v_restaurant is null then raise exception 'not_found'; end if;
  if p_policy is null or p_policy not in ('customer_choice', 'pay_now_only', 'pay_later_only') then raise exception 'invalid_policy'; end if;
  select payment_policy into v_old from restaurants where id = v_restaurant for update;
  if v_old = p_policy then return; end if;
  update restaurants set payment_policy = p_policy where id = v_restaurant;
  perform log_admin_event(v_restaurant, 'payment_policy', v_restaurant::text,
    jsonb_build_object('policy', v_old), jsonb_build_object('policy', p_policy));
end $$;

-- ---------- Existing commands, same behaviour, now audited ----------
create or replace function set_menu_item_available(p_item_id uuid, p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_item menu_items;
begin
  select * into v_item from menu_items where id = p_item_id for update;
  if not found or not is_member(v_item.restaurant_id, array['owner', 'manager', 'kitchen']) then
    raise exception 'not_found';
  end if;
  update menu_items set available = p_available where id = p_item_id;
  if v_item.available is distinct from p_available then
    perform log_admin_event(v_item.restaurant_id, 'menu.availability', p_item_id::text,
      jsonb_build_object('name', v_item.name, 'available', v_item.available), jsonb_build_object('available', p_available));
  end if;
end $$;

create or replace function save_menu_item(p_item_id uuid, p_menu_id uuid, p_name text, p_description text, p_price_cents int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_old menu_items;
  v_id uuid;
begin
  if p_item_id is null then
    select restaurant_id into v_restaurant from menus where id = p_menu_id;
  else
    select * into v_old from menu_items where id = p_item_id for update;
    v_restaurant := v_old.restaurant_id;
  end if;
  if v_restaurant is null or not is_member(v_restaurant, array['owner', 'manager']) then
    raise exception 'not_found';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 or length(coalesce(p_description, '')) > 300
     or p_price_cents is null or p_price_cents not between 0 and 10000000 then
    raise exception 'invalid_item';
  end if;

  if p_item_id is null then
    insert into menu_items (restaurant_id, menu_id, name, description, price_cents, sort_order)
      values (v_restaurant, p_menu_id, trim(p_name), coalesce(p_description, ''), p_price_cents,
              (select coalesce(max(sort_order), 0) + 1 from menu_items where menu_id = p_menu_id))
      returning id into v_id;
  else
    -- Past orders keep their own name and price snapshots, so editing never rewrites history.
    update menu_items set name = trim(p_name), description = coalesce(p_description, ''), price_cents = p_price_cents
      where id = p_item_id returning id into v_id;
  end if;
  perform log_admin_event(v_restaurant, case when p_item_id is null then 'menu.add' else 'menu.edit' end, v_id::text,
    case when p_item_id is null then null
      else jsonb_build_object('name', v_old.name, 'description', v_old.description, 'priceCents', v_old.price_cents) end,
    jsonb_build_object('name', trim(p_name), 'description', coalesce(p_description, ''), 'priceCents', p_price_cents));
  return v_id;
end $$;

create or replace function mark_order_paid(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id) then raise exception 'not_found'; end if;
  update orders set payment_status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now() where id = p_order_id;
  if v_order.payment_status is distinct from 'paid' then
    perform log_admin_event(v_order.restaurant_id, 'order.paid', v_order.public_ref,
      jsonb_build_object('paymentStatus', v_order.payment_status), jsonb_build_object('paymentStatus', 'paid'));
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_restaurant()', 'list_staff()', 'invite_staff(text, text)', 'admin_membership(uuid)',
    'is_last_active_owner(staff_memberships)', 'set_staff_role(uuid, text)', 'remove_staff(uuid)', 'set_payment_policy(text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- Helpers are internal: only the commands above call them.
revoke execute on function admin_membership(uuid) from authenticated;
revoke execute on function is_last_active_owner(staff_memberships) from authenticated;
