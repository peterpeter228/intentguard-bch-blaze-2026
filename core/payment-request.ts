/**
 * Offline payment REQUEST DRAFTS, not PaymentIntent, consent, wallet ownership or
 * chain evidence. The only exported document is a strict untrusted wire request.
 * Scripts/atomic amounts/digests are recomputed, never accepted from imported JSON.
 * No keys, wallet calls, transactions, provider calls, storage or side effects.
 */
import { binToHex, hexToBin, decodeCashAddress, cashAddressToLockingBytecode, getDustThreshold, sha256 } from '@bitauth/libauth';
import { parseUnits } from './guard.js';

export const MAX_PAYMENT_REQUEST_BYTES = 8192;
export const MAX_PAYMENT_REQUEST_TTL_MS = 86400000;
export interface PaymentRequestRecipient {
  readonly address: string; readonly bch: string;
  readonly token?: { readonly category: string; readonly amountAtomic: string };
}
export interface PaymentRequestWire {
  readonly schemaVersion: 1; readonly kind: 'intentguard-payment-request';
  readonly requestId: string; readonly network: 'mainnet' | 'chipnet';
  readonly expiresAt: number; readonly maxFeeBch: string;
  readonly recipients: readonly PaymentRequestRecipient[];
}
export interface PaymentRequestDisplayRecipient {
  readonly address: string; readonly script: string; readonly satoshis: string; readonly tokenAware: boolean;
  readonly token?: { readonly category: string; readonly amountAtomic: string };
}
export interface PaymentRequestDraft {
  readonly status: 'UNCONFIRMED_DRAFT'; readonly canSign: false; readonly receiptValid: false; readonly networkVerified: false;
  readonly request: PaymentRequestWire; readonly requestDigest: string;
  readonly display: { readonly recipients: readonly PaymentRequestDisplayRecipient[]; readonly recipientSatoshis: string; readonly maxFeeSatoshis: string };
  readonly limitations: readonly string[];
}
interface DraftFlags { readonly canSign: false; readonly receiptValid: false; readonly networkVerified: false; }
export type PaymentRequestResult = DraftFlags & (
  | { readonly status: 'DRAFT_READY'; readonly draft: PaymentRequestDraft; readonly issue: null }
  | { readonly status: 'REJECTED'; readonly draft: null; readonly issue: string }
);
const MAX_MONEY = 2100000000000000n, MAX_TOKEN = 9223372036854775807n;
const FLAGS = { canSign: false, receiptValid: false, networkVerified: false } as const;
const ERRORS = new Set(['REQUEST_INVALID_SCHEMA', 'REQUEST_INVALID_CLOCK', 'REQUEST_EXPIRED', 'REQUEST_EXPIRY_TOO_FAR', 'REQUEST_INVALID_ID', 'REQUEST_INVALID_NETWORK', 'REQUEST_INVALID_BCH_AMOUNT', 'REQUEST_BCH_RANGE', 'REQUEST_INVALID_TOKEN_AMOUNT', 'REQUEST_INVALID_TOKEN_CATEGORY', 'REQUEST_TOKEN_RANGE', 'REQUEST_INVALID_ADDRESS', 'REQUEST_MIXED_CASE_ADDRESS', 'REQUEST_NETWORK_MISMATCH', 'REQUEST_UNSUPPORTED_ADDRESS_TYPE', 'REQUEST_TOKEN_AWARE_REQUIRED', 'REQUEST_DUST_OUTPUT', 'REQUEST_TOO_LARGE', 'REQUEST_INVALID_JSON', 'REQUEST_DUPLICATE_JSON_KEY', 'REQUEST_TOO_DEEP']);
function record(v: unknown, required: readonly string[], optional: readonly string[] = []): asserts v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v)) || Reflect.ownKeys(v).some(k => typeof k !== 'string') || required.some(k => !Object.hasOwn(v, k)) || Object.keys(v).some(k => !required.includes(k) && !optional.includes(k)) || Object.values(Object.getOwnPropertyDescriptors(v)).some(d => !('value' in d))) throw Error('REQUEST_INVALID_SCHEMA');
}
function bchAtomic(v: unknown): bigint {
  if (typeof v !== 'string' || v.length > 24 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,8})?$/.test(v)) throw Error('REQUEST_INVALID_BCH_AMOUNT');
  let result: bigint; try { result = parseUnits(v, 8); } catch { throw Error('REQUEST_BCH_RANGE'); }
  if (result > MAX_MONEY) throw Error('REQUEST_BCH_RANGE'); return result;
}
function bchDisplay(satoshis: bigint): string { const whole = satoshis / 100000000n; const fraction = (satoshis % 100000000n).toString().padStart(8, '0').replace(/0+$/, ''); return whole.toString() + (fraction ? '.' + fraction : ''); }
function failure(code: string): PaymentRequestResult { return Object.freeze({ ...FLAGS, status: 'REJECTED', draft: null, issue: ERRORS.has(code) ? code : 'REQUEST_INVALID_SCHEMA' }); }
const LIMITATIONS = Object.freeze([
  'Unconfirmed request draft only. Address checksum and scripts do not authenticate the recipient, request source or human consent.',
  'bchtest addresses are shared by test networks; the prefix alone cannot establish Chipnet. No network or chain has been queried.',
  'Token category and base units are explicit; issuer, ticker, decimals, value and token existence are not verified.',
  'Recipient BCH includes token carrier funds. Dust uses a fixed 1000 sat/1000-byte application baseline, not live relay policy.',
  'There are no wallet owner/change scripts, signatures, spending authorization or verified receipts in this draft.'
]);

