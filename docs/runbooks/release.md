# Release runbook

Owner: TBD (release manager). Back-up owner: TBD.

## 1. Pre-deploy checks (on the commit being released)

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm test:realpg
pnpm --filter web typecheck
node scripts/check-website-release.mjs
pnpm --filter web build
```

All must pass. Do not release on red.

## 2. Database migrations

Migrations live in `supabase/migrations/` and are applied **in filename (timestamp) order**, each once.

1. Take a fresh backup first (see [backup-restore.md](backup-restore.md)).
2. See what production has: `supabase migration list --linked` (project ref: TBD).
3. Apply pending ones in order: `supabase db push --linked`.
4. Migrations must work with the app version still live (add columns/functions; drop only in a later release).

Order: **migrate first, then deploy the app**, so the new app never runs against an old schema.

## 3. Deploy and promote (Vercel)

One branch builds two Vercel projects, both with root directory `apps/web`:

| Project | Serves | Production branch | Env |
| --- | --- | --- | --- |
| `sora-restaurants` | ordering app (guest menu, kitchen, waiter, owner, staff) | TBD (the release branch) | Supabase ordering database |
| `sora-8818/sora-website` | marketing site, waitlist, `/admin` | `sora-website-waitlist` (see `docs/website.md`) | `SORA_SITE_ONLY=1`, waitlist database |

1. Merge to the release branch; Vercel builds a deployment for each project.
2. Smoke test each deployment's URL (section 4). The website must also follow `docs/website.md`.
3. Promote: Vercel dashboard → Deployments → the build → *Promote to Production* (or `vercel promote <deployment-url>`).

## 4. Smoke test (production: https://sora-restaurants.vercel.app)

- `GET /api/health` → `200 {"ok":true,"db":true}`
- `/demo` loads; open a demo table QR → menu renders.
- Place a test order at the test restaurant (TBD) → it appears on `/kitchen`.
- `/owner` loads for the owner test login (TBD).
- Waiter screen shows calls and unpaid orders.

Website (https://sora-website-nine.vercel.app): `/`, `/waitlist` and `/privacy` load; `/kitchen`, `/owner`, `/staff` and `/api/health` answer 404.

Record release commit SHA, time, who, smoke result in TBD (release log).

## 5. Rollback

**App:** Vercel → Deployments → previous production build → *Promote to Production* (instant, no rebuild), or `vercel rollback`.

**Migration:** there are no down migrations.
1. Prefer a forward fix: a new migration that reverses the change, tested with `pnpm test` and `pnpm test:realpg`, applied with `supabase db push --linked`.
2. If data was damaged: restore per [backup-restore.md](backup-restore.md) (point-in-time recovery: TBD).
3. Because migrations stay compatible with the previous app, rolling back the app alone is usually enough; leave the schema in place.
