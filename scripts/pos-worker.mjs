// Sends new orders to the simulated till, sends order emails (simulated), purges old addresses. Started by `pnpm demo`.
//   node --experimental-strip-types scripts/pos-worker.mjs [--fail-rate 0.3]   (simulate an unreliable till)
import { parseArgs } from 'node:util';
import pg from 'pg';
import { simulatedPos } from '../apps/web/src/server/pos/adapter.ts';
import { syncPendingOrders } from '../apps/web/src/server/pos/sync.ts';
import { sendPendingEmails } from '../apps/web/src/server/email/order-email.ts';
import fs from 'node:fs';
import path from 'node:path';

const { values } = parseArgs({ options: { 'fail-rate': { type: 'string', default: '0' } } });
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54330/sora', max: 2 });

// Same role switch as the app's server code: the worker acts as service_role, never as the superuser.
const deps = {
  db: {
    asService: async (sql, params = []) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query('set local role service_role');
        const { rows } = await client.query(sql, params);
        await client.query('commit');
        return rows;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  },
};

const adapter = simulatedPos({ failRate: Number(values['fail-rate']) });

// Stand-in email sender until a provider (Resend) is set up: saves each email as a page you can open.
const MAIL_DIR = path.resolve('.local-mail');
const mailer = {
  name: 'simulated',
  async send(email, key) {
    fs.mkdirSync(MAIL_DIR, { recursive: true });
    const file = path.join(MAIL_DIR, `${key}.html`);
    fs.writeFileSync(file, email.html);
    console.log(`📧 EMAIL to ${email.to.replace(/^(.).*@/, '$1***@')}: "${email.subject}" -> .local-mail/${key}.html`);
  },
};
let lastPurge = 0;
console.log(`POS worker: sending orders to the ${adapter.name} till every 2 s`);
for (;;) {
  try {
    const { failed } = await syncPendingOrders(deps, adapter);
    if (failed) console.log(`  till unreachable for ${failed} order(s); will retry`);
    await sendPendingEmails(deps, mailer);
    if (Date.now() - lastPurge > 3_600_000) {
      await deps.db.asService('select purge_customer_emails()'); // POPIA: addresses older than 30 days
      lastPurge = Date.now();
    }
  } catch (error) {
    console.log(`  POS worker error: ${error.message}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
