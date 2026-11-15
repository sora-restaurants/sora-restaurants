# Marketing site, waitlist and admin

Lives in `apps/web` beside the ordering app, kept apart from it:

| Part | Where |
| --- | --- |
| Homepage, `/waitlist`, `/privacy` | `apps/web/src/app/(site)/` |
| Admin (`/admin`, `/admin/login`, `/admin/[id]`, `/admin/export`) | `apps/web/src/app/admin/` |
| Styles (scoped under `.site`) | `apps/web/src/app/site.css` |
| Components and product mockups | `apps/web/src/components/site/` |
| Form options and validation (shared by browser and server) | `apps/web/src/lib/waitlist-schema.ts` |
| Saving, listing, statistics, CSV | `apps/web/src/server/waitlist.ts` |
| Admin sign-in | `apps/web/src/server/admin-auth.ts`, `admin-session.ts` |
| Table | `supabase/migrations/20261115000000_waitlist.sql` |

## Set up

1. Apply the migration: `pnpm db:reset` locally, or `supabase db push` against the hosted project.
2. Set the variables in `apps/web/.env.example`. `/admin` stays closed until `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set.
3. `pnpm dev`, then open `/`, `/waitlist` and `/admin`.

## The public interest indicator is simulated

The number on `/waitlist` comes from `apps/web/src/lib/interest-counter.ts`: a fixed function of the calendar day in
Johannesburg that starts at 30 on 15 November 2026 and moves between 30 and 50. It is not read from the database and is
labelled on the page as illustrative. Real application counts appear only in `/admin`.

## Not built yet

- No confirmation email is sent. The success screen does not claim one was.
- Spam protection is a hidden field, a minimum fill time and five applications an hour per connection. There is no CAPTCHA.
- Admin sign-in is one shared password. Login attempts are limited per server instance.
- The privacy policy is a draft and must have legal review before launch.
