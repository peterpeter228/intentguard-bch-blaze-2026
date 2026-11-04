import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawn} from 'node:child_process';
import http from 'node:http';
const base='http://127.0.0.1:8787';
test('loopback API, origin, redaction module, Unicode and interrupted-upload regression',async()=>{
 const server=spawn(process.execPath,['dist/preseason/xo/server.js'],{stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
  const page=await fetch(base);assert.equal(page.status,200);assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.ok((await page.text()).includes('type="module"'));
  assert.equal((await fetch(base+'/redact.mjs')).status,200);
  const fixture=await(await fetch(base+'/fixture')).json();
  const send=(body,headers={})=>fetch(base+'/inspect',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  const result=await(await send(fixture)).json();assert.equal(result.status,'REJECTED');assert.equal(result.canSign,false);
  assert.equal((await send(fixture,{Origin:'https://evil.example'})).status,403);
  assert.equal((await send(fixture,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await send({})).status,400);
  assert.equal((await fetch(base+'/package.json')).status,404);
  const template=JSON.parse(fixture.templateJson);template.name='中文 UTF-8';fixture.templateJson=JSON.stringify(template);
  const bytes=Buffer.from(JSON.stringify(fixture));const split=bytes.indexOf(Buffer.from('中'))+1;
  const unicode=await new Promise((resolve,reject)=>{const req=http.request(base+'/inspect',{method:'POST',headers:{'Content-Type':'application/json'}},res=>{let raw='';res.on('data',x=>raw+=x);res.on('end',()=>resolve(JSON.parse(raw)));});req.on('error',reject);req.write(bytes.subarray(0,split));setTimeout(()=>req.end(bytes.subarray(split)),20);});
  const whole=await(await send(fixture)).json();assert.equal(unicode.templateIdentifier,whole.templateIdentifier);assert.ok(unicode.templateIdentifier);
  const invalid=await fetch(base+'/inspect',{method:'POST',headers:{'Content-Type':'application/json'},body:Buffer.from([123,34,0xff,34,58,49,125])});assert.equal(invalid.status,400);
  await new Promise(resolve=>{const req=http.request(base+'/inspect',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'10000'}});req.on('error',()=>resolve());req.write('{');setTimeout(()=>{req.destroy();resolve();},20);});
  await new Promise(r=>setTimeout(r,50));assert.equal((await fetch(base)).status,200);
 }finally{server.kill();}
});
