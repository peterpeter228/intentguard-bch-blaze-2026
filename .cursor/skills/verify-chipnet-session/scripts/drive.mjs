#!/usr/bin/env node
// Public-only empirical driver. New identity creation is available only in explicit `live` mode.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root='/var/lib/docker/volumes/openbot-eval_openbot-data/_data/OpenBot/Shared/loop/bch-blaze-chipnet-20261109';
const art=root+'/artifacts';
const mode=process.argv[2];if(!['live','offline','reconcile'].includes(mode))throw Error('Use live, offline or journal-bound reconcile');
const receipts=[];
const record=(name,command,args)=>{
  const startedAt=new Date().toISOString();
  const r=spawnSync(command,args,{cwd:process.cwd(),encoding:'utf8',timeout:100000,maxBuffer:1048576,env:{...process.env,DEBUG:''}});
  // The owned command emits only whitelist JSON; offline inputs were already safety-checked.
  const receipt={name,command:[command,...args],startedAt,finishedAt:new Date().toISOString(),exit:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr};
  writeFileSync(art+'/'+name+'.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});receipts.push(receipt);
  if(r.status!==0)throw Error(name+'_FAILED');
  return r.stdout;
};
function report(stdout){return JSON.parse(stdout.slice(stdout.indexOf('{')));}
const doctor=report(record(mode+'-doctor-before',process.execPath,['preseason/xo/chipnet-session.mjs','doctor']));
if(mode==='live') {
  if(doctor.code!=='NO_OPERATION'||doctor.secretExists!==false)throw Error('LIVE_REPLAY_REFUSED');
  record('live-create',process.execPath,['--disable-sigusr1','preseason/xo/chipnet-session.mjs','create']);
}else if(mode==='reconcile') {
  if(doctor.code!=='RECONCILIATION_REQUIRED_NO_REPLAY'||doctor.attempts!==0||doctor.journalSha256!=='6d4831e4edaf75067df74ec10573db4622d4a73cf1b3f9a445fb46149d07a5f1')throw Error('RECONCILIATION_REFUSED');
  record('reconcile-session',process.execPath,['--disable-sigusr1','preseason/xo/chipnet-session.mjs','reconcile-session']);
}else if(doctor.code!=='PUBLIC_EXPORT_READY')throw Error('RECONCILE_DO_NOT_REPLAY');
const metadata=JSON.parse(readFileSync(art+'/metadata.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=readFileSync(art+'/invitation.json');
if(metadata.exportSha256!==hash(original)||metadata.network!=='chipnet')throw Error('PUBLIC_PROVENANCE_MISMATCH');
const pin='a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672';
const npm=resolve('/opt/aicc/node-v24.22.2-linux-x64/bin/npm');
const inspect=(name,path)=>report(record(name,npm,['run','xo:inspect','--',art+'/template.json',path,'chipnet',pin]));
const positive=inspect(mode+'-inspect-original',art+'/invitation.json');
if(positive.status!=='REVIEW_REQUIRED'||positive.canSign!==false||positive.commits!==1||positive.issues.length!==0)throw Error('POSITIVE_INSPECTION_FAILED');
// Mutate ONE public signature nibble; preserve every other serialized byte, never re-sign.
const text=original.toString('utf8');
let replacements=0;
const tampered=text.replace(/("signature"\s*:\s*")([0-9a-f])([0-9a-f]{127}")/,(_m,a,b,c)=>{replacements++;return a+(b==='0'?'1':'0')+c;});
if(replacements!==1)throw Error('PUBLIC_SIGNATURE_SHAPE_UNEXPECTED');
const tamperPath=art+'/invitation-tampered-'+mode+'.json';writeFileSync(tamperPath,tampered,{flag:'wx'});
const negative=inspect(mode+'-inspect-tampered',tamperPath);
if(negative.status!=='REJECTED'||negative.canSign!==false||!negative.issues.some(i=>/Signature/.test(i.code)))throw Error('SIGNATURE_TAMPER_NOT_REJECTED');
const after=report(record(mode+'-doctor-after',process.execPath,['preseason/xo/chipnet-session.mjs','doctor']));
if(after.code!=='PUBLIC_EXPORT_READY'||after.attempts!==1)throw Error('OPERATION_PROVENANCE_CHANGED');
if(hash(readFileSync(art+'/invitation.json'))!==metadata.exportSha256)throw Error('ORIGINAL_CHANGED');
const summary={mode,status:'PASS',checks:{realCLI:true,schemaAndSignatures:true,expiryClock:'Date.now; not overridden',original:positive.status,tampered:negative.status,tamperCodes:negative.issues.map(i=>i.code),canSign:false,attempts:after.attempts},exportSha256:metadata.exportSha256,secretMetadataOnly:true,cleanup:'Owned live command stops its network/Engine and exits; evidence and public export retained. No reset, new identity, funding or broadcast.',evidenceSurvived:receipts.every(r=>existsSync(art+'/'+r.name+'.json'))};
writeFileSync(art+'/empirical-'+mode+'.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(summary));
