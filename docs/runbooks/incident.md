# Incident runbook

Incident lead on call: TBD. Phone/WhatsApp: TBD. Escalation: TBD.

## Severity

| Level | Meaning | Example | Respond within |
|---|---|---|---|
| SEV1 | Restaurants cannot take orders | `/api/health` 503, orders not reaching kitchens | TBD (suggested 15 min) |
| SEV2 | Core flow degraded for some restaurants | one kitchen screen stale, payments failing | TBD (suggested 1 h) |
| SEV3 | Minor or cosmetic | owner stats wrong, typo | next working day |
| Data | Suspected leak of personal information | | immediately, plus POPIA steps below |

## Who to call

- Incident lead: TBD
- Engineering: TBD
- Supabase support: TBD
- Vercel support: TBD
- Restaurant communication: TBD
- Information officer (POPIA): TBD

## First steps

1. Check `/api/health`, the Vercel status page, the Supabase status page.
2. Recent release? Roll back the app ([release.md](release.md), section 5).
3. Note times and actions as you go.

## Kitchen fallback (tell restaurants at once for SEV1)

If Sora is down, restaurants keep trading without it:
- Staff take orders on paper order pads or their existing POS.
- Tell guests to order with their waiter; turn QR stands face down.
- Take payment at the till as usual.
- Write down orders still on the kitchen screen before refreshing it.
- When Sora is back, do not re-enter paper orders into Sora.

## Telling restaurants

- Channel: TBD (WhatsApp broadcast / SMS / email list).
- Start: "Sora ordering is down. Please take orders on paper or your POS. Next update by HH:MM."
- Update every TBD minutes, then send an all-clear.

## Personal-information incidents (POPIA)

Contain first, then inform the information officer (TBD). POPIA section 22 requires notifying the Information Regulator and affected people as soon as reasonably possible. Do not copy personal data into tickets or chat while investigating.

## Afterwards

Write-up within TBD days: timeline, cause, impact (restaurants, orders), changes. Store in TBD.
