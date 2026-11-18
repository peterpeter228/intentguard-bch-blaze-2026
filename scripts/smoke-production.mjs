import { spawn, spawnSync } from 'node:child_process';
import { request } from 'node:http';
import { createServer as createPortProbe } from 'node:net';
import { lstat, mkdtemp, rm, readFile, chmod, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const distribution = resolve(process.argv[2] ?? 'dist/production');
async function probePort(port = 0) {
  const listener = createPortProbe();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(port, '0.0.0.0', () => { listener.off('error', reject); resolve(); });
  });
  const assignedPort = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return assignedPort;
}
const port = await probePort();
const root = await mkdtemp(join(tmpdir(), 'intentguard-dist-')), journal = join(root, 'journal');
let child, exited, childReady = false;
async function launch(create, mode = 'private-loopback', directory = journal) {
  const env = { ...process.env, INTENTGUARD_MODE: mode, PORT: String(port), INTENTGUARD_PUBLIC_ROOT: join(distribution, 'public') };
  if (directory === null) delete env.INTENTGUARD_PAYMENT_DIR; else env.INTENTGUARD_PAYMENT_DIR = directory;
  const launched = child = spawn(process.execPath, ['server.mjs', ...(create ? ['--create-payment-journal'] : [])], { cwd: distribution, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let childError;
  const recordError = error => { childError = error; };
  launched.on('error', recordError);
  exited = new Promise(resolve => launched.once('close', (code, signal) => {
    launched.off('error', recordError); resolve({ code, signal, error: childError });
  }));
  launched.stderr.resume();
  await new Promise((resolve, reject) => {
    let logs = '';
    const ready = `http://${mode === 'private-loopback' ? '127.0.0.1' : '0.0.0.0'}:${port}`;
    const finish = error => {
      clearTimeout(timer); launched.stdout.off('data', data); launched.off('error', errorListener); launched.off('close', closeListener);
      launched.stdout.resume();
      if (error) reject(error); else resolve();
    };
    const data = chunk => { logs += chunk; if (logs.includes(ready)) finish(); };
    const errorListener = error => finish(error);
    const closeListener = (code, signal) => finish(Error(`DISTRIBUTION_EXITED: code=${code} signal=${signal}`));
    const timer = setTimeout(() => finish(Error('DISTRIBUTION_START_TIMEOUT')), 10000);
    launched.stdout.on('data', data); launched.once('error', errorListener); launched.once('close', closeListener);
  });
  childReady = true;
}
async function stop() {
  if (!child) return;
  const launched = child, wasReady = childReady;
  const running = launched.exitCode === null && launched.signalCode === null;
  if (running && launched.pid) launched.kill('SIGTERM');
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (launched.exitCode === null && launched.signalCode === null && launched.pid) launched.kill('SIGKILL');
      timer = setTimeout(() => reject(Error('DISTRIBUTION_STOP_TIMEOUT')), 2000);
    }, 5000);
  });
  let status;
  try { status = await Promise.race([exited, deadline]); } finally { clearTimeout(timer); child = undefined; exited = undefined; childReady = false; }
  if (wasReady) {
    assert.ok(running, 'distribution process exited before shutdown');
    assert.equal(status.error, undefined); assert.equal(status.signal, null, 'distribution process was terminated by a signal');
    assert.equal(status.code, 0, 'distribution process did not exit cleanly');
    assert.equal(await probePort(port), port, 'distribution listener was not released');
  }
}
const localFetch = (path, options = {}) => fetch(`http://127.0.0.1:${port}` + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(5000) });
function hostedRequest(path, { method = 'GET', host = 'intentguard-api-production.up.railway.app', origin, body } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Host: host, ...(origin ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) };
    const req = request(`http://127.0.0.1:${port}` + path, { method, headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('error', reject);
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, bytes, get text() { return bytes.toString('utf8'); } });
      });
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(Error('DISTRIBUTION_REQUEST_TIMEOUT'))); req.end(body);
  });
}
async function assertHostedPaymentBundle(mode, expected) {
  const response = await hostedRequest('/payment.js');
  assert.equal(response.status, 200, `${mode} /payment.js`);
  assert.match(response.headers['content-type'], /^text\/javascript\b/);
  assert.ok(response.bytes.equals(expected), `${mode} /payment.js served the wrong bundle`);
}
try {
  await assert.rejects(lstat(join(distribution, 'public/payment.js')), { code: 'ENOENT' },
    'public/payment.js shadows the Vercel rewrite');
  const legacyPayment = await readFile(join(distribution, 'legacy-payment.js'));
  const visitorPayment = await readFile(join(distribution, 'public/visitor-payment.js'));
  assert.ok(!legacyPayment.equals(visitorPayment), 'legacy and visitor bundles must be distinct');
  await launch(true);
  const manifest = JSON.parse(await readFile(join(distribution, 'manifest.json'), 'utf8'));
  for (const [route, mime] of [['/', 'text/html'], ['/pay', 'text/html'], ['/request', 'text/html'], ['/style.css', 'text/css'], ['/app.js', 'text/javascript'], ['/request.js', 'text/javascript'], ['/payment.js', 'text/javascript']]) {
    const response = await localFetch(route); assert.equal(response.status, 200, route); assert.ok(response.headers.get('content-type').startsWith(mime));
    if (route === '/') assert.doesNotMatch(await response.text(), /TODO_OWNER_/, 'production homepage contains an unresolved owner placeholder');
    else if (route === '/payment.js') assert.ok(Buffer.from(await response.arrayBuffer()).equals(legacyPayment), 'private-loopback /payment.js served the wrong bundle');
    else await response.arrayBuffer();
  }
  assert.deepEqual(manifest.notices, { publishedDirectory: 'public/notices', retainedDirectory: 'notices', entryPoint: '/notices/' });
  const noticeFiles = [['index.html', 'text/html'], ['LICENSE-MIT.txt', 'text/plain'], ['LICENSE-LGPLv3.txt', 'text/plain'], ['LICENSE-GPLv3.txt', 'text/plain'],
    ['LICENSE-XO.txt', 'text/plain'], ['license-evidence.json', 'application/json'], ['THIRD_PARTY_NOTICES.txt', 'text/plain']];
  const noticeContents = new Map();
  const publicNames = manifest.files.filter(file => file.path.startsWith('public/notices/')).map(file => file.path.slice('public/notices/'.length)).sort();
  const retainedNames = manifest.files.filter(file => file.path.startsWith('notices/')).map(file => file.path.slice('notices/'.length)).sort();
  assert.deepEqual(retainedNames, publicNames, 'packaged notice trees differ');
  for (const [name] of noticeFiles) assert.ok(publicNames.includes(name), `${name} missing from manifest`);
  for (const name of publicNames) {
    const publicCopy = await readFile(join(distribution, 'public/notices', name));
    const retainedCopy = await readFile(join(distribution, 'notices', name));
    assert.ok(publicCopy.length > 0, name); assert.deepEqual(retainedCopy, publicCopy, name);
    for (const dir of ['public/notices', 'notices']) {
      const entry = manifest.files.find(file => file.path === `${dir}/${name}`);
      assert.ok(entry, `${dir}/${name} missing from manifest`); assert.equal(entry.bytes, publicCopy.length);
    }
    noticeContents.set(name, publicCopy);
  }
  for (const [route, name, mime] of [['/notices', 'index.html', 'text/html'], ['/notices/', 'index.html', 'text/html'],
    ...noticeFiles.map(([name, mime]) => [`/notices/${name}`, name, mime])]) {
    const response = await localFetch(route);
    assert.equal(response.status, 200, route); assert.equal(response.headers.get('content-type'), `${mime}; charset=utf-8`, route);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer'); assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), noticeContents.get(name), route);
  }
  for (const route of ['/notices/unknown.txt', '/notices/LICENSE-MIT.txt/more']) {
    const response = await localFetch(route); assert.equal(response.status, 404, route); await response.arrayBuffer();
  }
  const health = await localFetch('/health'); assert.equal(health.status, 200);
  const healthValue = await health.json(); assert.equal(healthValue.status, 'ok'); assert.equal(healthValue.mode, 'private-loopback'); assert.equal(healthValue.mainnetCapSatoshis, '0');
  await stop(); await launch(false);
  const config = await localFetch('/api/payment', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` }, body: '{"action":"config"}' });
  assert.equal(config.status, 200); const configValue = await config.json();
  assert.equal(configValue.mainnetCapSatoshis, '0'); assert.equal(configValue.mode, 'private-loopback');
  const configGet = await localFetch('/api/payment-config'); assert.equal(configGet.status, 200); assert.deepEqual(await configGet.json(), configValue);
  await stop(); await launch(false, 'private-loopback', null);
  const missingConfig = await localFetch('/api/payment-config'); assert.equal(missingConfig.status, 503);
  assert.equal((await missingConfig.json()).issue, 'PAYMENT_JOURNAL_REQUIRED');
  await stop();
  const refuse = (directory, extra = {}, create = false) => {
    const result = spawnSync(process.execPath, ['server.mjs', ...(create ? ['--create-payment-journal'] : [])], { cwd: distribution, env: { ...process.env, INTENTGUARD_MODE: 'private-loopback', PORT: String(port), INTENTGUARD_PUBLIC_ROOT: join(distribution, 'public'), INTENTGUARD_PAYMENT_DIR: directory, ...extra }, timeout: 5000, encoding: 'utf8' });
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
  await assertHostedPaymentBundle('public-demo', legacyPayment);
  const publicConfig = await hostedRequest('/api/payment', { method: 'POST', origin: 'https://intentguard-bch.vercel.app', body: '{"action":"config"}' });
  assert.equal(publicConfig.status, 200); const publicValue = JSON.parse(publicConfig.text); assert.equal(publicValue.mode, 'public-demo');
  const publicConfigGet = await hostedRequest('/api/payment-config'); assert.equal(publicConfigGet.status, 200); assert.deepEqual(JSON.parse(publicConfigGet.text), publicValue);
  const publicHealth = await hostedRequest('/health', { host: 'healthcheck.railway.app' }); assert.equal(publicHealth.status, 200);
  assert.deepEqual(JSON.parse(publicHealth.text), { status: 'ok', mode: 'public-demo', mainnetCapSatoshis: '0' });
  assert.equal((await hostedRequest('/pay', { host: 'healthcheck.railway.app' })).status, 200);
  for (const [path, method] of [['/health', 'POST'], ['/pay', 'POST'], ['/health?probe=1', 'GET'], ['/api/payment-config', 'GET'], ['/notices/', 'GET']]) {
    assert.equal((await hostedRequest(path, { method, host: 'healthcheck.railway.app' })).status, 403, `${method} ${path}`);
  }
  assert.equal((await hostedRequest('/pay', { host: `127.0.0.1:${port}` })).status, 403, 'loopback Host cannot masquerade as public authority');
  await stop();
  // Unusable sentinel is isolated scratch, never the original production volume.
  const sentinel = join(root, 'must-not-open'); await writeFile(sentinel, 'NO_JOURNAL_ACCESS');
  await launch(false, 'visitor-wallet', sentinel);
  await assertHostedPaymentBundle('visitor-wallet', visitorPayment);
  const visitor = await hostedRequest('/api/payment', { method: 'POST', origin: 'https://intentguard-bch.vercel.app', body: '{"action":"config"}' });
  assert.equal(visitor.status, 200); const visitorValue = JSON.parse(visitor.text);
  assert.equal(visitorValue.mode, 'visitor-wallet'); assert.equal(visitorValue.network, 'mainnet'); assert.equal(visitorValue.mainnetCapSatoshis, '0');
  const visitorConfig = await hostedRequest('/api/payment-config'); assert.equal(visitorConfig.status, 200); assert.deepEqual(JSON.parse(visitorConfig.text), visitorValue);
  const visitorHealth = await hostedRequest('/health', { host: 'healthcheck.railway.app' }); assert.equal(visitorHealth.status, 200);
  assert.deepEqual(JSON.parse(visitorHealth.text), { status: 'ok', mode: 'visitor-wallet', mainnetCapSatoshis: '0' });
  assert.equal(await readFile(sentinel, 'utf8'), 'NO_JOURNAL_ACCESS');
  await stop();
  console.log('VISITOR_STATELESS_STARTUP_PASS: ignored unusable journal path; no volume/journal open; no network effect');
  console.log('PAYMENT_BUNDLE_ROUTING_PASS: no static shadow; verified /payment.js bytes in private-loopback, public-demo and visitor-wallet');
  console.log(JSON.stringify({ status: 'PASS', kind: 'LOOPBACK_DISTRIBUTION_SMOKE', visualProof: 'PARENT_REQUIRED', sourceAssetsUsed: false, legacyScratchJournalReopened: true, visitorStatelessStartup: true, originalVolumeAccess: false, mainnetCapSatoshis: '0', files: manifest.files, totalBytes: manifest.totalBytes, deploy: false }, null, 2));
} finally { try { await stop(); } finally { await rm(root, { recursive: true }); } }
