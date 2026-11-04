/** Explicit full-scenario loader only. Never use these invented funds as a default. */
import { encodeCashAddress, hexToBin } from '@bitauth/libauth';
import { fixture, merchant, owner, category } from './fixtures.js';
import type { PaymentRequestWire } from './payment-request.js';
import type { OfflineFundingFields } from './request-plan-form.js';
export function syntheticRequestPlanningExample(token: boolean, now: number): { request: PaymentRequestWire; funding: OfflineFundingFields } {
  if (!Number.isSafeInteger(now) || now < 0) throw Error('INVALID_CLOCK');
  const f = fixture(token); const utc = (n: number): string => new Date(n).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const address = (script: string, withTokens: boolean): string => encodeCashAddress({ prefix: 'bchtest', type: withTokens ? 'p2pkhWithTokens' : 'p2pkh', payload: hexToBin(script.slice(6, -4)) }).address;
  return { request: { schemaVersion: 1, kind: 'intentguard-payment-request', requestId: token ? 'synthetic-token-example' : 'synthetic-bch-example', network: 'chipnet', expiresAt: Date.parse(utc(now + 600000)), maxFeeBch: '0.000006', recipients: [{ address: address(merchant, token), bch: '0.00001', ...(token ? { token: { category, amountAtomic: '100' } } : {}) }] }, funding: { ownerAddress: address(owner, token), changeAddress: address(owner, token), parentHex: f.input.snapshot.parentTransactionHexes[0]!, outputIndex: '0', observedAtUtc: utc(now), targetRate: '1000', maxRate: '3000', signatureModel: 'compressed-p2pkh-schnorr', allowDustToFee: false } };
}
