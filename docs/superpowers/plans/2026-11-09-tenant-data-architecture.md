# Tenant Data Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the draft Supabase migration in line with the approved tenant design and prove cross-restaurant isolation with automated tests.

**Architecture:** One shared Postgres database. Every tenant table carries `restaurant_id`, has RLS on, and links to its parents by `(restaurant_id, id)`. Customers act only through `SECURITY DEFINER` functions keyed by tokens. Tests run the real migration and seed in PGlite (in-process Postgres, so no Docker), with a stub of Supabase's `auth` schema.

**Tech Stack:** Supabase migrations (Postgres 15+ SQL), PGlite 0.3.x with the pgcrypto contrib, Vitest 3, pnpm 10, Node 22.

**Spec:** `docs/superpowers/specs/2026-11-09-tenant-data-architecture-design.md`

## Global Constraints

- Table names: `restaurants`, `staff_memberships`, `tables`, `menus`, `menu_items`, `orders`, `order_items`, `order_events`, `waiter_calls`, `print_jobs`, `idempotency_keys`. The tenant column is `restaurant_id` everywhere.
- Money is `int` cents. Never `float` or `money`. `currency char(3) default 'ZAR' check (currency = 'ZAR')`.
- VAT: `vat_registered boolean default false`, `vat_rate_bp int default 1500`. `vat_cents = round(total_cents * vat_rate_bp / (10000 + vat_rate_bp))` when VAT-registered, else 0.
- RLS is enabled on every table, and children reference parents by a composite `(restaurant_id, id)` foreign key.
- Function grants: customer functions go to `service_role` only, and staff functions to `authenticated`.

## Review Focus

1. Staff from Restaurant B selecting Restaurant A's orders must get 0 rows, not an error leak. (Task 2)
2. An order line whose `menuItemId` belongs to another restaurant must be rejected with `item_unavailable`. (Task 2)
3. A staff member whose membership is `inactive`, or whose restaurant is `suspended`, must see nothing. (Task 2)
4. The same idempotency key with a different cart must raise `idempotency_conflict` and create no second order. (Task 2)
5. VAT rounding on odd totals: R125.00 at 15% gives `vat_cents = 1630`. A non-VAT-registered restaurant gives 0. (Task 2)

---

### Task 1: Rename the schema, add VAT and the kitchen index, and load it in a test

