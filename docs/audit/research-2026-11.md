# Sora competitor and SA integration research (2026-11-24)

Method: web search, plus fetching official pages where they could be reached. This was a quick pass, not an exhaustive one.
Legend: **V** = verified on an official page with concrete detail; **M** = marketing claim or third-party listing only; **?** = not found.
"(memory)" = from prior knowledge and not re-checked in this session. Treat it as M at best.

## Part A - Competitors

### A1. Named competitors

| Name | Found? | URL | Country | Positioning | Pricing | Source |
|---|---|---|---|---|---|---|
| TableServe | **Not found** (no search hits) | - | - | - | - | searches returned nothing |
| TableFlo(w) | Ambiguous: "TableFlow" (tableflowqr.com) | https://www.tableflowqr.com/ | Unclear (listed on Capterra ZA) | QR dine-in ordering for single-location restaurants; staff check orders before they reach the kitchen | "From R499" (Capterra ZA, M) | https://www.capterra.co.za/software/1104184/TableFlow |
| Brewster | **Not found** | - | - | - | - | - |
| OrderLine | **Not found** | - | - | - | - | - |
| TapTheTable | **Not found** | - | - | - | - | - |
| Insly Yum | **Not found** (possibly a mix-up with Mr Yum?) | - | - | - | - | - |
| Tafura | **Not found** under this name. Similar name: "Tafela" by Skynode (SA blog post on digital tipping). Not confirmed to be the same product | https://skynode.co.za/tafela/ | ZA | ? | ? | https://skynode.co.za/tafela/blog/digital-tipping-south-african-restaurants/ |
| Ordev | Listed by Pilot POS as a **payments/wallet integration partner**. Own site not found | - | ZA (likely) | pay at table or wallet via Pilot (M) | ? | https://pilot.co.za/integrations/ |
| Yoco / Table by Yoco | Yes | https://yoco.com/table , https://www.yoco.com/za/blog/turn-tables-faster-with-yoco/ | ZA | **Waiter-operated** handheld (Khumo) for ordering and payment at the table, with orders sent to the kitchen. **No guest self-order QR found** | Counter POS R3,499 once-off; software Core R0 / Plus R249 / Pro R499 per location per month; KDS add-on R5,999 (from the fetched yoco.com page, which describes Yoco Counter) | yoco.com/table |
| Pilot POS | Yes | https://pilot.co.za | ZA | Hospitality POS for restaurant groups; 50+ integrations; mobile waiter; AI layer | Not published | pilot.co.za/integrations, ITWeb |
| GAAP | Yes | https://za-marketplace.sage.com/en-za/apps/109448/gaap-point-of-sale/features | ZA | Hospitality POS with its own white-label online ordering web app linked to GAAP POS | Not published | Sage marketplace |
| MangoPOS | Yes (Mango Restaurant POS) | https://www.capterra.co.za/software/1108454/Mango-Restaurant-Point-Of-Sale | ZA | Restaurant POS with no monthly fee that works offline during load shedding (M) | "No monthly fee" (M) | Capterra |
| PosiTack | Yes | https://www.capterra.co.za/software/1345726/PosiTack | ZA/US | Cloud POS with stock and payroll; WordPress plugin for live menus (M) | ? | Capterra |
| TableTab | **Not found** (TableTap exists but is for Ethiopian restaurants, so not relevant) | - | - | - | - | - |
| Smart Menus | **Not found** (generic term; many products are called "smart menu") | - | - | - | - | - |

### A2. Other relevant players

