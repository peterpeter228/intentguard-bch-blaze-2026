import { buildPaymentRequestPlan } from './request-plan.js';
import { createPaymentRequestDraft } from './payment-request.js';
import { PaymentChain } from './payment-chain.js';
import { createReviewedMainnetCandidates, REVIEWED_MAINNET_ENDPOINTS } from './public-sources.js';
import { createElectrumSender } from './electrum-transport.js';
import { hashTransaction, hexToBin, decodeTransaction } from '@bitauth/libauth';
import { verifyParentBoundP2pkhSignatures, verifySignedPlan } from './signed-verifier.js';
import type { UnsignedFeePolicy } from './unsigned-builder.js';

function shape(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== fields.sort().join(',')) throw Error('INVALID_PAYMENT_SCHEMA');
}
/** Fixed-source visitor reads and post-verification relay; no journal, wallet or keys. */
export class VisitorPaymentReader {
  private readonly relayed = new Map<string, number>();
  constructor(private readonly chain = new PaymentChain(createReviewedMainnetCandidates()), private readonly clock = Date.now,
    private readonly sender = createElectrumSender(REVIEWED_MAINNET_ENDPOINTS, REVIEWED_MAINNET_ENDPOINTS[0]!.id)) {}
  async handle(raw: unknown, signal?: AbortSignal): Promise<unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('INVALID_PAYMENT_SCHEMA');
    const input: Record<string, unknown> = raw as Record<string, unknown>;
    if (input.action === 'config') {
      shape(input, ['action']);
      return { mode: 'visitor-wallet', network: 'mainnet', mainnetCapSatoshis: '0', delivery: 'visitor-approved verified-byte relay or exclusive native handoff',
        trust: 'Two publicly attributed operators/backends; TLS and node-reported inclusion, NOT SPV/consensus or collusion resistance',
        sources: this.chain.sources.map(({ transport, ...metadata }) => metadata) };
    }
    if (input.action === 'read') {
      shape(input, ['action', 'sourceId', 'method', 'params']);
      const methods = ['server.features', 'blockchain.block.header', 'blockchain.headers.subscribe', 'blockchain.transaction.get', 'blockchain.scripthash.listunspent'] as const;
      const method = methods.find(m => m === input.method);
      if (!method || typeof input.sourceId !== 'string' || !Array.isArray(input.params)) throw Error('INVALID_PAYMENT_SCHEMA');
      return this.chain.read(input.sourceId, method, input.params, AbortSignal.timeout(5000));
    }
    if (input.action === 'prepare') {
      shape(input, ['action', 'request', 'expectedRequestDigest', 'scripts', 'changeScript', 'feePolicy', 'selectedOutpoint']);
      const parsed = createPaymentRequestDraft(input.request, this.clock());
      if (parsed.status !== 'DRAFT_READY' || parsed.draft.request.network !== 'mainnet' || parsed.draft.requestDigest !== input.expectedRequestDigest || parsed.draft.request.recipients.some(r => r.token)) throw Error('REQUEST_RECONFIRM_REQUIRED');
      if (!Array.isArray(input.scripts) || !input.scripts.every((s): s is string => typeof s === 'string') || typeof input.changeScript !== 'string' || !input.scripts.includes(input.changeScript)) throw Error('UNKNOWN_OWNER_SCRIPT');
      const selected = input.selectedOutpoint;
      if (selected !== null) {
        shape(selected, ['txid', 'index']);
        if (typeof selected.txid !== 'string' || !/^[0-9a-f]{64}$/.test(selected.txid) || !Number.isSafeInteger(selected.index) || Number(selected.index) < 0 || Number(selected.index) > 0xffffffff) throw Error('INVALID_PAYMENT_SCHEMA');
      }
      const funding = await this.chain.funding(input.scripts, selected === null ? undefined : [{ txid: String(selected.txid), index: Number(selected.index) }]);
      const context = { ownerScripts: input.scripts, changeScript: input.changeScript, snapshot: funding.snapshot, selectedInputs: funding.selected, feePolicy: input.feePolicy };
      const bound = buildPaymentRequestPlan(parsed.draft.request, parsed.draft.requestDigest, context, this.clock());
      if (!bound.plan?.unsignedHex || !bound.intent) throw Error('BUILD_REJECTED');
      return { requestDigest: parsed.draft.requestDigest, plan: bound.plan, sourceDigest: funding.sourceDigest,
        build: { intent: bound.intent, snapshot: funding.snapshot, selectedInputs: funding.selected, changeScript: input.changeScript, now: this.clock(), feePolicy: input.feePolicy as UnsignedFeePolicy } };
    }
    if (input.action === 'relay') {
      shape(input, ['action', 'request', 'expectedRequestDigest', 'scripts', 'changeScript', 'feePolicy', 'selectedInputs', 'planDigest', 'signedHex', 'txid']);
      const parsed = createPaymentRequestDraft(input.request, this.clock());
      if (parsed.status !== 'DRAFT_READY' || parsed.draft.request.network !== 'mainnet' || parsed.draft.requestDigest !== input.expectedRequestDigest || parsed.draft.request.recipients.some(r => r.token) || this.chain.sources.some(s => s.network !== 'mainnet')) throw Error('REQUEST_RECONFIRM_REQUIRED');
      if (!Array.isArray(input.scripts) || !input.scripts.every((s): s is string => typeof s === 'string') || typeof input.changeScript !== 'string' || !input.scripts.includes(input.changeScript)) throw Error('UNKNOWN_OWNER_SCRIPT');
      if (!Array.isArray(input.selectedInputs) || input.selectedInputs.length < 1 || input.selectedInputs.length > 20) throw Error('INVALID_PAYMENT_SCHEMA');
      const selected = input.selectedInputs.map(item => {
        shape(item, ['txid', 'index']);
        if (typeof item.txid !== 'string' || !/^[0-9a-f]{64}$/.test(item.txid) || !Number.isSafeInteger(item.index) || Number(item.index) < 0 || Number(item.index) > 0xffffffff) throw Error('INVALID_PAYMENT_SCHEMA');
        return { txid: item.txid, index: Number(item.index) };
      });
      if (new Set(selected.map(item => item.txid + ':' + item.index)).size !== selected.length || typeof input.planDigest !== 'string' || !/^[0-9a-f]{64}$/.test(input.planDigest) || typeof input.txid !== 'string' || !/^[0-9a-f]{64}$/.test(input.txid) || typeof input.signedHex !== 'string' || input.signedHex.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(input.signedHex) || hashTransaction(hexToBin(input.signedHex)) !== input.txid) throw Error('INVALID_PAYMENT_SCHEMA');
      const funding = await this.chain.funding(input.scripts, selected);
      if (signal?.aborted || JSON.stringify(funding.selected) !== JSON.stringify(selected)) throw Error('NO_SEND_AUTHORITY');
      const context = { ownerScripts: input.scripts, changeScript: input.changeScript, snapshot: funding.snapshot, selectedInputs: funding.selected, feePolicy: input.feePolicy };
      const bound = buildPaymentRequestPlan(parsed.draft.request, parsed.draft.requestDigest, context, this.clock());
      if (!bound.intent || !bound.plan?.unsignedHex || bound.plan.planDigest !== input.planDigest || funding.snapshot.network !== 'mainnet') throw Error('POSTCHECK_FAILED');
      const build = { intent: { ...bound.intent, recipients: [...bound.intent.recipients], ownerScripts: [...bound.intent.ownerScripts] }, snapshot: funding.snapshot, selectedInputs: funding.selected, changeScript: input.changeScript, feePolicy: input.feePolicy as UnsignedFeePolicy, now: this.clock() };
      const checked = verifySignedPlan({ buildInput: build, signedHex: input.signedHex }, this.clock());
      const tx = decodeTransaction(hexToBin(input.signedHex));
      if (checked.status !== 'SIGNED_PLAN_VALID_OFFLINE' || checked.planDigest !== input.planDigest || build.feePolicy.signatureModel !== 'compressed-p2pkh-schnorr' || build.feePolicy.allowBchDustToFee || typeof tx === 'string' || !tx.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61) || signal?.aborted) throw Error('POSTCHECK_FAILED');
      // A same-process duplicate is refused even if a caller repeats the HTTP request.
      // Retained browser storage is the primary reservation; this map is not global durability.
      for (const [id, expiry] of this.relayed) if (expiry <= this.clock()) this.relayed.delete(id);
      if (this.relayed.has(input.txid) || this.relayed.size >= 4096) throw Error('NO_SEND_AUTHORITY');
      this.relayed.set(input.txid, parsed.draft.request.expiresAt);
      const relaySignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
      try { await this.sender(input.signedHex, relaySignal); } catch { /* Invocation may have reached the node; never retry. */ }
      return { status: 'UNKNOWN', txid: input.txid };
    }
    if (input.action === 'observe') {
      shape(input, ['action', 'signedHex', 'txid', 'parents']);
      if (typeof input.signedHex !== 'string' || input.signedHex.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(input.signedHex) || hashTransaction(hexToBin(input.signedHex)) !== input.txid || !Array.isArray(input.parents) || !input.parents.every((p): p is string => typeof p === 'string')) throw Error('ORIGINAL_HASH_REQUIRED');
      const checked = verifyParentBoundP2pkhSignatures({ signedHex: input.signedHex, parentTransactionHexes: input.parents, signatureModel: 'compressed-p2pkh-schnorr' });
      if (checked.status !== 'SIGNATURES_VALID_PARENT_BOUND') throw Error('POSTCHECK_FAILED');
      const tx = decodeTransaction(hexToBin(input.signedHex));
      if (typeof tx === 'string' || !tx.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61)) throw Error('POSTCHECK_FAILED');
      return this.chain.observe(input.signedHex);
    }
    throw Error('MAINNET_CAP_ZERO'); // No wallet, signing or arbitrary send endpoint.
  }
}