**Files:**
- Modify: `supabase/migrations/20261109000000_phase0.sql` (rename `tenants`→`restaurants`, `menu_categories`→`menus`, `tenant_id`→`restaurant_id`, `category_id`→`menu_id`, and the `p_tenant` parameter of `is_member`→`p_restaurant`)
- Modify: `supabase/seed.sql` (the same renames; set Demo Bistro `vat_registered = true`, leave Other Grill false)
- Create: `supabase/tests/db.ts` (test harness)
- Create: `supabase/tests/schema.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `async function freshDb(): Promise<PGlite>` in `supabase/tests/db.ts`. It creates the roles `anon`, `authenticated` and `service_role`, the schema `auth` with `auth.users` and `auth.identities` (only the columns seed.sql inserts), and `auth.uid()` returning `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`. It then runs the migration and seed.
- Produces: `async function asStaff<T>(db: PGlite, userId: string, sql: string, params?: unknown[]): Promise<T[]>`. It runs inside a transaction with `set local role authenticated` and `set_config('request.jwt.claim.sub', userId, true)`.
- Seed IDs that tests rely on: Demo Bistro `a0000000-0000-0000-0000-000000000001`, Other Grill `b0000000-0000-0000-0000-000000000001`, demo kitchen user `c0000000-0000-0000-0000-000000000001`, other kitchen user `c0000000-0000-0000-0000-000000000002`, tokens `demo-table-1-token` and `other-table-1-token`, Bunny chow `a2000000-0000-0000-0000-000000000001` (12500), Rump `b2000000-0000-0000-0000-000000000001`.

- [ ] **Step 1:** `git init`, then `npx -y pnpm@10.18.0 install` (installs the pinned devDependencies; this creates the lockfile).
- [ ] **Step 2: Write the failing test** `schema.test.ts`:
  - `'migration and seed load'`: `freshDb()` resolves, and `select count(*) from restaurants` = 2.
  - `'every public table has RLS'`: `select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity` returns 0 rows.
  - `'restaurant currency is locked to ZAR'`: inserting a restaurant with `currency='USD'` rejects.
- [ ] **Step 3:** Run `pnpm test`. Expected: FAIL (`relation "restaurants" does not exist`).
- [ ] **Step 4:** Apply the renames to the migration and seed. Add `vat_registered` and `vat_rate_bp` to `restaurants`, and `vat_cents int not null default 0 check (vat_cents >= 0)` to `orders`. Add `create index orders_kitchen on orders (restaurant_id, status, created_at)`. Write `db.ts` and `vitest.config.ts` (`test.include: ['supabase/tests/**/*.test.ts']`).
- [ ] **Step 5:** Run `pnpm test`. Expected: 3 passed.
- [ ] **Step 6:** Commit with the message `feat(db): restaurant-scoped schema with VAT and RLS harness`.

### Task 2: Order VAT and cross-restaurant denial tests

**Files:**
- Modify: `supabase/migrations/20261109000000_phase0.sql` (`submit_order` sets `vat_cents`)
- Create: `supabase/tests/isolation.test.ts`
- Create: `supabase/tests/orders.test.ts`

**Interfaces:**
- Consumes: `freshDb` and `asStaff` from Task 1. `submit_order(p_table_token text, p_idempotency_key text, p_items jsonb) returns jsonb` keeps its existing signature and errors.

- [ ] **Step 1: Write the failing tests.**
  `orders.test.ts`:
  - `'VAT-inclusive total at 15%'`: one Bunny chow on `demo-table-1-token` gives `total_cents=12500, vat_cents=1630`.
  - `'no VAT when not registered'`: one Rump on `other-table-1-token` gives `vat_cents=0`.
  - `'foreign menu item rejected'`: the Rump ID on `demo-table-1-token` throws `/item_unavailable/`, and `orders` stays empty.
  - `'same key replays'`: submitting twice with the same key and cart leaves `count(*) from orders` = 1, and the second result has `replayed: true`.
  - `'same key different cart conflicts'`: this throws `/idempotency_conflict/`, and the order count stays 1.

  `isolation.test.ts` (place one order per restaurant first):
  - `'staff see own restaurant only'`: the demo user reading `orders` returns 1 row, and all of them have Demo Bistro's `restaurant_id`. Repeat for `tables`, `menus`, `menu_items`, `order_items`, `print_jobs` and `restaurants`.
  - `'other staff cannot read or advance'`: the other user reading `orders where restaurant_id = demo` gets 0 rows, and `advance_order(<demo order id>, 'accepted')` throws `/not_found/`.
  - `'inactive membership sees nothing'`: set the demo membership `inactive`, and the demo user reads 0 orders.
  - `'suspended restaurant sees nothing'`: set Demo Bistro `suspended`, and the demo user reads 0 orders.
  - `'anon and authenticated cannot call customer functions'`: `submit_order` as `authenticated` throws `/permission denied/`.
  - `'cross-restaurant FK impossible'`: inserting an `order_items` row with Demo's `restaurant_id` and Other's order ID throws `/foreign key/`.
- [ ] **Step 2:** Run `pnpm test`. Expected: FAIL only on `'VAT-inclusive total at 15%'` (`vat_cents` is 0). If any isolation test fails, fix the migration.
- [ ] **Step 3:** In `submit_order`, after summing, set `vat_cents` using the Global Constraints formula with the restaurant's `vat_registered` and `vat_rate_bp`.
- [ ] **Step 4:** Run `pnpm test`. Expected: all pass.
- [ ] **Step 5:** Commit with the message `feat(db): order VAT and cross-restaurant isolation tests`.
