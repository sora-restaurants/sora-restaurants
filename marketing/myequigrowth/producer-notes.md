# EquiGrowth introduction film: producer's notes

**Files**
- `equigrowth-introduction.mp4`: 1920×1080, 25 fps, about 13:09, with voice-over and burned-in captions.
- `equigrowth-introduction.srt`: timestamped captions. They match the narration word for word, so an editor can re-voice from them.
- `film-script.mjs`: the full narration (90 lines, 1,686 words), one entry per line with an id.
- `film.html`: the animation source. Serve it with `node serve.mjs` in this folder, then open http://127.0.0.1:4181/film.html.
  - `?play` plays the film with its voice after one click.
  - `?t=120` shows a single frame.
  - `?render` re-exports the MP4 and SRT.
- `voice-film/`: one MP3 per line. Every scene's timing is derived from these, so the film re-times itself if a line is re-recorded.

**Length.** The brief asks for both "3–5 minutes" and a 14-minute timed outline with 1,600–1,900 words. Those words take about 13 minutes at a measured pace, so the film follows the outline and the word count.

**Voice.** The narrator is en-ZA-LeahNeural, Microsoft's free Edge voice. That is fine for an internal session. For anything public or paid, re-record with a licensed or human South African voice. The SRT and script are ready for that.

## Unresolved details (left out of the audience-facing film on purpose)

1. **Insurer-confirmed benefit schedule for the R430 package.** No document supplied for the revised package answers who is covered, the cover per person, waiting periods, exclusions or claims steps. The film shows Thandi checking the schedule instead of stating these. The old Silver package listed "member, spouse and 6 children" and "R10,000 cash back". The revised chart doesn't confirm those for R430, so neither is shown.
2. **Underwriter's exact legal name.** The deck says only "RMA (Underwriter)". The end card reads "Underwriter: RMA, as named in EquiGrowth's partnership information". Replace that with the exact legal name and approved wording from the policy documents.
3. **Mthembe Group's role.** The deck names it in the partnership section and doesn't explain its function, so the film only says it is named as a partner.
4. **Member benefits for the revised package.** The coupons, vouchers, travel and lifestyle discounts and home assistance come from the original presentation. The film says which apply "is set out in each member's benefit schedule". Confirm the list for R430.
5. **Cashback.** The amount, what triggers it and when it pays aren't supplied for R430. The film tells viewers to get these in writing.
6. **Consultant's individual share of the R80.** No approved agreement was supplied, so every figure is labelled "monthly compensation pool". The consultant scenes also carry a small on-screen tag: "Revised consultant model · proposal subject to FSP, insurer and legal approval". Your revised chart is marked as an internal proposal for legal, FSP and insurer review. Remove the tag only once that approval is in writing.
7. **Showing all 13 levels publicly.** Your own review notes recommend keeping the full table internal and using the 2- and 10-policy examples publicly until it's approved. The film shows the full chart because the brief asks for it, with the "snapshots, don't stack, arithmetic examples" caveats. Get compliance sign-off before showing it outside the company.
8. **Sponsor ID.** The original sign-up asks for a Sponsor ID, and it's unclear whether the revised flow still does. The film uses a general sign-up animation and the "office can help" route.
9. **Website.** myequigrowth.com is in the deck and on the end card, but on 24 Nov 2026 it didn't resolve. Check it's live before the session.
10. **Contact number.** None is verified in the supplied material, so none is shown.
11. **FSP 46798.** Check Sibiya Brokers' status and EquiGrowth's appointment on the FSCA register before showing this externally.

## What was kept separate, as the brief asked
- The founders' wider investment and wealth-building ambition is shown as "a separate story" and isn't linked to the funeral product.
- The R430 is always presented as the customer's package price, and the R80 always as the consultant compensation allocation.
- Recruiting earns nothing. Thandi gets no credit for Sipho's sales, and customers never need to recruit.
