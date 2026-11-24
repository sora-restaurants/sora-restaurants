# Sora platform audit — November 2026

Branch audited: `feature/full-qr-integration` at `542a26f` (the ordering app behind sora-restaurants.vercel.app).
Fixes from this audit: branch `claude/platform-audit-2026-11`.
Competitor and provider research: [research-2026-11.md](research-2026-11.md).

How this was checked: the code was read end to end, and every claim below about behaviour was either run in the
test suite (PGlite database with the real migrations, `pnpm test`) or is marked **not tested**. Nothing here was
tested on real phones, a real kitchen tablet, or a real payment provider.

## 1. What works today (tested)

| Area | Verified by tests |
|---|---|
| Guest ordering | Server prices every item; client cannot send a price, restaurant or table; idempotency key stops double orders on retry; sold-out / unavailable items refused; closed table session refused |
| Kitchen | Live board over Server-Sent Events, snapshot then updates, reconnects every 25 s to a fresh snapshot, staff from another restaurant get 403, revoked staff are kicked off mid-stream |
| Waiter | One open "call waiter" per table, list and acknowledge calls, list unpaid orders, mark paid |
| Owner | Today's sales, tables with real QR images, open/close/rotate table QR, edit and add menu items and categories |
| Separation | Every table has row-level security; staff queries run as the staff user, so another restaurant's rows are invisible |
| Production guard | Dev staff login refuses to start in a production build |

## 2. Problems found

Severity: **High** = can hurt a guest, money or data at a pilot. **Medium** = will annoy a pilot restaurant. **Low** = polish.

### Fixed on this branch (tested)

| # | Sev | Problem | Fix |
|---|---|---|---|
| F1 | High | "Pay now" showed a slide-to-pay that only pretended to charge, visible to every guest. Simulated payments must not reach real restaurants. | Hidden unless the deployment sets `NEXT_PUBLIC_DEMO_PAYMENTS=1` (design previews still show it). Guests on a live restaurant only see "pay after my meal". |
| F2 | High | Email receipts rejected any address containing the letter **s** (regex had lost its backslashes: `[^s@<>]` instead of `[^\s@<>]`). Most guests never got receipts. | Regex fixed, test added. |
| F3 | High | No rate limit on ordering. Anyone holding a table's QR link could flood the kitchen with orders. | Database cap: 10 new orders per table session per 5 minutes (retries of the same order still succeed). Guest sees a clear message. Migration `20261124000000_order_flood_and_paid_guard.sql`. |
| F4 | Medium | Staff could mark a cancelled/rejected order as paid, and a second tap overwrote the original paid time (cash-up drift). | `mark_order_paid` refuses cancelled/rejected (409) and is a no-op when already paid. Same migration. |
| F5 | Medium | Owner dashboard turned every server error (database down, bug) into "not found" and logged nothing. Failures were invisible. | Real faults now return 500 and are logged; validation errors return 400. |

**Action for Juan:** the migration must be applied to the Supabase project "sora" before deploying this branch
(`supabase db push`, or paste it into the SQL editor). Until then the app still works; it just has no flood cap.

### Open — not fixed yet

