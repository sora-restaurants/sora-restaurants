-- Restaurant waitlist applications from the marketing site (/waitlist), reviewed in /admin.
-- Separate from the ordering tables: nothing here references restaurants, orders or staff.

create table restaurant_waitlist_applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  -- One per form session, so a double click or a retry after a dropped connection saves one row.
  submission_key text not null unique check (length(submission_key) between 16 and 64),
  status text not null default 'new'
    check (status in ('new', 'under_review', 'contacted', 'demo_scheduled', 'approved', 'rejected', 'onboarded')),

  restaurant_name text not null,
  restaurant_type text not null,
  city text not null,
  locations int,
  tables_count int,
  seating_capacity int,
  website text,
  social text,

  contact_name text not null,
  contact_position text not null,
  email text not null,
  phone text not null,
  preferred_contact text,
  best_time text,

  pos_system text not null,
  pos_other text,
  ordering_method text,
  uses_qr text,
  kitchen_system text,
  payment_handling jsonb not null default '[]',
  daily_volume text,

  improvements jsonb not null default '[]',
  feature_interests jsonb not null default '[]',
  biggest_challenge text,
  requests text,

  test_timeline text,
  open_to_demo text,
  pilot_interest text,
  comments text,

  admin_notes text not null default '',
  consent_at timestamptz not null,
  -- Salted hash, for rate limiting only; the address itself is never stored.
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index waitlist_created on restaurant_waitlist_applications (created_at desc);
create index waitlist_duplicate on restaurant_waitlist_applications (lower(email), lower(restaurant_name));
create index waitlist_rate on restaurant_waitlist_applications (ip_hash, created_at);

-- No policies: only the server (service_role) reads or writes applicants' personal information.
alter table restaurant_waitlist_applications enable row level security;
revoke all on restaurant_waitlist_applications from anon, authenticated;
grant select, insert, update on restaurant_waitlist_applications to service_role;
