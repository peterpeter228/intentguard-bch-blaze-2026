import { DappConnectionManager } from '@wizardconnect/dapp';
import { DEFAULT_RELAY_URLS, encodeKeyExchangeURI, generateKeyExchangeCredentials, initiateRelay, RelayMsgAction, isHdwalletv1Session,
  type DappRelayOptions, type DappRelayResult, type initiateDappRelay, type ProtocolMessage, type RelayClient, type RelayStatusCallback,
  type SignTransactionRequest } from '@wizardconnect/core';
import { sourceOutputToRelay } from '@wizardconnect/core/hdwalletv1-serialize';
import { binToHex, hexToBin, decodeTransaction, hashTransaction, hash160, sha256, decodeHdPublicKey, secp256k1 } from '@bitauth/libauth';
import { EventEmitter } from 'eventemitter3';
import { deriveSessionOwnership, type PathBinding, type PublicKeySession } from './evidence.js';
import type { UnsignedBuildResult } from './unsigned-builder.js';
import type { DeepReadonly } from './request-plan.js';

export const WALLET_RELAY = 'wss://relay.riften.net:443';
export interface SignEnvelope {
  operationId: string; attemptId: string; revision: number; requestDigest: string;
  intentDigest: string; planDigest: string; unsignedHash: string; sessionId: string; sequence: number; expiresAt: number;
}
export type RelayStarter = typeof initiateDappRelay;

/** Use the SDK transport without its hide-page disconnect policy. */
export function startDappRelay(statusCallback: RelayStatusCallback, options: DappRelayOptions = {}): DappRelayResult {
  const stored = options.existingCredentials;
  const privateKey = stored ? hexToBin(stored.privateKey) : undefined;
  const publicKey = privateKey?.length === 32 ? secp256k1.derivePublicKeyCompressed(privateKey) : undefined;
  if (stored && !(publicKey instanceof Uint8Array)) throw Error('INVALID_RELAY_KEY');
  const credentials = stored && publicKey instanceof Uint8Array
    ? { privateKey: stored.privateKey, secret: stored.secret, publicKey: binToHex(publicKey.slice(1)) }
    : generateKeyExchangeCredentials();
  const explicit = options.explicitRelayUrls?.[0];
  const url = explicit ? new URL(explicit) : null;
  const protocol = url?.protocol === 'ws:' ? 'ws' : 'wss';
  const pairing = encodeKeyExchangeURI(credentials.publicKey, credentials.secret, url
    ? { hostname: url.hostname, port: url.port ? Number(url.port) : protocol === 'ws' ? 80 : 443, protocol }
    : undefined);
  const events = new EventEmitter<{ keyexchangecomplete: [Uint8Array] }>();
  let client: RelayClient | undefined;
  let disposed = false;
  let peer = stored ? hexToBin(stored.walletPublicKey) : null;
  const exchange = (message: ProtocolMessage): void => {
    if (!peer && message.action === RelayMsgAction.WalletReady && 'secret' in message && message.secret === credentials.secret &&
        'public_key' in message && typeof message.public_key === 'string' && /^[0-9a-f]{64}$/.test(message.public_key)) {
      peer = hexToBin(message.public_key);
      client?.setPairedPublicKey(peer);
      events.emit('keyexchangecomplete', peer);
    }
  };
  const cleanup = initiateRelay(payload => {
    if (!client) {
      const relayClient = client = payload.client;
      relayClient.on('message', exchange);
      const disconnect = relayClient.disconnect.bind(relayClient);
      relayClient.disconnect = async () => {
        if (!disposed) return disconnect();
        // WizardConnect 0.2.5 drops the subscription close promise before closing its pool.
        // Drain it first so nostr-tools' queued CLOSE send runs on the open socket.
        try {
          while (relayClient['subscription']) {
            const subscription = relayClient['subscription'];
            await subscription.close();
            // An in-flight connect() can replace the subscription while close is pending.
            if (relayClient['subscription'] === subscription) relayClient['subscription'] = null;
          }
        } finally {
          await disconnect();
        }
      };
    }
    statusCallback(payload);
  }, privateKey ?? hexToBin(credentials.privateKey), peer ?? new Uint8Array(33), {
    explicitRelayUrls: options.explicitRelayUrls?.length ? options.explicitRelayUrls : [...DEFAULT_RELAY_URLS],
    ...(options.reconnectInterval === undefined ? {} : { reconnectInterval: options.reconnectInterval }),
    ...(options.maxReconnectAttempts === undefined ? {} : { maxReconnectAttempts: options.maxReconnectAttempts }),
    enableVisibilityHandling: false,
  });
  return { ...pairing, credentials, events,
    get client() { if (!client) throw Error('RELAY_NOT_READY'); return client; },
    cleanup: () => {
      if (disposed) return;
      disposed = true;
      cleanup();
      client?.off('message', exchange);
    },
  };
}

