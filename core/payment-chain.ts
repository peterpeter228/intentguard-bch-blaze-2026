import { binToHex, hexToBin, hash256, sha256, decodeTransaction, encodeTransaction, hashTransaction, type Transaction } from '@bitauth/libauth';
import type { SourceConfig, ReadMethod } from './evidence.js';
import type { EvidenceSnapshot } from './guard.js';
import type { SelectedOutpoint } from './unsigned-builder.js';
import { createReviewedChipnetCandidates, REVIEWED_CHIPNET_ENDPOINTS } from './public-sources.js';
import { createChipnetSender, createChipnetObservationTransport, type ObservationMethod } from './electrum-transport.js';

export const paymentHash = (value: string): string => binToHex(sha256.hash(new TextEncoder().encode(value)));
export function publicTransaction(raw: unknown): Transaction {
  if (typeof raw !== 'string' || raw.length > 200000 || !/^(?:[0-9a-f]{2})+$/.test(raw)) throw Error('INVALID_TRANSACTION');
  const tx = decodeTransaction(hexToBin(raw));
  if (typeof tx === 'string' || binToHex(encodeTransaction(tx)) !== raw) throw Error('INVALID_TRANSACTION');
  return tx;
}
const scriptHash = (script: string): string => binToHex(sha256.hash(hexToBin(script)).reverse());
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_SOURCE');
  return value as Record<string, unknown>;
}
function header(raw: unknown): { raw: string; hash: string; time: number } {
  if (typeof raw !== 'string' || !/^[0-9a-f]{160}$/.test(raw)) throw Error('INVALID_HEADER');
  const b = hexToBin(raw);
  return { raw, hash: binToHex(hash256(b).reverse()), time: new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(68, true) * 1000 };
}
export interface FundingEvidence { snapshot: EvidenceSnapshot; selected: SelectedOutpoint[]; sourceDigest: string; kind: 'node' | 'synthetic'; }
export interface PaymentObservation { status: 'UNKNOWN' | 'OBSERVED' | 'CONFIRMED_ON_CHAIN'; blockHash: string | null; height: number | null; observedAt: number; }
type ObservationRead = (sourceId: string, method: ObservationMethod, params: readonly unknown[], signal: AbortSignal) => Promise<unknown>;
const inclusionReaders = new Map(REVIEWED_CHIPNET_ENDPOINTS.map(e => [e.id, createChipnetObservationTransport(REVIEWED_CHIPNET_ENDPOINTS, e.id)]));
const readInclusion: ObservationRead = (id, method, params, signal) => {
  const reader = inclusionReaders.get(id);
  if (!reader) throw Error('SOURCE_CONFIGURATION');
  return reader.request(method, params, signal);
};
/** Public reads only. Session ownership is separately derived in the browser. */
export class PaymentChain {
  readonly sources: readonly SourceConfig[];
  constructor(sources: readonly SourceConfig[] = createReviewedChipnetCandidates(), private readonly sender = createChipnetSender(REVIEWED_CHIPNET_ENDPOINTS, REVIEWED_CHIPNET_ENDPOINTS[0]!.id), private readonly clock = Date.now, private readonly observationRead: ObservationRead = readInclusion) {
    this.sources = sources.map(s => Object.freeze({ ...s, checkpoint: { ...s.checkpoint } }));
    if (sources.length !== 2 || new Set(sources.map(s => s.id)).size !== 2 || new Set(sources.map(s => s.operatorId)).size !== 2 ||
        sources.some(s => s.network !== 'chipnet' || s.genesisHash !== sources[0]!.genesisHash || s.checkpoint.hash !== sources[0]!.checkpoint.hash || s.checkpoint.height !== sources[0]!.checkpoint.height || s.kind !== sources[0]!.kind)) throw Error('SOURCE_CONFIGURATION');
  }
  async read(sourceId: string, method: ReadMethod, params: readonly unknown[], signal: AbortSignal): Promise<unknown> {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) throw Error('SOURCE_CONFIGURATION');
    return source.transport.request(method, params, signal);
  }
  private async tip(source: SourceConfig, signal: AbortSignal): Promise<{ height: number; hash: string }> {
    const [f, cp, t] = await Promise.all([source.transport.request('server.features', [], signal),
      source.transport.request('blockchain.block.header', [source.checkpoint.height], signal), source.transport.request('blockchain.headers.subscribe', [], signal)]);
    const features = record(f), tip = record(t), h = header(tip.hex), now = this.clock();
    if (features.genesis_hash !== source.genesisHash || features.hash_function !== 'sha256' || features.cashtokens !== true || header(cp).hash !== source.checkpoint.hash ||
        !Number.isSafeInteger(tip.height) || Number(tip.height) < source.checkpoint.height || h.time > now + 120000 || now - h.time > source.maxTipAgeMs) throw Error('SOURCE_IDENTITY_OR_FRESHNESS');
    return { height: Number(tip.height), hash: h.hash };
  }
  async funding(scripts: readonly string[], selected?: readonly SelectedOutpoint[]): Promise<FundingEvidence> {
    if (scripts.length < 1 || scripts.length > 2 || new Set(scripts).size !== scripts.length || scripts.some(s => !/^76a914[0-9a-f]{40}88ac$/.test(s))) throw Error('UNKNOWN_OWNER_SCRIPT');
    const started = this.clock(), signal = AbortSignal.timeout(10000);
    const observations = await Promise.all(this.sources.map(async source => {
      const before = await this.tip(source, signal);
      const lists = await Promise.all(scripts.map(s => source.transport.request('blockchain.scripthash.listunspent', [scriptHash(s), 'include_tokens'], signal)));
      const rows: { txid: string; index: number; value: number; script: string }[] = [];
      for (const [index, list] of lists.entries()) {
        if (!Array.isArray(list) || list.length > 1000) throw Error('INVALID_UTXO_LIST');
        for (const item of list) {
          const r = record(item);
          if (typeof r.tx_hash !== 'string' || !/^[0-9a-f]{64}$/.test(r.tx_hash) || !Number.isSafeInteger(r.tx_pos) || Number(r.tx_pos) < 0 || Number(r.tx_pos) > 0xffffffff ||
              !Number.isSafeInteger(r.value) || Number(r.value) < 0 || !Number.isSafeInteger(r.height) || Number(r.height) < 0 || Number(r.height) > before.height) throw Error('INVALID_UTXO');
          if (r.token_data !== undefined) { if (selected?.some(s => s.txid === r.tx_hash && s.index === r.tx_pos)) throw Error('TOKEN_INPUT_REFUSED'); continue; }
          if (Number(r.height) > 0) rows.push({ txid: r.tx_hash, index: Number(r.tx_pos), value: Number(r.value), script: scripts[index]! });
        }
      }
      rows.sort((a, b) => a.txid.localeCompare(b.txid) || a.index - b.index);
      if (new Set(rows.map(r => r.txid + ':' + r.index)).size !== rows.length) throw Error('DUPLICATE_UTXO');
      const chosen = selected ? selected.map(s => { const r = rows.find(r => r.txid === s.txid && r.index === s.index); if (!r) throw Error('MISSING_OR_SPENT_PREVOUT'); return r; }) : rows.slice(0, 20);
      if (!chosen.length) throw Error('NO_ORDINARY_CONFIRMED_FUNDS');
      const ids = [...new Set(chosen.map(r => r.txid))].sort();
      const parents = await Promise.all(ids.map(async id => {
        const raw = await source.transport.request('blockchain.transaction.get', [id, false], signal);
        const tx = publicTransaction(raw);
        if (hashTransaction(hexToBin(String(raw))) !== id) throw Error('PARENT_HASH_MISMATCH');
        for (const r of chosen.filter(r => r.txid === id)) {
          const prev = tx.outputs[r.index];
          if (!prev || prev.token || binToHex(prev.lockingBytecode) !== r.script || prev.valueSatoshis !== BigInt(r.value)) throw Error('UTXO_PARENT_MISMATCH');
        }
        return String(raw);
      }));
      const after = await this.tip(source, signal);
      if (JSON.stringify(before) !== JSON.stringify(after)) throw Error('TIP_CHANGED');
      return { tip: after, parents, chosen };
    }));
    if (signal.aborted || this.clock() - started > 10000 || JSON.stringify(observations[0]) !== JSON.stringify(observations[1])) throw Error('SOURCES_DISAGREE_OR_STALE');
    const o = observations[0]!;
    return { snapshot: { network: 'chipnet', observedAt: started, parentTransactionHexes: o.parents, unspentOutpoints: o.chosen.map(r => r.txid + ':' + r.index) },
      selected: o.chosen.map(r => ({ txid: r.txid, index: r.index })), sourceDigest: paymentHash(JSON.stringify(o)), kind: this.sources[0]!.kind };
  }
  async broadcast(network: string, signedHex: string): Promise<string> {
    if (network !== 'chipnet') throw Error('MAINNET_CAP_ZERO');
    const expected = hashTransaction(hexToBin(signedHex));
    const result = await this.sender(signedHex, AbortSignal.timeout(5000));
    if (result !== expected) throw Error('BROADCAST_UNKNOWN');
    return expected;
  }
  async observe(signedHex: string): Promise<PaymentObservation> {
    const tx = publicTransaction(signedHex), id = hashTransaction(hexToBin(signedHex)), signal = AbortSignal.timeout(10000);
    try {
      const replies = await Promise.all(this.sources.map(async source => {
        const tip = await this.tip(source, signal);
        if (await source.transport.request('blockchain.transaction.get', [id, false], signal) !== signedHex) throw Error('ORIGINAL_BYTES_MISSING');
        const history = await this.observationRead(source.id, 'blockchain.scripthash.get_history', [scriptHash(binToHex(tx.outputs[0]!.lockingBytecode))], signal);
        if (!Array.isArray(history) || history.length > 1000) throw Error('INVALID_HISTORY');
        const rows = history.map(record).filter(r => r.tx_hash === id);
        if (rows.length !== 1 || !Number.isSafeInteger(rows[0]!.height)) throw Error('ORIGINAL_HEIGHT_MISSING');
        const height = Number(rows[0]!.height);
        if (height <= 0) return { status: 'OBSERVED' as const, blockHash: null, height: null };
        if (height > tip.height) throw Error('INVALID_HEIGHT');
        const [raw, proof] = await Promise.all([source.transport.request('blockchain.block.header', [height], signal), this.observationRead(source.id, 'blockchain.transaction.get_merkle', [id, height], signal)]);
        const h = header(raw), p = record(proof);
        if (p.block_height !== height || !Number.isSafeInteger(p.pos) || Number(p.pos) < 0 || !Array.isArray(p.merkle) || p.merkle.length > 32) throw Error('INVALID_INCLUSION');
        let node = hexToBin(id).reverse(), pos = Number(p.pos);
        for (const sibling of p.merkle) {
          if (typeof sibling !== 'string' || !/^[0-9a-f]{64}$/.test(sibling)) throw Error('INVALID_INCLUSION');
          const other = hexToBin(sibling).reverse();
          node = hash256(Uint8Array.from(pos % 2 ? [...other, ...node] : [...node, ...other])); pos = Math.floor(pos / 2);
        }
        if (pos !== 0 || binToHex(node) !== h.raw.slice(72, 136)) throw Error('INVALID_INCLUSION');
        return { status: 'CONFIRMED_ON_CHAIN' as const, blockHash: h.hash, height };
      }));
      if (JSON.stringify(replies[0]) !== JSON.stringify(replies[1])) throw Error('SOURCES_DISAGREE');
      return { ...replies[0]!, observedAt: this.clock() };
    } catch { return { status: 'UNKNOWN', blockHash: null, height: null, observedAt: this.clock() }; }
  }
}
