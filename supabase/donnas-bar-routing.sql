-- HOSTED DEMO ONLY: sends Donna's drinks to the Bar screen and food to the Kitchen screen.
-- Run once in the Supabase SQL Editor AFTER migration 20261126000000_bar_station.sql. Touches only Donna's.
-- Undo: set every Donna's section back to 'kitchen' (the last statement shows how).
begin;

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

-- Everything else (Antipasti, Primi, Pizze, Secondi, Kids, Dolci...) stays on the kitchen.
update menus set station = 'kitchen'
  where restaurant_id = 'e0000000-0000-0000-0000-000000000001'
    and station is distinct from 'bar' and name <> 'Breakfast & brunch';

-- Open orders take the new routing too.
update order_items oi set station = coalesce(m.station, guess_station(i.name, m.name))
  from menu_items i join menus m on m.id = i.menu_id
  where i.id = oi.menu_item_id and oi.restaurant_id = 'e0000000-0000-0000-0000-000000000001';

commit;

-- Undo:
-- update menu_items set menu_id = 'e1000000-0000-0000-0000-000000000009' where menu_id = 'e1000000-0000-0000-0000-000000000017';
-- delete from menus where id = 'e1000000-0000-0000-0000-000000000017';
-- update menus set station = 'kitchen' where restaurant_id = 'e0000000-0000-0000-0000-000000000001';
