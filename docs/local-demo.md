# Local demo: real QR order to kitchen, no Docker, no cloud

Runs the whole journey on one laptop (Windows or Mac) against a real PostgreSQL 17, with a development-only
staff login. For the Supabase version (Docker), see `setup-mac.md`.

## Run it

Two terminals, from the project folder, after `pnpm install`:

```bash
pnpm db:local        # terminal 1: database on 127.0.0.1:54330; first run writes apps/web/.env.local
```

```bash
pnpm dev             # terminal 2: app on http://localhost:3000   (pnpm dev:lan for a phone on the same Wi-Fi)
```

- `pnpm db:local --reset` recreates the database from the migrations and seed (do this after pulling new migrations).
- Ctrl-C in terminal 1 stops the database. Data stays in `.local-pg/` (git-ignored) until a reset.

| Page | URL |
|---|---|
| Customer menu, Demo Bistro Table 4 | http://localhost:3000/t/demo-table-4-token |
| Kitchen board | http://localhost:3000/kitchen |

Kitchen logins (seeded, local only): `kitchen@demo.test` / `demo-kitchen-pass` (Demo Bistro),
`kitchen@other.test` / `other-kitchen-pass` (Other Grill), `waiter@demo.test` / `demo-waiter-pass` (refused by the board).

## How the dev login stays safe

- **Off unless asked for:** needs `DEV_STAFF_LOGIN=1`, `NEXT_PUBLIC_DEV_STAFF_LOGIN=1` and a 32+ character
  `DEV_STAFF_LOGIN_SECRET` (written by `db:local` into `apps/web/.env.local`, git-ignored).
- **Never in production, three ways:** `next build` / `next start` refuse to run with any of those set
  (`next.config.ts`); `prodDeps()` refuses at runtime; the login code returns 404 when `NODE_ENV=production`.
- **Only proves identity:** it checks a seeded account's real (pgcrypto) password and issues a signed token,
  valid 12 hours, holding the user id. Membership, kitchen role and RLS are then checked in the database exactly
  as with a Supabase login.
- Tests: `apps/web/src/server/dev-staff-login.test.ts`, `production-guard.test.ts`.

## Run on 2026-11-09 (Windows, real PostgreSQL 17)

| Check | Result |
|---|---|
| Menu loads from the database; unknown QR token | 200; 404 |
| Kitchen sign-in as `kitchen@demo.test` | board live, Demo Bistro |
| Order from the Table 4 menu (2× Bunny chow, 1× Rooibos iced tea) | "Order sent to the kitchen", ref 4C459C |
| Ticket appears on the board | yes, in New, within one poll |
| Start, Ready, Served | New → Cooking → Ready → off the board |
| Database row | `served`, total 28500, VAT 3717, history submitted → accepted → preparing → ready → served |
| Three simultaneous submits, same idempotency key | 201, 200, 200; one order created |
| Other Grill's kitchen: own restaurants / Demo Bistro board / cancel Demo Bistro order / tampered token | Other Grill only / 403 / 404 / 401 |
| `next build` with the dev settings present | refused, names the three settings |
| Not yet done | a real phone over Wi-Fi (`pnpm dev:lan`) |

Two bugs this run found, both fixed with a failing test first:

1. **Checkout failed against a real server.** postgres.js JSON-encoded the order lines a second time
   (`$3::jsonb`), so every real checkout was refused as `invalid_items`. PGlite and node-postgres did not show it.
   Fix: `$3::text::jsonb`. New test `prod-deps.test.ts` runs the production database code on real PostgreSQL.
2. **Test stand-ins differed from Supabase.** pgcrypto sat in `public`, where the migration revokes function access;
   Supabase keeps it in `extensions`. Test deps also ran server queries as the owner instead of `service_role`.
   Both now match production.
