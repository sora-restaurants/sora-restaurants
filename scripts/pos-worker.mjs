// Sends new orders to the simulated till. Started by `pnpm demo`. Guest receipts are emailed by the app (send-receipt).
//   node --experimental-strip-types scripts/pos-worker.mjs [--fail-rate 0.3]   (simulate an unreliable till)
import { parseArgs } from 'node:util';
import pg from 'pg';
import { simulatedPos } from '../apps/web/src/server/pos/adapter.ts';
import { syncPendingOrders } from '../apps/web/src/server/pos/sync.ts';

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

console.log(`POS worker: sending orders to the ${adapter.name} till every 2 s`);
for (;;) {
  try {
    const { failed } = await syncPendingOrders(deps, adapter);
    if (failed) console.log(`  till unreachable for ${failed} order(s); will retry`);
  } catch (error) {
    console.log(`  POS worker error: ${error.message}`);
  }
  await new Promise((r) => setTimeout(r, 2000));
}
