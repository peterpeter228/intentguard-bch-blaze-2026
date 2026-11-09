/** Loopback-only diagnostics and noncustodial payment journal. No server wallet. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { buildXoTemplateCandidate } from './xo-candidate.js';
import { buildPaymentRequestPlan } from './request-plan.js';
import { PaymentFlow } from './payment-flow.js';
import { PaymentChain } from './payment-chain.js';
import { PaymentJournal } from './operation-store.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const MAX_BODY_BYTES = 300 * 1024;
const BODY_DEADLINE_MS = 5000;
const COMPUTE_DEADLINE_MS = 15000;
const assets: Record<string, [string, string]> = {
  '/': ['../../core/index.html', 'text/html'], '/request': ['../../core/request.html', 'text/html'],
  '/request.js': ['./request.js', 'text/javascript'], '/style.css': ['../../core/style.css', 'text/css'], '/app.js': ['./app.js', 'text/javascript'],
  '/pay': ['../../core/payment.html', 'text/html'], '/payment.js': ['./payment.js', 'text/javascript']
};
function reply(res: ServerResponse, status: number, issue: string): void {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ status: 'REJECTED', issue, canSign: false, broadcastable: false, receiptValid: false, networkVerified: false, ownershipVerified: false }));
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** Reject duplicate decoded keys and excessive nesting before JSON.parse discards them. */
function parseBody(text: string, payment = false): Record<string, unknown> {
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      stack.push(text[i] === '{' ? new Set() : null);
      if (stack.length > 12) throw Error('INVALID_JSON');
    } else if (text[i] === '}' || text[i] === ']') stack.pop();
    else if (text[i] === '"') {
      const start = i++;
      for (; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      let next = i + 1;
      while (next < text.length && /\s/.test(text[next]!)) next++;
      if (text[next] === ':') {
        const key: unknown = JSON.parse(text.slice(start, i + 1));
        const keys = stack.at(-1);
        if (typeof key !== 'string' || !keys || keys.has(key)) throw Error('INVALID_JSON');
        keys.add(key);
      }
    }
  }
  const value: unknown = JSON.parse(text);
  if (payment) { if (!isRecord(value)) throw Error('INVALID_SCHEMA'); return value; }
  const fields = ['request', 'expectedRequestDigest', 'context', 'expectedRequestPlanDigest'];
  if (!isRecord(value) || Object.keys(value).length !== fields.length || fields.some(k => !Object.hasOwn(value, k)) || !isRecord(value.request) || !isRecord(value.context) ||
    typeof value.expectedRequestDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.expectedRequestDigest) ||
    typeof value.expectedRequestPlanDigest !== 'string' || !/^[0-9a-f]{64}$/.test(value.expectedRequestPlanDigest)) throw Error('INVALID_SCHEMA');
  return value;
}
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const metadata = Object.keys(req.headers).filter(k => k.startsWith('sec-fetch-'));
  if (!origin) return metadata.length === 0 && req.headers.referer === undefined;
  if (origin !== `http://${req.headers.host}`) return false;
  if (req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'same-origin') return false;
  if (req.headers['sec-fetch-mode'] !== undefined && !['cors', 'same-origin'].includes(String(req.headers['sec-fetch-mode']))) return false;
  if (req.headers['sec-fetch-dest'] !== undefined && req.headers['sec-fetch-dest'] !== 'empty') return false;
  return req.headers['sec-fetch-user'] === undefined;
}
async function candidate(req: IncomingMessage, res: ServerResponse, flow?: PaymentFlow): Promise<void> {
  // Aborted streams may emit a later error after body listeners are removed.
  req.on('error', () => {});
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); reply(res, 405, 'METHOD_NOT_ALLOWED'); return; }
  if (!sameOrigin(req) || req.headers['access-control-request-method'] !== undefined || req.headers['access-control-request-headers'] !== undefined) { reply(res, 403, 'ORIGIN_REJECTED'); return; }
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '') || req.headers['content-encoding'] !== undefined) { reply(res, 415, 'CONTENT_TYPE_REJECTED'); return; }
  const length = req.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) { reply(res, 413, 'BODY_TOO_LARGE'); return; }
  let body: Buffer;
  try {
    body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []; let count = 0;
      const cleanup = (): void => { clearTimeout(timer); req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', aborted); };
      const fail = (code: string): void => { cleanup(); req.resume(); reject(Error(code)); };
      const data = (chunk: Buffer): void => { count += chunk.length; if (count > MAX_BODY_BYTES) fail('BODY_TOO_LARGE'); else chunks.push(chunk); };
      const end = (): void => { cleanup(); resolve(Buffer.concat(chunks)); };
      const aborted = (): void => fail('REQUEST_INTERRUPTED');
      const timer = setTimeout(() => fail('BODY_TIMEOUT'), BODY_DEADLINE_MS);
      req.on('data', data); req.once('end', end); req.once('aborted', aborted); req.once('error', aborted);
    });
  } catch (error) {
    const issue = error instanceof Error ? error.message : 'REQUEST_INTERRUPTED';
    reply(res, issue === 'BODY_TOO_LARGE' ? 413 : issue === 'BODY_TIMEOUT' ? 408 : 400, issue);
    return;
  }
  let input: Record<string, unknown>;
  try { input = parseBody(new TextDecoder('utf-8', { fatal: true }).decode(body), flow !== undefined); }
  catch { reply(res, 400, 'INVALID_REQUEST'); return; }
  if (res.destroyed || req.aborted) return;
  try {
    if (flow) {
      const result = await flow.handle(input), json = JSON.stringify(result);
      if (Buffer.byteLength(json) > 1600000) { reply(res, 503, 'PAYMENT_UNAVAILABLE'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(json); return;
    }
    const startedAt = Date.now();
    const report = buildXoTemplateCandidate(input.request, input.expectedRequestDigest as string, input.context, startedAt);
    // The bounded adapter is synchronous: reject late results, rather than
    // pretending a Promise timer can interrupt CPU work on this event loop.
    if (Date.now() - startedAt > COMPUTE_DEADLINE_MS) { reply(res, 503, 'DIAGNOSTIC_UNAVAILABLE'); return; }
    if (isRecord(input.request) && typeof input.request.expiresAt === 'number' && input.request.expiresAt <= Date.now()) { reply(res, 409, 'REQUEST_EXPIRED'); return; }
    if (res.destroyed || req.aborted) return;
    if (report.binding && report.binding.requestPlanDigest !== input.expectedRequestPlanDigest) { reply(res, 409, 'REQUEST_PLAN_CHANGED'); return; }
    if (report.binding) {
      const refreshed = buildPaymentRequestPlan(input.request, input.expectedRequestDigest as string, input.context, Date.now());
      if (refreshed.status !== 'REQUEST_PLAN_BOUND_OFFLINE' || refreshed.binding?.requestPlanDigest !== input.expectedRequestPlanDigest) { reply(res, 409, 'REQUEST_PLAN_STALE'); return; }
    }
    const json = JSON.stringify(report);
    if (Buffer.byteLength(json) > 64 * 1024) { reply(res, 500, 'DIAGNOSTIC_UNAVAILABLE'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(json);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const allowed = /^(MAINNET_CAP_ZERO|REQUEST_RECONFIRM_REQUIRED|BUILD_REJECTED|UNKNOWN_OWNER_SCRIPT|NO_ORDINARY_CONFIRMED_FUNDS|CAPABILITY_REQUIRED|REVISION_CONFLICT|INVALID_TRANSITION|ATTEMPT_MISMATCH|NO_SEND_AUTHORITY|ORIGINAL_HASH_REQUIRED|POSTCHECK_FAILED|ECONOMIC_KEY_EXISTS|OPERATION_NOT_FOUND|INVALID_PAYMENT_SCHEMA|SOURCE_IDENTITY_OR_FRESHNESS|SOURCES_DISAGREE_OR_STALE)$/;
    reply(res, 409, flow ? allowed.test(code) ? code : 'PAYMENT_UNAVAILABLE_RECONCILE_ORIGINAL' : 'DIAGNOSTIC_UNAVAILABLE');
  }
}
export function createPaymentServer(flow?: PaymentFlow, publicRoot?: string) {
let active = 0;
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' wss://relay.riften.net:443; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const address = server.address(), port = address && typeof address !== 'string' ? address.port : 8788;
  if (![`localhost:${port}`, `127.0.0.1:${port}`].includes(req.headers.host ?? '')) { reply(res, 403, 'HOST_REJECTED'); return; }
  if (req.url === '/api/payment' || req.url === '/api/xo-candidate') {
    if (active >= 8) { reply(res, 503, 'BUSY'); return; }
    if (req.url === '/api/payment' && !flow) { reply(res, 503, 'PAYMENT_JOURNAL_REQUIRED'); return; }
    active++;
    try { await candidate(req, res, req.url === '/api/payment' ? flow : undefined); } finally { active--; }
    return;
  }
  const asset = assets[req.url ?? ''];
  if (req.method !== 'GET' || !asset) { res.writeHead(404); res.end(); return; }
  try { const data = await readFile(publicRoot ? resolve(publicRoot, req.url === '/' ? 'index.html' : req.url === '/pay' ? 'pay.html' : req.url === '/request' ? 'request.html' : req.url!.slice(1)) : new URL(asset[0], import.meta.url)); res.writeHead(200, { 'Content-Type': asset[1] + '; charset=utf-8' }); res.end(data); }
  catch { res.writeHead(500); res.end('Build the local core demo first.'); }
});
server.requestTimeout = 20000; server.headersTimeout = 10000; server.keepAliveTimeout = 1000; server.maxConnections = 32;
return server;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const directory = process.env.INTENTGUARD_PAYMENT_DIR;
  const journal = directory ? process.argv.includes('--create-payment-journal') ? PaymentJournal.create(directory) : PaymentJournal.open(directory) : null;
  const flow = journal ? new PaymentFlow(journal, new PaymentChain()) : undefined;
  const server = createPaymentServer(flow, process.env.INTENTGUARD_PUBLIC_ROOT);
  server.listen(8788, '127.0.0.1', () => console.log('Offline core demo http://127.0.0.1:8788; /pay Chipnet only; mainnet cap0; no server wallet.'));
  process.once('SIGTERM', () => { server.closeAllConnections(); server.close(() => { journal?.close(); }); });
}
