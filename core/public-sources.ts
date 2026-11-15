/** Fixed public candidates. Importing/configuring does not connect. Runtime must
 * recheck TLS, genesis, post-fork checkpoint, freshness, parents and agreement.
 * Public operator/backend attribution is a bounded assumption, not SPV/consensus
 * or proof against collusion; never infer independence from hostnames alone.
 */
import {createElectrumTransport,type ElectrumEndpoint} from './electrum-transport.js';
import type {SourceConfig} from './evidence.js';
export const CHIPNET_GENESIS='000000001dd410c49a788668ce26751718cc797474d3152a5fc073dd44fd9f7b';
/** BCHN 07576013c91ff4a3a74acd85f189c69121cdad1b src/chainparams.cpp:1080.
 * Chipnet/testnet4 share genesis; this post-split identity pin is NOT an SPV proof.
 */
export const CHIPNET_IDENTITY_CHECKPOINT=Object.freeze({height:121957,hash:'0000000056087dee73fb66178ca70da89dfd0be098b1a63cf6fe93934cd04c78'});
export const REVIEWED_CHIPNET_ENDPOINTS:readonly ElectrumEndpoint[]=Object.freeze([
 Object.freeze({id:'chipnet-ninja',hostname:'chipnet.bch.ninja',port:50002}),
 Object.freeze({id:'chipnet-imaginary',hostname:'chipnet.imaginary.cash',port:50002})
]);
/** Explicit application opt-in; no imported URL, peer-discovery or fallback. */
export function createReviewedChipnetCandidates():readonly SourceConfig[]{
 return Object.freeze(REVIEWED_CHIPNET_ENDPOINTS.map((endpoint,index)=>Object.freeze({
  id:endpoint.id,operatorId:index===0?'kallisti':'imaginary-username',network:'chipnet' as const,
  genesisHash:CHIPNET_GENESIS,checkpoint:CHIPNET_IDENTITY_CHECKPOINT,
  // Conservative application freshness policy, not a consensus/organizer rule.
  maxTipAgeMs:2*60*60*1000,kind:'node' as const,
  transport:createElectrumTransport(REVIEWED_CHIPNET_ENDPOINTS,endpoint.id)
 })));
}

/** BCHN 07576013c91ff4a3a74acd85f189c69121cdad1b src/chainparams.cpp.
 * Axion checkpoint distinguishes BCH from BTC, BSV and the ABC fork. Not SPV.
 */
export const MAINNET_GENESIS = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f';
export const MAINNET_IDENTITY_CHECKPOINT = Object.freeze({ height: 661648, hash: '0000000000000000029e471c41818d24b8b74c911071c4ef0b4a0509f9b5a8ce' });
/** Public operator attribution + distinct reported BCHN backends, not hostname-only independence.
 * https://bch.ninja/ credits Kallisti; https://cyberbits.eu/ identifies Cyberbits Labs.
 * TLS banners observed 2026-11-15: BCHN29.2.0 vs29.1.0; independent administration
 * remains a bounded trust assumption, not protection against colluding nodes.
 */
export const REVIEWED_MAINNET_ENDPOINTS: readonly ElectrumEndpoint[] = Object.freeze([
  Object.freeze({ id: 'mainnet-ninja', hostname: 'cashnode.bch.ninja', port: 50002 }),
  Object.freeze({ id: 'mainnet-cyberbits', hostname: 'bch.cyberbits.eu', port: 50002 })
]);
export function createReviewedMainnetCandidates(): readonly SourceConfig[] {
  return Object.freeze(REVIEWED_MAINNET_ENDPOINTS.map((endpoint, index) => Object.freeze({
    id: endpoint.id, operatorId: index === 0 ? 'kallisti' : 'cyberbits-labs', network: 'mainnet' as const,
    genesisHash: MAINNET_GENESIS, checkpoint: MAINNET_IDENTITY_CHECKPOINT, maxTipAgeMs: 7200000,
    kind: 'node' as const, transport: createElectrumTransport(REVIEWED_MAINNET_ENDPOINTS, endpoint.id)
  })));
}
