import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnServerProcess } from '../test-support/server-process.mjs';
import { request as httpRequest } from 'node:http';
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
test('loopback static UI and bounded XO diagnostics preserve all offline authority boundaries', async () => {
  const server = spawnServerProcess(['dist/core/server.js'], { readyText: 'Offline core demo http://127.0.0.1:8788' });
  try {
    await server.ready;
    for (const path of ['/', '/app.js', '/style.css', '/request', '/request.js']) {
      const response = await fetch(base + path); assert.equal(response.status, 200);
      const csp = response.headers.get('content-security-policy'); assert(csp.includes("'wasm-unsafe-eval'")); assert(!csp.includes("'unsafe-eval'")); assert(csp.includes("connect-src 'self'")); assert.equal(response.headers.get('cache-control'), 'no-store');
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
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 404);
    assert.equal((await fetch(base + '/api/wallet')).status, 404);
  } finally { await server.stop(); }
});
