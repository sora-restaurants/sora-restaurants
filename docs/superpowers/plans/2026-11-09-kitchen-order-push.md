# Kitchen Order Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer's QR order reaches the restaurant's live kitchen dashboard within seconds, and no other restaurant can ever subscribe to it.

**Architecture:** Two framework-free handlers, `(Request, deps) => Promise<Response>`, wrapped by thin Next.js route files.
- **Placing an order:** `POST /api/orders` calls the existing `submit_order` function as the service role.
- **Pushing to the kitchen:** `GET /api/kitchen/{restaurantId}/stream` is a Server-Sent Events stream. It checks membership, which gives a 403 for the wrong restaurant, then queries as the signed-in staff user, so RLS gives an empty result as a second line of defence. It sends a snapshot of the active orders, then polls the database and pushes changes.

The database is always the source of truth. A dropped connection just reconnects and gets a new snapshot.

**Why SSE and not WebSockets:** the push only goes one way, from server to kitchen. SSE runs over plain HTTP, the browser reconnects automatically, and it works on Vercel with no socket server. Kitchen actions such as accepting an order stay as normal POSTs.

**Tech Stack:** TypeScript, Vitest 3 with PGlite (the existing harness), Next.js 16 route handlers, the `postgres` 3.x driver, and `@supabase/supabase-js` 2.x (only for checking the staff login token).

**Spec:** the user request of 2026-11-09 (TDD; boundary tests before any implementation), plus `docs/superpowers/specs/2026-11-09-tenant-data-architecture-design.md`.

## Global Constraints

- **Boundary tests first.** Task 1 commits the tests on their own, and they fail. No handler code exists until that commit lands.
- **The browser is never trusted for tenant data.** It never supplies a trusted `restaurant_id`, price or table. Orders resolve the restaurant from `tableToken` only.
- **Wrong restaurant gets 403 and nothing else.** A staff member asking for another restaurant's stream gets 403 with no order data in the body. Queries still run as that user, so RLS returns nothing even if the 403 check is broken.
- **Kitchen roles only.** Stream access is limited to `owner`, `manager` and `kitchen`, the same roles `advance_order` allows.
- **Active orders** are those with status `submitted`, `accepted`, `preparing` or `ready`.
- **Money stays in integer cents** in every payload (`totalCents`).

## Review Focus

1. **Inactive staff mid-shift:** a staff member whose membership was deactivated must get 403 on the next connect. (Task 1, `inactive staff are refused`)
2. **Malformed order body** (bad JSON, missing items, a string quantity): the response must be 400 `invalid_items`, never a 500 that leaks a Postgres error. (Task 1, `malformed body is 400`)
3. **Closing the tab:** when the kitchen tab closes, polling must stop, so idle connections don't hammer the database. (Task 2, `stops polling after abort`)
4. **Waiter role:** a waiter must get 403 on the kitchen stream. (Task 1, `waiter is refused`)
5. **A restaurant ID that is not a valid uuid** must get 403, not a 500. (Task 1, `garbage restaurant id is 403`)

---

### Task 1: Boundary tests (no implementation)

**Files:**
- Modify: `supabase/seed.sql`. Add Demo Bistro `'Table 4'` with token `demo-table-4-token`, and a waiter user `c0000000-0000-0000-0000-000000000003` (`waiter@demo.test` / `demo-waiter-pass`) with role `waiter` at Demo Bistro.
- Modify: `supabase/tests/fixtures.ts`. Add `ROOIBOS = "a2000000-0000-0000-0000-000000000003"` and `WAITER_USER = "c0000000-0000-0000-0000-000000000003"`.
- Modify: `vitest.config.ts`. Add `apps/web/**/*.test.ts` to `include`.
- Create: `apps/web/src/server/test-deps.ts`
- Create: `apps/web/src/server/kitchen-push.test.ts`

**Interfaces:**
- Produces, in `apps/web/src/server/deps.ts` (Task 2 creates this file; Task 1 only imports its types):
  ```ts
  export interface Db {
    asService<T>(sql: string, params?: unknown[]): Promise<T[]>;
    asUser<T>(userId: string, sql: string, params?: unknown[]): Promise<T[]>; // RLS applies
  }
  export interface Deps { db: Db; verifyStaffToken(bearer: string): Promise<string | null>; pollMs: number }
  ```
