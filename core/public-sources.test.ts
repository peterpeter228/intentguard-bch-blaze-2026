import assert from 'node:assert/strict';import {test} from 'node:test';
import {createReviewedChipnetCandidates,REVIEWED_CHIPNET_ENDPOINTS,CHIPNET_GENESIS,CHIPNET_IDENTITY_CHECKPOINT} from './public-sources.js';
test('opt-in registry captures two documented Chipnet candidates without network I/O',()=>{
 const sources=createReviewedChipnetCandidates();assert.equal(sources.length,2);assert.equal(new Set(sources.map(s=>s.operatorId)).size,2);
 assert(sources.every(s=>s.network==='chipnet'&&s.genesisHash===CHIPNET_GENESIS&&s.checkpoint.height===121957&&s.checkpoint.hash===CHIPNET_IDENTITY_CHECKPOINT.hash&&s.maxTipAgeMs===7200000));
 assert(Object.isFrozen(sources));assert(sources.every(Object.isFrozen));assert(Object.isFrozen(REVIEWED_CHIPNET_ENDPOINTS));
 assert.throws(()=>Object.assign(sources[0]!.checkpoint,{hash:'00'.repeat(32)}));
 // No request is made: candidate construction proves neither TLS health nor chain truth.
});
