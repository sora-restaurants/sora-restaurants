# Real-Time Order Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest checkout, sent from a phone or from the terminal, reaches the restaurant's live kitchen board within seconds. The client can't influence price, restaurant or table, and no other restaurant can subscribe to the board.

**Architecture:**
- **Shared core:** one framework-free function, `submitOrder(input, deps)`, validates the payload and calls the existing `submit_order` SQL function. That function finds the restaurant and table from `qr_token` and prices every line from the database.
- **Two thin entry points use that core:** the Server Action `app/actions/submit-order.ts`, called from the web page, and `POST /api/orders`, called from the terminal script and anything else outside the web page.
- **Kitchen push:** `GET /api/kitchen/{restaurantId}/stream` is a Server-Sent Events stream. It checks membership first (403 for the wrong restaurant). It then queries as the signed-in staff user, so row-level security (RLS) gives an empty result as a second line of defence. It sends only active tickets, matching `idx_active_kitchen_orders`, plus a removal event when a ticket leaves the active set.

**Why SSE and not Supabase Realtime:**
- **Filtering:** a Realtime `postgres_changes` subscription allows one filter. It can't express "this restaurant **and** an active status", and it can't send a removal event when an order leaves the active set.
- **Testing:** Realtime can only be tested against a running Supabase, which needs Docker. This machine doesn't have it.
- **SSE avoids both:** the filtering is ordinary server-side SQL, it can be tested with PGlite today, and it runs on Vercel with no socket server.
- The database is always the source of truth. A dropped connection reconnects and gets a fresh snapshot.

**Tech Stack:** TypeScript, Vitest 3 with PGlite (the existing harness), `zod` 3.x, Next.js 16 (App Router, Server Actions, route handlers), the `postgres` 3.x driver, `@supabase/supabase-js` 2.x (only for checking staff tokens), and Node 22 for the `.mjs` script.

**Spec:** the user request of 2026-11-09 (real-time order routing pipeline), plus `docs/superpowers/specs/2026-11-09-tenant-data-architecture-design.md`.

## Global Constraints

- **Only these fields are accepted.** The order payload is exactly `{ qrToken: string, idempotencyKey: string, items: { menuItemId: uuid, quantity: int 1–50, notes?: string ≤200 }[] (1–50) }`. Any other key, such as `restaurantId`, `tenantId`, `tableId`, `priceCents` or `totalCents`, is **rejected** with 400 `{ error: "unexpected_field" }`, not silently dropped.
  - `idempotencyKey` is accepted because it lets a retry on a flaky connection avoid creating a second order. It decides nothing about price, restaurant or table.
  - `notes` is the customer's free text for the kitchen.
- **The server decides price, restaurant and table.** It finds `restaurant_id` and `table_id` only from `qr_token`, and works out every price and total only from `menu_items.price_cents` inside `submit_order`. Both already exist and are tested.
- **QR tokens can't be guessed:** they come from `gen_random_uuid()` with the dashes removed, which is 122 random bits.
- **The board shows active tickets only:** status `IN ('submitted', 'accepted', 'preparing', 'ready')`.
- **Only kitchen roles get the stream:** `owner`, `manager` and `kitchen`. Anyone else gets 403 with no order data in the body.
- **Money stays in integer cents** in every payload (`totalCents`).
- **Boundary tests first.** Task 1 commits failing tests on their own, and no handler code exists until that commit lands.

## Review Focus

1. **A ticket marked served must leave the board.** Without a removal event it would stay on screen forever. (Task 2, `served order is removed from the board`)
2. **Malformed bodies** (bad JSON, a string quantity, an empty cart) must get 400 `invalid_items`, never a 500 that leaks a Postgres error. (Task 1)
3. **A staff member deactivated mid-shift** must get 403 on their next connect. (Task 1)
4. **When the kitchen tab closes**, polling must stop. (Task 2, `stops polling after abort`)
5. **When the simulator hits a server that isn't running**, it must print a clear message and exit 1, not crash with a raw stack trace. (Task 4)

---

### Task 1: Boundary tests (no implementation)