- Produces: `testDeps(db: PGlite): Deps` in `test-deps.ts`:
  - `asUser` wraps `asStaff` from `supabase/tests/db.ts`.
  - `verifyStaffToken` maps `"token-A"` to the demo kitchen user, `"token-B"` to the other kitchen user, and `"token-waiter"` to the waiter. Anything else gives `null`.
  - `pollMs` is `50`.
- Consumes (Task 2 implements these): `placeOrder(req: Request, deps: Deps): Promise<Response>` from `apps/web/src/server/place-order.ts`, and `kitchenStream(req: Request, restaurantId: string, deps: Deps): Promise<Response>` from `apps/web/src/server/kitchen-stream.ts`.
- Test helper, in the test file: `readEvents(res: Response, n: number): Promise<{ event: string; data: any }[]>`. It reads the body until `n` SSE events have been parsed, then cancels the reader.
- Event shapes:
  - `event: snapshot`, `data: { orders: KitchenOrder[] }`
  - `event: order`, `data: KitchenOrder`
  - `KitchenOrder = { id, publicRef, table: string, status, totalCents: number, createdAt, items: { name, quantity, notes }[] }`

- [ ] **Step 1: Write the tests in `kitchen-push.test.ts`.** Use a fresh database per test (`freshDb()`). `post(body)` builds `new Request("http://x/api/orders", { method: "POST", body: JSON.stringify(body) })`. `stream(id, token?)` builds a GET request with `Authorization: Bearer <token>` when a token is given.
  - `customer at Table 4 of Restaurant A places a multi-item order`:
    - POST `{ tableToken: "demo-table-4-token", idempotencyKey: "key-t4-0001", items: [{ menuItemId: BUNNY_CHOW, quantity: 2 }, { menuItemId: ROOIBOS, quantity: 1, notes: "no ice" }] }`.
    - Expect status 201 and a body with a string `statusToken` and `publicRef`.
    - Then `readEvents(await kitchenStream(stream(DEMO, "token-A"), DEMO, deps), 1)`. Expect the snapshot to have exactly one order, with `table: "Table 4"`, `totalCents: 28500`, and 2 items, one of them `{ name: "Rooibos iced tea", quantity: 1, notes: "no ice" }`.
  - `Restaurant B credentials on Restaurant A's queue get 403 and no data`:
    - Place the Table 4 order above, then call `kitchenStream(stream(DEMO, "token-B"), DEMO, deps)`.
    - Expect status 403, and `await res.text()` must not contain the order's `publicRef` or `"Bunny"`.
  - `Restaurant B's own queue does not include Restaurant A's order`: after the Table 4 order, a snapshot of `OTHER` with `"token-B"` gives `orders: []`.
  - `forged restaurantId in the order body is ignored`: POST the same order plus `restaurantId: OTHER`. The order lands in `DEMO` (check with `select restaurant_id from orders`).
  - `new order is pushed to an open stream`:
    - Open `DEMO` with `"token-A"`, read the snapshot (`orders: []`), then place the Table 4 order.
    - The next event is `order` with the same `publicRef`. Cap the wait at 2 seconds.
  - `no or bad token is 401`: no header, and `"Bearer nope"`, both give 401.
  - `inactive staff are refused`: deactivate the demo kitchen membership, then `"token-A"` on `DEMO` gives 403.
  - `waiter is refused`: `"token-waiter"` on `DEMO` gives 403.
  - `garbage restaurant id is 403`: `kitchenStream(..., "not-a-uuid", deps)` with `"token-A"` gives 403.
  - `malformed body is 400`:
    - Body `"{"` gives 400.
    - `{ tableToken: "demo-table-4-token", idempotencyKey: "key-bad-001", items: [{ menuItemId: BUNNY_CHOW, quantity: "2" }] }` gives 400 with `{ error: "invalid_items" }`.
  - `unknown table is 404`: `tableToken: "nope"` gives 404 `{ error: "table_not_found" }`.
- [ ] **Step 2: Run `npx pnpm@10.18.0 test`.** Expected: `kitchen-push.test.ts` FAILS with `Failed to load url ./place-order` (or `./deps`), and the 18 database tests still pass.
- [ ] **Step 3: Commit only the tests and seed:** `test: kitchen push boundary tests (red)`.

### Task 2: Handlers (make the tests pass)

**Files:**
- Create: `apps/web/src/server/deps.ts` (the interfaces from Task 1 only)
- Create: `apps/web/src/server/place-order.ts`
- Create: `apps/web/src/server/kitchen-stream.ts`

