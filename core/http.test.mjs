import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
test('local core serves WASM-capable static UI without API, external connections or JavaScript eval',async()=>{
 const server=spawn(process.execPath,['dist/core/server.js'],{stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),5000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before ready'));});});
  for(const path of ['/','/app.js','/style.css','/request','/request.js']){const response=await fetch('http://127.0.0.1:8788'+path);assert.equal(response.status,200);const csp=response.headers.get('content-security-policy');assert(csp.includes("'wasm-unsafe-eval'"));assert(!csp.includes("'unsafe-eval'"));assert(csp.includes("connect-src 'none'"));assert.equal(response.headers.get('cache-control'),'no-store');}
  assert.equal((await fetch('http://127.0.0.1:8788/missing')).status,404);
  assert.equal((await fetch('http://127.0.0.1:8788/',{method:'POST'})).status,404);
 }finally{server.kill();}
});
