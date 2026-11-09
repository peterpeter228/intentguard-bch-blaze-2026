import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const distribution = resolve(process.argv[2] ?? 'dist/production');
const root = await mkdtemp(join(tmpdir(), 'intentguard-dist-')), journal = join(root, 'journal');
let child, exited, logs = '';
async function launch(create) {
  child = spawn(process.execPath, ['server.mjs', ...(create ? ['--create-payment-journal'] : [])], { cwd: distribution,
    env: { ...process.env, INTENTGUARD_PUBLIC_ROOT: join(distribution, 'public'), INTENTGUARD_PAYMENT_DIR: journal }, stdio: ['ignore', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('exit', resolve));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('DISTRIBUTION_START_TIMEOUT')), 10000);
    child.stdout.on('data', data => { logs += data; if (logs.includes('http://127.0.0.1:8788')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', () => {}); child.once('error', reject); child.once('exit', () => { clearTimeout(timer); reject(Error('DISTRIBUTION_EXITED')); });
  });
}
async function stop() { if (child?.exitCode === null) child.kill('SIGTERM'); await exited; child = null; logs = ''; }
try {
  await launch(true);
  const manifest = JSON.parse(await readFile(join(distribution, 'manifest.json'), 'utf8'));
  for (const [route, mime] of [['/', 'text/html'], ['/pay', 'text/html'], ['/request', 'text/html'], ['/style.css', 'text/css'], ['/app.js', 'text/javascript'], ['/request.js', 'text/javascript'], ['/payment.js', 'text/javascript']]) {
    const response = await fetch('http://127.0.0.1:8788' + route); assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').startsWith(mime));
    const body = await response.text();
    if (route === '/') { for (const field of ['SLIDES_URL', 'EMBER2026_ADDRESS', 'OLD_REPO_URL', 'NEW_REPO_URL', 'PRE_HACK_DEMO_URL']) assert.ok(body.includes('TODO_OWNER_' + field)); assert.ok(body.includes('private repository')); assert.ok(!/href=["'][^"']*TODO_OWNER/.test(body)); }
    if (route === '/pay') { assert.ok(body.includes('id="sign"')); assert.ok(body.includes('Mainnet cap exactly 0 sat')); }
  }
  await stop(); await launch(false);
  const config = await fetch('http://127.0.0.1:8788/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8788' }, body: '{"action":"config"}' });
  assert.equal(config.status, 200); assert.equal((await config.json()).mainnetCapSatoshis, '0');
  console.log(JSON.stringify({ status: 'PASS', kind: 'LOOPBACK_DISTRIBUTION_SMOKE', visualProof: 'PARENT_REQUIRED', sourceAssetsUsed: false, journalReopened: true, mainnetCapSatoshis: '0', files: manifest.files, totalBytes: manifest.totalBytes, deploy: false }, null, 2));
} finally { await stop(); await rm(root, { recursive: true }); }
