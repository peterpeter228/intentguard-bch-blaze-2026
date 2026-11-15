import { buildPaymentRequestPlan } from './request-plan.js';
import { createPaymentRequestDraft } from './payment-request.js';
import { PaymentChain } from './payment-chain.js';
import { createReviewedMainnetCandidates } from './public-sources.js';
import { hashTransaction, hexToBin, decodeTransaction } from '@bitauth/libauth';
import { verifyParentBoundP2pkhSignatures } from './signed-verifier.js';
import type { UnsignedFeePolicy } from './unsigned-builder.js';

function shape(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== fields.sort().join(',')) throw Error('INVALID_PAYMENT_SCHEMA');
}
/** Stateless fixed-source reads. No journal, wallet, sender invocation or imported paid flag. */
export class VisitorPaymentReader {
  constructor(private readonly chain = new PaymentChain(createReviewedMainnetCandidates()), private readonly clock = Date.now) {}
  async handle(raw: unknown): Promise<unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('INVALID_PAYMENT_SCHEMA');
    const input: Record<string, unknown> = raw as Record<string, unknown>;
    if (input.action === 'config') {
      shape(input, ['action']);
      return { mode: 'visitor-wallet', network: 'mainnet', mainnetCapSatoshis: '0', handoff: 'Electron Cash 4.4.6.1 raw-hex broadcast; visitor only',
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
    if (input.action === 'observe') {
      shape(input, ['action', 'signedHex', 'txid', 'parents']);
      if (typeof input.signedHex !== 'string' || input.signedHex.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(input.signedHex) || hashTransaction(hexToBin(input.signedHex)) !== input.txid || !Array.isArray(input.parents) || !input.parents.every((p): p is string => typeof p === 'string')) throw Error('ORIGINAL_HASH_REQUIRED');
      const checked = verifyParentBoundP2pkhSignatures({ signedHex: input.signedHex, parentTransactionHexes: input.parents, signatureModel: 'compressed-p2pkh-schnorr' });
      if (checked.status !== 'SIGNATURES_VALID_PARENT_BOUND') throw Error('POSTCHECK_FAILED');
      const tx = decodeTransaction(hexToBin(input.signedHex));
      if (typeof tx === 'string' || !tx.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61)) throw Error('POSTCHECK_FAILED');
      return this.chain.observe(input.signedHex);
    }
    throw Error('MAINNET_CAP_ZERO'); // No reserve/sign/send/broadcast endpoint.
  }
}
