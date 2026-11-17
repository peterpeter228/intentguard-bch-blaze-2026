import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnServerProcess } from '../test-support/server-process.mjs';
import { request as httpRequest } from 'node:http';
import { readFile, mkdtemp, mkdir, cp, appendFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticRequestPlanningExample } from '../dist/core/request-plan-examples.js';
import { contextFromFundingFields } from '../dist/core/request-plan-form.js';
import { createPaymentRequestDraft } from '../dist/core/payment-request.js';
import { buildPaymentRequestPlan } from '../dist/core/request-plan.js';
const base = 'http://127.0.0.1:8788';
const endpoint = base + '/api/xo-candidate';
function scenario(token = false) {
  const now = Date.now(), example = syntheticRequestPlanningExample(token, now);
  const context = contextFromFundingFields(example.funding, 'chipnet');
  const draft = createPaymentRequestDraft(example.request, now); assert.equal(draft.status, 'DRAFT_READY');
  const plan = buildPaymentRequestPlan(example.request, draft.draft.requestDigest, context, now); assert.equal(plan.status, 'REQUEST_PLAN_BOUND_OFFLINE');
  return { request: example.request, expectedRequestDigest: draft.draft.requestDigest, context, expectedRequestPlanDigest: plan.binding.requestPlanDigest };
}
function post(body, headers = {}) {
  return fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', origin: base, ...headers }, body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body) });
}
function rawPost(body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); req.end(body);
  });
}
function rawRequest(port, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.setTimeout(5000, () => req.destroy(Error('HTTP_TEST_TIMEOUT'))); req.end();
  });
}
function assertSecurityHeaders(headers) {
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(headers['access-control-allow-origin'], undefined);
}
async function assertFavicon(port, host) {
  const response = await rawRequest(port, '/favicon.svg', 'GET', { Host: host });
  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'image/svg+xml; charset=utf-8');
  assertSecurityHeaders(response.headers);
  assert.deepEqual(response.body, await readFile(join(process.cwd(), 'core/favicon.svg')));
  assert.match(response.body.toString('utf8'), /<svg\b/);
  const alias = await rawRequest(port, '/favicon.ico', 'GET', { Host: host });
  assert.equal(alias.status, 200);
  assert.equal(alias.headers['content-type'], 'image/svg+xml; charset=utf-8');
  assertSecurityHeaders(alias.headers);
  assert.deepEqual(alias.body, response.body);
}
async function assertNoticeRoutes(port, noticeRoot, host) {
  const paths = [
    ['/notices', 'index.html', 'text/html'], ['/notices/', 'index.html', 'text/html'], ['/notices/index.html', 'index.html', 'text/html'],
    ['/notices/LICENSE-MIT.txt', 'LICENSE-MIT.txt', 'text/plain'], ['/notices/LICENSE-LGPLv3.txt', 'LICENSE-LGPLv3.txt', 'text/plain'],
    ['/notices/LICENSE-GPLv3.txt', 'LICENSE-GPLv3.txt', 'text/plain'], ['/notices/LICENSE-XO.txt', 'LICENSE-XO.txt', 'text/plain'],
    ['/notices/license-evidence.json', 'license-evidence.json', 'application/json'], ['/notices/THIRD_PARTY_NOTICES.txt', 'THIRD_PARTY_NOTICES.txt', 'text/plain']
  ];
  for (const [path, name, type] of paths) {
    const response = await rawRequest(port, path, 'GET', { Host: host });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers['content-type'], type + '; charset=utf-8', path);
    assertSecurityHeaders(response.headers);
    assert.deepEqual(response.body, await readFile(join(noticeRoot, name)), path);
    if (name === 'license-evidence.json') assert.doesNotThrow(() => JSON.parse(response.body.toString('utf8')));
  }
  for (const path of ['/notices/unlisted.txt', '/notices/LICENSE-MIT.txt/', '/notices/LICENSE-MIT.txt?x=1', '/notices//LICENSE-MIT.txt',
    '/notices/%69ndex.html', '/notices/../private.txt', '/notices/%2e%2e/private.txt', '/notices/%2e%2e%2fprivate.txt',
    '/notices/%252e%252e/private.txt', '/notices/LICENSE-XO.txt%00', '/notices/THIRD_PARTY_NOTICES.TXT', '/notices/LICENSE-WizardConnect-upstream.txt']) {
    const response = await rawRequest(port, path, 'GET', { Host: host });
    assert.equal(response.status, 404, path); assertSecurityHeaders(response.headers);
  }
  for (const [path] of paths) {
    for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      assert.equal((await rawRequest(port, path, method, { Host: host })).status, 404, method + ' ' + path);
    }
  }
  for (const path of ['/notices', '/notices/LICENSE-XO.txt', '/notices/license-evidence.json']) {
    const response = await rawRequest(port, path, 'GET', { Host: 'evil.example' });
    assert.equal(response.status, 403, path); assert.equal(JSON.parse(response.body).issue, 'HOST_REJECTED'); assertSecurityHeaders(response.headers);
  }
}
test('loopback static UI and bounded XO diagnostics preserve all offline authority boundaries', async () => {
  const server = spawnServerProcess(['dist/core/server.js'], { readyText: 'http://127.0.0.1:8788' });
  try {
    await server.ready;
    for (const path of ['/', '/app.js', '/style.css', '/request', '/request.js']) {
      const response = await fetch(base + path); assert.equal(response.status, 200);
      const csp = response.headers.get('content-security-policy'); assert(csp.includes("'wasm-unsafe-eval'")); assert(!csp.includes("'unsafe-eval'")); assert(csp.includes("connect-src 'self'")); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    await assertFavicon(8788, '127.0.0.1:8788');
    await assertNoticeRoutes(8788, join(process.cwd(), 'notices'), '127.0.0.1:8788');
    const health = await rawRequest(8788, '/health');
    assert.equal(health.status, 200); assert.equal(health.headers['content-type'], 'application/json; charset=utf-8'); assertSecurityHeaders(health.headers);
    assert.deepEqual(JSON.parse(health.body), { status: 'ok', mode: 'private-loopback', mainnetCapSatoshis: '0' });
    const unavailable = await rawRequest(8788, '/api/payment-config');
    assert.equal(unavailable.status, 503); assert.equal(unavailable.headers['content-type'], 'application/json; charset=utf-8'); assertSecurityHeaders(unavailable.headers);
    assert.deepEqual(JSON.parse(unavailable.body), { status: 'REJECTED', issue: 'PAYMENT_JOURNAL_REQUIRED', canSign: false, broadcastable: false, receiptValid: false, networkVerified: false, ownershipVerified: false });
    const unavailablePost = await fetch(base + '/api/payment', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: '{"action":"config"}' });
    assert.equal(unavailablePost.status, 503); assert.deepEqual(await unavailablePost.json(), JSON.parse(unavailable.body));
    for (const path of ['/health', '/api/payment-config']) {
      for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
        const response = await rawRequest(8788, path, method);
        assert.equal(response.status, 405, method + ' ' + path); assert.equal(response.headers.allow, 'GET'); assertSecurityHeaders(response.headers);
      }
      for (const host of ['evil.example', 'healthcheck.railway.app']) {
        const response = await rawRequest(8788, path, 'GET', { Host: host });
        assert.equal(response.status, 403, host + ' ' + path); assert.equal(JSON.parse(response.body).issue, 'HOST_REJECTED');
      }
      assert.equal((await rawRequest(8788, path + '?probe=1')).status, 404);
      assert.equal((await rawRequest(8788, path + '/')).status, 404);
    }
    for (const token of [false, true]) {
      const input = scenario(token); const response = await post(input); assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
      const text = await response.text(), report = JSON.parse(text);
      assert.equal(report.status, 'EXACT_MATCH_OFFLINE'); assert.equal(report.exactBytesMatch, true);
      assert.equal(report.binding.requestPlanDigest, input.expectedRequestPlanDigest);
      assert.equal(report.binding.actionIdentifier, token ? 'sendFungibleTokens' : 'sendSatoshis');
      for (const flag of ['canSign', 'broadcastable', 'receiptValid', 'networkVerified', 'ownershipVerified']) assert.equal(report[flag], false);
      assert(!text.includes(input.context.snapshot.parentTransactionHexes[0]));
      for (const forbidden of ['candidateHex', 'unsignedHex', 'requestPlan', 'parentTransactionHexes']) assert(!Object.hasOwn(report, forbidden));
    }
    assert.equal((await rawPost(JSON.stringify(scenario()))).status, 200, 'metadata-free CLI diagnostics are allowed');
    assert.equal((await post(scenario(), { origin: 'http://localhost:8788' })).status, 403, 'origin must match the exact Host');
    for (const origin of ['null', 'https://evil.example', 'http://127.0.0.1:8788.evil.example']) assert.equal((await post(scenario(), { origin })).status, 403);
    assert.equal((await rawPost(JSON.stringify(scenario()), { host: 'evil.example' })).status, 403);
    assert.equal((await post(scenario(), { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await rawPost('{}', { 'sec-fetch-site': 'none' })).status, 403, 'no-Origin browser metadata is refused');
    assert.equal((await rawPost('{}', { referer: base })).status, 403);
    assert.equal((await post('{}', { 'content-type': 'text/plain' })).status, 415);
    assert.equal((await post('{}', { 'content-encoding': 'gzip' })).status, 415);
    for (const method of ['GET', 'OPTIONS', 'PUT', 'DELETE']) assert.equal((await fetch(endpoint, { method })).status, 405);
    for (const body of ['{', 'null', '[]', '{}', '{"request":{},"request":{}}', '{"request":{},"requ\\u0065st":{}}', Buffer.from([0xc3, 0x28]), '['.repeat(15) + ']'.repeat(15)]) assert.equal((await post(body)).status, 400);
    for (const changes of [{ now: Date.now() }, { canSign: true }, { expectedRequestDigest: 123 }, { expectedRequestPlanDigest: 'bad' }, { request: '{}' }]) assert.equal((await post({ ...scenario(), ...changes })).status, 400);
    assert.equal((await post(' '.repeat(300 * 1024 + 1))).status, 413);
    assert.equal((await rawPost(' '.repeat(300 * 1024 + 1), { 'transfer-encoding': 'chunked' })).status, 413);
    const staleDigest = scenario(); staleDigest.expectedRequestDigest = '0'.repeat(64);
    const staleReport = await (await post(staleDigest)).json(); assert.equal(staleReport.status, 'REJECTED'); assert.equal(staleReport.binding, null);
    const stalePlan = scenario(); stalePlan.expectedRequestPlanDigest = '0'.repeat(64);
    const staleResponse = await post(stalePlan); assert.equal(staleResponse.status, 409); assert.equal((await staleResponse.json()).issue, 'REQUEST_PLAN_CHANGED');
    for (const mutate of [i => i.context.snapshot.observedAt -= 600000, i => i.context.authority = true, i => i.context.feePolicy.allowBchDustToFee = 'false', i => i.request.canSign = true]) {
      const input = scenario(); mutate(input); const report = await (await post(input)).json(); assert.equal(report.status, 'REJECTED'); assert.equal(report.binding, null);
    }
    await new Promise(resolve => { const req = httpRequest(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '500' } }); req.on('error', () => resolve()); req.flushHeaders(); req.write('{'); setTimeout(() => { req.destroy(); resolve(); }, 20); });
    assert.equal((await post(scenario())).status, 200, 'interrupted body does not crash the server');
    const timeout = await new Promise((resolve, reject) => {
      const req = httpRequest(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '500' } }, res => { res.resume(); res.on('end', () => { resolve(res.statusCode); req.destroy(); }); }); req.on('error', reject); req.flushHeaders(); req.write('{');
    }); assert.equal(timeout, 408);
    assert.equal((await fetch(base + '/missing')).status, 404);
    for (const path of ['/__proto__', '/constructor', '/toString', '/notices/__proto__', '/notices/constructor']) assert.equal((await rawRequest(8788, path)).status, 404, path);
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 404);
    assert.equal((await fetch(base + '/api/wallet')).status, 404);
  } finally { await server.stop(); }
});

