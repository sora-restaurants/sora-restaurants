# Board brief: Sora

## The idea (from founder/idea.md)

- What it is: a subscription web platform that gives South African restaurants a branded QR-code menu customers order from at the table, a live kitchen screen, waiter calls, and an owner dashboard, without replacing the restaurant's POS.
- Who it is for: independent and small-chain sit-down restaurants in South Africa (braai spots, cafés, wine-farm restaurants, franchise branches such as a single Spur outlet) whose owners want faster table ordering without new hardware or a POS migration.
- Prices (hypotheses to test, not validated): Starter R299/month (branded page, menu, hours, contact, delivery links, training); Pro R699/month (adds QR ordering, waiter calls, kitchen dashboard, order status); Premium R1,299/month (adds advanced analytics and eligible POS integrations/support). All plans include staff training. No per-transaction commission. Payment processing, POS licences, domains, SMS/WhatsApp and printer hardware are charged separately.
- Where and how: South Africa; direct sales by a founder who also trains staff; a web app (customers scan a QR code, no app download); runs on the restaurant's existing phones and tablets.
- Team and constraints: three founders (two developers, one sales/operations/training person); budget not stated; built on free tiers until a pilot; POPIA (South Africa's data protection law) applies.

## Where it stands today (facts, as of 2026-11-09)

Working software, tested only on a local demo with made-up data. No restaurant has used it. No paying customer. No market research, interviews or pilot yet.

Built and working in the demo:
- QR table menu in three visual themes chosen per restaurant; customers add items and order from their phone.
- Server-side pricing (customers cannot alter prices), duplicate-order protection, VAT-inclusive totals.
- Live kitchen screen (New / Cooking / Ready), large buttons, reject and cancel.
- Customer order-tracking page; "call waiter" button with a staff screen.
- Pay now or pay after the meal; each restaurant chooses its policy (customer choice, pay now only, pay after only) to limit walk-outs; unpaid orders listed for staff. Payments are SIMULATED: no payment gateway chosen yet.
- Optional emailed order copy (simulated sending; no email provider yet).
- Owner dashboard (QR orders only: count, revenue, top dishes, busiest hours).
- Menu editing, sold-out switch.
- A simulated POS ("till") connection; no real POS integration. Receipt printing not built (no printer yet).
- Strict separation between restaurants' data, verified by automated tests on a real database.

Not decided or not done: payment gateway, real POS integration (depends on which POS pilot restaurants use), email provider, hosting for production, the first pilot restaurant, legal agreements, how customers are acquired beyond direct sales.

## Open numbers nobody has yet

Market size, how many restaurants would pay and at which plan, cost to acquire a restaurant, churn, support cost per restaurant, payment-processing economics, competitors and their prices in South Africa.