| # | Sev | Area | Problem | Suggested fix |
|---|---|---|---|---|
| O1 | High | Payments | No real payment provider. "Pay now" is a demo only. | Integrate one provider with server-side verification + webhook (see section 5). Needs merchant account. |
| O2 | High | Guest | Add-on prices live in a hard-coded list (`customise-options.ts`) shared by every restaurant and are recognised by matching words in the free-text notes. Owners can't set their own modifiers or prices; a dish named "Bacon burger" with a note "Bacon" is charged extra. | Proper `modifier_groups` / `modifier_options` tables per restaurant, sent as IDs, priced in `submit_order`. |
| O3 | High | Guest | Allergens only show on the demo table, from hard-coded sample data (`demo-menu.ts`). Real restaurants have no allergen field in the database or owner screen. Safety risk. | Add an `allergens` column per item, edit it in the owner menu, show it on every menu. |
| O4 | High | Reliability | No error monitoring (no Sentry or similar), no uptime check. A pilot outage would only be found by a restaurant phoning. | Add Sentry (free tier) + an uptime monitor on `/t/<demo>` and the kitchen stream. |
| O5 | High | Ops | Backups: Supabase free plan has no point-in-time recovery. | Confirm plan; at least Pro with daily backups before a paying pilot. Needs Juan's Supabase login. |
| O6 | Medium | Kitchen | No kitchen vs bar routing. Every item goes to one board. | Add a `station` per category (kitchen/bar), filter the board by station. |
| O7 | Medium | Kitchen | A chime plays on new tickets, but browsers block audio until the tablet is tapped once, and the screen can sleep. Not tested on a real tablet. | "Tap to enable sound" banner; screen wake-lock. |
| O8 | Medium | Kitchen | No priority, no "time since ordered" colour, no per-item done. | Age colour (green/amber/red) from `createdAt`; later per-item status. |
| O9 | Medium | Waiter | Waiter page has calls and unpaid orders but no table overview (which tables are open, how long, what they've ordered) and no way to message the kitchen. | Table grid built from the owner snapshot query; "note to kitchen" later. |
| O10 | Medium | Owner | Owner dashboard picks the **first** restaurant only (`limit 1`). Multi-branch owners can't switch. | Branch picker; pass restaurant id, check `is_member`. |
| O11 | Medium | Owner | No staff management in the app (adding a waiter or kitchen user is done in Supabase by hand). | Invite by email via Supabase Auth admin API, role picker. |
| O12 | Medium | Owner | Reports only show today. No date range, no item sales, no CSV export for the accountant. | Date range + top items + CSV. |
| O13 | Medium | Guest | Order status polls every 4 s per guest. Fine for a pilot; costly at scale. | Move to the same SSE pattern as the kitchen later. |
| O14 | Medium | Guest | Split bill is "split N ways" display only. Nothing is actually split or paid separately. | Needs real payments first (O1). |
| O15 | Medium | Security | Call-waiter, receipt and checkout server actions have no per-IP rate limit (receipt has a "shortcut" comment). Receipt email could be used to spam an address once per order. | Add a `sent_at` column on orders and allow one receipt per order. |
| O16 | Low | Duplicated systems | `supabase/migrations` redefines `submit_order` five times; the marketing branch (`sora-website-waitlist`) carries a different, older copy of the ordering app (`/api/payments/simulate`, `menu-admin`). Two code lines for one product. | Retire the ordering app from the website branch (it already 404s with `SORA_SITE_ONLY=1`). Keep ordering on one branch. |
| O17 | Low | Guest | Basket shows price × quantity without add-ons per line, while the total includes them. Can look like a wrong total. | Show add-on cost on the line. |
| O18 | Low | Mobile | Not tested on real iOS Safari / older Android. `sessionStorage` and `crypto.randomUUID` need a secure context (HTTPS) — fine on Vercel. | One manual test pass on 3 phones before December. |

## 3. Security and reliability checklist

| Topic | State | Notes |
|---|---|---|
| Restaurant data separation | **Good** (tested) | RLS on every table; staff queries run as the user; cross-restaurant tests exist (`isolation`, `order-routing`). |
| Auth and permissions | Good | Supabase Auth; roles owner/manager/kitchen/waiter checked in SQL with `is_member`. No in-app staff management (O11). |
| Database security | Good | Security-definer functions with fixed `search_path`, `execute` revoked from `anon`. Service role only on the server. |
| Payment verification and webhooks | **Missing** | No provider yet. Rule for later: an order is paid only when the provider's webhook (signature checked) or a server-to-server lookup says so — never from the browser. |
| Duplicate orders | Good (tested) | Idempotency key per checkout, request hash checked. |
| Flooding / rate limiting | Partly fixed | F3 caps orders per table. No IP rate limit on server actions (O15). |
| Sessions | OK | Table sessions opened/closed by staff; QR can be rotated. Branch `claude/qr-logout-after-pay-17b3a1` (unmerged) logs guests out after paying. |
| Backups | **Unknown** | O5. |
| Error handling | Improved | F5; guest gets plain-English errors. |
| Logging and monitoring | **Weak** | `console.error` only, no alerting (O4). |
| Reconnection | Good (tested) | Kitchen stream reconnects to a fresh snapshot; guest status keeps polling. Not tested on a flaky phone network. |
| Mobile browsers | **Not tested** on devices (O18). |
| Dev login / simulated payments in production | Guarded | Dev login refused by build guard; demo payments now opt-in (F1). |

## 4. Needs credentials, provider approval or hardware

- Apply migration `20261124000000_order_flood_and_paid_guard.sql` to Supabase (Supabase login).
- Decide whether sora-restaurants (the sales demo) keeps the fake "Pay now": set `NEXT_PUBLIC_DEMO_PAYMENTS=1` in that Vercel project only. Never on a real restaurant.
- Payment provider: merchant account and API keys (Yoco, Paystack or PayFast — see research). Sandbox keys for testing.
- POS integration: partner agreement with the POS vendor (Pilot, GAAP etc. do not publish open APIs).
- Supabase plan with backups (O5); Sentry account (O4).
- Hardware test: kitchen tablet (sound, screen sleep, Wi-Fi drop), 3 guest phones (iPhone Safari, Samsung, a cheap Android), a receipt printer if `print_jobs` will be used.

## 5. Payment and POS rule

A successful payment does **not** mean the order reached the POS. They are two separate integrations:
1. **Payment**: provider checkout → provider webhook → `orders.payment_status = 'paid'`.
2. **POS**: order → POS vendor API → POS ticket ID stored on the order, with retries and a visible "not in POS" state for staff.

Neither is faked in this codebase.

## 6. Gap analysis and roadmap

See [gap-analysis-and-roadmap-2026-11.md](gap-analysis-and-roadmap-2026-11.md).