test('production publicRoot serves only exact notice files with security headers', async () => {
  const { createPaymentServer } = await import('../dist/core/server.js');
  const root = await mkdtemp(join(tmpdir(), 'intentguard-notices-'));
  const publicRoot = join(root, 'public'), noticeRoot = join(publicRoot, 'notices');
  let server;
  try {
    await mkdir(publicRoot);
    await cp(join(process.cwd(), 'core/favicon.svg'), join(publicRoot, 'favicon.svg'));
    await cp(join(process.cwd(), 'notices'), noticeRoot, { recursive: true });
    await appendFile(join(noticeRoot, 'LICENSE-XO.txt'), '\nPublic-root fixture marker.\n');
    await writeFile(join(noticeRoot, 'LICENSE-WizardConnect-upstream.txt'), 'not publicly accessible');
    await writeFile(join(noticeRoot, 'unlisted.txt'), 'not publicly accessible');
    await writeFile(join(publicRoot, 'private.txt'), 'not publicly accessible');
    server = createPaymentServer(undefined, publicRoot, true);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port, host = 'intentguard-api-production.up.railway.app';
    await assertFavicon(port, host);
    await assertNoticeRoutes(port, noticeRoot, host);
    const health = await rawRequest(port, '/health', 'GET', { Host: host });
    assert.equal(health.status, 200); assert.deepEqual(JSON.parse(health.body), { status: 'ok', mode: 'public-demo', mainnetCapSatoshis: '0' });
  } finally {
    if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(root, { recursive: true });
  }
});

