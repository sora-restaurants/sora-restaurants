-- Admin sign-in attempts, so the 8-per-15-minutes limit holds across every server instance.
create table admin_login_attempts (ip_hash text not null, at timestamptz not null default now());
create index admin_login_attempts_ip on admin_login_attempts (ip_hash, at);
alter table admin_login_attempts enable row level security;
revoke all on admin_login_attempts from anon, authenticated;

-- Records one attempt and says whether it is within the limit. Old rows are cleared as it goes.
create function admin_login_allowed(ip text) returns boolean
language sql security definer set search_path = public as $$
  delete from admin_login_attempts where at < now() - interval '1 day';
  insert into admin_login_attempts (ip_hash) values (ip);
  select count(*) <= 8 from admin_login_attempts where ip_hash = ip and at > now() - interval '15 minutes';
$$;
revoke all on function admin_login_allowed(text) from public, anon, authenticated;
grant execute on function admin_login_allowed(text) to service_role;
