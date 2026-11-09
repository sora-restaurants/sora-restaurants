// Local demo database: real PostgreSQL 17 (embedded-postgres), no Docker, no cloud. Keeps running until Ctrl-C.
//   pnpm db:local          start (first run: create, apply migrations + seed, write apps/web/.env.local)
//   pnpm db:local --reset  wipe and recreate from migrations + seed
// Listens on 127.0.0.1 only. Data lives in .local-pg/ (git-ignored).
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { CLUSTER_ROLES, DATABASE_STUB } from '../supabase/tests/real-pg.ts';

const PORT = 54330;
const DATABASE = 'sora';
const DATA_DIR = path.resolve('.local-pg');
const ENV_FILE = path.resolve('apps/web/.env.local');
const SUPERUSER = { user: 'postgres', password: 'postgres' }; // local-only cluster on 127.0.0.1

const reset = process.argv.includes('--reset');
if (reset) fs.rmSync(DATA_DIR, { recursive: true, force: true });
const fresh = !fs.existsSync(DATA_DIR);

const server = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  ...SUPERUSER,
  persistent: true,
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  onLog: () => {},
});

if (fresh) await server.initialise();
await server.start();

if (fresh) {
  const admin = new pg.Client({ ...SUPERUSER, host: '127.0.0.1', port: PORT, database: 'postgres' });
  await admin.connect();
  await admin.query(CLUSTER_ROLES);
  await admin.query(`create database ${DATABASE}`);
  await admin.end();

  const db = new pg.Client({ ...SUPERUSER, host: '127.0.0.1', port: PORT, database: DATABASE });
  await db.connect();
  await db.query(DATABASE_STUB);
  for (const file of fs.readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    await db.query(fs.readFileSync(path.join('supabase/migrations', file), 'utf8'));
    console.log(`  applied ${file}`);
  }
  await db.query(fs.readFileSync('supabase/seed.sql', 'utf8'));
  console.log('  loaded supabase/seed.sql');
  await db.end();
}

const databaseUrl = `postgresql://${SUPERUSER.user}:${SUPERUSER.password}@127.0.0.1:${PORT}/${DATABASE}`;
if (!fs.existsSync(ENV_FILE)) {
  fs.writeFileSync(ENV_FILE, [
    '# Local demo (pnpm db:local). Never use these values outside this machine.',
    `DATABASE_URL=${databaseUrl}`,
    'DEV_STAFF_LOGIN=1',
    'NEXT_PUBLIC_DEV_STAFF_LOGIN=1',
    `DEV_STAFF_LOGIN_SECRET=${randomBytes(32).toString('hex')}`,
    '',
  ].join('\n'));
  console.log('  wrote apps/web/.env.local (dev login on; production builds refuse these settings)');
} else {
  console.log('  apps/web/.env.local already exists; for the local demo it needs:');
  console.log(`    DATABASE_URL=${databaseUrl}`);
  console.log('    DEV_STAFF_LOGIN=1, NEXT_PUBLIC_DEV_STAFF_LOGIN=1, DEV_STAFF_LOGIN_SECRET=<32+ random chars>');
}

console.log(`\nLocal demo database ready on 127.0.0.1:${PORT} (${fresh ? 'new' : 'existing data'}).`);
console.log('New migrations since it was created? Run: pnpm db:local --reset');
console.log('Now run pnpm dev (or pnpm dev:lan) in another terminal. Ctrl-C here stops the database.');

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30); // keep the process (and the database) alive
