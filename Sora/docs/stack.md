# Stack and layout

For coordinating frontend and backend work. Versions are pinned exactly in the `package.json` files.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Node 22+ (`.nvmrc`), pnpm 10.18 workspaces |
| Web app | Next.js 16 (App Router, Server Actions, route handlers), React 19, TypeScript 5.9 strict |
| Styling | Tailwind CSS 4, OKLCH design tokens; three QR-menu themes chosen per restaurant row |
| Database | PostgreSQL via Supabase: RLS on every table, composite `(restaurant_id, id)` foreign keys, SQL functions for every write |
| Auth | Supabase Auth for staff (bearer token); customers use opaque QR and status tokens, never a login |
| Server DB access | `postgres` (postgres.js) with `prepare: false` for the Supabase pooler; staff queries `SET ROLE authenticated` so RLS applies |
| Live kitchen board | Server-Sent Events over `fetch` (polls the database every 2 s; database is the source of truth) |
| Validation | zod `.strict()` on every request body |
| Tests | Vitest 3 on PGlite (fast, in-process) and on real PostgreSQL 17 (`embedded-postgres`) |

## How a QR order flows

```
Phone /t/<qr_token>  ──► get_table_menu(token)        restaurant, table, theme, menu (server only)
Menu "Place order"   ──► submitOrderAction (Server Action) ─► submitOrder() ─► submit_order() SQL
                         same core also at POST /api/orders     prices, VAT, idempotency, print job
Kitchen /kitchen     ──► GET /api/kitchen/<restaurant>/stream   SSE: snapshot, order, order_removed, revoked
Start/Ready/Served,      POST /api/kitchen/orders/<id>/advance  kitchen_move() SQL: one transaction per tap;
Reject/Cancel (2 taps) ──►                                       forward only, reject = new, cancel = cooking/ready
```

The browser never sends a trusted restaurant, table or price. Restaurant comes from the QR token (customers)
or the staff login (kitchen).

## Folders

```
apps/web/                         Next.js app (package "web")
  src/app/
    t/[token]/page.tsx            customer QR menu (themed)
    actions/submit-order.ts       checkout Server Action
    api/orders/route.ts           checkout over HTTP (16 KB body cap)
    api/kitchen/[restaurantId]/stream/route.ts     kitchen SSE stream
    api/kitchen/orders/[orderId]/advance/route.ts  kitchen status changes
    kitchen/page.tsx              kitchen tablet (Supabase sign-in + live board)
    preview/[theme], preview/kitchen   dev-only design previews, 404 in production
  src/server/                     framework-free handlers + their tests (submit-order, kitchen-stream, advance-order)
  src/kitchen/                    board UI, board state reducer, SSE parser, stream hook
  src/components/menu/            customer menu UI
  src/themes/                     theme ids (must match the database check constraint)
supabase/
  migrations/                     schema, RLS, SQL functions, indexes (timestamped, append-only)
  seed.sql                        local demo data: Demo Bistro, Other Grill, test logins
  tests/                          database tests; db.ts switches PGlite / real PostgreSQL
scripts/
  simulate-order.mjs              terminal checkout; `demo:pipeline` runs the whole flow in memory
  isolation-demo.mjs              two-restaurant RLS demo
  kitchen-index-bench.mjs         EXPLAIN ANALYZE benchmark on 1M orders
docs/
  stack.md                        this file
  verification/                   test and benchmark evidence, how to reproduce
  superpowers/specs, plans/       design decisions and build plans
```

## Commands

| Command | Does |
|---|---|
| `pnpm install` | install everything |
| `pnpm dev` | web app on http://localhost:3000 (needs `apps/web/.env.local`, see `docs/setup-mac.md`) |
| `pnpm dev:lan` | same, reachable from a phone on the same Wi-Fi |
| `pnpm test` / `pnpm test:realpg` | test suite on PGlite / on a real PostgreSQL 17 server |
| `pnpm demo:pipeline` | QR order → kitchen stream, in memory, no server |
| `pnpm db:start`, `pnpm db:reset` | local Supabase (needs Docker) |

## Who owns what

Frontend: `apps/web/src/app/**/page.tsx`, `src/components`, `src/kitchen/*.tsx`, `src/themes`, `globals.css`.
Backend: `apps/web/src/server`, `src/app/api`, `src/app/actions`, `supabase/`.
Contract between them: `apps/web/src/server/deps.ts` (`SubmitResult`, `KitchenOrder`) and the SSE event names above.
Change those only together, in one pull request.
