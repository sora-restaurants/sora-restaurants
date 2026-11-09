-- Local-only demo data. Two restaurants so isolation can be checked by hand and in tests.
-- Test logins (local only): kitchen@demo.test / demo-kitchen-pass  (Demo Bistro)
--                           kitchen@other.test / other-kitchen-pass (Other Grill)
--                           waiter@demo.test / demo-waiter-pass (Demo Bistro, waiter)

insert into restaurants (id, name, slug, vat_registered) values
  ('a0000000-0000-0000-0000-000000000001', 'Demo Bistro', 'demo-bistro', true),
  ('b0000000-0000-0000-0000-000000000001', 'Other Grill', 'other-grill', false);

insert into tables (restaurant_id, label, qr_token) values
  ('a0000000-0000-0000-0000-000000000001', 'Table 1', 'demo-table-1-token'),
  ('a0000000-0000-0000-0000-000000000001', 'Table 2', 'demo-table-2-token'),
  ('a0000000-0000-0000-0000-000000000001', 'Table 4', 'demo-table-4-token'),
  ('b0000000-0000-0000-0000-000000000001', 'Table 1', 'other-table-1-token');

insert into menus (id, restaurant_id, name, sort_order) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Mains', 1),
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Drinks', 2),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Grill', 1);

insert into menu_items (id, restaurant_id, menu_id, name, description, price_cents, sort_order) values
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Bunny chow', 'Quarter loaf, mutton curry', 12500, 1),
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Boerewors roll', 'With chakalaka', 8900, 2),
  ('a2000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'Rooibos iced tea', '', 3500, 1),
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Rump 300g', '', 21000, 1);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt(u.pass, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'kitchen@demo.test', 'demo-kitchen-pass'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'kitchen@other.test', 'other-kitchen-pass'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'waiter@demo.test', 'demo-waiter-pass')) u(id, email, pass);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email in ('kitchen@demo.test', 'kitchen@other.test', 'waiter@demo.test');

insert into staff_memberships (restaurant_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'kitchen'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'kitchen'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'waiter');
