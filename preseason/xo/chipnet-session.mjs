#!/usr/bin/env node
// One Q1=B operation only, bound to this task. Not a general wallet loader.
import {constants,existsSync,lstatSync,mkdirSync,openSync,closeSync,writeFileSync,readFileSync,readSync,readdirSync,fstatSync,fsyncSync} from 'node:fs';
import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {join} from 'node:path';
import {initialState,transition} from './chipnet-lifecycle.mjs';
import {syncDirectory,publishExclusive,createJournal,appendJournal,readJournal} from './chipnet-journal.mjs';
const TASK='bch-blaze-chipnet-20261109';
const ROOT='/var/lib/docker/volumes/openbot-eval_openbot-data/_data/OpenBot/Shared/loop/'+TASK;
const ART=join(ROOT,'artifacts');
const RUNTIME=join(ROOT,'runtime');
const SECRET_DIR='/root/.secrets';
const SECRET=join(SECRET_DIR,'intentguard-bch-chipnet.env');
const JOURNAL=join(RUNTIME,'operation.jsonl');
const PIN='a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672';
const NETWORK='chipnet';
const sha=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const out=(value)=>process.stdout.write(JSON.stringify(value)+'\n');
// Third-party errors can carry input values. Never forward console/debug/exception text.
process.env.DEBUG='';
for(const method of ['log','error','warn','info','debug','trace','dir'])console[method]=()=>{};
process.on('unhandledRejection',()=>{out({code:'UNHANDLED_SDK_FAILURE',task:TASK});process.exit(1);});
process.setUncaughtExceptionCaptureCallback(()=>{out({code:'UNCAUGHT_FAILURE',task:TASK});process.exit(1);});
function privateDirectory(path,create=false) {
  if(!existsSync(path)&&create)mkdirSync(path,{mode:0o700});
  const s=lstatSync(path);
  if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o777)!==0o700||s.uid!==process.getuid())throw Error('PRIVATE_DIRECTORY_REFUSED');
}
function absent(path) {try{lstatSync(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw Error('DESTINATION_REFUSED');}}
function onlyKeys(value,allowed) {return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k));}
function assertShareable(invitation,stored,forbidden) {
  if(!onlyKeys(invitation,['invitationIdentifier','templateIdentifier','actionIdentifier','createdAtTimestamp','commits'])||invitation.templateIdentifier!==PIN||invitation.actionIdentifier!=='receive'||invitation.commits.length!==1)throw Error('UNSAFE_EXPORT_REFUSED');
  const c=invitation.commits[0];
  if(!onlyKeys(c,['commitIdentifier','previousCommitIdentifier','createdAtTimestamp','expiresAtTimestamp','data','entityIdentifier','signature'])||c.previousCommitIdentifier!==undefined||!c.entityIdentifier.startsWith('tpub')||!onlyKeys(c.data,['transactionVersion','transactionLocktime'])||stored.secretsByCommitIdentifier!==undefined)throw Error('UNSAFE_EXPORT_REFUSED');
  const text=JSON.stringify(invitation);
  if(/xprv|tprv|mnemonic|secretsByCommitIdentifier|privateKey/i.test(text)||forbidden.some(secret=>secret&&text.includes(secret)))throw Error('UNSAFE_EXPORT_REFUSED');
}
let state,owned=false,engine,cryptoIdentity,timer;
function advance(event,evidence={}) {
  const next=transition(state,event,evidence);
  appendJournal(JOURNAL,{task:TASK,event,at:new Date().toISOString(),state:next});
  state=next;
}
async function doctor() {
  // Metadata and public operation records only. No SDK, network or secret file read.
  if(absent(JOURNAL))return out({task:TASK,code:'NO_OPERATION',secretExists:!absent(SECRET)});
  privateDirectory(RUNTIME);
  const rows=readJournal(JOURNAL);
  if(rows.some(r=>r.task!==TASK)||rows.length<1)throw Error('PROVENANCE_REFUSED');
  const last=rows.at(-1);
  const secretMeta=absent(SECRET)?null:lstatSync(SECRET);
  out({task:TASK,code:last.state.phase==='verified'?'PUBLIC_EXPORT_READY':'RECONCILIATION_REQUIRED_NO_REPLAY',phase:last.state.phase,attempts:last.state.attempts,secretMode:secretMeta?(secretMeta.mode&0o777).toString(8):null,secretIsRegular:secretMeta?.isFile()===true,exportExists:!absent(join(ART,'invitation.json')),journalSha256:sha(readFileSync(JOURNAL))});
}
async function create(reconcile=false) {
  privateDirectory(SECRET_DIR);
  privateDirectory(RUNTIME,!reconcile);
  if(reconcile) {
    const rows=readJournal(JOURNAL);
    // Bind this exceptional continuation to the observed ORIGINAL journal, not caller flags.
    if(sha(readFileSync(JOURNAL))!=='6d4831e4edaf75067df74ec10573db4622d4a73cf1b3f9a445fb46149d07a5f1'||rows[0]?.operationId!=='6eb5e21e-c104-4ead-bb31-cb6d72819b6e'||rows.map(r=>r.event).join(',')!=='claim,persistSecret,secretReady,startEngine,crash'||rows.some(r=>r.task!==TASK||r.state.network!=='chipnet'||r.state.attempts!==0))throw Error('RECONCILIATION_REFUSED');
    state={...initialState(NETWORK),...rows.at(-1).state,engineStarts:1,unknownFrom:'connecting'};
  }else {
    if(!absent(JOURNAL))throw Error('OPERATION_ALREADY_OWNED_NO_REPLAY');
    if(!absent(join(RUNTIME,'engine')))throw Error('EXISTING_RUNTIME_REFUSED');
    state=transition(initialState(NETWORK),'claim',{fileAbsent:absent(SECRET)});
    createJournal(JOURNAL,{task:TASK,operationId:randomUUID(),event:'claim',at:new Date().toISOString(),state});
  }
  owned=true;
  process.umask(0o077);
  // A hard per-command safety bound; task duration itself is unlimited.
  timer=setTimeout(()=>{try{advance('crash');}catch{}out({task:TASK,code:'COMMAND_TIMEOUT_NO_REPLAY'});process.exit(1);},90000);
  const lib=await import('@bitauth/libauth');
  const cryptoSDK=await import('@xo-cash/crypto');
  const utils=await import('@xo-cash/utils');
  const {p2pkhTemplate}=await import('@xo-cash/templates');
  const {Engine,listVariableIdentifiersToGenerate}=await import('@xo-cash/engine');
  const {StorageType}=await import('@xo-cash/state');
  const {chipnetServersWithBlockchain}=await import('@electrum-cash/servers');
  const {electrumClients,stopElectrumNetwork}=await import('@electrum-cash/application');
  const {inspectInvitation}=await import('../../dist/preseason/xo/inspect.js');
  // Independent reviewed pin predates this export. Never derive trust from the produced Invitation.
  const templateJson=JSON.stringify(p2pkhTemplate);
  const template=utils.parseTemplate(templateJson);
  if(utils.generateTemplateIdentifier(template)!==PIN||listVariableIdentifiersToGenerate(template,'receive').length!==0)throw Error('TEMPLATE_PROVENANCE_REFUSED');
  if(chipnetServersWithBlockchain.length!==2||chipnetServersWithBlockchain.some(s=>!['chipnet.imaginary.cash','chipnet.bch.ninja'].includes(s.host)))throw Error('PEER_PROVENANCE_REFUSED');
  // Exactly one reviewed official WSS peer; retain its version and blockchain/checkpoint metadata.
  const peers=chipnetServersWithBlockchain.filter(s=>s.host==='chipnet.bch.ninja');
  const engineDirectory=join(RUNTIME,'engine');privateDirectory(engineDirectory,!reconcile);
  if(!absent(join(ART,'invitation.json'))||!absent(join(ART,'metadata.json')))throw Error('EXISTING_EXPORT_REFUSED');
  let mnemonic,recovered,entropy;
  if(!reconcile) {
    advance('persistSecret');
    entropy=randomBytes(32);
    const encoded=lib.encodeBip39Mnemonic(entropy);
    if(typeof encoded==='string')throw Error('ENTROPY_ENCODING_FAILED');
    mnemonic=encoded.phrase;
  }
  const fd=openSync(SECRET,reconcile?(constants.O_RDONLY|constants.O_NOFOLLOW):(constants.O_RDWR|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW),0o600);
  try {
    if(!reconcile){writeFileSync(fd,`OWN_TASK=${TASK}\nNETWORK=chipnet\nMNEMONIC=${mnemonic}\n`);fsyncSync(fd);}
    const m=fstatSync(fd);
    if(!m.isFile()||(m.mode&0o777)!==0o600||m.uid!==process.getuid()||m.nlink!==1||m.size>2048)throw Error('SECRET_MODE_REFUSED');
    // Read only the newly-created inode, or this journal-bound operation's own protected inode.
    const bytes=Buffer.alloc(m.size);let used=0;
    while(used<bytes.length){const n=readSync(fd,bytes,used,bytes.length-used,used);if(n===0)throw Error('RECOVERY_FAILED');used+=n;}
    const match=/^OWN_TASK=bch-blaze-chipnet-20261109\nNETWORK=chipnet\nMNEMONIC=([a-z ]+)\n$/.exec(bytes.toString('utf8'));
    if(!match)throw Error('RECOVERY_FAILED');recovered=match[1];bytes.fill(0);
  }finally{closeSync(fd);}
  if(!reconcile)syncDirectory(SECRET_DIR);
  const decoded=lib.decodeBip39Mnemonic(recovered);
  if(typeof decoded==='string'||decoded.length!==32||(!reconcile&&!timingSafeEqual(decoded,entropy)))throw Error('RECOVERY_FAILED');
  mnemonic=recovered;
  const seed=cryptoSDK.convertMnemonicToSeedBytes(recovered);
  cryptoIdentity=new cryptoSDK.Crypto(seed,{network:'testnet'});
  const pub=cryptoIdentity.derivePublicKey({templateIdentifier:PIN,derivationIndex:0});
  const address=lib.encodeCashAddress({prefix:'bchtest',type:'p2pkh',payload:lib.hash160(pub)}).address;
  const forbidden=[mnemonic,lib.binToHex(decoded),lib.binToHex(seed)];
  const identity={task:TASK,network:NETWORK,address,publicKey:lib.binToHex(pub),derivation:{sdk:'@xo-cash/crypto@0.0.5',networkEncoding:'testnet',templateIdentifier:PIN,derivationIndex:0},recoveryChecked:true,secretMode:'600',directoryMode:'700',fundingRequestedSatoshis:'0'};
  if(reconcile) {
    const original=JSON.parse(readFileSync(join(ART,'identity.json'),'utf8'));
    if(original.task!==TASK||original.network!==NETWORK||original.address!==address||original.publicKey!==identity.publicKey||identity.publicKey!=='025b4b395ef9a3612a2c78418d8b107fa01cb910d4a6a545ef6ff0175d33530d0c')throw Error('RECONCILIATION_REFUSED');
    publishExclusive(join(ART,'reconciliation.json'),JSON.stringify({task:TASK,operationId:'6eb5e21e-c104-4ead-bb31-cb6d72819b6e',originalJournalSha256:sha(readFileSync(JOURNAL)),sameOwnedIdentity:true,priorSigningAttempts:0,reason:'Original Engine returned before readiness guard; pinned ElectrumClient.hostIdentifier is hostname without port. No signing intent was recorded or invoked. One connection-stage continuation only.'},null,2)+'\n');
    advance('reconcileSession',{sameOwnedIdentity:true,historyProvesNoSign:true});
  }else {
    publishExclusive(join(ART,'identity.json'),JSON.stringify(identity,null,2)+'\n');
    advance('secretReady');advance('startEngine');
  }
  entropy?.fill(0);decoded.fill(0);seed.fill(0);
  engine=await Engine.create(recovered,{network:NETWORK,storageType:StorageType.INDEXEDDB,databasePath:engineDirectory+'/',databaseFilename:'IntentGuard-Q1B',electrumServers:peers,electrumApplicationIdentifier:'IntentGuard Q1B identity-only Chipnet',remoteEncryptedStateServers:[]});
  const connections=engine.listElectrumConnections();
  const ready=engine.network==='chipnet'&&connections.length===1&&connections.every(c=>c.isEncrypted===true&&c.status==='connected'&&c.hostIdentifier==='chipnet.bch.ninja');
  advance('engineReady',{networkReady:ready});
  // Any disconnect ends this operation; never permit the SDK's automatic reconnect loop.
  const onNetworkLost=()=>{try{advance('crash');}catch{}out({task:TASK,code:'NETWORK_LOST_NO_REPLAY'});process.exit(1);};
  for(const client of electrumClients.values())client.once('disconnected',onNetworkLost);
  publishExclusive(join(ART,'session.json'),JSON.stringify({task:TASK,network:NETWORK,connections,transport:'WSS, normal TLS verification',checkpointVerification:'official initializeElectrumNetwork/verifyElectrumClient completed',at:new Date().toISOString()},null,2)+'\n');
  if((await engine.listSecretData()).length!==0||(await engine.listInvitations()).length!==0||(await engine.listScriptHashes()).length!==0)throw Error('FRESH_STATE_REFUSED');
  const imported=await engine.importTemplate(templateJson);
  if(imported.templateIdentifier!==PIN)throw Error('TEMPLATE_PROVENANCE_REFUSED');
  const expiresAtTimestamp=Date.now()+24*60*60*1000;
  advance('startSign',{fresh:Date.now()<expiresAtTimestamp});
  // The sole live identity signature operation. No inputs, outputs, role, generate, or resolutions.
  const stored=await engine.createInvitation({templateIdentifier:PIN,actionIdentifier:'receive',expiresAtTimestamp});
  advance('signed');
  if((await engine.listSecretData()).length!==0||(await engine.listScriptHashes()).length!==0)throw Error('PRIVATE_STATE_REFUSED');
  // Inspect only this operation's owned runtime inside the secret-owning process.
  // Public receipts disclose the result, never file contents or derived account filenames.
  let scannedFiles=0;
  function scanOwnedRuntime(directory) {
    for(const name of readdirSync(directory)) {
      const path=join(directory,name),meta=lstatSync(path);
      if(meta.isSymbolicLink())throw Error('PRIVATE_STATE_REFUSED');
      if(meta.isDirectory()){scanOwnedRuntime(path);continue;}
      if(!meta.isFile()||meta.size>32*1024*1024)throw Error('PRIVATE_STATE_REFUSED');
      const bytes=readFileSync(path);scannedFiles++;
      if(bytes.includes(Buffer.from(mnemonic))||forbidden.slice(1).some(hex=>bytes.includes(Buffer.from(hex,'hex'))||bytes.includes(Buffer.from(hex))))throw Error('PRIVATE_STATE_REFUSED');
    }
  }
  scanOwnedRuntime(engineDirectory);
  publishExclusive(join(ART,'runtime-custody.json'),JSON.stringify({task:TASK,network:NETWORK,scannedFiles,knownSecretBytesAbsent:true,generatedTemplateSecrets:0,accountStorage:'INDEXEDDB official Node SQLite shim; no generated template secrets',directoryMode:'700'},null,2)+'\n');
  assertShareable(stored.invitation,stored,forbidden);
  const entity=cryptoIdentity.deriveInvitationEntityIdentifier({templateIdentifier:PIN,rootCommitIdentifier:stored.invitation.commits[0].commitIdentifier});
  if(entity!==stored.entityIdentifier||entity!==stored.invitation.commits[0].entityIdentifier)throw Error('IDENTITY_BINDING_REFUSED');
  const invitationJson=utils.serializeInvitation(stored.invitation);
  if(forbidden.some(s=>s&&invitationJson.includes(s))||/xprv|tprv|mnemonic|secretsByCommitIdentifier|privateKey/i.test(invitationJson))throw Error('UNSAFE_EXPORT_REFUSED');
  const report=inspectInvitation({templateJson,invitationJson,network:NETWORK,expectedTemplateIdentifier:PIN,now:Date.now()});
  if(report.status!=='REVIEW_REQUIRED'||report.canSign!==false||report.issues.length!==0)throw Error('OFFLINE_VERIFICATION_REFUSED');
  advance('checkPublic',{publicSafe:true,fresh:Date.now()<expiresAtTimestamp});
  publishExclusive(join(ART,'template.json'),templateJson);
  advance('startExport',{fresh:Date.now()<expiresAtTimestamp});
  publishExclusive(join(ART,'invitation.json'),invitationJson);
  advance('published');
  publishExclusive(join(ART,'metadata.json'),JSON.stringify({task:TASK,network:NETWORK,address,entityIdentifier:entity,invitationIdentifier:stored.invitation.invitationIdentifier,templateIdentifier:PIN,templateProvenance:'@xo-cash/templates@0.0.12 P2PKH; independent pin preseason/xo/README.md:38 at dd71e0e',templateSha256:sha(templateJson),exportSha256:sha(invitationJson),createdAtTimestamp:stored.invitation.createdAtTimestamp,expiresAtTimestamp,engine:'0.1.1-next.17778370827',secretSafeChecked:true,generatedTemplateSecrets:0,createInvitationCalls:state.attempts,transactionSignatures:0,broadcasts:0,fundingSatoshis:'0',status:'PRESEASON_IDENTITY_ONLY_NOT_EXECUTED'},null,2)+'\n');
  publishExclusive(join(ART,'in-process-inspection.json'),JSON.stringify(report,null,2)+'\n');
  advance('verified',{fresh:Date.now()<expiresAtTimestamp});
  cryptoIdentity.destroy();cryptoIdentity=undefined;
  // Stop owned network first. Disconnect listener is removed only for this intentional shutdown.
  for(const client of electrumClients.values())client.removeListener('disconnected',onNetworkLost);
  await stopElectrumNetwork();await engine.stop();engine=undefined;
  clearTimeout(timer);
  out({task:TASK,code:'PUBLIC_EXPORT_READY',network:NETWORK,address,exportSha256:sha(invitationJson),attempts:state.attempts,canSign:false});
  process.exit(0);
}
try {
  if(process.argv.length!==3||!['create','doctor','reconcile-session'].includes(process.argv[2]))throw Error('USAGE_CREATE_OR_DOCTOR');
  if(process.argv[2]==='doctor')await doctor();else await create(process.argv[2]==='reconcile-session');
}catch(error){
  if(owned){try{advance('crash');}catch{}}
  cryptoIdentity?.destroy();clearTimeout(timer);
  const ownCodes=new Set(['RECONCILIATION_REFUSED','PRIVATE_DIRECTORY_REFUSED','DESTINATION_REFUSED','PROVENANCE_REFUSED','EXISTING_SECRET_REFUSED','OPERATION_ALREADY_OWNED_NO_REPLAY','EXISTING_RUNTIME_REFUSED','EXISTING_EXPORT_REFUSED','TEMPLATE_PROVENANCE_REFUSED','PEER_PROVENANCE_REFUSED','ENTROPY_ENCODING_FAILED','SECRET_MODE_REFUSED','RECOVERY_FAILED','NETWORK_REFUSED','FRESH_STATE_REFUSED','PRIVATE_STATE_REFUSED','UNSAFE_EXPORT_REFUSED','IDENTITY_BINDING_REFUSED','OFFLINE_VERIFICATION_REFUSED','EXPIRY_REFUSED','USAGE_CREATE_OR_DOCTOR']);
  out({task:TASK,code:ownCodes.has(error?.message)?error.message:'OWNED_OPERATION_FAILED_NO_REPLAY',phase:state?.phase??'unclaimed'});
  process.exit(1);
}
