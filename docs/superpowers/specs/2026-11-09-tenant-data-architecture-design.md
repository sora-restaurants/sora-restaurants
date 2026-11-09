# Tenant data architecture — design

Status: **Proposed** (awaiting founder approval). Date: 2026-11-09.

## Intent

Restaurants on the platform must never see each other's data — enforced by the database, not by
remembering a filter in app code. Three founders and several AI assistants will write queries; one
missed `WHERE` must fail safe, not leak orders (a POPIA incident). It must stay fast and cheap for a
small pilot.

- **Goals:** database-enforced isolation; correct rand amounts; fast tenant-scoped queries; simple
  enough to test every table for cross-tenant denial.
- **Non-goals (now):** franchise/group head-office views, payments, POS sync, modifiers, bookings.
- **Anti-goals:** any design where app code is the only thing standing between two restaurants;
  money stored as floats; the browser supplying a trusted price, restaurant or table.

## Decided

- **Tenant = one restaurant.** A franchise branch (e.g. one Spur) is its own tenant. A group/organisation
  layer above restaurants is a later migration, not built now.
- **Approach B** (founders delegated the choice; this is Claude's call):

| Approach | Verdict |
|---|---|
| A. `restaurant_id` column + middleware filter only | Rejected: one forgotten filter leaks data; the database never refuses. |
| **B. `restaurant_id` column + Postgres RLS + composite foreign keys** | **Chosen:** wrong app code still returns nothing; same speed as A when indexed; native in Supabase. |
| C. Schema/database per restaurant | Rejected for now: N× migrations and cost; keep for an enterprise contract that requires it. |

## Rules

1. Every tenant-owned table has `restaurant_id uuid not null`, and RLS enabled with no exceptions.
2. Children reference parents by **`(restaurant_id, id)`** composite foreign keys, so a row can never
   link to another restaurant's row, even through a bug.
3. Staff **read** through RLS: a row is visible only if `auth.uid()` has an active membership in that
   restaurant. Staff **write** through `SECURITY DEFINER` functions that check membership and role.
4. Customers have no table access. The server calls functions keyed by an opaque `qr_token` (table)
   or `status_token` (order); the restaurant is derived from the token, never sent by the browser.
5. Money: **integer cents** (`int`; `bigint` for future aggregates). R125.00 = `12500`. Never `float`
   or Postgres `money`. Menu prices are VAT-inclusive (SA consumer pricing); VAT is derived and stored
   on the order snapshot.
6. Orders snapshot item name and unit price, so menu edits never change history.
7. Every test of a tenant table proves: allowed in A, denied from B, denied without membership,
   forged IDs rejected.

## Schema

```sql
restaurants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  status          text not null default 'active' check (status in ('active','suspended')),
  timezone        text not null default 'Africa/Johannesburg',
  currency        char(3) not null default 'ZAR' check (currency = 'ZAR'),
  vat_registered  boolean not null default false,
  vat_rate_bp     int not null default 1500 check (vat_rate_bp between 0 and 10000), -- 15.00%
  created_at      timestamptz not null default now()
)

staff_memberships (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id),
  user_id        uuid not null,                                -- Supabase auth.users.id
  role           text not null check (role in ('owner','manager','kitchen','waiter')),
  status         text not null default 'active' check (status in ('active','inactive')),
  unique (restaurant_id, user_id)
)

tables (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id),
  label          text not null,
  active         boolean not null default true,
  qr_token       text not null unique,                         -- random ≥128 bits; rotate to revoke
  unique (restaurant_id, label),
  unique (restaurant_id, id)
)

menus (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants(id),
  name           text not null,                                -- "Mains", "Drinks"
  sort_order     int not null default 0,
  available      boolean not null default true,
  unique (restaurant_id, id)
)

menu_items (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null,
  menu_id        uuid not null,
  name           text not null,
  description    text not null default '',
  price_cents    int not null check (price_cents >= 0),        -- VAT-inclusive
  available      boolean not null default true,
  sort_order     int not null default 0,
  unique (restaurant_id, id),
  foreign key (restaurant_id, menu_id) references menus (restaurant_id, id)
)

orders (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null,
  table_id        uuid not null,
  public_ref      text not null,                               -- short code for staff
  status          text not null default 'submitted' check (status in
                  ('submitted','accepted','preparing','ready','served','rejected','cancelled')),
  subtotal_cents  int not null check (subtotal_cents >= 0),    -- sum of lines, VAT-inclusive
  vat_cents       int not null default 0 check (vat_cents >= 0), -- portion of total; 0 if not VAT-registered
  total_cents     int not null check (total_cents >= 0),
  source          text not null default 'qr' check (source = 'qr'),
  status_token    text not null unique,                        -- customer's private status link
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (restaurant_id, id),
  foreign key (restaurant_id, table_id) references tables (restaurant_id, id)
)

order_items (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null,
  order_id          uuid not null,
  menu_item_id      uuid not null,
  name_snapshot     text not null,
  unit_price_cents  int not null check (unit_price_cents >= 0),
  quantity          int not null check (quantity between 1 and 50),
  notes             text not null default '' check (length(notes) <= 200),
  foreign key (restaurant_id, order_id)     references orders (restaurant_id, id),
  foreign key (restaurant_id, menu_item_id) references menu_items (restaurant_id, id)
)
```

VAT on an order: `vat_cents = round(total_cents * vat_rate_bp / (10000 + vat_rate_bp))` when
`vat_registered`, else 0.

RLS, applied to every table above (on `restaurants` the column is `id`):

```sql
create function is_member(p_restaurant uuid, p_roles text[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_memberships m join restaurants r on r.id = m.restaurant_id
    where m.restaurant_id = p_restaurant and m.user_id = auth.uid()
      and m.status = 'active' and r.status = 'active'
      and (p_roles is null or m.role = any(p_roles)))
$$;

alter table orders enable row level security;
create policy staff_read on orders for select to authenticated using (is_member(restaurant_id));
```

Indexes: composite unique `(restaurant_id, id)` keys cover most lookups; add
`orders (restaurant_id, status, created_at)` for the kitchen board.

## Left to the builder

- Rename the existing draft migration (`tenants`, `menu_categories`, `tenant_id`) to these names and
  add the VAT fields.
- Customer and staff functions (`submit_order`, `advance_order`, etc.) as already drafted.
- Automated cross-tenant denial tests for each table.
