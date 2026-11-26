-- Local-only demo data. Two restaurants so isolation can be checked by hand and in tests.
-- The demo restaurant carries Donna Modern Italian's (Salt Rock, Ballito) published menu for sales pitches:
--   food  https://donnamodernitalian.co.za/wp-content/uploads/2026/01/DONNA-MENU.pdf (Dec 2025 edition)
--   drink https://donnamodernitalian.co.za/wp-content/uploads/2026/01/2026_Drinks-Menu_Donna.pdf
-- Paid extras (add mozzarella, gluten-free base, sides) are left for the owner panel; spirits by the tot,
-- wine, champagne and the breakfast menu are not loaded. No Donna photos or logo: those need their permission.
-- Test logins (local only): kitchen@demo.test / demo-kitchen-pass  (Donna's)
--                           kitchen@other.test / other-kitchen-pass (Other Grill)
--                           waiter@demo.test / demo-waiter-pass (Donna's, waiter)
--                           owner@demo.test / demo-owner-pass (Donna's, owner)

insert into restaurants (id, name, slug, vat_registered, theme) values
  ('a0000000-0000-0000-0000-000000000001', 'Donna''s', 'donnas-ballito', true, 'luxury-minimal'),
  ('b0000000-0000-0000-0000-000000000001', 'Other Grill', 'other-grill', false, 'fast-casual-vibrant');

insert into tables (restaurant_id, label, qr_token) values
  ('a0000000-0000-0000-0000-000000000001', 'Table 1', 'demo-table-1-token'),
  ('a0000000-0000-0000-0000-000000000001', 'Table 2', 'demo-table-2-token'),
  ('a0000000-0000-0000-0000-000000000001', 'Table 4', 'demo-table-4-token'),
  ('b0000000-0000-0000-0000-000000000001', 'Table 1', 'other-table-1-token');

insert into menus (id, restaurant_id, name, sort_order)
select ('a1000000-0000-0000-0000-0000000000' || v.m)::uuid, 'a0000000-0000-0000-0000-000000000001', v.name, v.sort
from (values
  ('01', 'Antipasti', 1), ('02', 'Insalate', 2), ('03', 'Primi', 3), ('04', 'Pizze', 4), ('05', 'Secondi', 5),
  ('06', 'Sides', 6), ('07', 'Kids', 7), ('08', 'Dolci', 8), ('09', 'Waffles, shakes & gelato', 9),
  ('0a', 'Cocktails', 10), ('0b', 'Beer & cider', 11), ('0c', 'Soft drinks & juice', 12), ('0d', 'Coffee & tea', 13)
) v(m, name, sort);

insert into menus (id, restaurant_id, name, sort_order) values
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Grill', 1);

-- Tests rely on item ...001 (Primavera Salad, R125), ...003 (Coca-Cola, R35) and ...012 (a dish the owner edits).
insert into menu_items (id, restaurant_id, menu_id, name, description, price_cents, image_url, dietary_tags, sort_order)
select ('a2000000-0000-0000-0000-000000000' || v.id)::uuid, 'a0000000-0000-0000-0000-000000000001',
  ('a1000000-0000-0000-0000-0000000000' || v.m)::uuid, v.name, v.description, v.rand * 100, v.img, v.tags::text[], v.sort
from (values
  ('101', '01', 'Salmon Tartare', 'Chopped salmon, diced cucumber.', 145, null::text, '{}', 1),
  ('102', '01', 'Mussels', 'Full mussels in a white wine and cream sauce.', 110, null, '{}', 2),
  ('103', '01', 'Calamari', 'Tubes and heads, grilled or fried, with lemon butter, lemon & herb or peri-peri.', 115, null, '{}', 3),
  ('104', '01', 'Beef Carpaccio', 'Thin raw beef, rocket, Parmesan, capers, olive oil and balsamic reduction.', 150, null, '{}', 4),
  ('105', '01', 'Involtini di Melanzane', 'Ricotta rolled in eggplant with herbs, béchamel and Napolitana sauce.', 110, null, '{vegetarian}', 5),
  ('106', '01', 'Creamy Prawn Tails', 'Prawn tails in creamy garlic sauce, baked under three cheeses, with ciabatta toast.', 135, null, '{}', 6),
  ('107', '01', 'Focaccia Garlic & Herb', 'Freshly baked focaccia with garlic, olive oil and herbs.', 75, null, '{vegetarian}', 7),
  ('108', '01', 'Focaccia Prima Donna', 'Focaccia topped with prosciutto, rocket, gorgonzola and fresh tomato.', 175, null, '{}', 8),
  ('109', '01', '4 Oysters with Donna''s Relish', 'Served with Donna''s secret vinaigrette.', 150, null, '{}', 9),
  ('110', '02', 'Burrata con Pomodoro', 'Burrata with tomatoes, basil, crispy onions, roasted garlic and balsamic reduction.', 180, null, '{vegetarian}', 1),
  ('111', '02', 'Caesar Salad', 'Romaine, creamy Caesar dressing, croutons, Parmesan and anchovies.', 120, null, '{}', 2),
  ('001', '02', 'Primavera Salad', 'Lettuce, mini mozzarella, cherry tomatoes, artichokes, olives, fried zucchini, Dijon vinaigrette.', 125, null, '{vegetarian}', 3),
  ('112', '02', 'Panzanella Salad', 'Cherry tomatoes, cucumber, red onion, basil, rustic bread and mini mozzarella.', 110, null, '{vegetarian}', 4),
  ('113', '03', 'Prawn Linguine', 'Homemade linguine, prawns, creamy garlic, anchovy, lemon and white wine, chilli flakes.', 250, null, '{}', 1),
  ('114', '03', 'Seafood Linguine', 'Homemade linguine with prawns, mussels and calamari, creamy or Napolitana.', 275, null, '{}', 2),
  ('115', '03', 'Beef Lasagna', 'Layers of pasta, beef mince and cheese.', 170, null, '{}', 3),
  ('116', '03', 'Rigatoni al Burrata', 'Rigatoni in tomato and cream sauce with burrata.', 195, null, '{vegetarian}', 4),
  ('117', '03', 'Butternut Ravioli', 'Roasted pumpkin and Parmigiano ravioli, sage brown butter, toasted walnuts.', 180, null, '{vegetarian}', 5),
  ('118', '03', 'Smoked Salmon Penne', 'Creamy garlic sauce with Ouzo, dill, smoked salmon and a touch of Napolitana.', 195, null, '{}', 6),
  ('119', '03', 'Chicken & Mushroom Tagliatelle', 'Homemade tagliatelle, chicken strips and mushrooms in a creamy rosemary sauce.', 175, null, '{}', 7),
  ('012', '03', 'Mushroom Risotto', 'Exotic mushrooms, fortified wine, sage, butter, Parmesan and truffle oil.', 165, null, '{vegetarian}', 8),
  ('120', '03', 'Prawn Risotto', 'Prawns grilled in garlic, lemon and white wine on a Napolitana risotto.', 235, null, '{}', 9),
  ('121', '03', 'Gnocchi alla Sorrentina', 'Gnocchi in Napolitana with chilli, sun-dried tomato, mozzarella and basil.', 175, null, '{vegetarian}', 10),
  ('122', '03', 'Gnocchi Quattro Formaggi', 'Gnocchi in a creamy four-cheese garlic sauce with toasted pine nuts.', 185, null, '{vegetarian}', 11),
  ('123', '03', 'Al Ragù Bolognese', 'Homemade spaghetti with traditional pork and beef ragù.', 165, null, '{}', 12),
  ('124', '03', 'Aglio Olio Spaghetti', 'Homemade spaghetti, olive oil, garlic, fresh chilli, lemon zest and Parmesan.', 150, null, '{vegetarian}', 13),
  ('125', '03', 'All''Arrabbiata', 'Penne with fresh chilli, garlic and Parmesan in Napolitana sauce.', 170, null, '{vegetarian}', 14),
  ('126', '04', 'Margherita', 'Tomato, mozzarella and basil.', 140, null, '{vegetarian}', 1),
  ('127', '04', 'Three Cheese', 'Mozzarella, cheddar, provolone and honey chilli.', 170, null, '{vegetarian}', 2),
  ('128', '04', 'Seafood Pizza', 'Cream cheese white sauce, mozzarella, prawns, mussels, calamari and onion jam.', 265, null, '{}', 3),
  ('129', '04', 'Chicken & Jalapeño', 'Tomato, mozzarella, chicken, jalapeño, avocado, red onion and sour cream.', 195, null, '{}', 4),
  ('130', '04', 'Bacon, Avo & Feta', 'Tomato, mozzarella, bacon, avocado and feta.', 195, null, '{}', 5),
  ('131', '04', 'Chicken Teriyaki', 'White sauce, mozzarella, teriyaki chicken, sesame, pickled ginger, Japanese mayo.', 180, null, '{}', 6),
  ('132', '04', 'Sicilian', 'Tomato, mozzarella, caramelised onion, capers, olives and anchovies.', 180, null, '{}', 7),
  ('133', '04', 'Hawaiian', 'Tomato, mozzarella, ham and pineapple.', 170, null, '{}', 8),
  ('134', '04', 'Vegetarian', 'Tomato, mozzarella, mushrooms, peppers, onion jam, olives and avocado.', 160, null, '{vegetarian}', 9),
  ('135', '04', 'Mushroom & Salami', 'Tomato, mozzarella, onions, mushrooms and salami.', 195, null, '{}', 10),
  ('136', '04', 'Steak Pizza', 'Steak strips, onion jam, Peppadews, balsamic reduction, Parmesan and rocket.', 195, null, '{}', 11),
  ('137', '05', 'Fillet & Pesto Linguine', 'Homemade basil-pesto linguine with thinly sliced seared beef fillet (125g).', 195, null, '{}', 1),
  ('138', '05', 'Chicken Masala', 'Flattened chicken fillet in a creamy masala wine sauce with buttered tagliatelle.', 180, null, '{}', 2),
  ('139', '05', 'Lamb Chops', 'Herb-crusted lamb chops with a side of your choice.', 320, null, '{}', 3),
  ('140', '05', 'Sole', 'Grilled sole with lemon butter, lemon herb & caper or peri-peri, and a side.', 275, null, '{}', 4),
  ('141', '05', 'Kingklip', 'Grilled kingklip fillet with your choice of sauce and a side.', 250, null, '{}', 5),
  ('142', '05', 'Queen Prawns', 'Grilled queen prawns with lemon butter, lemon & herb or peri-peri, and a side.', 260, null, '{}', 6),
  ('143', '05', 'Calamari Main', 'Tubes and heads, grilled or fried, with your choice of sauce and a side.', 180, null, '{}', 7),
  ('144', '05', 'Baby Chicken', 'Baby chicken with lemon butter, lemon & herb or peri-peri, and a side.', 225, null, '{}', 8),
  ('145', '05', 'Fillet', '250g beef fillet with pepper or mushroom sauce and a side.', 295, null, '{}', 9),
  ('146', '05', 'Seafood Platter for One', '4 queen prawns, calamari, mussels and hake with your choice of sauce and a side.', 345, null, '{}', 10),
  ('147', '05', 'Hake', 'Hake fillet, grilled or fried, with your choice of sauce and a side.', 155, null, '{}', 11),
  ('148', '05', 'Seared Salmon', 'Seared salmon with an Asian sauce and a side.', 260, null, '{}', 12),
  ('149', '06', 'Chips', '', 40, null, '{vegan}', 1),
  ('150', '06', 'Medi Veg', '', 40, null, '{vegan}', 2),
  ('151', '06', 'Side Salad', '', 40, null, '{vegetarian}', 3),
  ('152', '06', 'Rice', '', 40, null, '{vegan}', 4),
  ('153', '06', 'Creamed Spinach & Butternut', '', 45, null, '{vegetarian}', 5),
  ('154', '07', 'Kids Spaghetti Bolognese', 'Spaghetti with traditional pork and beef Bolognese.', 95, null, '{}', 1),
  ('155', '07', 'Kids Napoletana Penne', 'Penne in a tomato sauce.', 90, null, '{vegetarian}', 2),
  ('156', '07', 'Baby Margherita', 'Mini Margherita pizza with tomato and mozzarella.', 95, null, '{vegetarian}', 3),
  ('157', '07', 'Mac and Cheese', 'Macaroni in a creamy cheese sauce.', 95, null, '{vegetarian}', 4),
  ('158', '07', 'Kids Chicken Strips', 'Breaded chicken strips with fries.', 95, null, '{}', 5),
  ('159', '08', 'Tiramisu', 'Coffee-soaked ladyfingers layered with mascarpone.', 95, null, '{vegetarian}', 1),
  ('160', '08', 'Deconstructed Crème Brûlée', 'Creamy vanilla custard with a caramelised sugar crust.', 95, null, '{vegetarian}', 2),
  ('161', '08', 'Cannoli', 'Crisp pastry shells filled with Oreo or pistachio ricotta.', 55, null, '{vegetarian}', 3),
  ('162', '08', 'Affogato', 'Vanilla gelato drowned in espresso with toasted almond flakes.', 70, null, '{vegetarian}', 4),
  ('163', '08', 'Blueberry Cheesecake', '', 95, null, '{vegetarian}', 5),
  ('164', '08', 'Chocolate Brownie', 'With a scoop of vanilla ice cream and chocolate sauce.', 95, null, '{vegetarian}', 6),
  ('165', '08', 'Italian Doughnuts', 'Filled with custard or chocolate.', 50, null, '{vegetarian}', 7),
  ('166', '09', 'Oreo Waffle', 'Full waffle, two scoops vanilla gelato, Crispearls, Oreo and chocolate sauce.', 95, null, '{vegetarian}', 1),
  ('167', '09', 'Childhood Sweetheart Waffle', 'Full waffle, chocolate and vanilla gelato, mini marshmallows, chocolate sauce.', 95, null, '{vegetarian}', 2),
  ('168', '09', 'Plain Waffle', 'With maple syrup or honey.', 60, null, '{vegetarian}', 3),
  ('169', '09', 'Create Your Own Waffle', 'Two scoops of gelato and two add-ons.', 100, null, '{vegetarian}', 4),
  ('170', '09', 'Strawberry Milkshake', 'Small. Strawberry syrup, mini marshmallows and whipped cream.', 65, null, '{vegetarian}', 5),
  ('171', '09', 'Peanut Butter & Banana Milkshake', 'Small. Peanut butter, banana, whipped cream and caramel.', 65, null, '{vegetarian}', 6),
  ('172', '09', 'Chocolate Milkshake', 'Small. Chocolate syrup and whipped cream.', 65, null, '{vegetarian}', 7),
  ('173', '09', 'Oreo Milkshake', 'Small. Oreo crumbs, whipped cream and chocolate sauce.', 65, null, '{vegetarian}', 8),
  ('174', '09', 'Gelato, Two Scoops', '', 75, null, '{vegetarian}', 9),
  ('175', '0a', 'The Donna', 'Absolut with pineapple, a medley of berries and citrus.', 110, null, '{contains alcohol}', 1),
  ('176', '0a', 'Aperol Spritz', 'Aperol, Prosecco and soda.', 100, null, '{contains alcohol}', 2),
  ('177', '0a', 'Espresso Martini', 'Vodka, Kahlua and cold-brew espresso.', 110, null, '{contains alcohol}', 3),
  ('178', '0a', 'Negroni', 'Gin, Campari and rosemary-infused vermouth over a big block of ice.', 105, null, '{contains alcohol}', 4),
  ('179', '0a', 'Pornstar Martini', 'Passionfruit, vodka and vanilla with a shot of Prosecco.', 135, null, '{contains alcohol}', 5),
  ('180', '0a', 'Amaretto Sour', 'Disaronno with citrus and fresh orange juice.', 105, null, '{contains alcohol}', 6),
  ('181', '0a', 'Absolut Bliss', 'Pomegranate-raspberry vodka, pineapple and lemon.', 110, null, '{contains alcohol}', 7),
  ('182', '0a', 'Bees Knees', 'Gin, lime juice and honey syrup.', 105, null, '{contains alcohol}', 8),
  ('183', '0a', 'Elevated Paloma', 'Tequila, lime and grapefruit cordial, topped with orange soda.', 130, null, '{contains alcohol}', 9),
  ('184', '0a', 'Fruitful Evening', 'Hennessy VS, Kahlua, espresso, berry reduction, honey-cinnamon and citrus.', 145, null, '{contains alcohol}', 10),
  ('185', '0a', 'Gin Bull', 'Fresh lime, gin and Red Bull Watermelon.', 95, null, '{contains alcohol}', 11),
  ('186', '0a', 'Italian Bird', 'Campari, sherry, pineapple, lime and rum.', 105, null, '{contains alcohol}', 12),
  ('187', '0a', 'Italian Caipirinha', 'Sangria, lime and rum with a touch of red wine.', 105, null, '{contains alcohol}', 13),
  ('188', '0a', 'Margarita', 'Shaken with tequila.', 110, null, '{contains alcohol}', 14),
  ('189', '0a', 'Old Fashioned', 'Bourbon, cherry syrup and cacao bitters with cherry-oak smoke.', 105, null, '{contains alcohol}', 15),
  ('190', '0a', 'Peach Rita', 'Blanco tequila, lime and Red Bull White Peach.', 95, null, '{contains alcohol}', 16),
  ('191', '0a', 'The Spicy Diplomat', 'Hennessy VS, pineapple, fresh basil and jalapeño.', 145, null, '{contains alcohol}', 17),
  ('192', '0a', 'Whiskey Sour', 'Whiskey, sweet and sour, with a silky foam top.', 105, null, '{contains alcohol}', 18),
  ('193', '0b', 'Castle Lite', '', 42, null, '{contains alcohol}', 1),
  ('194', '0b', 'Corona', '', 52, null, '{contains alcohol}', 2),
  ('195', '0b', 'Heineken Draught 500ml', '', 55, null, '{contains alcohol}', 3),
  ('196', '0b', 'Stella Artois', '', 46, null, '{contains alcohol}', 4),
  ('197', '0b', 'Windhoek Draught', '', 52, null, '{contains alcohol}', 5),
  ('198', '0b', 'Black Label', '', 42, null, '{contains alcohol}', 6),
  ('199', '0b', 'Guinness', '', 60, null, '{contains alcohol}', 7),
  ('200', '0b', 'Savanna Dry', '', 52, null, '{contains alcohol}', 8),
  ('201', '0b', 'Hunters Dry', '', 48, null, '{contains alcohol}', 9),
  ('202', '0b', 'Heineken 0.0', 'Alcohol-free.', 46, null, '{}', 10),
  ('003', '0c', 'Coca-Cola', '', 35, null, '{vegan}', 1),
  ('203', '0c', 'Coke Zero', '', 35, null, '{vegan}', 2),
  ('204', '0c', 'Crème Soda', '', 35, null, '{vegan}', 3),
  ('205', '0c', 'Fanta Orange', '', 35, null, '{vegan}', 4),
  ('206', '0c', 'Peach Ice Tea', '', 40, null, '{vegan}', 5),
  ('207', '0c', 'Appletiser', '', 42, null, '{vegan}', 6),
  ('208', '0c', 'Red Bull', 'Original, Sugar Free or Summer Edition.', 45, null, '{}', 7),
  ('209', '0c', 'Valpré Still or Sparkling 750ml', '', 60, null, '{vegan}', 8),
  ('210', '0c', 'San Pellegrino 750ml', '', 90, null, '{vegan}', 9),
  ('211', '0c', 'Orange Juice', '', 38, null, '{vegan}', 10),
  ('212', '0d', 'Espresso', '', 32, null, '{vegan}', 1),
  ('213', '0d', 'Americano', '', 38, null, '{vegan}', 2),
  ('214', '0d', 'Cappuccino', '', 44, null, '{vegetarian}', 3),
  ('215', '0d', 'Flat White', '', 38, null, '{vegetarian}', 4),
  ('216', '0d', 'Latte', '', 44, null, '{vegetarian}', 5),
  ('217', '0d', 'Red Cappuccino', '', 44, null, '{vegetarian}', 6),
  ('218', '0d', 'Hot Chocolate', '', 44, null, '{vegetarian}', 7),
  ('219', '0d', 'Rooibos Tea', '', 38, null, '{vegan}', 8),
  ('220', '0d', 'Earl Grey', '', 38, null, '{vegan}', 9)
) v(id, m, name, description, rand, img, tags, sort);

insert into menu_items (id, restaurant_id, menu_id, name, description, price_cents, sort_order) values
  ('b2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Rump 300g', '', 21000, 1);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  crypt(u.pass, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'kitchen@demo.test', 'demo-kitchen-pass'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'kitchen@other.test', 'other-kitchen-pass'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'waiter@demo.test', 'demo-waiter-pass'),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'owner@demo.test', 'demo-owner-pass')) u(id, email, pass);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email in ('kitchen@demo.test', 'kitchen@other.test', 'waiter@demo.test', 'owner@demo.test');

insert into staff_memberships (restaurant_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'kitchen'),
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'kitchen'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'waiter'),
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'owner');

-- Local demo tables start with an open dining session so the existing QR demo remains usable.
insert into table_sessions (restaurant_id, table_id, opened_by)
select t.restaurant_id, t.id,
  case when t.restaurant_id = 'a0000000-0000-0000-0000-000000000001'
    then 'c0000000-0000-0000-0000-000000000004'::uuid
    else 'c0000000-0000-0000-0000-000000000002'::uuid end
from tables t;