| Name | URL | Country | Positioning | Pricing | Note |
|---|---|---|---|---|---|
| me&u (formerly Mr Yum) | https://www.meandu.com (memory) | AU/UK; had a ZA presence | Guests order and pay by QR; integrated with the POS | Not public | Mr Yum launched in Cape Town around 2020 (Bizcommunity/Ventureburn). **Pilot lists me&u as an integration**, which makes it a direct ZA competitor through Pilot |
| Square (self-serve ordering) | https://squareup.com/online-ordering/self-serve-ordering | US/AU/UK, **not in ZA** | QR code per table or seat via Square Online | Plan-based | Benchmark only |
| Toast | https://pos.toasttab.com (memory) | US/UK/IE, **not in ZA** | POS with Order & Pay at the table | Quote | Benchmark only |
| Lightspeed Restaurant | https://www.lightspeedhq.com (memory) | Global; ZA availability unclear (?) | POS with Order Anywhere QR | Quote | Check whether it operates in ZA |
| iKhokha | https://www.ikhokha.com/restaurants-and-nightlife | ZA | Card machines and restaurant POS for bars and cafes | Published on its site (not checked) | Competes with Yoco on hardware |
| Sunday | sundayapp.com (memory) | EU/US | Pay at table by QR | % fee | **No ZA presence found** |
| Chewzie, Tablewise, Qroda, EnuMenu | Capterra ZA listings | mixed | QR ordering and payment without an app | various | Capterra only (M) |

### A3. Feature matrix
Cells are filled only where this session found evidence; everything else is "?". Global players filled from memory are marked M.

| Feature | Yoco Table | Pilot | GAAP | Mango | PosiTack | TableFlow | me&u | Square | Toast |
|---|---|---|---|---|---|---|---|---|---|
| QR guest ordering | ? (waiter-driven only) | M (via me&u/Mr Yum partners) | ? | ? | ? | M | M | V (unique QR per table/seat) | M |
| In-app/guest payment | ? (Yoco QR accepted as a payment method) | M (SnapScan/Zapper/Ordev) | ? | ? | ? | ? | M | M | M |
| POS integrations | n/a (is a POS) | V (named list) | ? | ? | ? | ? | M | n/a | n/a |
| Kitchen display | V (R5,999 add-on) | ? | ? | ? | ? | M (counter-to-kitchen flow) | ? | M | M |
| Waiter assistance | V (handheld for waiters) | M (mobile waiter) | ? | ? | ? | ? | M | ? | ? |
| Table management | V (Pro: open tables, time seated) | ? | ? | ? | M | ? | ? | ? | M |
| Split bill | V (all plans) | M (Splittable logo shown, not confirmed) | ? | ? | ? | ? | M | ? | M |
| Group ordering | ? | ? | ? | ? | ? | ? | M | ? | ? |
| Loyalty | ? | V (Maxi Club, PilotMiles) | ? | ? | ? | ? | M | M | M |
| Customer accounts | ? | ? | ? | ? | ? | ? | M | M | M |
| Promotions | ? | ? | ? | ? | ? | ? | M | M | M |
| Reservations | ? | V (Dine Plan integration) | ? | ? | ? | ? | ? | ? | M |
| Delivery | ? | V (Uber Eats, Mr D) | M (online ordering) | ? | ? | ? | ? | M | M |
| Collection | ? | ? | M | ? | ? | ? | M | M | M |
| Menu management | M | M | M | M | M (WordPress live menu) | M | M | M | M |
| Inventory | ? | V (Stockmate) | ? | ? | M (stock) | ? | ? | M | M |
| Analytics | M | M | ? | ? | M | ? | M | M | M |
| Multi-branch | V (pricing per location) | M (restaurant groups) | ? | ? | ? | ? (focus on single locations) | M | M | M |
| Multilingual menus | ? | ? | ? | ? | ? | ? | M | ? | ? |
| Offline mode | ? | ? | ? | M (load shedding) | ? | ? | ? | M | M |
| Notifications | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Public API | V (developer.yoco.com covers payments, not POS menu or orders) | ? (no public docs; partner process instead) | ? | ? | ? | ? | ? | M | M (partner) |

Gaps against Sora to watch (strongest signals):
- Loyalty and delivery aggregation built into the POS (Pilot).
- KDS, table timing and split bill bundled into the POS (Yoco).
- Guest QR ordering that is integrated with the POS (me&u through Pilot).

## Part B - SA integrations

**Key point:** a successful payment does NOT mean the order reached the POS. The payment gateway (the money) and the POS integration (tickets, orders, menu sync) are separate integrations that fail in different ways. Sora has to reconcile both: payment webhook -> order record -> push to the POS and wait for its acknowledgement, with retries and a visible "not in POS" state.

### B1. Payments

