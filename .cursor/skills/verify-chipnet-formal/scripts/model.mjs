#!/usr/bin/env node
// Enumerate the REAL safety gate; TLC independently checks all reachable edges.
import {initialState,transition} from '../../../../preseason/xo/chipnet-lifecycle.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const dest=resolve(process.argv[2]);mkdirSync(dest,{recursive:true});
const expected={claim:'new',persistSecret:'claimed',secretReady:'persisting',startEngine:'identity',engineReady:'connecting',startSign:'session',signed:'signing',checkPublic:'signed',startExport:'checked',published:'exporting',verified:'exported',reconcileSession:'unknown'};
const states=[],ids=new Map(),edges=[];
const key=s=>JSON.stringify(s);
function add(s){const k=key(s);if(!ids.has(k)){ids.set(k,states.length);states.push(s);}return ids.get(k);}
const starts=[];
for(const network of ['chipnet','mainnet'])for(const existing of [false,true])starts.push(add({...initialState(network),existing,custody:false,signature:false}));
for(let i=0;i<states.length;i++) {
  const s=states[i];
  if(states.length>500)throw Error('MODEL_BOUND_EXCEEDED');
  const edge=(event,t)=>edges.push({from:i,to:add(t),event});
  if(s.phase==='persisting'&&!s.custody)edge('secretWrite',{...s,custody:true});
  if(s.phase==='signing'&&!s.signature)edge('sdkSign',{...s,signature:true});
  if(s.phase==='exporting'&&!s.published)edge('publishFile',{...s,published:true});
  for(const [event,phase] of Object.entries(expected)) {
    if(s.phase!==phase)continue;
    if(event==='secretReady'&&!s.custody||event==='signed'&&!s.signature||event==='published'&&!s.published)continue;
    for(const evidence of [{fileAbsent:!s.existing,networkReady:true,fresh:true,publicSafe:true,sameOwnedIdentity:true,historyProvesNoSign:true},{fileAbsent:!s.existing,networkReady:false,fresh:true,publicSafe:true},{fileAbsent:!s.existing,networkReady:true,fresh:false,publicSafe:true},{fileAbsent:!s.existing,networkReady:true,fresh:true,publicSafe:false}]) {
      try{edge(event,transition(s,event,evidence));}catch {
        edge('refused',s.phase==='new'?{...s,phase:'refused'}:transition(s,'crash'));
      }
    }
  }
  if(!['new','refused','unknown','verified'].includes(s.phase))edge('crash',transition(s,'crash'));
  // A reopened command refuses the existing journal before creating keys or signing.
  edge('doctor',transition(s,'doctor'));
}
const scalar=v=>typeof v==='string'?JSON.stringify(v):typeof v==='boolean'?(v?'TRUE':'FALSE'):String(v);
const tlaState=s=>'['+Object.entries(s).map(([k,v])=>k+' |-> '+scalar(v)).join(', ')+']';
const names=[...new Set(edges.map(e=>e.event))];
const unique=[...new Map(edges.map(e=>[JSON.stringify(e),e])).values()];
const text=`---------------- MODULE ChipnetInvitation ----------------\nEXTENDS Naturals, FiniteSets\nVARIABLE s\nvars == <<s>>\nStates == <<\n${states.map(tlaState).join(',\n')}\n>>\nEdges == {\n${unique.map(e=>`[from |-> ${e.from+1}, to |-> ${e.to+1}, event |-> "${e.event}"]`).join(',\n')}\n}\nInit == s \\in {${starts.map(i=>'States['+(i+1)+']').join(', ')}}\n${names.map(n=>n+' == \\E e \\in Edges: /\\ e.event = "'+n+'" /\\ s = States[e.from] /\\ s\' = States[e.to]').join('\n')}\nNext == ${names.join(' \\/ ')}\nChipnetOnly == (s.custody \\/ s.attempts > 0 \\/ s.published) => s.network = "chipnet"\nExistingFileRefusal == s.existing => ~s.custody /\\ s.attempts = 0 /\\ ~s.published\nAtMostOneSign == s.attempts <= 1\nSecretSafeExport == s.published => s.publicChecked /\\ s.freshChecked /\\ s.signature /\\ s.custody\nOfflineNotAuthority == s.verified => s.published /\\ s.publicChecked\n===========================================================\n`;
writeFileSync(resolve(dest,'ChipnetInvitation.tla'),text);
writeFileSync(resolve(dest,'ChipnetInvitation.cfg'),'INIT Init\nNEXT Next\nINVARIANT ChipnetOnly ExistingFileRefusal AtMostOneSign SecretSafeExport OfflineNotAuthority\n');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(resolve(dest,'model-source.json'),JSON.stringify({generator:'actual transition() reachable-state enumeration plus explicitly separate filesystem/SDK effect gaps',bounds:{operations:1,networks:2,existingFile:2,evidence:'good; network unavailable; expired; unsafe export',states:states.length,edges:unique.length,crashes:'at every nonterminal phase; no replay after reopen'},codeSha256:hash(new URL('../../../../preseason/xo/chipnet-lifecycle.mjs',import.meta.url)),modelSha256:hash(resolve(dest,'ChipnetInvitation.tla')),excluded:['cryptography internals','TLS implementation','OS crash durability beyond fsync assumptions','private value inference','physical side effects of third-party SDK outside reviewed path']},null,2)+'\n');
console.log(JSON.stringify({states:states.length,edges:unique.length,destination:dest}));
