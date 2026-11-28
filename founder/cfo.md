# CFO's note (read this first)

All amounts are **rand**, before VAT (the tool prints "$"; read it as R). "A day" means "a month" here: one unit is one
paying restaurant for one month. Nearly every input is an estimate (`founder/cfo-sources.md`). Not financial, tax or
legal advice: an accountant should check the company structure, payroll costs and VAT before money moves.

**Price decided 2026-11-26: R1,200 a month per restaurant** (was R699). See `founder/pricing.md`.

- **The margin:** each paying restaurant leaves **R1,010 a month** after its own costs (84% of R1,200).
- **The line to watch: founder salaries.** With 3 x R25,000 (an estimate), fixed costs are R80,205 a month and
  break-even is **80 paying restaurants**. Year 1 loses **R899,840** on R74,400 of revenue and needs **R927,515** of
  cash. Without founder pay, fixed costs fall to R3,705, break-even is **4 restaurants** (reached in month 5 of the
  plan), year 1 makes **R18,160**, and the most cash needed is **R39,465** (`founder/cfo-unpaid.md`).
- **Cash:** startup spend is still not earned back inside year 1 (R9,515 short at month 12 without salaries).

**The risk at this price:** the simulated buyer panel's acceptable range was R250 to R899; 18 of 20 called R1,200 too
expensive. The plan's sign-up ramp (3 restaurants in month 4, rising to 10) was built at R699 and is unproven at
R1,200. Re-run with `--volume 0.5` if sign-ups come in slower. Proof from pilots and the POS link are what justify it.

**Board money conditions** (`founder/board.md`): not met. The cost to win a restaurant, support cost per restaurant and
payback period are still unknown; they need real pilot data. The R150/month support travel per restaurant is a guess
and should be measured in the pilots.

---

# Unit economics: Sora (QR ordering SaaS, Pro plan). Unit = one paying restaurant for one month; 'per day' fields count restaurants because days_per_month = 1.

Every number below comes from the input file. Nothing is looked up or guessed.

## One restaurant-month

| line | per restaurant-month |
| --- | ---: |
| Price | $1,200.00 |
| On-site support visits, travel (estimate) | -$150.00 |
| Hosting and email share per restaurant (estimate) | -$25.00 |
| Subscription collection fee, debit order or card (estimate) | -$15.00 |
| **Contribution** (what each restaurant-month leaves to pay the fixed costs) | **$1,010.00** (84%) |

## The margin that matters

Fixed costs: $80,205 a month (Founder salaries, 3 x R25,000 (ESTIMATE: amount not given) $75,000, Employer UIF + SDL, ~2% of payroll (estimate) $1,500, Supabase Pro, USD 25 (estimate at ~R18.5/USD) $465, Vercel Pro, 2 seats x USD 20 (estimate) $740, Google Workspace, 3 users (estimate) $400, Accountant / bookkeeping (estimate) $1,500, Phones and data for sales and support (estimate) $600).

- **Break-even: 80 restaurant-months a day.** Below that you lose money every month.
- **Profit margin at your plan** (10 a day): **-584%** of every sale, after every cost.

## Year 1, month by month

| month | restaurant-months a day | revenue | profit | cumulative (after $27,675 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $0 | -$80,205 | -$107,880 |
| 2 | 0 | $0 | -$80,205 | -$188,085 |
| 3 | 0 | $0 | -$80,205 | -$268,290 |
| 4 | 3 | $3,600 | -$77,175 | -$345,465 |
| 5 | 4 | $4,800 | -$76,165 | -$421,630 |
| 6 | 5 | $6,000 | -$75,155 | -$496,785 |
| 7 | 6 | $7,200 | -$74,145 | -$570,930 |
| 8 | 7 | $8,400 | -$73,135 | -$644,065 |
| 9 | 8 | $9,600 | -$72,125 | -$716,190 |
| 10 | 9 | $10,800 | -$71,115 | -$787,305 |
| 11 | 10 | $12,000 | -$70,105 | -$857,410 |
| 12 | 10 | $12,000 | -$70,105 | -$927,515 |

- **Year 1 operating profit: -$899,840** on $74,400 of revenue.
- After the $27,675 startup spend: -$927,515.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$927,515**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | -584% | 80 | -$899,840 |
| Price -10% | -660% | 91 | -$907,280 |
| Volume -20% | -751% | 80 | -$912,364 |
| Unit costs +15% | -587% | 82 | -$901,607 |

## Red flags

- Year 1 loses money on operations (-$899,840).
- The startup spend is not earned back within year 1.
