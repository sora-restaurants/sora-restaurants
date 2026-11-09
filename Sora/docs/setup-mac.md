# Run Sora on a Mac (Apple Silicon) with local Supabase

Status: **written from the code, not yet run end to end.** Docker was unavailable on the machine Sora was built on,
so the local Supabase path below is untested. The tests, demos and design previews are verified
(`docs/verification/`). Note anything that differs in the "What happened" section at the bottom.

## 1. Install once

- Node 22 or newer: `node -v`
- pnpm 10: `corepack enable` (the project pins `pnpm@10.18.0`)
- Docker Desktop for Mac (Apple Silicon). Start it and wait until it says the engine is running.

## 2. Get the code

```bash
git clone <private repo URL> sora
cd sora
git checkout tenant-data-architecture
git log -1 --oneline        # compare with Juan's latest commit
pnpm install
pnpm test                   # expect all passing, 1 skipped
```

## 3. Start local Supabase (disposable)

```bash
pnpm db:start               # first run downloads images, several minutes
pnpm db:reset               # DELETES the local database, then applies migrations + supabase/seed.sql
```

`db:start` prints local URLs and keys. They are for this machine only; never paste them into chat or GitHub.

## 4. Configure the web app

Next.js reads env vars from **`apps/web/.env.local`**, not the project root.

```bash
cp .env.example apps/web/.env.local
```

Then edit `apps/web/.env.local`:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `API URL` printed by `db:start` (normally `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon key` printed by `db:start` |
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (local Supabase default) |

Leave everything else as it is.

## 5. Run it

On the Mac only:

```bash
pnpm dev
```

From your phone on the same, trusted Wi-Fi:

```bash
pnpm dev:lan                # listens on your network, not only localhost
ipconfig getifaddr en0      # your Mac's Wi-Fi address, e.g. 192.168.1.23
```

Use that address in place of `localhost` on the phone. Stop the server (Ctrl-C) when you leave that network.

## 6. Demo URLs

| Page | URL |
|---|---|
| Customer menu, Demo Bistro Table 4 | `http://<host>:3000/t/demo-table-4-token` |
| Kitchen board (sign in) | `http://<host>:3000/kitchen` |
| Design previews, no database | `/preview/kitchen`, `/preview/rustic-traditional`, `/preview/luxury-minimal`, `/preview/fast-casual-vibrant` |

Seeded staff logins (local only, from `supabase/seed.sql`):

| Email | Password | Restaurant, role |
|---|---|---|
| `kitchen@demo.test` | `demo-kitchen-pass` | Demo Bistro, kitchen |
| `kitchen@other.test` | `other-kitchen-pass` | Other Grill, kitchen (use to check isolation) |
| `waiter@demo.test` | `demo-waiter-pass` | Demo Bistro, waiter (should be refused by the board) |

## 7. Acceptance checklist

Check the database while testing (`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`, or Supabase Studio at
the `Studio URL` from `db:start`):

1. Open the Table 4 menu on the phone.
2. Add food and drinks.
3. Place the order: the bar shows "Order sent to the kitchen" with a reference.
4. Signed in as `kitchen@demo.test`, the ticket appears in **New** within about 2 seconds.
5. Start, then Ready, then Served: it moves columns and leaves the board.
6. `select public_ref, status, total_cents, vat_cents from orders order by created_at desc limit 1;`
   shows `served`, the total in cents, and VAT (Demo Bistro is VAT-registered at 15% inclusive).
7. Duplicate: tap "Place order" twice quickly. `select count(*) from orders;` goes up by one.
8. Isolation: sign in as `kitchen@other.test` and open the board. Demo Bistro's order must not appear.

## What happened

Record the date, commit, what worked, and anything that did not.
