# Sora gap analysis and roadmap — November 2026

Sources: [research-2026-11.md](research-2026-11.md) (V = verified on an official page, M = marketing claim) and
[platform-audit-2026-11.md](platform-audit-2026-11.md) (O-numbers are open audit items).

Honest note on competitors: 9 of the 15 names on the brief (TableServe, Brewster, OrderLine, TapTheTable, Insly Yum,
Tafura, TableTab, Smart Menus, TableFlo) could not be found under those names. Please check the spellings. The real
SA competition found is **Yoco (Table)**, **Pilot POS** (plus its partner **me&u / Mr Yum** for QR ordering),
**GAAP**, **Mango**, **iKhokha**, with Square/Toast/Sunday as overseas benchmarks.

Where Sora is already ahead: guest-side QR ordering straight to a live kitchen board without a POS. Yoco Table is
waiter-operated; Pilot needs a partner (me&u) for QR ordering. Sora's gap is everything around the order.

## 1. Gap analysis

Effort: S = days, M = 1–3 weeks, L = a month or more / needs a partner.

| Gap | What it does | Who has it | Why restaurants want it | How it improves Sora | Effort | When |
|---|---|---|---|---|---|---|
| Real online payment | Guest pays by card / instant EFT in the menu, verified by webhook | me&u (M), Square (M), Toast (M); Yoco has the API (V) | Faster table turns, no waiting for the bill | Unlocks pay-now, split bill, tips for real | M (+ merchant account) | **Now** (before December pilot if possible; otherwise pay-at-table only) |
| Owner-set modifiers & prices | Owner defines sizes, add-ons and their prices per dish | Every POS (M) | Every menu has them; today Sora's are hard-coded (O2) | Correct prices per restaurant | M | **Now** |
| Allergens in the database | Allergen list per dish, shown to guests | Common (M) | Safety and liability | Real data instead of demo-only (O3) | S | **Now** |
| Kitchen / bar routing | Drinks go to the bar screen, food to the kitchen | Yoco KDS (V, paid add-on) | Bar staff don't watch a food screen | Fewer missed drinks (O6) | S–M | **Now** |
| Table overview for waiters | Grid of tables: open, time seated, orders, unpaid | Yoco Pro (V) | Waiters see the floor at a glance | Completes the waiter app (O9) | S | **Now** |
| Monitoring & backups | Alerts when it breaks; restorable data | Expected of any SaaS | A pilot can't lose orders | Trust (O4, O5) | S | **Now** |
| Split bill (real) | Each guest pays their own share or items | Yoco (V, all plans), Toast (M) | Groups are a big share of covers | Needs real payments first (O14) | M | 30 days |
| Sales reports & export | Date ranges, item sales, CSV for the accountant | Most POS (M) | Owners run the business on these | Owner keeps Sora open daily (O12) | S–M | 30 days |
| Staff management | Owner invites/removes waiter and kitchen users | Every POS | No phoning Sora to add a waiter | Self-serve onboarding (O11) | S | 30 days |
| Multi-branch | One owner login, switch branches, group totals | Yoco (V per location), Pilot (M) | Groups are the bigger customers | Sell to groups (O10) | M | 90 days |
| POS integration | Orders land in the restaurant's POS | Pilot partners e.g. me&u (V list) | Restaurants won't run two systems | Removes the biggest sales objection | L (partner agreement) | 90 days to start talks; build after |
| Loyalty | Points or rewards for returning guests | Pilot (V: Maxi Club, PilotMiles) | Repeat visits | Needs customer accounts | M | 90 days |
| Promotions / upsell | Specials, "add a drink?" prompts | me&u, Square, Toast (M) | Higher spend per table | Cheap win once modifiers exist | S–M | 90 days |
| Reservations | Book a table | Pilot via Dine Plan (V) | Fewer no-shows | Better as an integration than built | L | Long-term (integrate) |
| Delivery & collection | Takeaway / delivery orders | Pilot via Uber Eats, Mr D (V); GAAP (M) | Extra revenue | Collection is easy (same menu); delivery is not | M / L | Collection 90 days; delivery long-term |
| Inventory | Stock counts, auto sold-out | Pilot (Stockmate, V), PosiTack (M) | Food cost control | Belongs in the POS; skip | L | Long-term / integrate |
| Multilingual menu | Menu in more languages | me&u (M) | Tourists | Afrikaans/isiZulu/English for SA; easy for static text | M | Long-term |
| Offline mode | Keep taking orders when internet drops | Mango (M, load shedding), Square/Toast (M) | Load shedding | Kitchen board already reconnects; full offline is big | L | Long-term |
| WhatsApp notifications | "Your order is ready" by WhatsApp | none verified | Guests leave the page | Needs WhatsApp Business API approval | M | Long-term |
| Group ordering | Several phones add to one table basket | me&u (M) | Groups | Table session exists, so feasible | M | 90 days |
| Customer feedback | Rate the meal after paying | common (M) | Reviews, service fixes | Simple form | S | 30 days |
| AI ordering | Chat / voice ordering, recommendations | none verified | Novelty | Low real value now | L | Long-term (skip for now) |
| Advanced analytics / franchise controls | Cross-branch dashboards, central menu push | Pilot (M) | Large groups | After multi-branch | L | Long-term |

