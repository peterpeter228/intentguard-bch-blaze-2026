import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const cli=(...args)=>spawnSync(process.execPath,['dist/preseason/xo/cli.js',...args],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
test('CLI synthetic command succeeds but report rejects and never permits signing',()=>{const r=cli('--synthetic');assert.equal(r.status,0);const report=JSON.parse(r.stdout);assert.equal(report.status,'REJECTED');assert.equal(report.canSign,false);assert.ok(report.issues.some(x=>x.code==='EMPTY_INVITATION'));});
test('CLI rejects invalid arguments without exposing local file contents',()=>{const r=cli();assert.equal(r.status,2);assert.ok(r.stderr.includes('Usage'));});
test('CLI bounds input bytes and rejects malformed UTF8 and missing files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'intentguard-cli-'));
 try{
  const small=join(dir,'small.json'),large=join(dir,'large.json'),invalid=join(dir,'invalid.json');
  await writeFile(small,'{}');await writeFile(large,' '.repeat(262145));await writeFile(invalid,Buffer.from([0xff]));
  for(const path of [large,invalid,join(dir,'missing.json')]){const r=cli(path,small,'chipnet','a'.repeat(64));assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(r.stderr.includes('Unable to read'));assert.ok(!r.stderr.includes(path));}
  // Exactly the byte cap is readable but invalid JSON fails the schema, not I/O.
  await writeFile(large,' '.repeat(262142)+'{}');const r=cli(large,small,'chipnet','a'.repeat(64));assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).canSign,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
