-- Menu editing for staff. Owners and managers edit dishes; the kitchen may also mark dishes sold out.
-- Restaurant and role come from the session (is_member), never from the request.

create function set_menu_item_available(p_item_id uuid, p_available boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_restaurant uuid;
begin
  select restaurant_id into v_restaurant from menu_items where id = p_item_id for update;
  if not found or not is_member(v_restaurant, array['owner', 'manager', 'kitchen']) then
    raise exception 'not_found';
  end if;
  update menu_items set available = p_available where id = p_item_id;
end $$;

-- p_item_id null adds a dish to p_menu_id; otherwise updates that dish. Returns the dish id.
create function save_menu_item(p_item_id uuid, p_menu_id uuid, p_name text, p_description text, p_price_cents int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_id uuid;
begin
  if p_item_id is null then
    select restaurant_id into v_restaurant from menus where id = p_menu_id;
  else
    select restaurant_id into v_restaurant from menu_items where id = p_item_id for update;
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
  return v_id;
end $$;

revoke execute on function set_menu_item_available(uuid, boolean) from public, anon;
revoke execute on function save_menu_item(uuid, uuid, text, text, int) from public, anon;
grant execute on function set_menu_item_available(uuid, boolean) to authenticated;
grant execute on function save_menu_item(uuid, uuid, text, text, int) to authenticated;
