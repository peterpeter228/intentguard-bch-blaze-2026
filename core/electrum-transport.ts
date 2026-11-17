/**
 * Node-only, read-only Electrum TLS transport. Endpoint definitions MUST be authored
 * by trusted application code, never constructed from candidate JSON, URLs, or
 * request parameters. No endpoints are configured here; importing performs no I/O.
 * The allowlist is validated, cloned and frozen at construction. DNS/TLS identity
 * is not chain truth, operator independence, or spending authorization.
 *
 * Each call uses one verified TLS connection, one protocol-1.5.0 handshake,
 * and at most one allowed read request. No reconnect, fallback, or retry. Self-
 * signed/untrusted certificates fail normally; there is no insecure TLS option.
 * The whole connection (handshake included) has a 5s deadline and 512KiB response
 * budget. Test injection is explicitly synthetic and must not serve node evidence.
 */
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { Duplex } from 'node:stream';
import { connect, checkServerIdentity } from 'node:tls';
import type { ReadMethod, ReadTransport } from './evidence.js';

export interface ElectrumEndpoint { readonly id: string; readonly hostname: string; readonly port: number; }
export const ELECTRUM_RESPONSE_LIMIT = 512 * 1024;
export const ELECTRUM_DEADLINE_MS = 5000;
export interface ElectrumTLSOptions {
  readonly host: string; readonly port: number; readonly servername: string;
  readonly rejectUnauthorized: true; readonly minVersion: 'TLSv1.2';
  readonly checkServerIdentity: typeof checkServerIdentity;
}
/** Synthetic test seam, not a certificate-verification replacement for production. */
export interface SyntheticTLSSocket extends Duplex { readonly authorized: boolean; readonly encrypted: boolean; }
export type SyntheticTLSFactory = (options: ElectrumTLSOptions) => SyntheticTLSSocket;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const safeInteger = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function captureEndpoint(allowlist: readonly ElectrumEndpoint[], endpointId: string): Readonly<ElectrumEndpoint> {
  if (!Array.isArray(allowlist) || allowlist.length < 1 || allowlist.length > 32 || typeof endpointId !== 'string') throw Error('ELECTRUM_INVALID_CONFIG');
  const captured = allowlist.map((e: ElectrumEndpoint) => {
    if (!object(e) || Object.keys(e).sort().join(',') !== 'hostname,id,port' || typeof e.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(e.id) || typeof e.hostname !== 'string' || e.hostname.length > 253 || e.hostname !== e.hostname.toLowerCase() || isIP(e.hostname) !== 0 || !safeInteger(e.port) || e.port < 1 || e.port > 65535) throw Error('ELECTRUM_INVALID_CONFIG');
    const labels = e.hostname.split('.');
    if (labels.length < 2 || labels.some(label => label === 'localhost' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(labels.at(-1)!)) throw Error('ELECTRUM_INVALID_CONFIG');
    return Object.freeze({ id: e.id, hostname: e.hostname, port: e.port });
  });
  if (new Set(captured.map(e => e.id)).size !== captured.length) throw Error('ELECTRUM_INVALID_CONFIG');
  Object.freeze(captured);
  const selected = captured.find(e => e.id === endpointId); if (!selected) throw Error('ELECTRUM_ENDPOINT_NOT_ALLOWED'); return selected;
}
/** Runtime validation also rejects forged TypeScript callers, before opening TLS. */
function captureParams(method: ReadMethod, params: readonly unknown[]): readonly (string | number | boolean)[] {
  if (!Array.isArray(params)) throw Error('ELECTRUM_INVALID_PARAMS');
  switch (method) {
    case 'server.features': case 'blockchain.headers.subscribe': if (params.length === 0) return Object.freeze([]); break;
    case 'blockchain.block.header': if (params.length === 1 && safeInteger(params[0])) return Object.freeze([params[0]]); break;
    case 'blockchain.transaction.get': if (params.length === 2 && hash(params[0]) && params[1] === false) return Object.freeze([params[0], false]); break;
    case 'blockchain.scripthash.listunspent': if (params.length === 2 && hash(params[0]) && params[1] === 'include_tokens') return Object.freeze([params[0], 'include_tokens']); break;
    default: throw Error('ELECTRUM_METHOD_FORBIDDEN');
  }
  throw Error('ELECTRUM_INVALID_PARAMS');
}
export type ObservationMethod = 'blockchain.scripthash.get_history' | 'blockchain.transaction.get_merkle';
export interface ObservationTransport { request(method: ObservationMethod, params: readonly unknown[], signal: AbortSignal): Promise<unknown>; }
function transport(endpoint: Readonly<ElectrumEndpoint>, factory: SyntheticTLSFactory, deadlineMs: number, send = false, observe = false) {
  return Object.freeze({
    async request(method: ReadMethod | ObservationMethod | 'blockchain.transaction.broadcast', params: readonly unknown[], signal: AbortSignal): Promise<unknown> {
      const captured = method === 'blockchain.transaction.broadcast' ? (() => {
        if (!send) throw Error('ELECTRUM_METHOD_FORBIDDEN');
        if (params.length !== 1 || typeof params[0] !== 'string' || params[0].length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(params[0])) throw Error('ELECTRUM_INVALID_PARAMS');
        return [params[0]];
      })() : method === 'blockchain.scripthash.get_history' || method === 'blockchain.transaction.get_merkle' ? (() => {
        if (!observe) throw Error('ELECTRUM_METHOD_FORBIDDEN');
        if (!Array.isArray(params) || !hash(params[0]) || (method === 'blockchain.scripthash.get_history' ? params.length !== 1 : params.length !== 2 || !safeInteger(params[1]) || params[1] < 1)) throw Error('ELECTRUM_INVALID_PARAMS');
        return params as readonly (string | number)[];
      })() : captureParams(method, params);
      if (!(signal instanceof AbortSignal)) throw Error('ELECTRUM_INVALID_SIGNAL');
      if (signal.aborted) throw Error('ELECTRUM_ABORTED');
      const handshakeId = randomUUID(); const requestId = randomUUID();
      return await new Promise<unknown>((resolve, reject) => {
        let socket: SyntheticTLSSocket | undefined; let settled = false; let stage: 'tls' | 'version' | 'response' = 'tls';
        let bytes = 0; let buffer = Buffer.alloc(0);
        const timer = setTimeout(() => finish('ELECTRUM_TIMEOUT'), deadlineMs);
        const onAbort = (): void => finish('ELECTRUM_ABORTED');
        const onError = (): void => finish('ELECTRUM_CONNECTION_FAILED');
        const onClosed = (): void => finish('ELECTRUM_INCOMPLETE_RESPONSE');
        function finish(error: string | null, result?: unknown): void {
          if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', onAbort);
          cleanupSocket();
          if (error !== null) reject(Error(error)); else resolve(result);
        }
        function cleanupSocket(): void {
          if (socket) {
            socket.removeListener('secureConnect', onSecure); socket.removeListener('data', onData); socket.removeListener('error', onError); socket.removeListener('end', onClosed); socket.removeListener('close', onClosed);
            // A queued transport error during destroy must not become unhandled.
            if (!socket.closed) {
              const ignoreLateError = (): void => {};
              socket.on('error', ignoreLateError);
              socket.once('close', () => socket?.removeListener('error', ignoreLateError));
            }
            try { socket.destroy(); } catch { /* Synthetic teardown cannot leak raw errors. */ }
          }
        }
        function send(id: string, rpcMethod: string, rpcParams: readonly (string | number | boolean)[]): void {
          if (settled || !socket) return;
          try { socket.write(JSON.stringify({ jsonrpc: '2.0', id, method: rpcMethod, params: rpcParams }) + '\n', error => { if (error) finish('ELECTRUM_CONNECTION_FAILED'); }); }
          catch { finish('ELECTRUM_CONNECTION_FAILED'); }
        }
        function onSecure(): void {
          if (settled) return;
          if (stage !== 'tls' || socket?.authorized !== true || socket.encrypted !== true) { finish('ELECTRUM_TLS_UNVERIFIED'); return; }
          stage = 'version'; send(handshakeId, 'server.version', ['IntentGuard read-only', '1.5.0']);
        }
        function onData(chunk: unknown): void {
          if (settled) return;
          if (!Buffer.isBuffer(chunk) || stage === 'tls') { finish('ELECTRUM_MALFORMED_RESPONSE'); return; }
          bytes += chunk.length; if (bytes > ELECTRUM_RESPONSE_LIMIT) { finish('ELECTRUM_RESPONSE_TOO_LARGE'); return; }
          buffer = Buffer.concat([buffer, chunk]);
          while (!settled) {
            const newline = buffer.indexOf(10); if (newline < 0) return;
            const frame = buffer.subarray(0, newline); buffer = buffer.subarray(newline + 1);
            let message: unknown;
            try { message = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(frame)); } catch { finish('ELECTRUM_MALFORMED_RESPONSE'); return; }
            const expectedId = stage === 'version' ? handshakeId : requestId;
            if (!object(message) || message.jsonrpc !== '2.0' || message.id !== expectedId || Object.keys(message).some(k => !['jsonrpc', 'id', 'result', 'error'].includes(k)) || (!Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error')) || (Object.hasOwn(message, 'result') && Object.hasOwn(message, 'error'))) { finish('ELECTRUM_PROTOCOL_ERROR'); return; }
            if (Object.hasOwn(message, 'error')) { finish('ELECTRUM_RPC_ERROR'); return; }
            if (stage === 'version') {
              // Electrum permits omitted zero revision: Fulcrum returns "1.5" for "1.5.0".
              if (!Array.isArray(message.result) || message.result.length !== 2 || typeof message.result[0] !== 'string' || message.result[0].length > 256 || (message.result[1] !== '1.5.0' && message.result[1] !== '1.5')) { finish('ELECTRUM_UNSUPPORTED_PROTOCOL'); return; }
              // No unsolicited frames may be queued before the actual read request.
              if (buffer.length !== 0) { finish('ELECTRUM_PROTOCOL_ERROR'); return; }
              stage = 'response'; send(requestId, method, captured); return;
            }
            if (buffer.length !== 0) { finish('ELECTRUM_PROTOCOL_ERROR'); return; }
            finish(null, message.result); return;
          }
        }
        signal.addEventListener('abort', onAbort, { once: true });
        try {
          socket = factory(Object.freeze({ host: endpoint.hostname, port: endpoint.port, servername: endpoint.hostname, rejectUnauthorized: true, minVersion: 'TLSv1.2', checkServerIdentity }));
          if (settled) { cleanupSocket(); return; }
          socket.on('secureConnect', onSecure); socket.on('data', onData); socket.on('error', onError); socket.on('end', onClosed); socket.on('close', onClosed);
          if (signal.aborted) onAbort(); else if (socket.destroyed) onClosed();
        } catch { finish('ELECTRUM_CONNECTION_FAILED'); }
      });
    }
  });
}
/** Only a key in an application-authored allowlist is selectable, never a URL. */
export function createElectrumTransport(allowlist: readonly ElectrumEndpoint[], endpointId: string): ReadTransport {
  return transport(captureEndpoint(allowlist, endpointId), options => connect(options), ELECTRUM_DEADLINE_MS);
}
/** No networking in synthetic tests. A short test deadline may not exceed 5 seconds. */
export function createSyntheticElectrumTransport(allowlist: readonly ElectrumEndpoint[], endpointId: string, factory: SyntheticTLSFactory, deadlineMs = ELECTRUM_DEADLINE_MS): ReadTransport {
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > ELECTRUM_DEADLINE_MS) throw Error('ELECTRUM_INVALID_TEST_DEADLINE');
  return transport(captureEndpoint(allowlist, endpointId), factory, deadlineMs);
}

/** Send-only transport; its caller must commit the applicable send reservation first. */
export function createElectrumSender(allowlist: readonly ElectrumEndpoint[], endpointId: string): (hex: string, signal: AbortSignal) => Promise<unknown> {
  const wire = transport(captureEndpoint(allowlist, endpointId), options => connect(options), ELECTRUM_DEADLINE_MS, true);
  return (hex, signal) => wire.request('blockchain.transaction.broadcast', [hex], signal);
}

/** Separate inclusion reader; ordinary ReadTransport retains its original five methods. */
export function createChipnetObservationTransport(allowlist: readonly ElectrumEndpoint[], endpointId: string): ObservationTransport {
  return transport(captureEndpoint(allowlist, endpointId), options => connect(options), ELECTRUM_DEADLINE_MS, false, true);
}