| Provider | Public API | Online checkout | Webhooks | Refunds | Split/marketplace | Tokenization | Merchant reqs / approval | Fees (published?) | Sandbox | Docs |
|---|---|---|---|---|---|---|---|---|---|---|
| Yoco | V | V (Checkout API) | V (payment.succeeded/failed, refund.*). Webhooks fire for every payment on the account, so filter by checkout id | V (full refunds only; official docs say partial refunds are not supported) | ? (not found) | ? | Self-serve signup, ZA business | Online rates on its site (not checked) | V (test keys) | https://developer.yoco.com/guides/overview |
| PayFast (Network International) | V | V | V (ITN) | M | V **Split Payments**: custom integration only; both the primary and the split account must act; the platform needs the merchant ID and key | M (tokenization/subscriptions, memory) | Self-serve signup with verification | A snippet showed about 4.5% + R5 for cards; **check the live page** https://payfast.io/fees | V (sandbox credentials) | https://developers.payfast.co.za (memory) |
| Paystack ZA | V (memory) | V | V | V | M (subaccounts; not confirmed for ZA) | M | Self-serve with business verification | 2.9% + R1 for local cards ex VAT (third-party); international possibly 3.1% (sources conflict); Ozow EFT at 2% inside its checkout | V (test mode, memory) | https://paystack.com/docs |
| SnapScan | V | QR payment; API base pos.snapscan.io/merchant/api/v1 | M | ? | ? | ? | SnapScan merchant account | Not checked | ? | https://developer.getsnapscan.com |
| Zapper | M (API Tracker lists docs, webhooks and a sandbox) | QR payment | M | ? | ? | ? | Merchant account | ? | M | Official docs not reached |
| iKhokha | ? (no public API docs found) | ? | ? | ? | ? | ? | - | - | ? | - |
| Peach Payments | M (memory: has an API) | M | M | M | ? | M | Application and approval (memory) | 2.95% + R1.50 for local cards (third-party) | M | https://developer.peachpayments.com (memory) |
| Ozow | M (memory) | Instant EFT | M | ? | ? | n/a | Merchant onboarding | ? (2% when used through Paystack) | ? | Not checked |
| Stitch | M (memory: pay by bank, cards) | M | M | ? | ? | ? | Onboarding through sales (memory) | Not published (?) | M | Not checked |

### B2. POS

| POS | Public API | What the integration covers | Partnership required? | Fees | Sandbox | Source |
|---|---|---|---|---|---|---|
| Pilot | **No public API or docs found** | Ordering (me&u, PlaceOrder, Mr Yum), delivery (Uber Eats, Mr D), payments (SnapScan, Zapper, Yoyo, Ordev), loyalty, PMS, stock, accounting | **Yes**: request through the integrations team; Pilot says it scopes feasibility and pricing within a few business days | Possible certification, implementation, data-streaming and monthly fees; not published | ? | https://pilot.co.za/integrations/ |
| GAAP | ? (none found) | Its own white-label online ordering, linked to the POS | Probably yes (?); ask GAAP | ? | ? | Sage marketplace listing |
| Yoco POS | The Yoco API gives read access to orders, payments, refunds and payouts (third-party summary; **check** whether it can *create* orders) | The payments side is well documented; injecting orders into the POS is unclear | ? | ? | ? | https://developer.yoco.com/api-reference/yoco-api |
| Lightspeed (K-Series) | M (memory: partner API program) | Sending orders into the POS | Yes, partner approval (memory) | ? | M | Not checked; confirm it operates in ZA |
| Mango / PosiTack / iKhokha POS | ? | ? | ? | ? | ? | Capterra only |

## Open questions and next checks
- 9 of the named competitors could not be identified (TableServe, Brewster, OrderLine, TapTheTable, Insly Yum, Tafura, TableTab and Smart Menus were not found; TableFlo matches only an ambiguous TableFlow). Confirm the exact spellings with whoever supplied the list.
- Yoco: check whether Table or the KDS has any guest QR mode, and whether the Yoco API can create POS orders.
- PayFast: check the live fee page and how fees are charged on split payments. Paystack: check whether subaccount splits work in ZA.
- Pilot: ask the integrations team for the cost and timeline to certify an ordering partner (the same route me&u used).
