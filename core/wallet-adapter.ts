import { DappConnectionManager } from '@wizardconnect/dapp';
import { initiateDappRelay, RelayMsgAction, isHdwalletv1Session, type DappRelayResult, type SignTransactionRequest } from '@wizardconnect/core';
import { sourceOutputToRelay } from '@wizardconnect/core/hdwalletv1-serialize';
import { binToHex, hexToBin, decodeTransaction, hashTransaction, hash160, sha256, decodeHdPublicKey } from '@bitauth/libauth';
import { deriveSessionOwnership, type PathBinding, type PublicKeySession } from './evidence.js';
import type { UnsignedBuildResult } from './unsigned-builder.js';
import type { DeepReadonly } from './request-plan.js';

export const WALLET_RELAY = 'wss://relay.riften.net:443';
export interface SignEnvelope {
  operationId: string; attemptId: string; revision: number; requestDigest: string;
  intentDigest: string; planDigest: string; unsignedHash: string; sessionId: string; sequence: number; expiresAt: number;
}
export type RelayStarter = typeof initiateDappRelay;
/** Noncustodial, memory-only session. No cached discovery is authentication. */
export class ConnectedWallet implements PublicKeySession {
  private manager = new DappConnectionManager('IntentGuard PRESEASON', undefined, { session: false });
  private relay: DappRelayResult | null = null;
  private live = false;
  private exchanged: string | null = null;
  private session: string | null = null;
  private pending: SignEnvelope | null = null;
  private cancelled: SignEnvelope | null = null;
  private timer: NodeJS.Timeout | undefined;
  private closed = true;
  private network: string | null = null;
  constructor(private readonly changed: () => void, private readonly start: RelayStarter = initiateDappRelay,
    private readonly quarantine: (envelope: SignEnvelope, signedHex: string) => void = () => {},
    private readonly allowedNetwork: 'chipnet' | 'mainnet' = 'chipnet') {}
  currentSessionId(): string | null { return this.live && !this.closed ? this.session : null; }
  hasPath(childIndex: number): boolean { return this.currentSessionId() !== null && this.manager.hasPath(childIndex); }
  getPubkey(childIndex: number, index: bigint): Uint8Array | undefined { return this.currentSessionId() ? this.manager.getPubkey(childIndex, index) : undefined; }
  connect(network: string): string {
    if (network !== this.allowedNetwork) throw Error('MAINNET_CAP_ZERO');
    if (!this.closed) throw Error('CONNECTION_EXISTS');
    this.manager = new DappConnectionManager('IntentGuard PRESEASON', undefined, { session: false });
    this.closed = false;
    this.network = network;
    this.manager.on('messagereceived', msg => {
      if (msg.action === RelayMsgAction.SignTransactionResponse && this.cancelled && 'sequence' in msg && msg.sequence === this.cancelled.sequence &&
          'signedTransaction' in msg && typeof msg.signedTransaction === 'string' && msg.signedTransaction.length <= 200000 && /^(?:[0-9a-f]{2})+$/.test(msg.signedTransaction)) {
        this.quarantine(this.cancelled, msg.signedTransaction); this.cancelled = null;
      }
      if (msg.action === RelayMsgAction.Disconnect) this.disconnect(); // SDK otherwise waits 8s.
      if (msg.action === RelayMsgAction.WalletReady && this.session) this.disconnect(); // Before SDK pending replay.
    });
    this.manager.on('reconnecting', () => this.disconnect());
    this.manager.on('disconnect', () => this.disconnect());
    this.manager.on('walletready', msg => {
      if (this.closed || !this.live || !this.exchanged || msg.public_key !== this.exchanged || msg.secret !== this.relay?.credentials.secret ||
          this.manager.protocol !== 'hdwalletv1' || !isHdwalletv1Session(msg.session.hdwalletv1)) { this.disconnect(); return; }
      const paths = msg.session.hdwalletv1.paths;
      if (!['receive', 'change'].every(name => paths.filter(p => p.name === name).length === 1) ||
          paths.some(p => typeof decodeHdPublicKey(p.xpub) === 'string') || !this.manager.hasPath(0) || !this.manager.hasPath(1)) { this.disconnect(); return; }
      this.session = binToHex(sha256.hash(new TextEncoder().encode(crypto.randomUUID())));
      clearTimeout(this.timer);
      this.timer = undefined;
      this.changed();
    });
    try {
      this.relay = this.start(payload => {
        if (this.closed) return;
        if (payload.status.status !== 'connected') { this.disconnect(); return; }
        this.live = true;
        this.manager.updateConnection(payload.client, payload.status);
      }, { explicitRelayUrls: [WALLET_RELAY], maxReconnectAttempts: 0 });
      this.relay.events.on('keyexchangecomplete', key => { if (!this.closed) this.exchanged = binToHex(key); });
      this.timer = setTimeout(() => this.disconnect(), 45000);
      return this.relay.uri; // Only caller's transient pairing surface; never diagnostics/storage.
    } catch { this.disconnect(); throw Error('CONNECTION_UNAVAILABLE'); }
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
    return this.manager.nextSequence();
  }
  async sign(network: string, envelope: SignEnvelope, plan: DeepReadonly<UnsignedBuildResult>, paths: PathBinding[], signal: AbortSignal): Promise<{ envelope: SignEnvelope; signedHex: string }> {
    if (signal.aborted) throw Error('ABORTED');
    if (network !== this.allowedNetwork || network !== this.network) throw Error('MAINNET_CAP_ZERO');
    if (!Number.isSafeInteger(envelope.expiresAt) || Date.now() >= envelope.expiresAt) throw Error('INTENT_EXPIRED');
    const owned = deriveSessionOwnership(this, envelope.sessionId, paths, Date.now());
    if (!this.currentSessionId() || this.pending || owned.status !== 'SESSION_DERIVED' || !plan.unsignedHex ||
        envelope.sessionId !== this.session || plan.planDigest !== envelope.planDigest || plan.intentDigest !== envelope.intentDigest ||
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
    this.pending = { ...envelope };
    const abort = (): void => this.disconnect();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 60000);
    try {
      const response = await this.manager.sendSignRequest({ action: RelayMsgAction.SignTransactionRequest, sequence: envelope.sequence,
        time: Math.floor(Date.now() / 1000), inputPaths,
        transaction: { transaction: plan.unsignedHex, sourceOutputs, broadcast: false, userPrompt: `IntentGuard ${network}: sign ONLY. App verifies exact bytes before your separately approved relay or native handoff.` } });
      if (signal.aborted || !this.pending || this.session !== envelope.sessionId || JSON.stringify(this.pending) !== JSON.stringify(envelope) ||
          response.action !== RelayMsgAction.SignTransactionResponse || response.sequence !== envelope.sequence || response.error !== undefined ||
          !Number.isSafeInteger(response.time) || Math.abs(Date.now() / 1000 - response.time) > 120 ||
          typeof response.signedTransaction !== 'string' || response.signedTransaction.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(response.signedTransaction)) {
        if (typeof response.signedTransaction === 'string' && response.signedTransaction.length <= 200000 && /^(?:[0-9a-f]{2})+$/.test(response.signedTransaction)) this.quarantine(envelope, response.signedTransaction);
        throw Error('STALE_OR_INVALID_RESPONSE');
      }
      return { envelope: { ...envelope }, signedHex: response.signedTransaction };
    } catch { throw Error('SIGNING_UNKNOWN'); }
    finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); this.pending = null; }
  }
  disconnect(): void {
    this.closed = true; this.live = false; this.session = null; this.exchanged = null; this.network = null;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.pending) { this.cancelled = this.pending; void this.manager.sendSignCancel(this.pending.sequence, 'IntentGuard invalidated').catch(() => {}); }
    this.pending = null;
    void this.manager.sendDisconnect().catch(() => {});
    this.manager.destroy(); this.relay?.cleanup(); this.relay = null;
    const manager = this.manager; queueMicrotask(() => manager.destroy()); // SDK starts keepalive after walletready listeners return.
    this.changed();
  }
}