const isSignedHex = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 200000 && /^(?:[0-9a-f]{2})+$/.test(value);

/** Noncustodial, memory-only session. No cached discovery is authentication. */
export class ConnectedWallet implements PublicKeySession {
  private manager = new DappConnectionManager('IntentGuard PRESEASON', undefined, { session: false });
  private relay: DappRelayResult | null = null;
  private client: RelayClient | null = null;
  private live = false;
  private exchanged: string | null = null;
  private session: string | null = null;
  private xpubs: [string, string] | null = null;
  private issuedSequence: number | null = null;
  private readonly sentAttempts = new Set<string>();
  private pending: { envelope: SignEnvelope; resume: () => void; reject: (reason: Error) => void } | null = null;
  private cancelled: { manager: DappConnectionManager; envelope: SignEnvelope } | null = null;
  private timer: NodeJS.Timeout | undefined;
  private closed = true;
  private network: string | null = null;
  private visibility: (() => void) | null = null;
  constructor(private readonly changed: () => void, private readonly start: RelayStarter = startDappRelay,
    private readonly quarantine: (envelope: SignEnvelope, signedHex: string) => void = () => {},
    private readonly allowedNetwork: 'chipnet' | 'mainnet' = 'chipnet') {}
  currentSessionId(): string | null { return this.live && !this.closed ? this.session : null; }
  hasPath(childIndex: number): boolean { return this.currentSessionId() !== null && this.manager.hasPath(childIndex); }
  getPubkey(childIndex: number, index: bigint): Uint8Array | undefined { return this.currentSessionId() ? this.manager.getPubkey(childIndex, index) : undefined; }
  connect(network: string): string {
    if (network !== this.allowedNetwork) throw Error('MAINNET_CAP_ZERO');
    if (!this.closed) throw Error('CONNECTION_EXISTS');
    const manager = this.manager = new DappConnectionManager('IntentGuard PRESEASON', undefined, { session: false });
    const active = (): boolean => !this.closed && this.manager === manager;
    let announced = false;
    const announce = (): void => {
      if (!announced && this.live && this.session) { announced = true; this.changed(); }
    };
    this.closed = false;
    this.network = network;
    manager.on('messagereceived', msg => {
      const cancelled = this.cancelled;
      if (msg.action === RelayMsgAction.SignTransactionResponse && cancelled?.manager === manager &&
          'sequence' in msg && msg.sequence === cancelled.envelope.sequence && 'signedTransaction' in msg && isSignedHex(msg.signedTransaction)) {
        this.cancelled = null;
        this.quarantine(cancelled.envelope, msg.signedTransaction);
      }
      if (!active()) return;
      if (msg.action === RelayMsgAction.Disconnect) { void this.disconnect(false); return; } // SDK otherwise waits 8s.
      if (msg.action !== RelayMsgAction.WalletReady) return;
      const data = 'session' in msg && msg.session && typeof msg.session === 'object' && 'hdwalletv1' in msg.session
        ? msg.session.hdwalletv1 : undefined;
      if (!this.exchanged || !('public_key' in msg) || msg.public_key !== this.exchanged ||
          !('secret' in msg) || msg.secret !== this.relay?.credentials.secret ||
          !('supported_protocols' in msg) || !Array.isArray(msg.supported_protocols) || !msg.supported_protocols.includes('hdwalletv1') ||
          !isHdwalletv1Session(data)) { void this.disconnect(); return; }
      const receive = data.paths.filter(p => p.name === 'receive');
      const change = data.paths.filter(p => p.name === 'change');
      if (receive.length !== 1 || change.length !== 1 || data.paths.some(p => typeof decodeHdPublicKey(p.xpub) === 'string')) {
        void this.disconnect(); return;
      }
      const xpubs: [string, string] = [receive[0]!.xpub, change[0]!.xpub];
      if (this.xpubs && (this.xpubs[0] !== xpubs[0] || this.xpubs[1] !== xpubs[1])) { void this.disconnect(); return; }
      this.xpubs ??= xpubs;
    });
    manager.on('disconnect', () => { if (active()) void this.disconnect(); });
    manager.on('walletready', () => {
      // SDK may start keepalive after this listener, including after an awaited dapp_ready.
      if (!active()) { queueMicrotask(() => manager.destroy()); return; }
      if (manager.protocol !== 'hdwalletv1' || !this.xpubs || !manager.hasPath(0) || !manager.hasPath(1)) { void this.disconnect(); return; }
      if (this.session) return;
      this.session = binToHex(sha256.hash(new TextEncoder().encode(crypto.randomUUID())));
      clearTimeout(this.timer);
      this.timer = undefined;
      announce();
    });
    try {
      const relay = this.start(payload => {
        if (!active()) return;
        const state = payload.status.status;
        if (state !== 'connected' && state !== 'reconnecting') { void this.disconnect(); return; }
        this.client = payload.client;
        this.live = state === 'connected';
        manager.updateConnection(payload.client, payload.status);
        announce();
        this.pending?.resume();
      }, { explicitRelayUrls: [WALLET_RELAY], reconnectInterval: 1500, maxReconnectAttempts: 40 });
      if (!active()) { relay.cleanup(); throw Error('CONNECTION_UNAVAILABLE'); }
      this.relay = relay;
      relay.events.on('keyexchangecomplete', key => { if (active()) this.exchanged = binToHex(key); });
      this.timer = setTimeout(() => void this.disconnect(), 90000);
      if (typeof document !== 'undefined') {
        let resubscribing = false;
        this.visibility = () => {
          const client = this.client;
          if (document.visibilityState !== 'visible' || !active() || !client || resubscribing ||
              (this.live && (this.start !== startDappRelay || client.isConnected()))) return;
          this.live = false;
          resubscribing = true;
          void client.connect().catch(() => { /* No new effects until the SDK restores connectivity. */ }).finally(() => { resubscribing = false; });
        };
        document.addEventListener('visibilitychange', this.visibility);
      }
      return relay.uri; // Only caller's transient pairing surface; never diagnostics/storage.
    } catch { void this.disconnect(); throw Error('CONNECTION_UNAVAILABLE'); }
  }
  paths(receiveIndex: number, changeIndex: number): PathBinding[] {
    return [0, 1].map((childIndex, i) => {
      const index = i === 0 ? receiveIndex : changeIndex;
      if (!Number.isSafeInteger(index) || index < 0 || index > 10000) throw Error('UNKNOWN_WALLET_PATH');
      const pub = this.getPubkey(childIndex, BigInt(index));
      if (!pub) throw Error('SESSION_UNAVAILABLE');
      return { childIndex, index, script: '76a914' + binToHex(hash160(pub)) + '88ac' };
    });
  }
  nextSequence(network: string, signal: AbortSignal): number {
    if (signal.aborted) throw Error('ABORTED');
    if (network !== this.allowedNetwork || network !== this.network) throw Error('MAINNET_CAP_ZERO');
    if (!this.currentSessionId() || this.pending) throw Error('SESSION_UNAVAILABLE');
    return this.issuedSequence = this.manager.nextSequence();
  }
  async sign(network: string, envelope: SignEnvelope, plan: DeepReadonly<UnsignedBuildResult>, paths: PathBinding[], signal: AbortSignal): Promise<{ envelope: SignEnvelope; signedHex: string }> {
    if (signal.aborted) throw Error('ABORTED');
    if (network !== this.allowedNetwork || network !== this.network) throw Error('MAINNET_CAP_ZERO');
    if (!Number.isSafeInteger(envelope.expiresAt) || Date.now() >= envelope.expiresAt) throw Error('INTENT_EXPIRED');
    const owned = deriveSessionOwnership(this, envelope.sessionId, paths, Date.now());
    const client = this.client, manager = this.manager;
    if (!client || !this.currentSessionId() || this.pending || envelope.sequence !== this.issuedSequence || this.sentAttempts.has(envelope.attemptId) ||
        owned.status !== 'SESSION_DERIVED' || !plan.unsignedHex || envelope.sessionId !== this.session ||
        plan.planDigest !== envelope.planDigest || plan.intentDigest !== envelope.intentDigest ||
        hashTransaction(hexToBin(plan.unsignedHex)) !== envelope.unsignedHash) throw Error('ATTEMPT_MISMATCH');
    const tx = decodeTransaction(hexToBin(plan.unsignedHex));
    if (typeof tx === 'string' || tx.inputs.some(i => i.unlockingBytecode.length !== 0)) throw Error('INVALID_CANDIDATE');
    const inputPaths: SignTransactionRequest['inputPaths'] = [];
    const sourceOutputs = tx.inputs.map((input, index) => {
      const source = plan.selectedInputs[index];
      if (!source || source.txid !== binToHex(input.outpointTransactionHash) || source.index !== input.outpointIndex || source.sourceOutput.token) throw Error('SOURCE_MISMATCH');
      const path = paths.find(p => p.script === source.sourceOutput.script);
      if (!path) throw Error('UNKNOWN_WALLET_PATH');
      inputPaths.push([index, path.childIndex === 0 ? 'receive' : 'change', path.index]);
      return sourceOutputToRelay({ ...input, lockingBytecode: hexToBin(source.sourceOutput.script), valueSatoshis: BigInt(source.sourceOutput.satoshis) });
    });
    this.issuedSequence = null;
    this.sentAttempts.add(envelope.attemptId);
    const { promise, resolve, reject } = Promise.withResolvers<ProtocolMessage>();
    let received: ProtocolMessage | undefined, published = false;
    // A missed response may arrive on resubscription before EOSE marks the transport live.
    const attempt = this.pending = { envelope: { ...envelope }, reject, resume: () => {
      if (this.live && published && received) resolve(received);
    } };
    const onResponse = (msg: ProtocolMessage): void => {
      if (msg.action !== RelayMsgAction.SignTransactionResponse || !('sequence' in msg) || msg.sequence !== attempt.envelope.sequence) return;
      manager.off('messagereceived', onResponse);
      if (this.pending !== attempt) return;
      received = msg;
      attempt.resume();
    };
    const abort = (): void => { void this.disconnect(); };
    manager.on('messagereceived', onResponse);
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 60000);
    try {
      // The SDK manager retries pending requests on wallet_ready. Never enqueue one there.
      const request: SignTransactionRequest = { action: RelayMsgAction.SignTransactionRequest, sequence: envelope.sequence,
        time: Math.floor(Date.now() / 1000), inputPaths,
        transaction: { transaction: plan.unsignedHex, sourceOutputs, broadcast: false, userPrompt: `IntentGuard ${network}: sign ONLY. App verifies exact bytes before your separately approved relay or native handoff.` } };
      void client.relay(request).then(() => { published = true; attempt.resume(); }, reject);
      const response = await promise;
      if (signal.aborted || this.pending !== attempt || this.session !== envelope.sessionId || JSON.stringify(attempt.envelope) !== JSON.stringify(envelope) ||
          ('error' in response && response.error !== undefined) || !Number.isSafeInteger(response.time) || Math.abs(Date.now() / 1000 - response.time) > 120 ||
          !('signedTransaction' in response) || !isSignedHex(response.signedTransaction)) throw Error('STALE_OR_INVALID_RESPONSE');
      return { envelope: attempt.envelope, signedHex: response.signedTransaction };
    } catch {
      if (received && 'signedTransaction' in received && isSignedHex(received.signedTransaction)) this.quarantine(attempt.envelope, received.signedTransaction);
      if (this.pending === attempt) void this.disconnect();
      throw Error('SIGNING_UNKNOWN');
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      manager.off('messagereceived', onResponse);
      if (this.pending === attempt) this.pending = null;
    }
  }
  async disconnect(notifyRemote = true): Promise<void> {
    if (this.closed) return;
    const { relay, manager, pending, exchanged } = this;
    this.closed = true; this.live = false; this.session = null; this.exchanged = null; this.xpubs = null; this.network = null;
    this.relay = null; this.client = null; this.pending = null; this.issuedSequence = null; this.sentAttempts.clear();
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.visibility) { document.removeEventListener('visibilitychange', this.visibility); this.visibility = null; }
    if (pending) {
      this.cancelled = { manager, envelope: pending.envelope };
      pending.reject(Error('SIGNING_UNKNOWN'));
    }
    manager.destroy();
    queueMicrotask(() => manager.destroy());
    let flushTimer: NodeJS.Timeout | undefined;
    try {
      this.changed();
      if (notifyRemote && exchanged) {
        await Promise.race([
          Promise.allSettled([pending ? manager.sendSignCancel(pending.envelope.sequence, 'IntentGuard invalidated') : Promise.resolve(), manager.sendDisconnect()]),
          new Promise<void>(resolve => { flushTimer = setTimeout(resolve, 800); }),
        ]);
      }
    } finally { clearTimeout(flushTimer); relay?.cleanup(); }
  }
}
