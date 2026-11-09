-- Each restaurant picks one of the QR menu's design systems; the app maps the id to its tokens.
alter table restaurants
  add column theme text not null default 'fast-casual-vibrant'
  check (theme in ('luxury-minimal', 'fast-casual-vibrant', 'rustic-traditional'));

-- Same function as before, now also returning the restaurant's theme.
create or replace function get_table_menu(p_table_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', t.name,
    'theme', t.theme,
    'table', tb.label,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'items', (
        select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name,
          'description', i.description, 'priceCents', i.price_cents) order by i.sort_order, i.name), '[]')
        from menu_items i where i.restaurant_id = c.restaurant_id and i.menu_id = c.id and i.available
      )) order by c.sort_order, c.name)
      from menus c where c.restaurant_id = t.id and c.available
    ), '[]'))
  from tables tb join restaurants t on t.id = tb.restaurant_id
  where tb.qr_token = p_table_token and tb.active and t.status = 'active'
$$;

-- create or replace keeps the earlier grants, but be explicit: customers reach this only through the server.
revoke execute on function get_table_menu(text) from public, anon, authenticated;
grant execute on function get_table_menu(text) to service_role;
