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
