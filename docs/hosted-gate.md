# P0 hosted demo gate

Goal: prove, on the hosted app (https://sora-restaurants.vercel.app) with real Supabase, that a guest's order
reaches a real signed-in kitchen user and moves through the board. No dev login, no simulated payments.

## 0. Production can never use the dev shortcuts (checked in code)

| Shortcut | Guard |
|---|---|
| Dev staff login | `assertNoDevLoginInProduction` (`apps/web/src/server/dev-staff-login.ts`) throws if `DEV_STAFF_LOGIN`, `NEXT_PUBLIC_DEV_STAFF_LOGIN` or `DEV_STAFF_LOGIN_SECRET` is set. It runs in `next.config.ts` for the production build and server phases (the Vercel build fails) and again in `prodDeps()`. `devStaffLoginEnabled` and the `/api/dev/staff-login` route also return false / 404 when `NODE_ENV=production`. Covered by `production-guard.test.ts`. |
| Simulated payments | `payments.ts`: `simulatedPaymentsEnabled` is false when `NODE_ENV=production`, `DEV_SIMULATED_PAYMENTS` is in `DEV_FLAGS` so a production build with it fails, and `payments.test.ts` checks `/api/payments/simulate` is 404 in production. |

## 1. Vercel environment variables

Must have (Production):

- `NEXT_PUBLIC_SUPABASE_URL` — the project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **anon/publishable** key only.
- `DATABASE_URL` — the Supabase pooler connection string (transaction mode, port 6543). Server-only.

Must NOT have (in any environment that serves the public):

- `DEV_STAFF_LOGIN`, `NEXT_PUBLIC_DEV_STAFF_LOGIN`, `DEV_STAFF_LOGIN_SECRET` (build would fail anyway).
- `DEV_SIMULATED_PAYMENTS` (production build fails).
- Any `NEXT_PUBLIC_*` variable holding the service-role key, `DATABASE_URL`, or a password. Everything named
  `NEXT_PUBLIC_*` is shipped to every browser.
- `SUPABASE_SERVICE_ROLE_KEY` is not used by the app; leave it out.

Check: Vercel → Project → Settings → Environment Variables. Do not paste values into chat.

## 2. Give an existing auth user the kitchen role

Create the user yourself in Supabase → Authentication → Users (email + password). Then in the SQL editor
(replace the email):

```sql
-- Minimum role: kitchen. Demo Bistro = slug 'demo-bistro'.
insert into staff_memberships (restaurant_id, user_id, role, status)
select r.id, u.id, 'kitchen', 'active'
from restaurants r, auth.users u
where r.slug = 'demo-bistro'
  and lower(u.email) = lower('kitchen-staff@example.com')
on conflict (restaurant_id, user_id) do update set role = 'kitchen', status = 'active';

-- Confirm: exactly one row, role kitchen, status active.
select r.slug, u.email, m.role, m.status
from staff_memberships m
join restaurants r on r.id = m.restaurant_id
join auth.users u on u.id = m.user_id
where lower(u.email) = lower('kitchen-staff@example.com');
```

If the insert says 0 rows: the email is wrong, or the hosted DB has no `demo-bistro` restaurant
(`select id, slug from restaurants;`).

To revoke later: `update staff_memberships set status = 'inactive' where user_id = (select id from auth.users where lower(email) = lower('kitchen-staff@example.com'));`

## 3. Sign-in / sign-out check

1. Open https://sora-restaurants.vercel.app/kitchen on the kitchen device (laptop or tablet).
2. Sign in with the new user. Expected: the Demo Bistro board loads. No "dev login" wording anywhere.
3. Sign out. Expected: back to the sign-in form; reloading `/kitchen` does not show the board.
4. Negative: sign in with a Supabase user that has **no** membership. Expected: no board / not authorised.

## 4. Hosted end-to-end test

Two devices: guest phone (mobile data or Wi-Fi) and kitchen device signed in as above.

1. **Menu.** On the phone open the table link `https://sora-restaurants.vercel.app/t/<table qr_token>`
   (`select label, qr_token from tables where active;`). Menu loads, prices in rand.
2. **Order.** Add 2 items, place the order. Write down the order ref and time shown on the confirmation.
3. **Live board.** Without touching the kitchen device, the ticket appears within ~5 s. No refresh.
4. **Start → Ready → Served.** Tap each. The phone's order page follows each status. Time each step.
5. **Reject rule.** Place a second order; on the new ticket the only "stop" action is **Reject** (a new
   ticket cannot be cancelled). Reject it; the phone shows rejected.
6. **Cancel rule.** Place a third order, Start it, then **Cancel**. Allowed from preparing or ready.
   Served/rejected/cancelled tickets have no further moves (a retry returns 409 `invalid_transition`).
7. **Reconnect.** On the kitchen device turn Wi-Fi off, place a fourth order from the phone, wait 30 s,
   turn Wi-Fi on. The ticket appears without a manual refresh, no duplicates.
8. **History.** In the SQL editor:

```sql
select o.status, e.from_status, e.to_status, e.actor_user_id, e.created_at
from order_events e join orders o on o.id = e.order_id
where o.restaurant_id = (select id from restaurants where slug = 'demo-bistro')
  and e.created_at > now() - interval '2 hours'
order by e.order_id, e.created_at;
```

   Expected: `submitted` with no actor, then each move with the kitchen user's id as `actor_user_id`.
   Start shows as two rows (`submitted→accepted`, `accepted→preparing`) with the same timestamp.

Gate passes when steps 1–8 all pass on the hosted URL.

## 5. Evidence log

| # | Step | Order ref | Time placed | Time on board | Status times | Device / browser | Screenshot | Outcome | Defect owner |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Earlier hosted demo order | BB8206 | | | | | | Placed OK (before real kitchen login) | |
| 1 | Menu loads | | | | | | | | |
| 2–4 | Order, live board, Start/Ready/Served | | | | | | | | |
| 5 | Reject new ticket | | | | | | | | |
| 6 | Cancel while preparing | | | | | | | | |
| 7 | Wi-Fi off/on | | | | | | | | |
| 8 | order_events history | | | | | | | | |
| — | Sign-in / sign-out / no-membership | n/a | | | | | | | |

Keep screenshots in a shared folder, named `<step>-<order ref>.png`. Do not screenshot env var values.
