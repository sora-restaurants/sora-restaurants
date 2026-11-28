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

Fixed costs: $3,705 a month (Supabase Pro, USD 25 (estimate at ~R18.5/USD) $465, Vercel Pro, 2 seats x USD 20 (estimate) $740, Google Workspace, 3 users (estimate) $400, Accountant / bookkeeping (estimate) $1,500, Phones and data for sales and support (estimate) $600).

- **Break-even: 4 restaurant-months a day.** Below that you lose money every month.
- **Profit margin at your plan** (10 a day): **53%** of every sale, after every cost.

## Year 1, month by month

| month | restaurant-months a day | revenue | profit | cumulative (after $27,675 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $0 | -$3,705 | -$31,380 |
| 2 | 0 | $0 | -$3,705 | -$35,085 |
| 3 | 0 | $0 | -$3,705 | -$38,790 |
| 4 | 3 | $3,600 | -$675 | -$39,465 |
| 5 | 4 | $4,800 | $335 | -$39,130 |
| 6 | 5 | $6,000 | $1,345 | -$37,785 |
| 7 | 6 | $7,200 | $2,355 | -$35,430 |
| 8 | 7 | $8,400 | $3,365 | -$32,065 |
| 9 | 8 | $9,600 | $4,375 | -$27,690 |
| 10 | 9 | $10,800 | $5,385 | -$22,305 |
| 11 | 10 | $12,000 | $6,395 | -$15,910 |
| 12 | 10 | $12,000 | $6,395 | -$9,515 |

- **Year 1 operating profit: $18,160** on $74,400 of revenue.
- After the $27,675 startup spend: -$9,515.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$39,465**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 53% | 4 | $18,160 |
| Price -10% | 48% | 5 | $10,720 |
| Volume -20% | 46% | 4 | $5,636 |
| Unit costs +15% | 51% | 4 | $16,393 |

## Red flags

- The startup spend is not earned back within year 1.
