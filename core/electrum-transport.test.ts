/** Entirely synthetic stream tests. No DNS, TLS sockets, or external requests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { Duplex } from 'node:stream';
import { checkServerIdentity } from 'node:tls';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createElectrumTransport, createSyntheticElectrumTransport, ELECTRUM_RESPONSE_LIMIT, ELECTRUM_DEADLINE_MS, type ElectrumEndpoint, type ElectrumTLSOptions } from './electrum-transport.js';
import type { ReadMethod } from './evidence.js';
interface WireRequest { jsonrpc: string; id: string; method: string; params: unknown[]; }
class FakeTLS extends Duplex {
  authorized = true; encrypted = true; requests: WireRequest[] = [];
  constructor(private readonly reply: (request: WireRequest, socket: FakeTLS) => void, secure = true) { super(); if (secure) queueMicrotask(() => { if (!this.destroyed) this.emit('secureConnect'); }); }
  override _read(): void {}
  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    const parsed: unknown = JSON.parse(chunk.toString('utf8')); assert.ok(parsed && typeof parsed === 'object' && 'id' in parsed && 'method' in parsed && 'params' in parsed);
    const request = parsed as WireRequest; this.requests.push(request); callback();
    queueMicrotask(() => { if (!this.destroyed) this.reply(request, this); });
  }
  frame(id: string, result: unknown): void { this.push(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')); }
}
const allowlist: readonly ElectrumEndpoint[] = [{ id: 'fixture', hostname: 'electrum.example.org', port: 50002 }];
const signal = (): AbortSignal => new AbortController().signal;
function harness(respond: (request: WireRequest, socket: FakeTLS) => void, deadline = 1000, secure = true) {
  const sockets: FakeTLS[] = []; const options: ElectrumTLSOptions[] = [];
  const transport = createSyntheticElectrumTransport(allowlist, 'fixture', o => {
    options.push(o); const socket = new FakeTLS((request, stream) => {
      if (request.method === 'server.version') stream.frame(request.id, ['Synthetic Electrum fixture', '1.5.0']); else respond(request, stream);
    }, secure); sockets.push(socket); return socket;
  }, deadline);
  return { transport, sockets, options };
}
async function assertClean(socket: FakeTLS, abortSignal: AbortSignal): Promise<void> {
  await nextTurn(); assert.equal(socket.destroyed, true);
  for (const name of ['secureConnect', 'data', 'error', 'end', 'close']) assert.equal(socket.listenerCount(name), 0, name);
  assert.equal(getEventListeners(abortSignal, 'abort').length, 0);
}

test('five allowed reads negotiate exact 1.5.0 with normal certificate verification and no retries', async () => {
  const h = harness((request, socket) => socket.frame(request.id, { synthetic: request.method }));
  const cases: [ReadMethod, readonly unknown[]][] = [['server.features', []], ['blockchain.block.header', [123]], ['blockchain.headers.subscribe', []], ['blockchain.transaction.get', ['ab'.repeat(32), false]], ['blockchain.scripthash.listunspent', ['cd'.repeat(32), 'include_tokens']]];
  for (const [method, params] of cases) {
    const abortSignal = signal(); assert.deepEqual(await h.transport.request(method, params, abortSignal), { synthetic: method });
    const socket = h.sockets.at(-1)!; assert.equal(socket.requests.length, 2);
    assert.equal(socket.requests[0]?.method, 'server.version'); assert.deepEqual(socket.requests[0]?.params, ['IntentGuard read-only', '1.5.0']);
    assert.equal(socket.requests[1]?.method, method); assert.deepEqual(socket.requests[1]?.params, params);
    assert.notEqual(socket.requests[0]?.id, socket.requests[1]?.id); await assertClean(socket, abortSignal);
  }
  assert.equal(h.sockets.length, 5);
  for (const options of h.options) {
    assert.equal(options.host, 'electrum.example.org'); assert.equal(options.servername, options.host); assert.equal(options.port, 50002);
    assert.equal(options.rejectUnauthorized, true); assert.equal(options.minVersion, 'TLSv1.2'); assert.equal(options.checkServerIdentity, checkServerIdentity); assert.equal(Object.isFrozen(options), true);
    assert.deepEqual(Object.keys(options).sort(), ['checkServerIdentity', 'host', 'minVersion', 'port', 'rejectUnauthorized', 'servername']);
  }
  assert.equal(ELECTRUM_DEADLINE_MS, 5000);
});

test('newline frames and UTF-8 code points may be fragmented', async () => {
  const h = harness((request, socket) => {
    const bytes = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: '中文🙂' }) + '\r\n');
    for (const byte of bytes) socket.push(Buffer.from([byte]));
  }); const abortSignal = signal(); assert.equal(await h.transport.request('server.features', [], abortSignal), '中文🙂'); await assertClean(h.sockets[0]!, abortSignal);
});

test('allowlist is captured immutably and parameters are copied before handshake', async () => {
  const mutable = [{ id: 'fixture', hostname: 'electrum.example.org', port: 50002 }]; let observed: ElectrumTLSOptions | undefined; let socket: FakeTLS | undefined;
  const t = createSyntheticElectrumTransport(mutable, 'fixture', o => { observed = o; socket = new FakeTLS((r, s) => s.frame(r.id, r.method === 'server.version' ? ['fixture', '1.5.0'] : r.params)); return socket; });
  mutable[0]!.hostname = 'attacker.example.org'; mutable[0]!.port = 1;
  const params: unknown[] = ['ab'.repeat(32), false]; const pending = t.request('blockchain.transaction.get', params, signal()); params[0] = 'cd'.repeat(32);
  assert.deepEqual(await pending, ['ab'.repeat(32), false]); assert.equal(observed?.host, 'electrum.example.org'); assert.equal(observed?.port, 50002); assert.equal(socket?.requests.length, 2);
});

test('invalid endpoint configurations are rejected without connecting; no arbitrary URL selector', () => {
  for (const hostname of ['localhost', 'a.localhost', '127.0.0.1', '[::1]', '::1', 'https://example.org', 'user@example.org', 'example.org/path', 'example.org:50002', 'example.org.', 'bad_.example.org', 'Example.org', 'example.123', '-bad.example.org']) assert.throws(() => createElectrumTransport([{ id: 'fixture', hostname, port: 50002 }], 'fixture'), /ELECTRUM_INVALID_CONFIG/);
  for (const port of [0, -1, 65536, 1.5, NaN]) assert.throws(() => createElectrumTransport([{ id: 'fixture', hostname: 'electrum.example.org', port }], 'fixture'), /ELECTRUM_INVALID_CONFIG/);
  assert.throws(() => createElectrumTransport(allowlist, 'https://elsewhere.example.org'), /ELECTRUM_ENDPOINT_NOT_ALLOWED/);
  assert.throws(() => createElectrumTransport([...allowlist, ...allowlist], 'fixture'), /ELECTRUM_INVALID_CONFIG/);
  assert.throws(() => createElectrumTransport([], 'fixture'), /ELECTRUM_INVALID_CONFIG/);
  assert.throws(() => Reflect.apply(createElectrumTransport, undefined, [[{ ...allowlist[0], rejectUnauthorized: false }], 'fixture']), /ELECTRUM_INVALID_CONFIG/);
});

test('forbidden methods and malformed params fail before the TLS factory', async () => {
  let calls = 0; const t = createSyntheticElectrumTransport(allowlist, 'fixture', () => { calls++; throw Error('must not connect'); });
  for (const method of ['blockchain.transaction.broadcast', 'server.version', 'wallet.sign', 'server.peers.subscribe', 'https://example.org']) await assert.rejects(Reflect.apply(t.request, t, [method, [], signal()]), /ELECTRUM_METHOD_FORBIDDEN/);
  const invalid: [ReadMethod, unknown][] = [['server.features', [1]], ['blockchain.headers.subscribe', [0]], ['blockchain.block.header', [-1]], ['blockchain.block.header', [1.1]], ['blockchain.block.header', [Number.MAX_SAFE_INTEGER + 1]], ['blockchain.block.header', ['1']], ['blockchain.transaction.get', ['AB'.repeat(32), false]], ['blockchain.transaction.get', ['ab'.repeat(32), true]], ['blockchain.transaction.get', ['ab'.repeat(32)]], ['blockchain.scripthash.listunspent', ['ab'.repeat(32), 'exclude_tokens']], ['blockchain.scripthash.listunspent', ['ab'.repeat(32), 'include_tokens', 'extra']], ['server.features', {}]];
  for (const [method, params] of invalid) await assert.rejects(Reflect.apply(t.request, t, [method, params, signal()]), /ELECTRUM_INVALID_PARAMS/);
  assert.equal(calls, 0);
});

test('wrong ids, malformed envelopes, RPC errors and extra frames are sanitized and rejected', async () => {
  const replies: ((r: WireRequest) => string | Buffer)[] = [
    r => JSON.stringify({ jsonrpc: '2.0', id: r.id + '-wrong', result: true }) + '\n',
    r => JSON.stringify({ id: r.id, result: true }) + '\n',
    r => JSON.stringify({ jsonrpc: '2.0', id: r.id, result: true, error: null }) + '\n',
    r => JSON.stringify({ jsonrpc: '2.0', id: r.id, error: { code: -1, message: 'credential secret /private/path' } }) + '\n',
    r => JSON.stringify({ jsonrpc: '2.0', id: r.id, result: true, method: 'notification' }) + '\n',
    r => JSON.stringify({ jsonrpc: '2.0', id: r.id, result: true }) + '\n{}\n',
    r => JSON.stringify({ jsonrpc: '2.0', id: r.id, result: true }) + '\nx',
    () => 'null\n', () => '[]\n', () => '\n', () => '{broken}\n', () => Buffer.from([0xff, 10])
  ];
  for (const reply of replies) {
    const h = harness((r, s) => s.push(Buffer.from(reply(r)))); const abortSignal = signal();
    await assert.rejects(h.transport.request('server.features', [], abortSignal), error => error instanceof Error && /^ELECTRUM_(PROTOCOL_ERROR|RPC_ERROR|MALFORMED_RESPONSE)$/.test(error.message));
    assert.equal(h.sockets.length, 1); await assertClean(h.sockets[0]!, abortSignal);
  }
});

test('Fulcrum canonical 1.5 response permits the requested 1.5.0 read without fallback', async () => {
  let socket: FakeTLS | undefined;
  const transport = createSyntheticElectrumTransport(allowlist, 'fixture', () => {
    socket = new FakeTLS((r, s) => s.frame(r.id, r.method === 'server.version' ? ['Fulcrum fixture', '1.5'] : 'checkpoint header'));
    return socket;
  });
  const abortSignal = signal();
  assert.equal(await transport.request('blockchain.block.header', [121957], abortSignal), 'checkpoint header');
  assert.deepEqual(socket!.requests.map(r => r.method), ['server.version', 'blockchain.block.header']);
  await assertClean(socket!, abortSignal);
});

test('unsupported protocol and unverified TLS never send the application read', async () => {
  for (const version of ['1.4', '1.5.1', '1.6', '01.5', '1.05', '1.5.', '1.5.0.0', '1.5\n', null, ['fixture', '1.5.0', 'extra']]) {
    let socket: FakeTLS | undefined;
    const t = createSyntheticElectrumTransport(allowlist, 'fixture', () => { socket = new FakeTLS((r, s) => s.frame(r.id, Array.isArray(version) ? version : ['fixture', version])); return socket; });
    const abortSignal = signal(); await assert.rejects(t.request('server.features', [], abortSignal), /ELECTRUM_UNSUPPORTED_PROTOCOL/); assert.equal(socket?.requests.length, 1); await assertClean(socket!, abortSignal);
  }
  const h = harness(() => assert.fail('application request must not occur')); const abortSignal = signal(); const pending = h.transport.request('server.features', [], abortSignal); h.sockets[0]!.authorized = false;
  await assert.rejects(pending, /ELECTRUM_TLS_UNVERIFIED/); assert.equal(h.sockets[0]?.requests.length, 0); await assertClean(h.sockets[0]!, abortSignal);
});

test('aggregate response limit includes handshake and fragmented unterminated frames', async () => {
  const h = harness((_r, s) => { s.push(Buffer.alloc(ELECTRUM_RESPONSE_LIMIT / 2, 32)); s.push(Buffer.alloc(ELECTRUM_RESPONSE_LIMIT / 2, 32)); }); const abortSignal = signal();
  await assert.rejects(h.transport.request('server.features', [], abortSignal), /ELECTRUM_RESPONSE_TOO_LARGE/); await assertClean(h.sockets[0]!, abortSignal);
});

test('deadline spans TLS establishment and incomplete application response, with cleanup and no retry', async () => {
  for (const secure of [false, true]) {
    const h = harness((_r, s) => s.push(Buffer.from('{')), 15, secure); const abortSignal = signal();
    await assert.rejects(h.transport.request('server.features', [], abortSignal), /ELECTRUM_TIMEOUT/);
    assert.equal(h.sockets.length, 1); await assertClean(h.sockets[0]!, abortSignal);
  }
});

test('abort before connect, during handshake, and during read destroys resources', async () => {
  const already = new AbortController(); already.abort('private reason'); const h = harness(() => {});
  await assert.rejects(h.transport.request('server.features', [], already.signal), /ELECTRUM_ABORTED/); assert.equal(h.sockets.length, 0);
  for (const secure of [false, true]) {
    const controller = new AbortController(); const live = harness(() => controller.abort('private reason'), 1000, secure); const pending = live.transport.request('server.features', [], controller.signal);
    if (!secure) controller.abort('private reason'); await assert.rejects(pending, /ELECTRUM_ABORTED/); await assertClean(live.sockets[0]!, controller.signal);
  }
  const controller = new AbortController(); let socket: FakeTLS | undefined;
  const t = createSyntheticElectrumTransport(allowlist, 'fixture', () => { controller.abort(); socket = new FakeTLS(() => {}); return socket; });
  await assert.rejects(t.request('server.features', [], controller.signal), /ELECTRUM_ABORTED/); await assertClean(socket!, controller.signal);
});

test('connection errors, unexpected end, and factory errors do not disclose endpoint/error contents', async () => {
  for (const respond of [(_r: WireRequest, s: FakeTLS) => s.emit('error', Error('password secret private path')), (_r: WireRequest, s: FakeTLS) => s.push(null), (_r: WireRequest, s: FakeTLS) => s.destroy()]) {
    const h = harness(respond); const abortSignal = signal(); await assert.rejects(h.transport.request('server.features', [], abortSignal), error => error instanceof Error && /^ELECTRUM_(CONNECTION_FAILED|INCOMPLETE_RESPONSE)$/.test(error.message)); await assertClean(h.sockets[0]!, abortSignal);
  }
  const t = createSyntheticElectrumTransport(allowlist, 'fixture', () => { throw Error('sensitive endpoint or certificate detail'); });
  const abortSignal = signal(); await assert.rejects(t.request('server.features', [], abortSignal), /^Error: ELECTRUM_CONNECTION_FAILED$/); assert.equal(getEventListeners(abortSignal, 'abort').length, 0);
});
