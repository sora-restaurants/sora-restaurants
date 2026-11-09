// One command for the local demo: database + app, then prints the link to open.  pnpm demo   (Ctrl-C stops both)
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const node = process.execPath;
const children = [];
const run = (args, opts) => {
  const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  children.push(child);
  return child;
};
const stopAll = () => {
  for (const c of children) c.kill('SIGINT');
  setTimeout(() => process.exit(0), 1500);
};
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

// The first private IPv4 address: what a phone on the same Wi-Fi uses to reach this computer.
const lanIp = Object.values(os.networkInterfaces()).flat()
  .find((a) => a && a.family === 'IPv4' && !a.internal && /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(a.address))?.address;

function waitFor(child, text, label) {
  return new Promise((resolve, reject) => {
    let output = '';
    const onData = (d) => {
      output += d;
      if (output.includes(text)) resolve();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => { output += d; });
    child.on('exit', (code) => reject(new Error(`${label} stopped (exit ${code}):\n${output.slice(-2000)}`)));
  });
}

console.log('Starting the Sora demo (first run takes a minute)...');
const db = run(['--experimental-strip-types', 'scripts/local-db.mjs', ...process.argv.slice(2)]);
await waitFor(db, 'Local demo database ready', 'Database');
console.log('  database ready');

const nextBin = path.resolve('apps/web/node_modules/next/dist/bin/next');
const app = run([nextBin, 'dev', '-H', '0.0.0.0', '-p', '3000'], { cwd: path.resolve('apps/web') });
await waitFor(app, 'Ready', 'App');
// Show app errors in this window, so a problem is visible without a second terminal.
app.stderr.on('data', (d) => process.stderr.write(d));
app.stdout.on('data', (d) => { if (/error|⨯/i.test(d)) process.stdout.write(d); });

// The till simulator: prints a docket here whenever an order reaches the "till".
const pos = run(['--experimental-strip-types', 'scripts/pos-worker.mjs']);
pos.stdout.on('data', (d) => process.stdout.write(d));
pos.stderr.on('data', (d) => { if (!/ExperimentalWarning|MODULE_TYPELESS|Reparsing|eliminate this warning|trace-warnings/.test(d)) process.stderr.write(d); });

console.log(`
  Sora demo is running.

  Open on this computer:   http://localhost:3000/demo
${lanIp ? `  Or from a phone/tablet:  http://${lanIp}:3000/demo   (same Wi-Fi)\n` : ''}
  The demo page has the Table 4 QR code, the kitchen link and the logins.
  Orders also go to a simulated till; its dockets print below.
  Press Ctrl-C here to stop everything.
`);
