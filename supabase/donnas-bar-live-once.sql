-- Paste this whole file into the Supabase SQL Editor of the LIVE project and press Run.
-- Safe to run more than once. It runs as one transaction: if any line fails, nothing changes.
-- Part 1: per-screen routing (Kitchen / Bar). Part 2: Donna's drinks to the Bar screen.

begin;

-- Bar routing. Every order line is stamped with the screen that makes it (kitchen or bar), and each
-- screen moves its own lines to Ready; the order is Ready when every line is.
-- Rule: the category's station when the owner set one, else a guess from the dish and category names.

-- A category with no station is "Auto": its lines are routed by name.
alter table menus add column if not exists station text check (station in ('kitchen', 'bar'));
alter table menus alter column station drop not null, alter column station drop default;

-- Whole words only, so "Steak", "Ginger", "Watermelon" or "Barbecue" stay in the kitchen.
create or replace function guess_station(p_item text, p_category text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_category ~* '\y(drinks?|beverages?|bar|wines?|beers?|cocktails?|mocktails?|spirits|shooters|shots|soft drinks|juices?|coffees?|teas?|smoothies|shakes)\y'
      or p_item ~* '\y(drinks?|juices?|sodas?|cola|coke|sprite|fanta|tonic|water|tea|teas|chai|coffees?|lattes?|espresso|cappuccinos?|americano|mocha|flat white|macchiato|hot chocolate|beers?|lager|ale|ipa|cider|wines?|chenin|sauvignon|merlot|shiraz|pinotage|chardonnay|cabernet|ros[eé]|prosecco|champagne|bubbly|cocktails?|mocktails?|margarita|mojito|martini|negroni|spritz|g&t|gin|whisk(e)?y|vodka|rum|tequila|brandy|shooters?|shots?|smoothies?|milkshakes?|shakes?|lemonade|cooler|frappe)\y'
    then 'bar' else 'kitchen' end
$$;

-- Existing menus: drink-named categories go to the bar; everything else keeps its explicit Kitchen.
update menus set station = 'bar'
  where station = 'kitchen' and guess_station('', name) = 'bar';

alter table order_items
  add column if not exists station text not null default 'kitchen' check (station in ('kitchen', 'bar')),
  add column if not exists prep_status text not null default 'new' check (prep_status in ('new', 'preparing', 'ready'));

-- Stamped at order time, so a later menu edit never moves a ticket that is already on a screen.
create or replace function stamp_order_item_station() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(m.station, guess_station(i.name, m.name)) into new.station
    from menu_items i join menus m on m.id = i.menu_id where i.id = new.menu_item_id;
  new.station := coalesce(new.station, 'kitchen');
  return new;
end $$;
drop trigger if exists order_items_station on order_items;
create trigger order_items_station before insert on order_items
  for each row execute function stamp_order_item_station();

-- Lines of orders already open take their station from the menu as it is now.
update order_items oi set station = coalesce(m.station, guess_station(i.name, m.name))
  from menu_items i join menus m on m.id = i.menu_id
  where i.id = oi.menu_item_id;
-- Finished orders count as ready; open orders keep each line's own progress (safe to run again).
update order_items oi set prep_status = 'ready'
  from orders o where o.id = oi.order_id and oi.prep_status = 'new'
    and o.status not in ('submitted', 'accepted', 'preparing');

-- "Auto" is null; the editor sends 'auto'.
create or replace function set_menu_station(p_menu_id uuid, p_station text) returns void
language plpgsql security definer set search_path = public as $$
declare v_menu menus;
begin
  select * into v_menu from menus where id = p_menu_id;
  if not found or not is_member(v_menu.restaurant_id, array['owner','manager']) then raise exception 'not_found'; end if;
  if p_station not in ('kitchen', 'bar', 'auto') then raise exception 'invalid_item'; end if;
  update menus set station = nullif(p_station, 'auto') where id = p_menu_id;
end $$;

-- Same board moves, plus an optional station. With a station, Start and Ready move only that
-- station's lines; the order becomes Preparing when either starts and Ready when every line is ready.
-- Without one (the All screen, older tablets), a move applies to the whole order as before.
drop function if exists kitchen_move(uuid, text);
create or replace function kitchen_move(p_order_id uuid, p_move text, p_station text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order orders;
  v_steps text[];
begin
  if p_move not in ('preparing', 'ready', 'served', 'rejected', 'cancelled') then raise exception 'invalid_move'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found or not is_member(v_order.restaurant_id, array['owner','manager','kitchen']) then raise exception 'not_found'; end if;

  if p_station is not null and p_move in ('preparing', 'ready') then
    if p_station not in ('kitchen', 'bar') then raise exception 'invalid_move'; end if;
    if v_order.status not in ('submitted', 'accepted', 'preparing') then raise exception 'invalid_transition'; end if;
    update order_items set prep_status = p_move
      where order_id = p_order_id and station = p_station
        and prep_status = any(case p_move when 'preparing' then array['new'] else array['new', 'preparing'] end);
    if not found then raise exception 'invalid_transition'; end if;
    v_steps := case v_order.status when 'submitted' then array['accepted', 'preparing'] when 'accepted' then array['preparing'] else '{}' end;
    if not exists (select 1 from order_items where order_id = p_order_id and prep_status <> 'ready') then
      v_steps := v_steps || array['ready'];
    end if;
    for i in 1 .. coalesce(array_length(v_steps, 1), 0) loop
      perform advance_order(p_order_id, v_steps[i]);
    end loop;
    -- The board polls on updated_at: a station move that left the order status alone must still show.
    update orders set updated_at = now() where id = p_order_id;
    return p_move;
  end if;

  v_steps := case
    when p_move = 'preparing' and v_order.status = 'submitted' then array['accepted', 'preparing']
    when p_move = 'preparing' and v_order.status = 'accepted' then array['preparing']
    when p_move = 'cancelled' and v_order.status = 'submitted' then null -- a new ticket is rejected, not cancelled
    when p_move in ('ready', 'served', 'rejected', 'cancelled') then array[p_move]
    else null
  end;
  if v_steps is null then raise exception 'invalid_transition'; end if;
  for i in 1 .. array_length(v_steps, 1) loop
    perform advance_order(p_order_id, v_steps[i]);
  end loop;
  if p_move = 'preparing' then update order_items set prep_status = 'preparing' where order_id = p_order_id and prep_status = 'new';
  elsif p_move = 'ready' then update order_items set prep_status = 'ready' where order_id = p_order_id;
  end if;
  return p_move;
end $$;

revoke execute on function kitchen_move(uuid, text, text) from public, anon;
grant execute on function kitchen_move(uuid, text, text) to authenticated;
revoke execute on function guess_station(text, text), stamp_order_item_station() from public, anon;

-- ===== Part 2: Donna's =====
-- HOSTED DEMO ONLY: sends Donna's drinks to the Bar screen and food to the Kitchen screen.
-- Run once in the Supabase SQL Editor AFTER migration 20261126000000_bar_station.sql. Touches only Donna's.
-- Undo: set every Donna's section back to 'kitchen' (the last statement shows how).

-- Drink sections: always the bar.
update menus set station = 'bar'
  where restaurant_id = 'e0000000-0000-0000-0000-000000000001'
    and name in ('Cocktails', 'Mimosas & bubbles', 'Wine by the glass', 'White wine', 'Rosé & semi-sweet', 'Red wine',
                 'Cellar list', 'Beer & cider', 'Spirits & shooters', 'Soft drinks & juice', 'Coffee & tea');

-- Milkshakes move out of "Waffles, shakes & gelato" into their own Bar section, so waffles and gelato
-- stay in the kitchen. Guests still see them under Smoothies & shakes.
insert into menus (id, restaurant_id, name, sort_order, station)
  values ('e1000000-0000-0000-0000-000000000017', 'e0000000-0000-0000-0000-000000000001', 'Milkshakes', 11, 'bar')
  on conflict (id) do nothing;
update menu_items set menu_id = 'e1000000-0000-0000-0000-000000000017'
  where restaurant_id = 'e0000000-0000-0000-0000-000000000001' and name ~* 'milkshake'
    and menu_id = 'e1000000-0000-0000-0000-000000000009';

-- Breakfast is "Auto": each line goes by its name, so smoothies go to the bar and the rest to the kitchen.
update menus set station = null
  where restaurant_id = 'e0000000-0000-0000-0000-000000000001' and name = 'Breakfast & brunch';

-- Food sections: the kitchen. Named one by one so running this file again gives the same result.
update menus set station = 'kitchen'
  where restaurant_id = 'e0000000-0000-0000-0000-000000000001'
    and name in ('Toasties & wraps', 'Antipasti', 'Insalate', 'Primi', 'Pizze', 'Secondi', 'Sides', 'Kids', 'Dolci',
                 'Waffles, shakes & gelato');
update menus set station = 'bar' where id = 'e1000000-0000-0000-0000-000000000017';

-- Open orders take the new routing too.
update order_items oi set station = coalesce(m.station, guess_station(i.name, m.name))
  from menu_items i join menus m on m.id = i.menu_id
  where i.id = oi.menu_item_id and oi.restaurant_id = 'e0000000-0000-0000-0000-000000000001';


-- Undo:
-- update menu_items set menu_id = 'e1000000-0000-0000-0000-000000000009' where menu_id = 'e1000000-0000-0000-0000-000000000017';
-- delete from menus where id = 'e1000000-0000-0000-0000-000000000017';
-- update menus set station = 'kitchen' where restaurant_id = 'e0000000-0000-0000-0000-000000000001';

commit;