**Files:**
- Modify: `supabase/seed.sql`. Add Demo Bistro `'Table 4'` with token `demo-table-4-token`, and a waiter user `c0000000-0000-0000-0000-000000000003` (`waiter@demo.test` / `demo-waiter-pass`, role `waiter`, at Demo Bistro).
- Modify: `supabase/tests/fixtures.ts`. Add `ROOIBOS = "a2000000-0000-0000-0000-000000000003"` and `WAITER_USER = "c0000000-0000-0000-0000-000000000003"`.
- Modify: `vitest.config.ts`. Add `apps/web/**/*.test.ts` and `scripts/**/*.test.ts` to `include`.
- Create: `apps/web/src/server/test-deps.ts`
- Create: `apps/web/src/server/order-routing.test.ts`

**Interfaces:**
- Produces, in `apps/web/src/server/deps.ts` (Task 2 creates the file; Task 1 only imports its types):
  ```ts
  export interface Db {
    asService<T>(sql: string, params?: unknown[]): Promise<T[]>;
    asUser<T>(userId: string, sql: string, params?: unknown[]): Promise<T[]>; // RLS applies
  }
  export interface Deps { db: Db; verifyStaffToken(bearer: string): Promise<string | null>; pollMs: number }
  export type SubmitResult =
    | { ok: true; statusToken: string; publicRef: string; replayed: boolean }
    | { ok: false; httpStatus: 400 | 404 | 409 | 413 | 422 | 500; error: string };
  export type KitchenOrder = { id: string; publicRef: string; table: string; status: string; totalCents: number;
    createdAt: string; items: { name: string; quantity: number; notes: string }[] };
  ```
- Produces: `testDeps(db: PGlite): Deps`.
  - `asUser` wraps `asStaff` from `supabase/tests/db.ts`.
  - Bearer `"token-A"` maps to the demo kitchen user, `"token-B"` to the other kitchen user, and `"token-waiter"` to the waiter. Anything else gives `null`.
  - `pollMs` is `50`.
- Consumes (Task 2 implements these):
  - `submitOrder(input: unknown, deps: Deps): Promise<SubmitResult>` from `apps/web/src/server/submit-order.ts`.
  - `kitchenStream(req: Request, restaurantId: string, deps: Deps): Promise<Response>` from `apps/web/src/server/kitchen-stream.ts`.
- SSE events:
  - `snapshot`, with `{ orders: KitchenOrder[] }` (active orders only, oldest first).
  - `order`, with a `KitchenOrder` (a new or changed active order).
  - `order_removed`, with `{ id, status }` (an order left the active set).
- Test helper in the test file: `readEvents(res, n, timeoutMs = 2000)`. It parses `n` SSE events, then cancels the reader. It rejects on timeout.

- [ ] **Step 1: Write the tests in `order-routing.test.ts`.** Use a fresh database per test.
  - `T4` means `{ qrToken: "demo-table-4-token", idempotencyKey: "key-t4-0001", items: [{ menuItemId: BUNNY_CHOW, quantity: 2 }, { menuItemId: ROOIBOS, quantity: 1, notes: "no ice" }] }`.
  - **Checkout:**
    - `Table 4 at Restaurant A places a multi-item order`: `submitOrder(T4)` returns `ok: true`. The stored order has `restaurant_id = DEMO`, its table's label is `'Table 4'`, and `total_cents = 28500`.
    - `client-supplied price is rejected`: `T4` with `priceCents: 1` on an item gives `{ ok: false, httpStatus: 400, error: "unexpected_field" }`, and no order is stored.
    - `client-supplied restaurant or table is rejected`: `T4` plus `restaurantId: OTHER`, and separately `T4` plus `tableId: <any uuid>`. Both give 400 `unexpected_field`, and no order is stored.
    - `unknown QR token is 404`: `qrToken: "nope"` gives 404 `table_not_found`.
    - `malformed body is 400`: `"{"` as the input, `quantity: "2"`, and `items: []` all give 400 `invalid_items`.
  - **Kitchen board:**
    - `A's board shows Table 4's order`: after `T4`, the snapshot for `DEMO` with `"token-A"` has one order, with `table: "Table 4"`, `totalCents: 28500`, and items including `{ name: "Rooibos iced tea", quantity: 1, notes: "no ice" }`.
    - `Restaurant B credentials on A's board get 403 and no data`: status 403, and the body contains neither the `publicRef` nor `"Bunny"`.
    - `B's own board does not include A's order`: the snapshot for `OTHER` with `"token-B"` has `orders: []`.
    - `new order is pushed to an open board`: open `DEMO`, receive the snapshot `[]`, place `T4`, and the next event is `order` with the matching `publicRef`.
    - `no or bad token is 401`: no header and `"Bearer nope"` both give 401.
    - `inactive staff are refused`, `waiter is refused`, and `garbage restaurant id is 403` each give 403.
