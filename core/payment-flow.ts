import { randomBytes } from 'node:crypto';
import { hashTransaction, hexToBin } from '@bitauth/libauth';
import { createPaymentRequestDraft } from './payment-request.js';
import { buildPaymentRequestPlan } from './request-plan.js';
import { verifySignedPlan, verifyParentBoundP2pkhSignatures } from './signed-verifier.js';
import { PaymentJournal, type PaymentRecord } from './operation-store.js';
import { PaymentChain, paymentHash, publicTransaction, type PaymentObservation } from './payment-chain.js';
import type { UnsignedFeePolicy } from './unsigned-builder.js';
import { structuralTransactionDigest } from './guard.js';

export const MAINNET_CAP_SATOSHIS = '0';
const digest = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
function shape(v: unknown, names: string[]): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== names.sort().join(',')) throw Error('INVALID_PAYMENT_SCHEMA');
}
function publicOperation(op: PaymentRecord) {
  return { id: op.id, revision: op.revision, state: op.state, request: op.request, requestDigest: op.requestDigest,
    plan: op.plan, build: op.build, envelope: op.envelope, txid: op.txid, observation: op.observation, mainnetCapSatoshis: MAINNET_CAP_SATOSHIS };
}
/** The only live journal writer. HTTP cannot import success events or reset operations. */
export class PaymentFlow {
  constructor(private readonly journal: PaymentJournal, private readonly chain: PaymentChain, private readonly clock = Date.now) {}
  private async observeOriginal(op: PaymentRecord): Promise<PaymentObservation> {
    if (!op.signedHex || !op.plan.unsignedHex || hashTransaction(hexToBin(op.signedHex)) !== op.txid ||
        structuralTransactionDigest(op.signedHex) !== structuralTransactionDigest(op.plan.unsignedHex) ||
        !publicTransaction(op.signedHex).inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61) ||
        verifyParentBoundP2pkhSignatures({ signedHex: op.signedHex, parentTransactionHexes: op.build.snapshot.parentTransactionHexes, signatureModel: op.build.feePolicy.signatureModel }).status !== 'SIGNATURES_VALID_PARENT_BOUND') {
      return { status: 'UNKNOWN', blockHash: null, height: null, observedAt: this.clock() };
    }
    return this.chain.observe(op.signedHex);
  }
  async handle(raw: unknown): Promise<unknown> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('INVALID_PAYMENT_SCHEMA');
    const input: Record<string, unknown> = raw as Record<string, unknown>;
    const action = input.action;
    if (action === 'read') {
      shape(input, ['action', 'sourceId', 'method', 'params']);
      const methods = ['server.features', 'blockchain.block.header', 'blockchain.headers.subscribe', 'blockchain.transaction.get', 'blockchain.scripthash.listunspent'] as const;
      const method = methods.find(m => m === input.method);
      if (!method || typeof input.sourceId !== 'string' || !Array.isArray(input.params)) throw Error('INVALID_PAYMENT_SCHEMA');
      return this.chain.read(input.sourceId, method, input.params, AbortSignal.timeout(5000));
    }
    if (action === 'config') {
      shape(input, ['action']);
      return { mainnetCapSatoshis: MAINNET_CAP_SATOSHIS, network: 'chipnet', evidenceKind: this.chain.sources[0]!.kind,
        sources: this.chain.sources.map(({ id, operatorId, network, genesisHash, checkpoint, maxTipAgeMs, kind }) => ({ id, operatorId, network, genesisHash, checkpoint, maxTipAgeMs, kind })) };
    }
    if (action === 'prepare') {
      shape(input, ['action', 'request', 'expectedRequestDigest', 'scripts', 'changeScript', 'feePolicy']);
      const parsed = createPaymentRequestDraft(input.request, this.clock());
      if (parsed.status !== 'DRAFT_READY' || parsed.draft.requestDigest !== input.expectedRequestDigest || parsed.draft.request.recipients.some(r => r.token)) throw Error('REQUEST_RECONFIRM_REQUIRED');
      if (parsed.draft.request.network !== 'chipnet') throw Error('MAINNET_CAP_ZERO');
      if (!Array.isArray(input.scripts) || !input.scripts.every((s): s is string => typeof s === 'string') || typeof input.changeScript !== 'string' || !input.scripts.includes(input.changeScript)) throw Error('UNKNOWN_OWNER_SCRIPT');
      const evidence = await this.chain.funding(input.scripts);
      const context = { ownerScripts: input.scripts, changeScript: input.changeScript, snapshot: evidence.snapshot, selectedInputs: evidence.selected, feePolicy: input.feePolicy };
      const bound = buildPaymentRequestPlan(parsed.draft.request, parsed.draft.requestDigest, context, this.clock());
      if (!bound.intent || !bound.plan?.unsignedHex || !bound.binding || bound.status !== 'REQUEST_PLAN_BOUND_OFFLINE') throw Error('BUILD_REJECTED');
      const capability = randomBytes(32).toString('hex');
      const op: PaymentRecord = { id: paymentHash('intentguard/payment/v1\0' + parsed.draft.request.network + '\0' + parsed.draft.request.requestId), revision: 0,
        state: 'PREFLIGHTED', capabilityHash: paymentHash(capability), request: parsed.draft.request, requestDigest: parsed.draft.requestDigest,
        build: { intent: structuredClone({ ...bound.intent, recipients: [...bound.intent.recipients], ownerScripts: [...bound.intent.ownerScripts] }), snapshot: evidence.snapshot, selectedInputs: evidence.selected, changeScript: input.changeScript, now: this.clock(), feePolicy: structuredClone(input.feePolicy) as UnsignedFeePolicy },
        plan: structuredClone({ ...bound.plan, outputSummary: [...bound.plan.outputSummary], selectedInputs: [...bound.plan.selectedInputs] }), sourceDigest: evidence.sourceDigest, envelope: null, signedHex: null, txid: null, observation: null };
      this.journal.insert(op);
      return { ...publicOperation(op), capability, evidenceKind: evidence.kind };
    }
    if (action === 'get') {
      shape(input, ['action', 'id']);
      if (!digest(input.id)) throw Error('INVALID_PAYMENT_SCHEMA');
      const op = this.journal.get(input.id);
      if (!op) throw Error('OPERATION_NOT_FOUND');
      const recoveryObservation = op.signedHex ? await this.observeOriginal(op) : null;
      const state = op.state === 'CONFIRMED_ON_CHAIN' && (recoveryObservation?.status !== 'CONFIRMED_ON_CHAIN' || recoveryObservation.blockHash !== op.observation?.blockHash) ? 'CONFLICTED' :
        op.state === 'OBSERVED' && recoveryObservation?.status === 'UNKNOWN' ? 'UNKNOWN' : op.state;
      return { ...publicOperation(op), state, persistedState: op.state, observation: recoveryObservation ?? op.observation, recoveryObservation };
    }
    const names = action === 'reserve' ? ['sequence', 'sessionId', 'planDigest'] : action === 'signed' ? ['envelope', 'signedHex'] : [];
    if (!['reserve', 'signed', 'uncertain', 'broadcast', 'observe'].includes(String(action))) throw Error('INVALID_PAYMENT_SCHEMA');
    shape(input, ['action', 'id', 'revision', 'capability', ...names]);
    if (!digest(input.id) || !digest(input.capability) || !Number.isSafeInteger(input.revision)) throw Error('INVALID_PAYMENT_SCHEMA');
    let op = this.journal.get(input.id);
    if (!op || op.capabilityHash !== paymentHash(input.capability)) throw Error('CAPABILITY_REQUIRED');
    if (op.revision !== input.revision) throw Error('REVISION_CONFLICT');
    // Task policy is not data in a browser request, imported intent or database row.
    if (op.request.network !== 'chipnet' || op.build.intent.network !== 'chipnet' || op.build.snapshot.network !== 'chipnet') throw Error('MAINNET_CAP_ZERO');
    if (action === 'reserve') {
      if (this.clock() >= op.request.expiresAt || !digest(input.sessionId) || !Number.isSafeInteger(input.sequence) || Number(input.sequence) <= 0 || input.planDigest !== op.plan.planDigest) throw Error('ATTEMPT_MISMATCH');
      const sequence = Number(input.sequence), sessionId = input.sessionId;
      op = this.journal.advance(op.id, op.revision, ['PREFLIGHTED'], p => {
        p.envelope = { operationId: p.id, attemptId: randomBytes(32).toString('hex'), revision: p.revision + 1, requestDigest: p.requestDigest,
          intentDigest: p.plan.intentDigest!, planDigest: p.plan.planDigest!, unsignedHash: hashTransaction(hexToBin(p.plan.unsignedHex!)), sessionId, sequence, expiresAt: p.request.expiresAt }; p.state = 'SIGNING';
      });
    } else if (action === 'uncertain') {
      op = this.journal.advance(op.id, op.revision, ['SIGNING', 'POSTCHECKED'], p => { p.state = 'UNKNOWN'; });
    } else if (action === 'signed') {
      if (!op.envelope || JSON.stringify(input.envelope) !== JSON.stringify(op.envelope) || typeof input.signedHex !== 'string') throw Error('ATTEMPT_MISMATCH');
      const signedHex = input.signedHex, tx = publicTransaction(signedHex), txid = hashTransaction(hexToBin(signedHex));
      if (op.signedHex && op.signedHex !== signedHex) throw Error('ORIGINAL_HASH_REQUIRED');
      const report = verifySignedPlan({ buildInput: op.build, signedHex }, this.clock());
      const flags = tx.inputs.every(i => i.unlockingBytecode[i.unlockingBytecode[0] ?? 0] === 0x61);
      op = this.journal.advance(op.id, op.revision, ['SIGNING', 'UNKNOWN'], p => {
        p.signedHex = signedHex; p.txid = txid;
        p.state = p.state === 'SIGNING' && report.status === 'SIGNED_PLAN_VALID_OFFLINE' && flags ? 'POSTCHECKED' : 'NEEDS_REVIEW';
      });
    } else if (action === 'broadcast') {
      if (op.state !== 'POSTCHECKED' || !op.signedHex || !op.txid || !op.envelope) throw Error('NO_SEND_AUTHORITY');
      const fresh = await this.chain.funding(op.build.intent.ownerScripts, op.build.selectedInputs);
      const checked = verifySignedPlan({ buildInput: { ...op.build, snapshot: fresh.snapshot }, signedHex: op.signedHex }, this.clock());
      if (checked.status !== 'SIGNED_PLAN_VALID_OFFLINE' || checked.planDigest !== op.plan.planDigest) throw Error('POSTCHECK_FAILED');
      // CAS + FULL-sync BEFORE network send. No retry even if COMMIT/send returns unknown.
      op = this.journal.advance(op.id, op.revision, ['POSTCHECKED'], p => { p.state = 'BROADCASTING'; });
      try {
        await this.chain.broadcast(op.request.network, op.signedHex!);
      } catch {
        op = this.journal.advance(op.id, op.revision, ['BROADCASTING'], p => { p.state = 'UNKNOWN'; });
        return publicOperation(op);
      }
    } else if (action === 'observe') {
      if (!op.signedHex || !op.txid) throw Error('ORIGINAL_HASH_REQUIRED');
      const observed = await this.observeOriginal(op);
      op = this.journal.advance(op.id, op.revision, ['BROADCASTING', 'UNKNOWN', 'NEEDS_REVIEW', 'OBSERVED', 'CONFIRMED_ON_CHAIN', 'CONFLICTED'], p => {
        const previous = p.observation;
        p.observation = observed;
        p.state = observed.status === 'UNKNOWN' ? previous?.status === 'CONFIRMED_ON_CHAIN' ? 'CONFLICTED' : 'UNKNOWN' :
          previous?.status === 'CONFIRMED_ON_CHAIN' && previous.blockHash !== observed.blockHash ? 'CONFLICTED' : observed.status;
      });
    }
    return publicOperation(op);
  }
}