**Interfaces:**
- Consumes: `Deps` and `Db`. The SQL functions `submit_order`, `is_member` and the RLS-protected tables, from the tenant plan.
- Produces: `placeOrder` and `kitchenStream` with the signatures in Task 1.

- [ ] **Step 1: Implement `placeOrder`.**
  - Validate the body with a `zod` 3.x schema: `tableToken` string of 1–100 characters, `idempotencyKey` string of 8–100, `items` array of 1–50 objects with `menuItemId` (uuid), `quantity` (int 1–50) and optional `notes` (≤200). Unknown keys are stripped.
  - Call `submit_order` through `db.asService`.
  - Map responses:
    - Success: 201.
    - Validation failure or `invalid_items`: 400.
    - `table_not_found`: 404.
    - `item_unavailable`: 422.
    - `idempotency_conflict`: 409.
    - `order_too_large`: 413.
    - Anything else: 500 `{ error: "internal" }`, logging the error without the body.
- [ ] **Step 2: Implement `kitchenStream`.**
  - Read the Bearer token, then call `verifyStaffToken`. `null` gives 401.
  - If `restaurantId` is not a uuid, return 403.
  - Run `select is_member($1, array['owner','manager','kitchen']) ok` through `asUser`. False gives 403 with body `{ error: "forbidden" }`.
  - Otherwise return a `ReadableStream` with header `content-type: text/event-stream`:
    - Send a `snapshot` of the active orders through `asUser`, filtered by `restaurant_id = $1`.
    - Every `pollMs`, query `updated_at > cursor or created_at > cursor` and send one `order` event per row. The cursor is the largest timestamp seen so far.
    - Send a `: ping` comment every 15 seconds so proxies keep the connection open.
    - Stop the timers on `req.signal` abort and on stream `cancel`.
- [ ] **Step 3: Add the test `stops polling after abort`.** Open a stream with an `AbortController` signal, read the snapshot, abort, wait `pollMs * 4`, and assert that a spy on `deps.db.asUser` was not called after the abort.
- [ ] **Step 4: Run `npx pnpm@10.18.0 test`.** Expected: all tests pass (18 database tests plus 12 kitchen tests).
- [ ] **Step 5: Commit:** `feat(api): order placement and kitchen SSE stream`.

### Task 3: Next.js wiring and production adapters

**Files:**
- Create: the `apps/web` Next.js 16 app (`package.json` named `web`, App Router, strict TypeScript). Generate it with `create-next-app` using `--ts --app --no-tailwind --no-eslint`, then delete the demo page content.
- Create: `apps/web/src/server/prod-deps.ts`
- Create: `apps/web/src/app/api/orders/route.ts`
- Create: `apps/web/src/app/api/kitchen/[restaurantId]/stream/route.ts`
- Create: `.env.example`, using the variables from the README's `.env.example`.

**Interfaces:**
- Produces: `prodDeps(): Deps`.
  - `asService` uses a `postgres(DATABASE_URL)` connection running as `service_role`.
  - `asUser` runs a transaction that does `set local role authenticated` and `set_config('request.jwt.claim.sub', userId, true)`. This is the same mechanism as the test harness, so RLS behaves identically.
  - `verifyStaffToken` calls `supabase.auth.getUser(bearer)` and returns `data.user?.id ?? null`.
  - `pollMs` is `2000`.
- The route files only call the handlers. They set `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"`.

- [ ] **Step 1:** Scaffold the app, add `prod-deps.ts` and the two routes.
- [ ] **Step 2: Run `npx pnpm@10.18.0 -r typecheck` and `npx pnpm@10.18.0 --filter web build`.** Expected: both exit 0.
- [ ] **Step 3: Run `npx pnpm@10.18.0 test`.** Expected: all tests still pass.
- [ ] **Step 4: Manual smoke test** (needs Docker and local Supabase, so it can't be done on this machine yet):
  - Run `pnpm db:start && pnpm db:reset && pnpm dev`.
  - Sign in as `kitchen@demo.test` to get a token.
  - Run `curl -N -H "Authorization: Bearer $T" localhost:3000/api/kitchen/a0000000-0000-0000-0000-000000000001/stream`, then POST an order. The event should appear.
- [ ] **Step 5: Commit:** `feat(web): wire order and kitchen stream routes`.
