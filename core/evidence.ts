/** Read-only adapter boundary. No provider endpoints or wallet connection is configured here. */
import {binToHex,hexToBin,decodeTransaction,encodeTransaction,hashTransaction,sha256,hash256,hash160,secp256k1} from '@bitauth/libauth';
import type {DappConnectionManager} from '@wizardconnect/dapp';
import {verifyCandidate,structuralTransactionDigest,type PaymentIntent,type EvidenceSnapshot,type GuardReport} from './guard.js';
export type ReadMethod='server.features'|'blockchain.block.header'|'blockchain.headers.subscribe'|'blockchain.transaction.get'|'blockchain.scripthash.listunspent';
export interface ReadTransport { request(method:ReadMethod,params:readonly unknown[],signal:AbortSignal):Promise<unknown>; }
/** Trusted application configuration, NEVER populated from imported candidate JSON. */
export interface SourceConfig {id:string;operatorId:string;network:'chipnet'|'mainnet';genesisHash:string;checkpoint:{height:number;hash:string};maxTipAgeMs:number;kind:'synthetic'|'node';transport:ReadTransport;}
export interface PublicKeySession extends Pick<DappConnectionManager, 'hasPath' | 'getPubkey'> {
 /** Application-owned authenticated session state, not an imported request's session claim. */
 currentSessionId():string|null;
}
export interface PathBinding {childIndex:number;index:number;script:string;}
export interface OwnershipEvidence {status:'SESSION_DERIVED'|'UNKNOWN';sessionId:string;observedAt:number;scripts:string[];issue:string|null;}
const sessionEvidence = new WeakMap<object,()=>boolean>();
const hex64=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const p2pkh=(x:unknown):x is string=>typeof x==='string'&&/^76a914[0-9a-f]{40}88ac$/.test(x);
const time=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
const record=(x:unknown):Record<string,unknown>=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('MALFORMED_SOURCE');return x as Record<string,unknown>;};
const hash=(s:string)=>binToHex(sha256.hash(new TextEncoder().encode(s)));
export function deriveSessionOwnership(adapter:PublicKeySession,sessionId:string,bindings:readonly PathBinding[],now:number):OwnershipEvidence{
 const result:OwnershipEvidence={status:'UNKNOWN',sessionId,observedAt:now,scripts:[],issue:null};
 try{
  if(!time(now)||!sessionId||sessionId.length>128||adapter.currentSessionId()!==sessionId||!bindings.length||bindings.length>100)throw Error('SESSION_UNAVAILABLE');
  for(const b of bindings){if(!Number.isInteger(b.childIndex)||b.childIndex<0||b.childIndex>=0x80000000||!Number.isInteger(b.index)||b.index<0||b.index>=0x80000000||!p2pkh(b.script)||!adapter.hasPath(b.childIndex))throw Error('UNKNOWN_WALLET_PATH');
   const pub=adapter.getPubkey(b.childIndex,BigInt(b.index));if(!pub||pub.length!==33||!secp256k1.validatePublicKey(pub))throw Error('INVALID_PUBLIC_KEY');
   const script='76a914'+binToHex(hash160(pub))+'88ac';if(script!==b.script)throw Error('OWNERSHIP_MISMATCH');result.scripts.push(script);
  }
  if(adapter.currentSessionId()!==sessionId)throw Error('SESSION_CHANGED');
  if(new Set(result.scripts).size!==result.scripts.length)throw Error('DUPLICATE_OWNERSHIP');
  result.status='SESSION_DERIVED';
  const captured=bindings.map(b=>({...b}));sessionEvidence.set(result,()=>{try{return adapter.currentSessionId()===sessionId&&captured.every(b=>{if(!adapter.hasPath(b.childIndex))return false;const pub=adapter.getPubkey(b.childIndex,BigInt(b.index));return !!pub&&pub.length===33&&secp256k1.validatePublicKey(pub)&&'76a914'+binToHex(hash160(pub))+'88ac'===b.script;});}catch{return false;}});
 }catch(e){result.scripts=[];const code=e instanceof Error?e.message:'';result.issue=['SESSION_UNAVAILABLE','UNKNOWN_WALLET_PATH','INVALID_PUBLIC_KEY','OWNERSHIP_MISMATCH','SESSION_CHANGED','DUPLICATE_OWNERSHIP'].includes(code)?code:'OWNERSHIP_UNAVAILABLE';}
 Object.freeze(result.scripts);return Object.freeze(result);
}
interface Tip {height:number;hash:string;timestampMs:number;}
export interface EvidenceResult {status:'NODE_REPORTED'|'SYNTHETIC_MATCH'|'UNKNOWN';canSign:false;issue:string|null;snapshot:EvidenceSnapshot|null;guard:GuardReport|null;sourceIds:string[];observedAt:number|null;sourceBindingDigest:string|null;chainTip:Tip|null;}
function decodeRaw(raw:unknown){if(typeof raw!=='string'||raw.length>200000||!/^([0-9a-f]{2})+$/.test(raw))throw Error('INVALID_PARENT');const tx=decodeTransaction(hexToBin(raw));if(typeof tx==='string'||binToHex(encodeTransaction(tx))!==raw)throw Error('INVALID_PARENT');return tx;}
function header(raw:unknown):string{if(typeof raw!=='string'||!/^[0-9a-f]{160}$/.test(raw))throw Error('INVALID_HEADER');return binToHex(hash256(hexToBin(raw)).reverse());}
function tip(x:unknown):Tip{const t=record(x);if(!time(t.height))throw Error('INVALID_TIP');const hash=header(t.hex);const bytes=hexToBin(t.hex as string);const timestampMs=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(68,true)*1000;return {height:t.height,hash,timestampMs};}
/** Collects bounded node-reported evidence through app-injected read-only transports.
 * Two configured independent operator IDs and a pinned checkpoint are required.
 * This does NOT establish SPV/consensus, key possession or spending authorization.
 */
