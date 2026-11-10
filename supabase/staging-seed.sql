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

insert into menu_items (id, restaurant_id, menu_id, name, description, price_cents, sort_order)
values
  ('d3000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'Cape Malay chicken bowl', 'Fragrant rice, sambal and seasonal greens', 12900, 1),
  ('d3000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'Chakalaka toastie', 'Mature cheddar, chakalaka and sourdough', 8900, 2),
  ('d3000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'Rooibos iced tea', 'House-brewed with citrus', 3900, 1)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  sort_order = excluded.sort_order,
  available = true;

-- After creating the staff user in Supabase Auth, add membership separately (replace the email):
-- insert into staff_memberships (restaurant_id, user_id, role)
-- select 'd0000000-0000-0000-0000-000000000001', id, 'kitchen'
-- from auth.users where lower(email) = lower('YOUR_STAGING_STAFF_EMAIL')
-- on conflict (restaurant_id, user_id) do update set role = 'kitchen', status = 'active';
