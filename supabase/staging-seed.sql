-- HOSTED STAGING ONLY: demo restaurant/menu/table data, never customer or production data.
-- Run manually after `supabase db push`. This file deliberately creates no Auth users and no passwords.

insert into restaurants (id, name, slug, vat_registered, theme)
values ('d0000000-0000-0000-0000-000000000001', 'Sora Demo Kitchen', 'sora-demo-kitchen', true, 'fast-casual-vibrant')
on conflict (id) do update set
  name = excluded.name,
  vat_registered = excluded.vat_registered,
  theme = excluded.theme;

insert into tables (id, restaurant_id, label, qr_token)
values ('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Demo Table 1', 'staging-demo-table-1')
on conflict (id) do update set label = excluded.label, active = true;

insert into menus (id, restaurant_id, name, sort_order)
values
  ('d2000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'From the kitchen', 1),
  ('d2000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Drinks', 2)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, available = true;

insert into menu_items (id, restaurant_id, menu_id, name, description, price_cents, image_url, dietary_tags, sort_order)
values
  ('d3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'Cape Malay Chicken Curry', 'Fragrant turmeric and toasted spices, sambals, steamed basmati and warm roti.', 16800, '/menu/cape-malay-chicken-curry.jpg', '{}', 1),
  ('d3000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'Charred Cauliflower', 'Tahini yoghurt, apricot harissa, toasted almonds and fresh herbs.', 12800, '/menu/charred-cauliflower.jpg', '{vegetarian}', 2),
  ('d3000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'Rooibos Iced Tea', 'House-brewed rooibos over ice with fresh orange and rosemary.', 3900, '/menu/rooibos-iced-tea.jpg', '{vegan}', 1),
  ('d3000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'Fresh Lemon & Mint Cooler', 'Fresh lemon, garden mint and sparkling water over ice.', 4800, '/menu/fresh-lemon-mint-cooler.jpg', '{vegan}', 2),
  ('d3000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'Cape Citrus Tonic', 'Grapefruit, naartjie peel, thyme and premium tonic over ice.', 5600, '/menu/cape-citrus-tonic.jpg', '{vegan}', 3),
  ('d3000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'South African Chenin Blanc', 'A chilled glass with bright stone fruit, citrus and a clean mineral finish.', 7800, '/menu/south-african-chenin-blanc.jpg', '{contains alcohol}', 4)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  image_url = excluded.image_url,
  dietary_tags = excluded.dietary_tags,
  sort_order = excluded.sort_order,
  available = true;

-- After creating the staff user in Supabase Auth, add membership separately (replace the email):
-- insert into staff_memberships (restaurant_id, user_id, role)
-- select 'd0000000-0000-0000-0000-000000000001', id, 'owner'
-- from auth.users where lower(email) = lower('YOUR_STAGING_STAFF_EMAIL')
-- on conflict (restaurant_id, user_id) do update set role = 'owner', status = 'active';

-- The hosted demo menu (same dishes and ids as apps/web/src/components/menu/demo-menu.ts), so demo orders reach the kitchen.
update restaurants set name = 'The Corner Bistro' where id = 'd0000000-0000-0000-0000-000000000001';
update menus set available = false where restaurant_id = 'd0000000-0000-0000-0000-000000000001' and id::text not like 'd2000000-0000-0000-0000-0000000001%';
insert into menus (id, restaurant_id, name, sort_order)
values
  ('d2000000-0000-0000-0000-000000000101', 'd0000000-0000-0000-0000-000000000001', 'Starters', 1),
  ('d2000000-0000-0000-0000-000000000102', 'd0000000-0000-0000-0000-000000000001', 'Mains', 2),
  ('d2000000-0000-0000-0000-000000000103', 'd0000000-0000-0000-0000-000000000001', 'Sides', 3),
  ('d2000000-0000-0000-0000-000000000104', 'd0000000-0000-0000-0000-000000000001', 'Desserts', 4),
  ('d2000000-0000-0000-0000-000000000105', 'd0000000-0000-0000-0000-000000000001', 'Hot Drinks', 5),
  ('d2000000-0000-0000-0000-000000000106', 'd0000000-0000-0000-0000-000000000001', 'Cold Drinks', 6)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, available = true;

insert into menu_items (id, restaurant_id, menu_id, name, description, price_cents, image_url, dietary_tags, sort_order)
values
  ('d3000000-0000-0000-0000-000000000101', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000101', 'Tomato Bruschetta', 'Toasted sourdough, ripe tomatoes, basil, olive oil.', 8500, 'https://images.unsplash.com/photo-1506280754576-f6fa8a873550?auto=format&fit=crop&w=800&q=70', '{"Vegetarian","Vegan"}', 1),
  ('d3000000-0000-0000-0000-000000000102', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000101', 'Crispy Calamari', 'Lightly battered squid with lemon aioli.', 12000, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=70', '{}', 2),
  ('d3000000-0000-0000-0000-000000000103', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000101', 'Peri-Peri Wings', 'Six wings with extra hot peri-peri sauce.', 11000, 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=800&q=70', '{"Gluten-free"}', 3),
  ('d3000000-0000-0000-0000-000000000104', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000102', 'Ribeye Steak', '300g grain-fed ribeye, herb butter, chips.', 28500, 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=70', '{"Gluten-free"}', 1),
  ('d3000000-0000-0000-0000-000000000105', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000102', 'Smash Burger', 'Double beef patty, cheese, pickles, special sauce.', 16500, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=70', '{}', 2),
  ('d3000000-0000-0000-0000-000000000106', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000102', 'Grilled Chicken Breast', 'Herb-marinated chicken, seasonal vegetables.', 17500, 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=70', '{"Gluten-free","Dairy-free"}', 3),
  ('d3000000-0000-0000-0000-000000000107', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000102', 'Pan-Seared Salmon', 'Atlantic salmon, lemon butter, greens.', 24500, 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=800&q=70', '{"Gluten-free"}', 4),
  ('d3000000-0000-0000-0000-000000000108', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000102', 'Tomato Basil Pasta', 'Fresh pasta in a slow-cooked tomato sauce.', 14500, 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 5),
  ('d3000000-0000-0000-0000-000000000109', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000102', 'Garden Veggie Bowl', 'Quinoa, roasted vegetables, tahini dressing.', 13500, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=70', '{"Vegetarian","Vegan","Gluten-free"}', 6),
  ('d3000000-0000-0000-0000-000000000110', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000103', 'Skinny Fries', 'Crisp fries with sea salt.', 4500, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=70', '{"Vegetarian","Vegan"}', 1),
  ('d3000000-0000-0000-0000-000000000111', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000103', 'Garden Salad', 'Mixed leaves, cucumber, tomato, vinaigrette.', 5500, 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=800&q=70', '{"Vegetarian","Vegan","Gluten-free"}', 2),
  ('d3000000-0000-0000-0000-000000000112', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000103', 'Mac & Cheese', 'Creamy three-cheese macaroni.', 7500, 'https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 3),
  ('d3000000-0000-0000-0000-000000000113', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000104', 'Chocolate Brownie', 'Warm brownie with vanilla ice cream.', 8500, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 1),
  ('d3000000-0000-0000-0000-000000000114', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000104', 'New York Cheesecake', 'Classic baked cheesecake, berry coulis.', 9500, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 2),
  ('d3000000-0000-0000-0000-000000000115', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000105', 'Flat White', 'Double espresso with steamed milk.', 4200, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 1),
  ('d3000000-0000-0000-0000-000000000116', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000105', 'Cafe Latte', 'Espresso with a silky milk foam.', 4500, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 2),
  ('d3000000-0000-0000-0000-000000000117', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000105', 'Cappuccino', 'Equal parts espresso, steamed milk and foam.', 4500, 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 3),
  ('d3000000-0000-0000-0000-000000000118', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000105', 'Espresso', 'A short, strong shot.', 2800, 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=70', '{"Vegan"}', 4),
  ('d3000000-0000-0000-0000-000000000119', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000105', 'Hot Chocolate', 'Rich cocoa with steamed milk.', 4800, 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=800&q=70', '{"Vegetarian"}', 5),
  ('d3000000-0000-0000-0000-000000000120', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000106', 'Cool Drink', 'Choose your brand and can or bottle.', 3500, 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=800&q=70', '{"Vegan"}', 1),
  ('d3000000-0000-0000-0000-000000000121', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000106', 'Fresh Lemonade', 'House-made with mint.', 4000, 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=800&q=70', '{"Vegetarian","Vegan"}', 2),
  ('d3000000-0000-0000-0000-000000000122', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000106', 'Smoothie', 'Pick your flavour.', 5500, 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=800&q=70', '{"Vegetarian","Vegan","Dairy-free"}', 3),
  ('d3000000-0000-0000-0000-000000000123', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000106', 'Iced Tea', 'Chilled black tea with lemon.', 3800, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=800&q=70', '{"Vegan"}', 4),
  ('d3000000-0000-0000-0000-000000000124', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000106', 'Water', 'Tap (free), bottled or sparkling.', 0, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=800&q=70', '{"Vegan"}', 5)
on conflict (id) do update set
  menu_id = excluded.menu_id, name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
  image_url = excluded.image_url, dietary_tags = excluded.dietary_tags, sort_order = excluded.sort_order, available = true;