/** Caller supplies now from trusted application state, never from request JSON. */
export function createPaymentRequestDraft(input: unknown, now: number): PaymentRequestResult {
  try {
    if (!Number.isSafeInteger(now) || now < 0) throw Error('REQUEST_INVALID_CLOCK');
    record(input, ['schemaVersion', 'kind', 'requestId', 'network', 'expiresAt', 'maxFeeBch', 'recipients']);
    if (input.schemaVersion !== 1 || input.kind !== 'intentguard-payment-request') throw Error('REQUEST_INVALID_SCHEMA');
    if (typeof input.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.requestId)) throw Error('REQUEST_INVALID_ID');
    if (input.network !== 'mainnet' && input.network !== 'chipnet') throw Error('REQUEST_INVALID_NETWORK');
    if (typeof input.expiresAt !== 'number' || !Number.isSafeInteger(input.expiresAt) || input.expiresAt < 0) throw Error('REQUEST_INVALID_SCHEMA');
    if (input.expiresAt <= now) throw Error('REQUEST_EXPIRED'); if (input.expiresAt - now > MAX_PAYMENT_REQUEST_TTL_MS) throw Error('REQUEST_EXPIRY_TOO_FAR');
    if (!Array.isArray(input.recipients) || Object.getPrototypeOf(input.recipients) !== Array.prototype || input.recipients.length < 1 || input.recipients.length > 20) throw Error('REQUEST_INVALID_SCHEMA');
    const recipientsInput = input.recipients;
    if (Reflect.ownKeys(recipientsInput).length !== recipientsInput.length + 1 || Array.from({ length: recipientsInput.length }, (_, i) => Object.getOwnPropertyDescriptor(recipientsInput, String(i))).some(d => !d || !('value' in d))) throw Error('REQUEST_INVALID_SCHEMA');
    const fee = bchAtomic(input.maxFeeBch); const prefix = input.network === 'mainnet' ? 'bitcoincash' : 'bchtest';
    let total = 0n; const tokenTotals = new Map<string, bigint>(); const display: PaymentRequestDisplayRecipient[] = [];
    const recipients = input.recipients.map((raw: unknown): PaymentRequestRecipient => {
      record(raw, ['address', 'bch'], ['token']);
      if (typeof raw.address !== 'string' || raw.address.length > 120 || !/^[A-Za-z0-9]+:[A-Za-z0-9]+$/.test(raw.address)) throw Error('REQUEST_INVALID_ADDRESS');
      // Pinned libauth normalizes case internally, so enforce the CashAddr rule
      // on the original string BEFORE calling its checksum/version decoder.
      if (raw.address !== raw.address.toLowerCase() && raw.address !== raw.address.toUpperCase()) throw Error('REQUEST_MIXED_CASE_ADDRESS');
      const decoded = decodeCashAddress(raw.address); if (typeof decoded === 'string') throw Error('REQUEST_INVALID_ADDRESS');
      if (decoded.prefix !== prefix) throw Error('REQUEST_NETWORK_MISMATCH');
      if ((decoded.type !== 'p2pkh' && decoded.type !== 'p2pkhWithTokens') || decoded.payload.length !== 20) throw Error('REQUEST_UNSUPPORTED_ADDRESS_TYPE');
      const converted = cashAddressToLockingBytecode(raw.address); if (typeof converted === 'string') throw Error('REQUEST_INVALID_ADDRESS');
      const address = raw.address.toLowerCase(); const satoshis = bchAtomic(raw.bch); if (satoshis === 0n) throw Error('REQUEST_BCH_RANGE');
      let token: PaymentRequestRecipient['token'];
      if (Object.hasOwn(raw, 'token')) {
        record(raw.token, ['category', 'amountAtomic']);
        if (typeof raw.token.category !== 'string' || !/^[0-9a-f]{64}$/.test(raw.token.category)) throw Error('REQUEST_INVALID_TOKEN_CATEGORY');
        if (typeof raw.token.amountAtomic !== 'string' || !/^[1-9][0-9]{0,18}$/.test(raw.token.amountAtomic)) throw Error('REQUEST_INVALID_TOKEN_AMOUNT');
        const amount = BigInt(raw.token.amountAtomic); const aggregate = (tokenTotals.get(raw.token.category) ?? 0n) + amount;
        if (amount > MAX_TOKEN || aggregate > MAX_TOKEN) throw Error('REQUEST_TOKEN_RANGE'); tokenTotals.set(raw.token.category, aggregate);
        if (decoded.type !== 'p2pkhWithTokens' || !converted.tokenSupport) throw Error('REQUEST_TOKEN_AWARE_REQUIRED');
        token = Object.freeze({ category: raw.token.category, amountAtomic: amount.toString() });
      }
      const dust = getDustThreshold({ lockingBytecode: converted.bytecode, valueSatoshis: satoshis, ...(token ? { token: { category: hexToBin(token.category), amount: BigInt(token.amountAtomic) } } : {}) }, 1000n);
      if (satoshis < dust) throw Error('REQUEST_DUST_OUTPUT');
      total += satoshis; if (total + fee > MAX_MONEY) throw Error('REQUEST_BCH_RANGE');
      display.push(Object.freeze({ address, script: binToHex(converted.bytecode), satoshis: satoshis.toString(), tokenAware: converted.tokenSupport, ...(token ? { token } : {}) }));
      return Object.freeze({ address, bch: bchDisplay(satoshis), ...(token ? { token } : {}) });
    });
    const request: PaymentRequestWire = Object.freeze({ schemaVersion: 1, kind: 'intentguard-payment-request', requestId: input.requestId, network: input.network, expiresAt: input.expiresAt, maxFeeBch: bchDisplay(fee), recipients: Object.freeze(recipients) });
    const canonical = JSON.stringify(request);
    if (new TextEncoder().encode(canonical).length > MAX_PAYMENT_REQUEST_BYTES || new TextEncoder().encode(JSON.stringify(request, null, 2)).length > MAX_PAYMENT_REQUEST_BYTES) throw Error('REQUEST_TOO_LARGE');
    const requestDigest = binToHex(sha256.hash(new TextEncoder().encode('intentguard/payment-request-draft/v1\0' + canonical)));
    const draft: PaymentRequestDraft = Object.freeze({ ...FLAGS, status: 'UNCONFIRMED_DRAFT', request, requestDigest, display: Object.freeze({ recipients: Object.freeze(display), recipientSatoshis: total.toString(), maxFeeSatoshis: fee.toString() }), limitations: LIMITATIONS });
    return Object.freeze({ ...FLAGS, status: 'DRAFT_READY', draft, issue: null });
  } catch (error) { return failure(error instanceof Error ? error.message : ''); }
}

