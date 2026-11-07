import { createHash } from 'node:crypto';
import { createElectrumTransport } from '../../core/electrum-transport.ts';
const endpoint = { id: 'chipnet-ninja', hostname: 'chipnet.bch.ninja', port: 50002 };
const transport = createElectrumTransport([endpoint], endpoint.id);
const checkpoint = { height: 121957, hash: '0000000056087dee73fb66178ca70da89dfd0be098b1a63cf6fe93934cd04c78' };
const genesis = '000000001dd410c49a788668ce26751718cc797474d3152a5fc073dd44fd9f7b';
const hashHeader = raw => createHash('sha256').update(createHash('sha256').update(Buffer.from(raw, 'hex')).digest()).digest().reverse().toString('hex');
const report = { timestamp: new Date().toISOString(), sourceCommit: '61e0895d21ab173a74cf5363a9392d73a3b2314f', endpoint, scope: 'public features/checkpoint/tip only; no user data or transaction', operations: [], status: 'UNVERIFIED', canSign: false, broadcastable: false, receiptValid: false, consensusVerified: false };
try {
  const features = await transport.request('server.features', [], new AbortController().signal);
  report.operations.push({ method: 'server.features', result: features });
  if (!features || features.genesis_hash !== genesis || features.hash_function !== 'sha256' || features.cashtokens !== true) throw Error('SOURCE_IDENTITY_MISMATCH');
  const raw = await transport.request('blockchain.block.header', [checkpoint.height], new AbortController().signal);
  if (typeof raw !== 'string' || !/^[0-9a-f]{160}$/.test(raw) || hashHeader(raw) !== checkpoint.hash) throw Error('CHECKPOINT_MISMATCH');
  report.operations.push({ method: 'blockchain.block.header', height: checkpoint.height, hash: hashHeader(raw) });
  const tip = await transport.request('blockchain.headers.subscribe', [], new AbortController().signal);
  if (!tip || !Number.isSafeInteger(tip.height) || tip.height < checkpoint.height || typeof tip.hex !== 'string' || !/^[0-9a-f]{160}$/.test(tip.hex)) throw Error('INVALID_TIP');
  const timestampMs = Buffer.from(tip.hex, 'hex').readUInt32LE(68) * 1000;
  if (timestampMs > Date.now() + 120000 || Date.now() - timestampMs > 7200000) throw Error('TIP_NOT_FRESH');
  report.operations.push({ method: 'blockchain.headers.subscribe', height: tip.height, hash: hashHeader(tip.hex), timestampMs });
  report.status = 'SINGLE_SOURCE_HEADER_CHECK_ONLY';
} catch (error) {
  report.issue = error instanceof Error ? error.message : 'UNKNOWN';
  process.exitCode = 1;
}
report.completedAt = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));

