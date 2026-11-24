# Marketing site, waitlist and admin

The public website is https://sora-website-nine.vercel.app. It runs in the Vercel
project `sora-8818/sora-website`, rooted at `apps/web` and connected to the GitHub
repository `sora-restaurants/sora-restaurants`. Its production branch is
`sora-website-waitlist`. The guest ordering demo uses the separate Vercel project
`sora-restaurants`.

## Releases

Commit website changes on `sora-website-waitlist` and push that branch. Vercel
builds the production branch. The configured build command is
`node ../../scripts/check-website-release.mjs && pnpm run build`.
The release script rejects a different production Git branch. Older checkouts
without the release script fail the build before they can replace the site.

For a manual deployment, verify the Vercel project is `sora-website` and deploy a
clean checkout of the latest production branch. Check the public homepage,
waitlist, privacy notice, and a test enquiry after release. Mark test enquiries as
rejected and label their admin notes so they can be excluded from follow-up.

## Backend

Apply `supabase/migrations/20261115000000_waitlist.sql` to the hosted database.
The website uses `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) and the server-only
`SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) through the Supabase API.
It can also use `DATABASE_URL` where API credentials are not configured.
Public and restaurant staff roles cannot access waitlist records.

Set `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `WAITLIST_IP_SALT` and
`NEXT_PUBLIC_SITE_URL` in Vercel. Never prefix server secrets with `NEXT_PUBLIC_`.
Admin sign-in uses a shared password and an expiring session cookie. Login
attempts are currently limited per server instance.

## Public flow

The short enquiry form accepts restaurant name/type/city, a contact name, and at
least one email or phone number. Earlier detailed applications remain readable.
There is no simulated signup counter. The Founding Restaurant Programme is a
discounted, paid introductory partnership, never a free pilot; each restaurant's
price is agreed in writing before paid service begins. Only list features the
code implements; POS integration and online card payment are still in development.

The form stores a temporary draft in the same browser tab, preserves its retry
key across refresh, and clears it after a successful submission or when the user
chooses Clear saved details. Browser storage is optional. Signup still works if
storage is unavailable. JavaScript-disabled visitors have an email alternative.

No confirmation email is sent. Spam controls use a honeypot, minimum fill time,
and a database-backed application count. The privacy notice describes actual
collection and draft storage. Registered company and Information Officer details
have not yet been supplied by the founder.