- [ ] **Step 2: Run `npx pnpm@10.18.0 test`.** Expected: `order-routing.test.ts` FAILS to import `./submit-order`, and the other 19 tests pass.
- [ ] **Step 3: Commit only the tests and seed:** `test: order routing boundary tests (red)`.

### Task 2: Core checkout and kitchen stream

**Files:**
- Create: `apps/web/src/server/deps.ts` (the types from Task 1)
- Create: `apps/web/src/server/submit-order.ts`
- Create: `apps/web/src/server/kitchen-stream.ts`
- Modify: `apps/web/src/server/order-routing.test.ts` (add the two tests below)

- [ ] **Step 1: Add the failing tests.**
  - `served order is removed from the board`: open the board, place `T4`, then as `"token-A"` call `advance_order` three times (`accepted`, `preparing`, `ready`) and then `served`. The events end with `order_removed` and `{ status: "served" }`.
  - `stops polling after abort`: with a spy on `deps.db.asUser`, abort the request after the snapshot, wait `pollMs * 4`, and check there were no calls after the abort.
- [ ] **Step 2: Implement `submitOrder`.**
  - If the input is a string, `JSON.parse` it. A parse failure gives `invalid_items`.
  - Validate with a `zod` `.strict()` schema at both the top level and the item level. An unrecognized key gives `unexpected_field`, and any other zod error gives `invalid_items`.
  - Call `select submit_order($1, $2, $3::jsonb) r` through `db.asService`.
  - Map SQL errors to results:
    - `invalid_items`: 400.
    - `table_not_found`: 404.
    - `idempotency_conflict`: 409.
    - `order_too_large`: 413.
    - `item_unavailable`: 422.
    - Anything else: 500 `internal`, logged without the payload.
- [ ] **Step 3: Implement `kitchenStream`.**
  - A missing or unknown bearer token gives 401. A restaurant ID that isn't a uuid gives 403. `is_member($1, array['owner','manager','kitchen'])` being false, checked through `asUser`, gives 403 `{ error: "forbidden" }`.
  - Otherwise return `content-type: text/event-stream`:
    - Send a snapshot through `asUser`, using `where restaurant_id = $1 and status in (<active>)`. This uses `idx_active_kitchen_orders`.
    - Every `pollMs`, select `where restaurant_id = $1 and updated_at > $cursor`, with **no** status filter, so orders that leave the active set are seen. Send `order` for active rows and `order_removed` for the rest.
    - Send a `: ping` comment every 15 seconds.
    - Clear the timers on `req.signal` abort and on stream `cancel`.
- [ ] **Step 4: Run `npx pnpm@10.18.0 test`.** Expected: all pass.
- [ ] **Step 5: Commit:** `feat(api): server-priced checkout and active-ticket kitchen stream`.

### Task 3: Next.js entry points

**Files:**
- Create: the `apps/web` Next.js 16 app, generated with `create-next-app` using `--ts --app --src-dir --no-tailwind --no-eslint`. Name the package `web` and empty the demo page.
- Create: `apps/web/src/server/prod-deps.ts`
- Create: `apps/web/src/app/actions/submit-order.ts`
- Create: `apps/web/src/app/api/orders/route.ts`
- Create: `apps/web/src/app/api/kitchen/[restaurantId]/stream/route.ts`
- Create: `.env.example`, using the variables from the README.

**Interfaces:**
- Produces: `prodDeps(): Deps`.
  - `asService` uses `postgres(DATABASE_URL)` as `service_role`.
  - `asUser` runs a transaction with `set local role authenticated` and `set_config('request.jwt.claims', json_build_object('sub', $1)::text, true)`.
  - `verifyStaffToken` calls `supabase.auth.getUser(bearer)`.
  - `pollMs` is `2000`.
- Produces: `"use server"; export async function submitOrderAction(input: unknown): Promise<SubmitResult>`, which is `submitOrder(input, prodDeps())`.
- Produces: `POST /api/orders`, which returns `submitOrder` results as HTTP. Success gives 201 `{ statusToken, publicRef }`. A failure gives its `httpStatus` with `{ error }`.
- The route files set `dynamic = "force-dynamic"` and `runtime = "nodejs"`.

- [ ] **Step 1:** Scaffold the app and add the files above.
- [ ] **Step 2: Run `npx pnpm@10.18.0 --filter web build`.** Expected: exit 0.
- [ ] **Step 3: Run `npx pnpm@10.18.0 test`.** Expected: all pass.
- [ ] **Step 4: Commit:** `feat(web): checkout server action, orders route, kitchen stream route`.

