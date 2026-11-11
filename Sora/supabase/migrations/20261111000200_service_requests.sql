-- Service request functions. Does not change submit_order, kitchen movement, or SSE.

alter table public.service_request_events drop constraint service_request_events_source_check;
alter table public.service_request_events add constraint service_request_events_source_check
  check (source in ('customer_request', 'staff_acknowledge', 'staff_complete', 'staff_cancel'));

drop index if exists public.service_requests_one_open;
create unique index service_requests_one_active
  on public.service_requests (restaurant_id, table_id, type)
  where status in ('open', 'acknowledged');

create or replace function public.create_service_request(
  p_table_token text,
  p_type text,
  p_notes text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table public.tables;
  v_id uuid;
begin
  if p_type not in ('waiter', 'water', 'cutlery', 'bill', 'other') then
    raise exception 'invalid_type';
  end if;
  select tb.* into v_table
    from public.tables tb
    join public.restaurants r on r.id = tb.restaurant_id
   where tb.qr_token = p_table_token and tb.active and r.status = 'active';
  if not found then raise exception 'table_not_found'; end if;

  select id into v_id
    from public.service_requests
   where restaurant_id = v_table.restaurant_id
     and table_id = v_table.id
     and type = p_type
     and status in ('open', 'acknowledged')
   limit 1;
  if found then return v_id; end if;

  begin
    insert into public.service_requests (restaurant_id, table_id, type, notes)
    values (v_table.restaurant_id, v_table.id, p_type, left(coalesce(p_notes, ''), 200))
    returning id into v_id;
    insert into public.service_request_events (request_id, restaurant_id, to_status, source)
    values (v_id, v_table.restaurant_id, 'open', 'customer_request');
    return v_id;
  exception when unique_violation then
    select id into v_id
      from public.service_requests
     where restaurant_id = v_table.restaurant_id
       and table_id = v_table.id
       and type = p_type
       and status in ('open', 'acknowledged')
     limit 1;
    if v_id is null then raise exception 'retryable'; end if;
    return v_id;
  end;
end $$;

create or replace function public.update_service_request(p_id uuid, p_to text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.service_requests;
begin
  if p_to not in ('acknowledged', 'completed', 'cancelled') then
    raise exception 'invalid_transition';
  end if;
  select * into v_row from public.service_requests where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.is_member(v_row.restaurant_id, array['owner', 'manager', 'waiter']) then
    raise exception 'not_found';
  end if;
  if p_to = 'acknowledged' and v_row.status <> 'open' then raise exception 'invalid_transition'; end if;
  if p_to = 'completed' and v_row.status not in ('open', 'acknowledged') then raise exception 'invalid_transition'; end if;
  if p_to = 'cancelled' and v_row.status not in ('open', 'acknowledged') then raise exception 'invalid_transition'; end if;

  update public.service_requests
     set status = p_to,
         updated_at = now(),
         acknowledged_at = case when p_to = 'acknowledged' then now() else acknowledged_at end,
         acknowledged_by = case when p_to = 'acknowledged' then auth.uid() else acknowledged_by end,
         completed_at = case when p_to = 'completed' then now() else completed_at end,
         completed_by = case when p_to = 'completed' then auth.uid() else completed_by end
   where id = p_id;

  insert into public.service_request_events (
    request_id, restaurant_id, from_status, to_status, actor_user_id, source
  ) values (
    p_id, v_row.restaurant_id, v_row.status, p_to, auth.uid(),
    case p_to
      when 'acknowledged' then 'staff_acknowledge'
      when 'completed' then 'staff_complete'
      else 'staff_cancel'
    end
  );
end $$;

revoke all on function public.create_service_request(text, text, text) from public;
revoke all on function public.update_service_request(uuid, text) from public;
grant execute on function public.create_service_request(text, text, text) to service_role;
grant execute on function public.update_service_request(uuid, text) to authenticated;
alter function public.create_service_request(text, text, text) owner to sora_definer;
alter function public.update_service_request(uuid, text) owner to sora_definer;

-- create_service_request resolves the table from the QR token.
grant select on public.tables, public.restaurants to sora_definer;
create policy definer_read_tables on public.tables for select to sora_definer using (true);
create policy definer_read_restaurants on public.restaurants for select to sora_definer using (true);
