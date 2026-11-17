-- One application per email per restaurant, enforced by the database rather than a check-then-insert race.
drop index if exists waitlist_duplicate;
create unique index waitlist_duplicate on restaurant_waitlist_applications (lower(email), lower(restaurant_name));

-- Saves one application from a validated JSON payload (column names as keys). A repeat of the same
-- submission_key, or the same email and restaurant, returns the first application's reference instead.
create function submit_waitlist_application(app jsonb)
returns table (reference text, restaurant_name text, replayed boolean)
language plpgsql security definer set search_path = public as $$
begin
  return query
    insert into restaurant_waitlist_applications
    select * from jsonb_populate_record(null::restaurant_waitlist_applications, app || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'new', 'admin_notes', '', 'consent_at', now(), 'created_at', now(), 'updated_at', now()))
    on conflict do nothing
    returning restaurant_waitlist_applications.reference, restaurant_waitlist_applications.restaurant_name, false;
  if found then return; end if;

  return query
    select a.reference, a.restaurant_name, true from restaurant_waitlist_applications a
    where a.submission_key = app->>'submission_key'
       or (lower(a.email) = lower(app->>'email') and lower(a.restaurant_name) = lower(app->>'restaurant_name'))
    order by a.created_at limit 1;
  if not found then raise exception 'waitlist reference collision, retry'; end if;
end $$;

revoke all on function submit_waitlist_application(jsonb) from public, anon, authenticated;
grant execute on function submit_waitlist_application(jsonb) to service_role;
