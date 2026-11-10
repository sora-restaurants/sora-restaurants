# Hosted development/staging setup

This runbook creates an Internet-accessible **demo-only** environment. Do not copy real restaurant, staff or customer data into it.

## 1. Credentials first

- Rotate any Render database password that was ever pasted into chat, a document or an untrusted terminal recording. Delete the Render database if it is no longer used.
- Rotate the Supabase database password shared during setup after the connection is working.
- Never commit `.env`, `.env.local`, database URLs, service-role keys or staff passwords.
- Do not add `DEV_STAFF_LOGIN`, `NEXT_PUBLIC_DEV_STAFF_LOGIN` or `DEV_STAFF_LOGIN_SECRET` to Vercel. The production build intentionally fails if any is present.

## 2. Supabase project

Use a separate project named clearly as staging, in the closest available region to the team and pilot venue. Prefer a South Africa region when the dashboard offers one; otherwise compare the currently available nearby regions and document the choice before creating the project.

1. Create the project and save the generated database password in a password manager.
2. Link locally: `pnpm exec supabase link --project-ref <project-ref>`.
3. Review the target: `pnpm exec supabase migration list`.
4. Apply schema/RLS/functions: `pnpm exec supabase db push`.
5. Run `supabase/staging-seed.sql` manually in the SQL editor. It contains demo-only menu data and creates no Auth users.
6. In Authentication, keep public sign-ups disabled. Create a dedicated staging kitchen user with a unique password; do not reuse the local demo password.
7. Run only the commented membership statement at the bottom of `staging-seed.sql`, substituting the new staff email.
8. In the SQL editor, confirm all public tables have RLS enabled and that the staff user can only see the demo restaurant.

Use the project API URL and **publishable/anon key** in the browser. The anon key is designed to be public; authorization still depends on Auth and RLS. This application does not require a service-role key.

For `DATABASE_URL`, use Supabase's transaction-mode pooler connection string with `sslmode=require`. The app disables prepared statements for pooler compatibility and limits each function instance to 10 connections.

## 3. Vercel monorepo

Import the GitHub repository as a new **staging** Vercel project with:

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Root Directory | `apps/web` |
| Install Command | automatic (workspace `pnpm-lock.yaml`) |
| Build Command | `pnpm build` |
| Output Directory | automatic (`.next`) |
| Node.js | 22.x |

Add these variables to Preview and Production for this staging project:

- `NEXT_PUBLIC_APP_URL` — the final Vercel URL (update after the first deployment)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable/anon key
- `DATABASE_URL` — transaction-pooler URL, server-only
- `LOG_LEVEL=info`

Do **not** add the three `DEV_STAFF_LOGIN*` variables, a Supabase service-role key, the direct database URL, or any Render credential.

The kitchen feed uses authenticated streaming responses. A stream closes after 25 seconds and the client reconnects to a fresh snapshot, making termination by a finite-lived Vercel function expected rather than an outage. Verify this under the limits of the selected Vercel plan before a restaurant pilot; a dedicated realtime transport can replace this polling stream at larger scale.

## 4. Verification gate

Before calling staging complete:

1. Run `pnpm typecheck`, `pnpm test`, `pnpm test:realpg`, and a production build with all local dev-login variables unset.
2. Open the customer URL on a 320 px phone, a modern iPhone/Android viewport and a tablet.
3. Sign into `/kitchen` with the hosted staging staff user on a second device.
4. Scan/open `/t/staging-demo-table-1`, place a demo order, and verify it appears without a manual refresh.
5. Move it through Start → Ready → Served and verify it disappears.
6. Leave the kitchen open for at least two stream reconnect cycles and confirm it remains Live.
7. Confirm a wrong restaurant user cannot read the board and anonymous users cannot call staff functions.
8. Inspect Vercel logs for errors without logging credentials or authorization headers.

Record the deployed URL, Git commit, Supabase project reference, region, test time and tester. A successful build alone is not a live end-to-end verification.
