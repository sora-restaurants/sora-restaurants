# Monitoring

Owner: TBD.

## Uptime: UptimeRobot on `/api/health`

1. Create an HTTP(s) keyword monitor (account owner: TBD) for `https://sora-restaurants.vercel.app/api/health`, expecting `"ok":true`, so a 503 or an error page both alert.
2. Interval: TBD (suggested 1 min). Alert after TBD consecutive failures (suggested 2).
3. Alert contacts: TBD (on-call phone and email).
4. Public status page: TBD.

`/api/health` returns `200 {"ok":true,"db":true}` or `503 {"ok":false,"db":false}`. It runs `select 1` only and exposes no versions or config.

The marketing website (https://sora-website-nine.vercel.app) runs with `SORA_SITE_ONLY=1`, so `/api/health` answers 404 there by design. Monitor its home page `/` for a 200 instead; that check does not cover the waitlist database.

## Errors: Sentry (not installed yet)

1. Create a Sentry project (org TBD, Next.js). Put the DSN in Vercel env vars (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`), never in the repo.
2. `pnpm --filter web add @sentry/nextjs`, then `npx @sentry/wizard@latest -i nextjs`.
3. PII scrubbing (POPIA), required before go-live:
   - `sendDefaultPii: false`.
   - `beforeSend` / `beforeBreadcrumb`: drop request bodies, cookies and `authorization` headers; pass messages and extras through `redact` from `apps/web/src/server/log.ts`.
   - Replace the token in `/t/<token>` (table QR) and `/api/orders/status/<token>` URLs before sending.
   - Project settings → Security & Privacy: enable Data Scrubber and default scrubbers; add sensitive fields `email`, `token`, `qrToken`, `note`.
   - Session Replay off (or mask all text and inputs).
4. Data region: TBD; record it in the POPIA register (TBD).

## Server logs

Handlers write JSON lines through `apps/web/src/server/log.ts` (`level`, `event`, `requestId`, `restaurantId` when known), visible in Vercel → Logs. Log drain and retention: TBD.

## What to alert on

| Signal | Threshold | Who |
|---|---|---|
| `/api/health` failing | 2 checks in a row | on-call, page (TBD) |
| `submit_order failed` events | > TBD per 5 min | on-call |
| `kitchen_move failed` events | > TBD per 5 min | on-call |
| Sentry new issue / error spike | TBD | engineering channel (TBD) |
| Supabase CPU / connections | > TBD% | engineering |
| Vercel function error rate | > TBD% | engineering |
