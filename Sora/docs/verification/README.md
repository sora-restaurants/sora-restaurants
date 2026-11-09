# Verification evidence

How we know tenant isolation and the kitchen indexes work, and how to reproduce every number.
Each dated folder holds the raw output of one full run; add a new folder rather than editing an old one.

| Run | Commit | Folder |
|---|---|---|
| 2026-11-09 | `97a1235` | [`2026-11-09/`](2026-11-09/) (`environment.txt` has Node, OS and time) |

## Reproduce

No Docker needed. Node 22+ and `pnpm install` first.

| Command | What it proves | 2026-11-09 result |
|---|---|---|
| `pnpm test` | Full suite on PGlite (the real PostgreSQL engine compiled to WebAssembly) | 59 passed, 1 skipped (real-server-only test) |
| `pnpm test:realpg` | The same suite on a disposable **real PostgreSQL 17.10 server** (`embedded-postgres`, official binaries) | **60 / 60 passed** |
| `pnpm demo:isolation` | Two restaurants; A's staff read 0 of B's active tickets; includes a self-test that RLS-off is detected | exit 0 |
| `pnpm demo:pipeline` | QR checkout → server pricing (R285.00, R37.17 VAT) → live kitchen stream; refuses bad quantity, forged price, other restaurant | exit 0 |
| `pnpm bench:kitchen` | `EXPLAIN ANALYZE` of the board queries on 1,000,000 orders, real PostgreSQL 17 | table below |

## What the real-server run checks that PGlite cannot

- **Connection identity.** Staff queries log in as `authenticator` (non-superuser, `NOINHERIT`) and `SET ROLE authenticated`,
  as Supabase's API does. Test: `real server connection › staff queries log in as authenticator…`
  asserts `session_user = authenticator`, `current_user = authenticated`, `superuser = false`.
- **Supabase-shaped roles.** `anon` and `authenticated` cannot log in; `service_role` has `BYPASSRLS`; `pgcrypto` is real
  (seed passwords are really hashed). See `supabase/tests/real-pg.ts`.

## Proof the isolation tests can fail

A test that cannot fail proves nothing. On 2026-11-09 we added a temporary migration with
`alter table orders disable row level security;` and ran `pnpm test:realpg supabase/tests/isolation.test.ts`:
**4 of 6 isolation tests failed** (own-restaurant-only, other staff cannot read, inactive membership, suspended
restaurant). The file was then deleted. To repeat:

```bash
echo "alter table orders disable row level security;" > supabase/migrations/29991231000000_TEMP_disable_rls.sql
pnpm test:realpg supabase/tests/isolation.test.ts   # expect 4 failures
rm supabase/migrations/29991231000000_TEMP_disable_rls.sql
```

`pnpm demo:isolation` does the same self-test on every run (it disables RLS, expects a leak, re-enables it).

## Kitchen index benchmark (real PostgreSQL 17.10, 1M orders)

100 restaurants × 10,000 orders, 200 active per restaurant (2%), median of 25 `EXPLAIN (ANALYZE, BUFFERS)` runs.
Raw table: [`2026-11-09/bench-kitchen.txt`](2026-11-09/bench-kitchen.txt).

| Query | No kitchen index | Old full index `(restaurant_id, status, created_at)` | Current |
|---|---|---|---|
| Board snapshot (active tickets) | 10.7 ms, 10,085 buffers | 0.23 ms, 208 buffers | **0.18 ms, 202 buffers** via `idx_active_kitchen_orders` |
| Board poll (every 2 s per tablet) | 10.5 ms | 10.5 ms (index unused) | **0.013 ms, 3 buffers** via `idx_orders_board_poll` |
| Index size | — | 48 MB | 232 kB (partial) + 69 MB (poll) |

Findings:

1. **The partial index works**: ~60× faster than no index and as fast as a full index at ~1/200th the size.
2. **The poll was the real cost.** It cannot use the partial index (it must see orders *leaving* the active set),
   so it scanned each restaurant's whole history every 2 s per tablet. Fixed by migration `20261109000300`.
3. **Cached plans.** With the status list as a `$parameter`, a generic (cached) plan cannot use the partial index
   (10.5 ms). The app now writes the list into the SQL; `supabase/tests/board-plans.test.ts` guards this.
   The app's full snapshot query under a generic plan: 1.4 ms (includes the joins), using the partial index.

Caveats: timings are from one Windows laptop with a warm cache; compare ratios, not absolute milliseconds.
Production Supabase runs on Linux with different hardware and connection pooling.

## Not yet verified

- Against a real Supabase project (Auth tokens, PostgREST, the Supavisor pooler): needs `supabase start` (Docker) or a hosted project.
- Real devices: kitchen tablet and phones on restaurant Wi-Fi.
- Load: many tablets polling at once (one connection pool of 10 is shared by checkout and every board).