test('public demo denies authority before payment allocation and accepts only exact HTTPS headers', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { PaymentJournal } = await import('../dist/core/operation-store.js');
  const { PaymentFlow } = await import('../dist/core/payment-flow.js');
  const { PaymentChain } = await import('../dist/core/payment-chain.js');
  const { createPaymentServer } = await import('../dist/core/server.js');
  const root = await mkdtemp(join(tmpdir(), 'intentguard-public-'));
  const journal = PaymentJournal.create(join(root, 'journal'));
  const server = createPaymentServer(new PaymentFlow(journal, new PaymentChain()), undefined, true);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const send = (body, headers = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${server.address().port}/api/payment`, { method: 'POST', headers: {
      Host: 'intentguard-api-production.up.railway.app', Origin: 'https://intentguard-bch.vercel.app', 'Content-Type': 'application/json', ...headers
    } }, res => { let text = ''; res.on('data', b => text += b); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text), headers: res.headers })); });
    req.on('error', reject); req.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  try {
    const config = await send({ action: 'config' });
    assert.equal(config.status, 200); assert.equal(config.data.mode, 'public-demo'); assert.equal(config.data.mainnetCapSatoshis, '0');
    const configGet = await rawRequest(server.address().port, '/api/payment-config', 'GET', { Host: 'intentguard-api-production.up.railway.app' });
    assert.equal(configGet.status, 200); assert.equal(configGet.headers['content-type'], 'application/json; charset=utf-8'); assertSecurityHeaders(configGet.headers);
    assert.deepEqual(JSON.parse(configGet.body), config.data);
    for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const denied = await rawRequest(server.address().port, '/api/payment-config', method, { Host: 'intentguard-api-production.up.railway.app' });
      assert.equal(denied.status, 405); assert.equal(denied.headers.allow, 'GET');
    }
    for (const host of ['evil.example', 'healthcheck.railway.app', 'intentguard-api-production.up.railway.app:443']) {
      const denied = await rawRequest(server.address().port, '/api/payment-config', 'GET', { Host: host });
      assert.equal(denied.status, 403); assert.equal(JSON.parse(denied.body).issue, 'HOST_REJECTED');
    }
    assert.equal(config.headers['access-control-allow-origin'], undefined);
    for (const Host of ['evil.example', 'intentguard-bch.vercel.app.evil', 'intentguard-api-production.up.railway.app:8080', 'localhost:8080']) assert.equal((await send({ action: 'config' }, { Host })).status, 403);
    for (const Origin of ['', 'null', 'http://intentguard-bch.vercel.app', 'https://evil.example', 'https://intentguard-bch.vercel.app/', ['https://intentguard-bch.vercel.app', 'https://intentguard-bch.vercel.app']]) assert.equal((await send({ action: 'config' }, { Origin })).status, 403);
    assert.equal((await send({ action: 'config' }, { Origin: '', 'X-Forwarded-Host': 'intentguard-bch.vercel.app', 'X-Forwarded-Proto': 'https' })).status, 403);
    assert.equal((await send({ action: 'config' }, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await send('{"action":"config","action":"prepare"}')).status, 400);
    for (const action of ['prepare', 'revise', 'reserve', 'signed', 'uncertain', 'broadcast', 'observe', 'anything']) {
      const denied = await send({ action, capability: '00'.repeat(32), network: 'mainnet' });
      assert.equal(denied.status, 403); assert.equal(denied.data.issue, 'PUBLIC_DEMO_READ_ONLY'); assert.equal(denied.data.canSign, false);
    }
    assert.equal((await send({ action: 'get', id: '00'.repeat(32) })).data.issue, 'OPERATION_NOT_FOUND');
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(join(root, 'journal/payments.sqlite'), { readOnly: true });
    try { assert.equal(db.prepare('SELECT count(*) AS n FROM payments').get().n, 0); assert.equal(db.prepare('SELECT count(*) AS n FROM payment_inputs').get().n, 0); } finally { db.close(); }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); journal.close(); await rm(root, { recursive: true }); }
});
