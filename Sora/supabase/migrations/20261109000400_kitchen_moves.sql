-- Kitchen board moves. Each tap is one call to kitchen_move, so a move that needs several steps
-- (Start = submitted -> accepted -> preparing) either fully happens or not at all.

-- Same as before, plus: a ticket can be cancelled while cooking or ready (the guest left, an item ran out).
create or replace function advance_order(p_order_id uuid, p_to_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','kitchen']) then
    raise exception 'not_found';
  end if;
  if not (v_order.status, p_to_status) in (
    ('submitted','accepted'), ('submitted','rejected'), ('accepted','preparing'), ('accepted','cancelled'),
    ('preparing','ready'), ('preparing','cancelled'), ('ready','served'), ('ready','cancelled')) then
    raise exception 'invalid_transition';
  end if;
  update orders set status = p_to_status, updated_at = now() where id = p_order_id;
  insert into order_events (restaurant_id, order_id, from_status, to_status, actor_user_id)
    values (v_order.restaurant_id, p_order_id, v_order.status, p_to_status, auth.uid());
end $$;

-- p_move is the board button: preparing (Start), ready, served, rejected, cancelled.
-- Returns the new status. Raises not_found (other restaurant, wrong role, no such order),
-- invalid_transition (not possible from the current status) or invalid_move.
create function kitchen_move(p_order_id uuid, p_move text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_steps text[];
begin
  select status into v_status from orders where id = p_order_id for update;
  if not found then raise exception 'not_found'; end if;
  v_steps := case
    when p_move = 'preparing' and v_status = 'submitted' then array['accepted', 'preparing']
    when p_move = 'preparing' and v_status = 'accepted' then array['preparing']
    when p_move = 'cancelled' and v_status = 'submitted' then null -- a new ticket is rejected, not cancelled
    when p_move in ('ready', 'served', 'rejected', 'cancelled') then array[p_move]
    else null
  end;
  if p_move not in ('preparing', 'ready', 'served', 'rejected', 'cancelled') then raise exception 'invalid_move'; end if;
  if v_steps is null then
    -- Still check membership first, so another restaurant's order looks missing rather than "wrong state".
    perform advance_order(p_order_id, p_move);
    raise exception 'invalid_transition';
  end if;
  for i in 1 .. array_length(v_steps, 1) loop
    perform advance_order(p_order_id, v_steps[i]);
  end loop;
  return p_move;
end $$;

revoke execute on function kitchen_move(uuid, text) from public, anon;
grant execute on function kitchen_move(uuid, text) to authenticated;
