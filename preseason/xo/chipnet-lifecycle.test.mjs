import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,lstatSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {initialState,transition} from './chipnet-lifecycle.mjs';
import {createJournal,readJournal,publishExclusive} from './chipnet-journal.mjs';
const good={fileAbsent:true,networkReady:true,fresh:true,publicSafe:true};
const events=['claim','persistSecret','secretReady','startEngine','engineReady','startSign','signed','checkPublic','startExport','published','verified'];
function through(last){let s=initialState('chipnet');for(const event of events){s=transition(s,event,good);if(event===last)break;}return s;}
test('identity-only gate refuses other networks, existing files, unavailable network, unsafe bytes and expiry',()=>{
  assert.throws(()=>transition(initialState('mainnet'),'claim',good),/CHIPNET_REQUIRED/);
  assert.throws(()=>transition(initialState('chipnet'),'claim',{...good,fileAbsent:false}),/EXISTING_SECRET_REFUSED/);
  assert.throws(()=>transition(through('startEngine'),'engineReady',{...good,networkReady:false}),/NETWORK_REFUSED/);
  assert.throws(()=>transition(through('engineReady'),'startSign',{...good,fresh:false}),/EXPIRY_REFUSED/);
  assert.throws(()=>transition(through('signed'),'checkPublic',{...good,publicSafe:false}),/UNSAFE_EXPORT_REFUSED/);
  assert.throws(()=>transition(through('checkPublic'),'startExport',{...good,fresh:false}),/EXPIRY_REFUSED/);
  assert.throws(()=>transition(through('published'),'verified',{...good,fresh:false}),/EXPIRY_REFUSED/);
  const s=through('verified');assert.equal(s.attempts,1);assert.equal(s.published,true);assert.equal(s.verified,true);
  assert.throws(()=>transition(s,'startSign',good),/OPERATION_REPLAY_REFUSED/);
});
test('connection-only reconciliation requires same owned identity, zero signing history and is allowed once',()=>{
  const interrupted=transition(through('startEngine'),'crash');
  assert.throws(()=>transition(interrupted,'reconcileSession',{}),/RECONCILIATION_REFUSED/);
  const proof={sameOwnedIdentity:true,historyProvesNoSign:true};
  const continued=transition(interrupted,'reconcileSession',proof);
  assert.equal(continued.engineStarts,2);assert.equal(continued.attempts,0);assert.equal(continued.reconciled,true);
  assert.throws(()=>transition(transition(continued,'crash'),'reconcileSession',proof),/RECONCILIATION_REFUSED/);
  const uncertainSignature=transition(through('startSign'),'crash');
  assert.throws(()=>transition(uncertainSignature,'reconcileSession',proof),/RECONCILIATION_REFUSED/);
  assert.throws(()=>transition(transition(through('secretReady'),'crash'),'reconcileSession',proof),/RECONCILIATION_REFUSED/);
});

test('SIGKILL between persistence, signing and export never permits reclaiming the journal',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chipnet-public-crash-'));
  try {
    for(const stop of ['persistSecret','secretReady','startSign','signed','startExport','published']) {
      const journal=join(dir,stop+'.jsonl');
      const code=`import {initialState,transition} from ${JSON.stringify(new URL('./chipnet-lifecycle.mjs',import.meta.url).href)};
import {createJournal,appendJournal,publishExclusive} from ${JSON.stringify(new URL('./chipnet-journal.mjs',import.meta.url).href)};
let state=initialState('chipnet');const good=${JSON.stringify(good)};
createJournal(process.argv[1],{state});
for(const event of ${JSON.stringify(events)}){state=transition(state,event,good);appendJournal(process.argv[1],{state});if(event==='secretReady')publishExclusive(process.argv[1]+'.public-marker','NOT_A_SECRET');if(event==='published')publishExclusive(process.argv[1]+'.public-export','PUBLIC_EXPORT');if(event===process.argv[2])process.kill(process.pid,'SIGKILL');}`;
      const child=spawnSync(process.execPath,['--input-type=module','-e',code,journal,stop],{encoding:'utf8',timeout:3000});
      assert.equal(child.signal,'SIGKILL',child.stderr);
      const before=readFileSync(journal);const saved=readJournal(journal).at(-1).state;
      assert.equal(saved.phase,through(stop).phase);assert.ok(saved.attempts<=1);
      assert.throws(()=>createJournal(journal,{state:initialState('chipnet')}),{code:'EEXIST'});
      assert.deepEqual(readFileSync(journal),before);
      const quarantined=transition(saved,'crash');assert.equal(quarantined.phase,'unknown');
      assert.deepEqual(transition(quarantined,'doctor'),quarantined);
      assert.throws(()=>transition(quarantined,'startSign',good),/OPERATION_REPLAY_REFUSED/);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('exclusive public publication survives and refuses replacement without changing original bytes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chipnet-public-export-'));
  try {
    const file=join(dir,'invitation');publishExclusive(file,'PUBLIC_ORIGINAL');
    assert.equal(readFileSync(file,'utf8'),'PUBLIC_ORIGINAL');assert.equal(lstatSync(file).mode&0o777,0o600);
    assert.throws(()=>publishExclusive(file,'PUBLIC_REPLACEMENT'),{code:'EEXIST'});
    assert.equal(readFileSync(file,'utf8'),'PUBLIC_ORIGINAL');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