/** Lexical preflight only: JSON.parse remains the grammar parser. Detect duplicate
 * decoded keys before JSON.parse can silently keep only the final spelling. */
function checkJsonKeys(text: string): void {
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{' || c === '[') { stack.push(c === '{' ? new Set() : null); if (stack.length > 6) throw Error('REQUEST_TOO_DEEP'); }
    else if (c === '}' || c === ']') stack.pop();
    else if (c === '"') {
      const start = i; i++;
      for (; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      let next = i + 1; while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      if (text[next] === ':') {
        let key: unknown; try { key = JSON.parse(text.slice(start, i + 1)); } catch { throw Error('REQUEST_INVALID_JSON'); }
        const objectKeys = stack.at(-1); if (typeof key !== 'string' || !objectKeys) throw Error('REQUEST_INVALID_JSON');
        if (objectKeys.has(key)) throw Error('REQUEST_DUPLICATE_JSON_KEY'); objectKeys.add(key);
      }
    }
  }
}
export function parsePaymentRequestDraft(text: string, now: number): PaymentRequestResult {
  try {
    if (typeof text !== 'string') throw Error('REQUEST_INVALID_JSON');
    if (text.length > MAX_PAYMENT_REQUEST_BYTES || new TextEncoder().encode(text).length > MAX_PAYMENT_REQUEST_BYTES) throw Error('REQUEST_TOO_LARGE');
    checkJsonKeys(text);
    let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw Error('REQUEST_INVALID_JSON'); }
    return createPaymentRequestDraft(parsed, now);
  } catch (error) { return failure(error instanceof Error ? error.message : ''); }
}
/** Export ONLY normalized wire fields. Pass draft.request, not the draft/report.
 * Revalidates expiry using the caller clock and never serializes trust flags. */
export function exportPaymentRequest(inputWire: unknown, now: number): string {
  const result = createPaymentRequestDraft(inputWire, now); if (result.status === 'REJECTED') throw Error(result.issue);
  const text = JSON.stringify(result.draft.request, null, 2);
  if (new TextEncoder().encode(text).length > MAX_PAYMENT_REQUEST_BYTES) throw Error('REQUEST_TOO_LARGE');
  return text;
}
