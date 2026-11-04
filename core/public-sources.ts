/** Reviewed public Chipnet candidates. Importing/configuring does not connect.
 * Directory attribution is not proof of independent backends. These nodes have
 * NOT passed this project's live verification; app/UI defaults remain unconfigured.
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
