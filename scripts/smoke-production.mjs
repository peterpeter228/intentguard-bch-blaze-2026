import { spawn, spawnSync } from 'node:child_process';
import { request } from 'node:http';
import { mkdtemp, rm, readFile, chmod, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const distribution = resolve(process.argv[2] ?? 'dist/production');
const root = await mkdtemp(join(tmpdir(), 'intentguard-dist-')), journal = join(root, 'journal');
let child, exited, logs = '';
async function launch(create, mode = 'private-loopback') {
  child = spawn(process.execPath, ['server.mjs', ...(create ? ['--create-payment-journal'] : [])], { cwd: distribution,
    env: { ...process.env, INTENTGUARD_MODE: mode, PORT: mode === 'public-demo' ? '8080' : '8788', INTENTGUARD_PUBLIC_ROOT: join(distribution, 'public'), INTENTGUARD_PAYMENT_DIR: journal }, stdio: ['ignore', 'pipe', 'pipe'] });
  exited = new Promise(resolve => child.once('exit', resolve));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('DISTRIBUTION_START_TIMEOUT')), 10000);
    child.stdout.on('data', data => { logs += data; if (logs.includes(mode === 'public-demo' ? 'http://0.0.0.0:8080' : 'http://127.0.0.1:8788')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', () => {}); child.once('error', reject); child.once('exit', () => { clearTimeout(timer); reject(Error('DISTRIBUTION_EXITED')); });
  });
}
async function stop() { if (child?.exitCode === null) child.kill('SIGTERM'); await exited; child = null; logs = ''; }
try {
  await launch(true);
  const manifest = JSON.parse(await readFile(join(distribution, 'manifest.json'), 'utf8'));
  for (const [route, mime] of [['/', 'text/html'], ['/pay', 'text/html'], ['/request', 'text/html'], ['/style.css', 'text/css'], ['/app.js', 'text/javascript'], ['/request.js', 'text/javascript'], ['/payment.js', 'text/javascript']]) {
    const response = await fetch('http://127.0.0.1:8788' + route); assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').startsWith(mime));
    await response.arrayBuffer();
  }
  await stop(); await launch(false);
  const config = await fetch('http://127.0.0.1:8788/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8788' }, body: '{"action":"config"}' });
  assert.equal(config.status, 200); assert.equal((await config.json()).mainnetCapSatoshis, '0');
  await stop();
  const refuse = (directory, extra = {}, create = false) => {
    const result = spawnSync(process.execPath, ['server.mjs', ...(create ? ['--create-payment-journal'] : [])], { cwd: distribution, env: { ...process.env, INTENTGUARD_MODE: 'private-loopback', INTENTGUARD_PAYMENT_DIR: directory, ...extra }, timeout: 5000, encoding: 'utf8' });
    assert.equal(result.error, undefined); assert.notEqual(result.status, 0);
  };
  refuse(join(root, 'absent'));
  for (const PORT of ['0', '65536', '8080junk', '-1', '']) refuse(journal, { PORT });
  refuse(journal, { INTENTGUARD_MODE: 'other' });
  refuse(journal, {}, true); // create-exclusive never reuses an existing directory.
  await chmod(journal, 0o755); refuse(journal); await chmod(journal, 0o700);
  await rename(join(journal, 'payments.sqlite'), join(root, 'original.sqlite')); refuse(journal);
  await writeFile(join(journal, 'payments.sqlite'), 'corrupt', { mode: 0o600 }); refuse(journal);
  await rm(join(journal, 'payments.sqlite')); await rename(join(root, 'original.sqlite'), join(journal, 'payments.sqlite'));
  await launch(false, 'public-demo');
  const publicConfig = await new Promise((resolve, reject) => {
    const req = request('http://127.0.0.1:8080/api/payment', { method: 'POST', headers: { Host: 'intentguard-api-production.up.railway.app', Origin: 'https://intentguard-bch.vercel.app', 'Content-Type': 'application/json' } }, res => {
      let body = ''; res.on('data', b => body += b); res.on('end', () => resolve({ status: res.statusCode, value: JSON.parse(body) }));
    }); req.on('error', reject); req.end('{"action":"config"}');
  });
  assert.equal(publicConfig.status, 200); assert.equal(publicConfig.value.mode, 'public-demo');
  assert.equal((await fetch('http://127.0.0.1:8080/pay')).status, 403, 'loopback Host cannot masquerade as public authority');
  console.log(JSON.stringify({ status: 'PASS', kind: 'LOOPBACK_DISTRIBUTION_SMOKE', visualProof: 'PARENT_REQUIRED', sourceAssetsUsed: false, journalReopened: true, mainnetCapSatoshis: '0', files: manifest.files, totalBytes: manifest.totalBytes, deploy: false }, null, 2));
} finally { await stop(); await rm(root, { recursive: true }); }
