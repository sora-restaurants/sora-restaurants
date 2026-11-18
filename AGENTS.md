# Sora website releases

The public restaurant website is https://sora-website-nine.vercel.app.
Its Vercel project is `sora-8818/sora-website`, its root directory is `apps/web`,
and its production branch is `sora-website-waitlist`.
The ordering demo is a separate Vercel project, `sora-restaurants`.

For marketing website work, start from the latest `sora-website-waitlist` commit
and preserve the approved restaurant copy, short enquiry form, working demo QR,
Supabase API connection, and privacy notice. An older checkout previously replaced
these fixes in production. Read `docs/website.md` before publishing the website.
The website project runs `scripts/check-website-release.mjs` before its build so
checkouts from before the audit fail before they can replace the public site.

Respect unrelated local edits and keep secrets in ignored environment files or
Vercel environment settings.
