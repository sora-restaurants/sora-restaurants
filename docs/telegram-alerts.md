# Telegram alerts (free, private)

Two alerts share one private Telegram group. Tokens live only in GitHub Actions Secrets and Vercel Environment Variables. Nothing is committed.

## 1. Create the bot and lock the group

1. In Telegram, open `@BotFather` and send `/newbot`. Save the bot token.
2. Create a **private** group. Invite only your team. Do not make it public.
3. Add the bot to that group.
4. Send any message in the group, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the group `chat.id` (negative number for groups).
5. In `@BotFather` send `/setjoingroups` → choose the bot → **Disable**. Strangers cannot add the bot to other chats.
6. Optional: `/setprivacy` → Enable, so the bot only sees messages that mention it.

## 2. Store the secrets

GitHub repo → Settings → Secrets and variables → Actions:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Vercel project → Settings → Environment Variables (Production and Preview):

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Redeploy after adding the Vercel variables.

## 3. What each alert does

- **Code watcher** (`.github/workflows/ci.yml`): on push, runs typecheck, Vitest, Next.js build, and Gitleaks. Sends only status, branch, short commit subject, and a link to the action run. No source and no secrets.
- **Waitlist watcher**: after a successful application save, sends restaurant name, city, contact, email, phone, and reference. Inputs are HTML-escaped. The form already has a honeypot (`companyUrl`), a minimum fill time, and a 5-per-hour IP limit.

If the Telegram variables are unset, notifications are skipped. The site and CI still work.
