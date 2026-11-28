# Customer interface test, 16 Nov 2026

Tested on the hosted demo, https://sora-restaurants.vercel.app/t/staging-demo-table-1, on a phone-size screen (375 × 812).

## Result: it works, and it looks good

| Step | Result |
|---|---|
| Open the menu from the table link | ✅ Fast. Photos, categories, prices in rand, "Table 1" badge |
| Choose a dish with options (burger: how cooked, add-ons) | ✅ Works. A required choice is marked with * |
| View your order | ✅ Bottom bar "1 · View your order · R165" opens a clear summary with − / + |
| Pay after my meal or pay now, tip, split the bill | ✅ Simple buttons |
| Email receipt (optional) | ✅ |
| Slide to pay (demo) | ✅ "Payment confirmed (demo), ready in 10–15 min" |
| Need something? (water, cutlery, bill, help) | ✅ Simple four-button sheet |

The guest can order without help. The photos, ratings and "View your order" bar make it feel like a real app.

## Needs work (most important first)

1. **Fake ratings and reviews.** Every dish shows stars and "(26)" style review counts, and "See 3 reviews", even water. Real customers will spot invented reviews, and it hurts trust, which the buyer panel already said is our biggest weakness. Before going live, show only real reviews, or hide ratings until a dish has some.
2. **Wrong options on dishes.** The beef burger offers "Vegetarian", "Vegan", "Halal" and "Kosher" as choices, which reads as if you could make it vegan. Dietary labels should describe the dish, not be choices. Options should be per dish (no "how cooked" on a smash burger).
3. **"Goes well with" suggestions don't make sense.** Espresso is suggested with Espresso, and "Sweet wine", "Snack plate" and "Bread basket" aren't on the menu. Only suggest dishes that exist, and make each one tappable to add.
4. **The demo restaurant is called "Sora".** Guests see "Welcome to Sora" and "Sora Smash Burger", which mixes up our brand with the restaurant's. Use a made-up restaurant name for demos, so owners see their own name would go there.
5. **The options panel stays open after adding.** After "Add to order", the long list of options stays expanded under the dish. Close it once the dish is added.
6. **Checkout has three steps with no total until the end.** Order → pay choice / tip / split → email → place order. The total isn't shown on the tip/split or email steps. Show the running total (with the tip) on every step.
7. **"Continue to payment" leads to "Pay after my meal" already selected.** The button name suggests paying now. Rename it to "Continue".
8. **No way to track the order after placing it.** The order reference shows as "PREVIEW" and there is no "Track my order" link. Show the real reference and a big "Track my order" button.
9. **"Need something?" covers the food photos.** The floating button sits on top of the pictures while scrolling. Make it smaller, or move it into the top bar.
10. **The first tap on "Add" sometimes only opens the options.** That's expected for dishes with choices, but a guest can think nothing happened. Scroll the options into view, or open them as a sheet.

## Not tested
- A real phone and a real QR scan (only a phone-size browser window).
- The kitchen, waiter and owner screens on the hosted demo; whether the "Need something?" request reaches staff.
- Real payments (demo payment only), and many guests at once.
