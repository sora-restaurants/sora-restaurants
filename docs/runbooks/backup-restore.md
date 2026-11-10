# Backup and restore

Owner: TBD. Back-up owner: TBD. Restore test cadence: TBD (suggested monthly).

## Supabase managed backups

- Plan: TBD. Daily backups kept for TBD days; point-in-time recovery: TBD (enabled / not).
- Dashboard → project (ref TBD) → Database → Backups to view and restore.
- A managed restore replaces the whole project database. Disasters only; agree with TBD first.

## Logical export (our own copy)

Run from a trusted machine. The connection string is a secret: take it from the password manager (TBD); never paste it into chat, tickets or logs.

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "sora-$(date +%Y%m%d-%H%M).dump"
```

- Store in TBD (encrypted, access limited to TBD). Dumps contain customer emails: POPIA personal information.
- Retention: TBD; delete old dumps on schedule.

## Test restore into a scratch database

Never into production.

```bash
createdb sora_restore_test
pg_restore --no-owner --no-privileges --dbname sora_restore_test sora-YYYYMMDD-HHMM.dump
psql sora_restore_test -c "select count(*) from orders"
psql sora_restore_test -c "select count(*) from restaurants"
```

Run the same counts on production and compare. Drop the scratch database afterwards (`dropdb sora_restore_test`).

## Evidence to record per test

Date, who, dump file name and size, source project, restore target, row counts (production vs restored), time taken, problems. Record in TBD.
