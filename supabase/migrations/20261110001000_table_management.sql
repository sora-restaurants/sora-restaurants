-- Table management for owners and managers: add, rename, deactivate, rotate the QR token.
-- Restaurant and role come from the session (is_member), never from the request.

-- p_table_id null adds a table to the caller's restaurant; otherwise renames and/or (de)activates it.
create function save_table(p_table_id uuid, p_label text, p_active boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_id uuid;
begin
  if p_table_id is null then
    select id into v_restaurant from restaurants where is_member(id, array['owner', 'manager']) order by name limit 1;
  else
    select restaurant_id into v_restaurant from tables where id = p_table_id for update;
  end if;
  if v_restaurant is null or not is_member(v_restaurant, array['owner', 'manager']) then
    raise exception 'not_found';
  end if;
  if (p_table_id is null or p_label is not null) and length(trim(coalesce(p_label, ''))) not between 1 and 40 then
    raise exception 'invalid_table';
  end if;
  begin
    if p_table_id is null then
      insert into tables (restaurant_id, label, active) values (v_restaurant, trim(p_label), coalesce(p_active, true))
        returning id into v_id;
    else
      update tables set label = coalesce(trim(p_label), label), active = coalesce(p_active, active)
        where id = p_table_id returning id into v_id;
    end if;
  exception when unique_violation then
    raise exception 'duplicate_table';
  end;
  return v_id;
end $$;

-- New opaque token; the old QR URL stops resolving immediately.
create function rotate_table_qr(p_table_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_token text;
begin
  select restaurant_id into v_restaurant from tables where id = p_table_id for update;
  if not found or not is_member(v_restaurant, array['owner', 'manager']) then
    raise exception 'not_found';
  end if;
  update tables set qr_token = replace(gen_random_uuid()::text, '-', '') where id = p_table_id returning qr_token into v_token;
  return v_token;
end $$;

revoke execute on function save_table(uuid, text, boolean) from public, anon;
revoke execute on function rotate_table_qr(uuid) from public, anon;
grant execute on function save_table(uuid, text, boolean) to authenticated;
grant execute on function rotate_table_qr(uuid) to authenticated;