## 2. Future features ranked by real restaurant value

1. Real payments + split bill (direct money and table-turn time)
2. Owner-set modifiers, allergens (correct orders, safety)
3. POS integration (removes the "two systems" objection)
4. Reports, staff management, multi-branch (owner retention, bigger customers)
5. Promotions/upsell and customer feedback (cheap, measurable)
6. Group ordering, collection
7. Loyalty, customer profiles (needs accounts and consent under POPIA)
8. WhatsApp, multilingual, reservations, delivery (integrate rather than build)
9. Franchise controls, advanced analytics, AI ordering (later, if customers ask)

## 3. Payments and POS: what to pursue first

- **Payments, first choice: Yoco Checkout API** — documented checkout, webhooks, refunds, test keys; many SA
  restaurants already have Yoco. Caveats: full refunds only; webhooks fire for every payment on the account, so match
  by checkout id. **Fallback/alternative: Paystack** (cheapest card rate found, includes Ozow EFT and Capitec Pay);
  **PayFast** if marketplace split payouts are needed (custom integration, both accounts must activate).
- **POS, first target: Pilot** — no public API; integrations go through Pilot's integrations team, possibly with
  certification and fees. me&u already uses this route, so it is proven. GAAP and Yoco POS: no public order-in API found.
- Rule: payment and POS are separate. Show staff a "paid but not in POS" state with retries. Never fake either.

## 4. Roadmap

### Phase 1 — before December 2026 (pilot essentials, reliability, security, testing)
- [x] Hide simulated "Pay now" from real guests (F1)
- [x] Fix receipt emails rejecting most addresses (F2)
- [x] Order flood cap per table (F3) — **apply the migration in Supabase**
- [x] Mark-paid guard (F4), owner error logging (F5)
- [ ] Apply migration; deploy this branch to sora-restaurants; decide on `NEXT_PUBLIC_DEMO_PAYMENTS` for the sales demo
- [ ] Sentry + uptime monitor (O4); confirm Supabase backups (O5)
- [x] Allergens column + owner editing (O3)
- [x] "Tap to enable sound" + screen wake-lock on the kitchen board (O7)
- [ ] Device test: 3 phones, 1 kitchen tablet, Wi-Fi drop test (O18)
- [ ] Pilot runbook: how to open/close tables, rotate a QR, mark paid, what to do if it's down

### Phase 2 — first 30 days of the pilot
- Real payments with Yoco (or Paystack) in sandbox → live, webhook-verified (O1)
- [x] Owner-set modifiers replacing the hard-coded list (O2)
- [x] Kitchen/bar routing (O6); ticket age colours (O8) still to do
- [x] Waiter table overview (O9)
- [x] Staff invites (O11), reports with date range + CSV (O12), receipt one-per-order limit (O15)
- Customer feedback after the meal

### Phase 3 — first 90 days
- Real split bill (O14), group ordering
- [x] Multi-branch switcher (O10)
- Start Pilot POS partnership talks; build the POS bridge once approved
- Promotions/upsell, collection orders
- Move guest status to live updates (O13); retire the old ordering copy on the website branch (O16)

### Phase 4 — long-term
- Loyalty and customer profiles (POPIA consent), WhatsApp notifications
- Reservations and delivery via integrations (Dine Plan, Uber Eats/Mr D)
- Multilingual menus, offline mode, franchise controls, advanced analytics
- Inventory via POS integration rather than building it