export function createEvidenceCollector(configs:readonly SourceConfig[],clock:()=>number=Date.now){
 // Capture identity independently from response/candidate data and prevent later config mutation.
 const sources=configs.map(c=>({...c,checkpoint:{...c.checkpoint},request:c.transport.request.bind(c.transport)}));
 return async function collect(intent:PaymentIntent,candidateHex:string,ownership:OwnershipEvidence,signal?:AbortSignal):Promise<EvidenceResult>{
  const r:EvidenceResult={status:'UNKNOWN',canSign:false,issue:null,snapshot:null,guard:null,sourceIds:[],observedAt:null,sourceBindingDigest:null,chainTip:null};
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;const onAbort=()=>controller.abort(Error('ABORTED'));
  try{
   if(signal?.aborted)throw Error('ABORTED');signal?.addEventListener('abort',onAbort,{once:true});
   intent=structuredClone(intent);
   const start=clock();if(!time(start))throw Error('INVALID_CLOCK');
   if(sources.length!==2||new Set(sources.map(s=>s.id)).size!==2||new Set(sources.map(s=>s.operatorId)).size!==2)throw Error('CONFIGURATION_REQUIRED');
   if(sources.some(s=>!s.id||s.id.length>80||!s.operatorId||s.operatorId.length>80||s.network!==intent.network||!hex64(s.genesisHash)||!time(s.checkpoint.height)||!hex64(s.checkpoint.hash)||!time(s.maxTipAgeMs)||s.maxTipAgeMs<1000||s.maxTipAgeMs>86400000||!['node','synthetic'].includes(s.kind)))throw Error('INVALID_SOURCE_CONFIG');
   if(sources[0]!.genesisHash!==sources[1]!.genesisHash||(sources[0]!.checkpoint.height!==sources[1]!.checkpoint.height||sources[0]!.checkpoint.hash!==sources[1]!.checkpoint.hash)||sources[0]!.kind!==sources[1]!.kind)throw Error('SOURCE_CONFIG_DISAGREEMENT');
   if(!sessionEvidence.get(ownership)?.()||ownership.status!=='SESSION_DERIVED'||!ownership.sessionId||!time(ownership.observedAt)||ownership.observedAt>start||start-ownership.observedAt>120000||!Array.isArray(ownership.scripts)||!Array.isArray(intent.ownerScripts)||JSON.stringify([...ownership.scripts].sort())!==JSON.stringify([...intent.ownerScripts].sort()))throw Error('OWNERSHIP_REQUIRED');
   // OwnershipEvidence must originate from deriveSessionOwnership in trusted app state;
   // imported JSON must not be cast into this capability. Result still never authorizes signing.
   const tx=decodeRaw(candidateHex);if(!tx.inputs.length||tx.inputs.length>20||intent.ownerScripts.length>20)throw Error('EVIDENCE_LIMIT');
   const ids=[...new Set(tx.inputs.map(i=>binToHex(i.outpointTransactionHash)))];
   const work=async()=>{
    const observations=[];
    for(const source of sources){
     const call=async(method:ReadMethod,params:readonly unknown[]=[])=>{if(controller.signal.aborted)throw Error('ABORTED');try{return await source.request(method,params,controller.signal);}catch{throw Error('SOURCE_UNAVAILABLE');}};
     const features=record(await call('server.features'));if(features.genesis_hash!==source.genesisHash||features.hash_function!=='sha256'||features.cashtokens!==true)throw Error('SOURCE_IDENTITY_MISMATCH');
     if(header(await call('blockchain.block.header',[source.checkpoint.height]))!==source.checkpoint.hash)throw Error('CHECKPOINT_MISMATCH');
     const before=tip(await call('blockchain.headers.subscribe'));if(before.height<source.checkpoint.height)throw Error('TIP_BEFORE_CHECKPOINT');if(before.timestampMs>start+120000||start-before.timestampMs>source.maxTipAgeMs)throw Error('TIP_NOT_FRESH');
     const parents:string[]=[];const unspent:string[]=[];
     for(const id of ids){const raw=await call('blockchain.transaction.get',[id,false]);decodeRaw(raw);if(hashTransaction(hexToBin(raw as string))!==id)throw Error('PARENT_HASH_MISMATCH');parents.push(raw as string);}
     for(const script of intent.ownerScripts){if(!p2pkh(script))throw Error('UNSUPPORTED_OWNER_SCRIPT');const sh=binToHex(sha256.hash(hexToBin(script)).reverse());const list=await call('blockchain.scripthash.listunspent',[sh,'include_tokens']);if(!Array.isArray(list)||list.length>1000)throw Error('INVALID_UTXO_LIST');
      const seen=new Set<string>();
      for(const item of list){const row=record(item);if(!time(row.height)||row.height>before.height||!hex64(row.tx_hash)||!time(row.tx_pos)||row.tx_pos>0xffffffff)throw Error('INVALID_UTXO');const key=`${row.tx_hash}:${row.tx_pos}`;if(seen.has(key))throw Error('DUPLICATE_UTXO');seen.add(key);
       if(tx.inputs.some(x=>binToHex(x.outpointTransactionHash)===row.tx_hash&&x.outpointIndex===row.tx_pos)){
        const parentRaw=parents.find(raw=>hashTransaction(hexToBin(raw))===row.tx_hash);const prev=parentRaw?decodeRaw(parentRaw).outputs[row.tx_pos]:undefined;
        if(!prev||binToHex(prev.lockingBytecode)!==script||!time(row.value)||BigInt(row.value)!==prev.valueSatoshis)throw Error('UTXO_PARENT_MISMATCH');
        // Cross-check token summaries rather than trusting or silently ignoring conflicts.
        if(prev.token){const td=record(row.token_data);if(td.category!==binToHex(prev.token.category)||td.amount!==prev.token.amount.toString()||td.nft!==undefined||prev.token.nft)throw Error('TOKEN_SUMMARY_MISMATCH');}else if(row.token_data!==undefined)throw Error('TOKEN_SUMMARY_MISMATCH');
        unspent.push(key);
       }
      }
     }
     const after=tip(await call('blockchain.headers.subscribe'));if(before.height!==after.height||before.hash!==after.hash)throw Error('TIP_CHANGED');
     observations.push({tip:after,parents,unspent:unspent.sort()});r.sourceIds.push(source.id);
    }
    if(JSON.stringify(observations[0])!==JSON.stringify(observations[1]))throw Error('SOURCES_DISAGREE');
    const end=clock();if(!sessionEvidence.get(ownership)?.())throw Error('SESSION_CHANGED');
    if(!time(end)||end<start||end-ownership.observedAt>120000||end-start>10000||controller.signal.aborted)throw Error('EXPIRED_OR_ABORTED_COLLECTION');
    if(observations.some((o,i)=>o.tip.timestampMs>end+120000||end-o.tip.timestampMs>sources[i]!.maxTipAgeMs))throw Error('TIP_NOT_FRESH');
    const o=observations[0]!;const snapshot:EvidenceSnapshot={network:intent.network,observedAt:start,parentTransactionHexes:o.parents,unspentOutpoints:o.unspent};
    const guard=verifyCandidate({intent,candidateHex,snapshot,now:end});r.guard=guard;
    if(guard.status!=='MATCH_OFFLINE')throw Error('GUARD_NOT_MATCHED');
    r.snapshot=snapshot;r.observedAt=start;r.chainTip=o.tip;r.sourceBindingDigest=hash(JSON.stringify({version:1,network:intent.network,intent:guard.intentDigest,structural:structuralTransactionDigest(candidateHex),parents:o.parents.map(raw=>hashTransaction(hexToBin(raw))).sort()}));
    r.status=sources[0]!.kind==='synthetic'?'SYNTHETIC_MATCH':'NODE_REPORTED';return structuredClone(r);
   };
   // Timeout returns even when a transport ignores AbortSignal. No retries or writes.
   const aborted=new Promise<EvidenceResult>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(controller.signal.reason),{once:true}));
   timer=setTimeout(()=>controller.abort(Error('SOURCE_TIMEOUT')),10000);
   return await Promise.race([work(),aborted]);
  }catch(e){r.status='UNKNOWN';r.snapshot=null;r.sourceBindingDigest=null;const code=e instanceof Error?e.message:'';r.issue=/^(ABORTED|INVALID_CLOCK|CONFIGURATION_REQUIRED|INVALID_SOURCE_CONFIG|SOURCE_CONFIG_DISAGREEMENT|OWNERSHIP_REQUIRED|INVALID_PARENT|EVIDENCE_LIMIT|SOURCE_IDENTITY_MISMATCH|CHECKPOINT_MISMATCH|INVALID_HEADER|INVALID_TIP|TIP_BEFORE_CHECKPOINT|TIP_NOT_FRESH|PARENT_HASH_MISMATCH|UNSUPPORTED_OWNER_SCRIPT|INVALID_UTXO_LIST|INVALID_UTXO|DUPLICATE_UTXO|UTXO_PARENT_MISMATCH|TOKEN_SUMMARY_MISMATCH|TIP_CHANGED|SOURCES_DISAGREE|SESSION_CHANGED|EXPIRED_OR_ABORTED_COLLECTION|GUARD_NOT_MATCHED|SOURCE_TIMEOUT|MALFORMED_SOURCE)$/.test(code)?code:'SOURCE_UNAVAILABLE';return structuredClone(r);}
  finally{if(timer)clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',onAbort);}
 };
}
