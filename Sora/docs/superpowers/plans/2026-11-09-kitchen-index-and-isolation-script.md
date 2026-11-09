# Kitchen Index and Isolation Demo Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the kitchen index with the requested partial index, and add a one-command Node script that shows Restaurant A's staff cannot see Restaurant B's active tickets.

**Architecture:** The index change is one edit to the draft migration. The migration has not been applied anywhere yet, so it is edited in place rather than adding a new migration. The script loads the real migration into PGlite with a mocked `auth.uid()`, seeds two restaurants of its own, and exits non-zero if isolation fails. That makes it usable as a demo and as a CI check.

**Tech Stack:** Node 22 (plain ESM `.mjs`, no TypeScript build step), `@electric-sql/pglite` 0.3.11 (already installed), Vitest 3.

**Spec:** the user request of 2026-11-09, plus `docs/superpowers/specs/2026-11-09-tenant-data-architecture-design.md`.

## Already done (no task needed)

These were checked against `supabase/migrations/20261109000000_phase0.sql` on 2026-11-09:

1. **`restaurants.vat_registered`:** line 13, `boolean not null default false`.
2. **`orders.vat_cents`:** line 68, `int not null default 0 check (vat_cents >= 0)`. `submit_order` fills it.
3. **Composite foreign keys:** every child links by `(restaurant_id, id)`: `menu_items→menus`, `orders→tables`, `order_items→orders/menu_items`, `order_events→orders`, `waiter_calls→tables`, `print_jobs→orders`. The test `cross-restaurant FK impossible` already proves it.

## Global Constraints

- **Index definition, exactly:** `CREATE INDEX idx_active_kitchen_orders ON orders (restaurant_id, status) WHERE status IN ('submitted', 'accepted', 'preparing', 'ready');`
- **Restaurant names, exactly:** `'Braai Spot Johannesburg'` (A) and `'Stellenbosch Winery'` (B).
- **The script runs the real migration file.** It must not keep a copy of the schema.

## Review Focus

1. **Duplicate index:** the old `orders_kitchen` index must be removed, not kept alongside the new one, so writes don't pay for two indexes. (Task 1, `only the partial kitchen index exists`)
2. **A script that never really checked anything:** it must fail if A's user sees B's tickets, and also fail if B's user can't see B's own tickets. Otherwise a broken setup that returns 0 rows for everyone would pass. (Task 2, positive control)
3. **No logged-in user:** with no mocked user, the query must return 0 rows. (Task 2)

---

### Task 1: Partial kitchen index

**Files:**
- Modify: `supabase/migrations/20261109000000_phase0.sql:78`
- Modify: `supabase/tests/schema.test.ts`

- [ ] **Step 1: Write the failing test** `only the partial kitchen index exists`.
  - Query `select indexname, indexdef from pg_indexes where tablename = 'orders' and indexname in ('orders_kitchen', 'idx_active_kitchen_orders')`.
  - Expect exactly one row, named `idx_active_kitchen_orders`, whose `indexdef` contains `(restaurant_id, status)` and `WHERE`.
- [ ] **Step 2: Run `npx pnpm@10.18.0 test`.** Expected: this test fails (the row found is `orders_kitchen`), and the other 18 pass.
- [ ] **Step 3:** Replace line 78 with the index from Global Constraints.
- [ ] **Step 4: Run `npx pnpm@10.18.0 test`.** Expected: 19 passed.
- [ ] **Step 5: Commit:** `perf(db): partial index for active kitchen orders`.

### Task 2: Isolation demo script

**Files:**
- Create: `scripts/isolation-demo.mjs`
- Modify: `package.json` (add `"demo:isolation": "node scripts/isolation-demo.mjs"`)

**Interfaces:**
- Consumes: the migration file only. The script copies the small Supabase stub from `supabase/tests/db.ts`: the roles, `auth` schema, `auth.uid()` reading `request.jwt.claim.sub`, and the default grants. It is not imported, because `db.ts` is TypeScript.
- Produces: a command that exits `0` and prints `PASS` lines, or exits `1` and prints which check failed.

- [ ] **Step 1: Write the script with its assertions first**, as a list of checks run in order:
  - **Set up:**
    - Load the stub and the migration.
    - Insert `Braai Spot Johannesburg` and `Stellenbosch Winery`, each with one table, one menu and one item.
    - Insert user A (`c0000000-0000-0000-0000-00000000000a`) as `kitchen` at A, and user B (`…0b`) as `kitchen` at B.
    - Place one order at each restaurant through `submit_order`.
  - **Check `A cannot see B's active tickets`:** as user A, run `select id from orders where restaurant_id = <B> and status in ('submitted','accepted','preparing','ready')`. It must give 0 rows, or an error containing `permission denied`.
  - **Check `B sees its own active tickets` (positive control):** the same query as user B must give exactly 1 row.
  - **Check `no user sees nothing`:** the same query as `authenticated` with no `sub` set must give 0 rows.
  - Use `node:assert/strict`. Print `PASS <name>` per check. On the first failure, print `FAIL <name>: <message>` and set `process.exitCode = 1`.
- [ ] **Step 2: Prove the script can fail.** The script takes an optional migration path, `node scripts/isolation-demo.mjs [migrationFile]`, which defaults to the real one.
  - Write a copy to the system temp directory with every `enable row level security` removed, and run the script on it.
  - Expect `FAIL A cannot see B's active tickets` and exit code 1.
  - Delete the copy.
- [ ] **Step 3: Run `npx pnpm@10.18.0 demo:isolation`.** Expected: 3 `PASS` lines and exit code 0.
- [ ] **Step 4: Run `npx pnpm@10.18.0 test`.** Expected: 19 passed (unchanged).
- [ ] **Step 5: Commit:** `chore: isolation demo script (Braai Spot vs Stellenbosch Winery)`.