### Task 4: Terminal simulator `scripts/simulate-order.mjs`

**Files:**
- Create: `scripts/simulate-order.mjs`
- Create: `scripts/simulate-order.test.ts`
- Modify: `package.json`. Add `"simulate:order": "node --experimental-strip-types scripts/simulate-order.mjs --url http://localhost:3000"` and `"demo:pipeline": "node --experimental-strip-types scripts/simulate-order.mjs"`.
- Extract: move the Supabase stub and the migration loader from `scripts/isolation-demo.mjs` into `scripts/pglite-db.mjs`, as `export async function loadDb(): Promise<PGlite>`. Both scripts use it.

**Two modes, one script:**
- **Without `--url` (`demo:pipeline`): in-process, no server, no Docker.**
  - Load PGlite through `loadDb()` and seed it from `supabase/seed.sql`.
  - Build deps the same way as `testDeps`.
  - Open the **real** `kitchenStream` for Demo Bistro as `"token-A"`, then call `export async function simulateIncomingScan(qrToken, items)`, which is the **real** `submitOrder`, imported from `apps/web/src/server/submit-order.ts`.
  - Assert, in order:
    1. The result is `ok`.
    2. The order's `total_cents` is `28500`.
    3. Within 2 seconds the stream sends an `order` event with the same `publicRef`.
  - Print `🍳 Kitchen received <publicRef> · <table> · R285.00 · 2× Bunny chow, 1× Rooibos iced tea`, then exit 0. Any failed assertion prints `❌` and exits 1.
  - Node strips TypeScript types natively here, with `--experimental-strip-types` on Node 22.6+ and by default on 24. This means `.ts` imports need explicit extensions and type-only imports must use `import type`.
  - There is no `EventEmitter` mock. The real stream polls the database, so this exercises exactly the code production runs.
- **With `--url`:** the HTTP mode described below.

**Interfaces:**
- CLI: `node scripts/simulate-order.mjs [--url http://localhost:3000] [--table demo-table-4-token] [--items <uuid>:<qty>,...] [--tamper]`.
  - `--items` defaults to Bunny chow ×2 and Rooibos ×1.
  - The idempotency key is `crypto.randomUUID()`.
  - `--tamper` adds `priceCents: 1` to the first item, to show the server refusing it.
- Output on success: `✅ Order <publicRef> placed at <table> — status link token <statusToken>`, with exit code 0.
- Output on a non-2xx response: `❌ <httpStatus> <error>`, with exit code 1.
- Output on a connection error: `❌ Cannot reach <url> — is "pnpm dev" running?`, with exit code 1.

- [ ] **Step 1: Write the failing tests.**
  - In `beforeAll`, start a `node:http` server on port 0 that sends `POST /api/orders` to `submitOrder` using `testDeps(freshDb())`. This is the same mapping as the Task 3 route.
  - Run the script with `execFile` and `--url` pointing at that server.
  - `places Table 4 order from the terminal`: exit 0, stdout contains `✅ Order`, and the database has 1 order with `total_cents = 28500`.
  - `tampered price is refused`: with `--tamper`, exit 1, stdout contains `400 unexpected_field`, and no new order is stored.
  - `server down gives a clear message`: with `--url http://127.0.0.1:9`, exit 1, and the output contains `Cannot reach`.
  - `demo:pipeline runs end to end in memory`: running the script with no `--url` exits 0, and stdout contains `🍳 Kitchen received` and `R285.00`.
- [ ] **Step 2: Run `npx pnpm@10.18.0 test`.** Expected: these 3 tests fail (the script is missing).
- [ ] **Step 3:** Write the script, using `fetch` and `node:util` `parseArgs` with no new dependencies.
- [ ] **Step 4: Run `npx pnpm@10.18.0 test`.** Expected: all pass.
- [ ] **Step 5: Manual check** (needs Docker and local Supabase, which this machine doesn't have yet):
  - Run `pnpm db:start && pnpm db:reset && pnpm dev`.
  - Open the board with `curl -N -H "Authorization: Bearer $T" localhost:3000/api/kitchen/a0000000-0000-0000-0000-000000000001/stream`.
  - Run `pnpm simulate:order`. The `order` event should appear on the board.
- [ ] **Step 6: Commit:** `chore: terminal order simulator`.
