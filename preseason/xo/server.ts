/** Loopback-only preview; no wallet API, remote RPC, accounts, cookies, or state writes. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {inspectInvitation} from './inspect.js';
import {fixtureInput} from './fixture.js';
const port=8787;
createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
 const finish=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(req.headers.host!==`127.0.0.1:${port}` && req.headers.host!==`localhost:${port}`){finish(403,{error:'Loopback host required'});return;}
 if(req.method==='GET' && req.url==='/fixture'){finish(200,fixtureInput());return;}
 if(req.method==='POST' && req.url==='/inspect'){
  if(req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin)){finish(403,{error:'Cross-origin request refused'});return;}
  if(req.headers['content-type']!=='application/json'){finish(415,{error:'Use application/json'});return;}
  try {
  const chunks:Buffer[]=[];let bytes=0;for await(const part of req){const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);bytes+=chunk.length;if(bytes>600000){finish(413,{error:'Input too large'});return;}chunks.push(chunk);}
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));
  const input:unknown=JSON.parse(raw);if(!input || typeof input!=='object')throw new Error();const data=input as Record<string,unknown>;if(typeof data.templateJson!=='string'||typeof data.invitationJson!=='string'||typeof data.expectedTemplateIdentifier!=='string'||(data.network!=='chipnet'&&data.network!=='mainnet'))throw new Error();finish(200,inspectInvitation({templateJson:data.templateJson,invitationJson:data.invitationJson,expectedTemplateIdentifier:data.expectedTemplateIdentifier,network:data.network,now:Date.now()}));}catch{if(!res.destroyed && !res.writableEnded)finish(400,{error:'Invalid or interrupted request'});}return;
 }
 const paths:Record<string,[string,string]>={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/redact.mjs':['redact.mjs','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
 const file=paths[req.url??''];if(req.method!=='GET'||!file){finish(404,{error:'Not found'});return;}
 try{res.writeHead(200,{'Content-Type':file[1]});res.end(await readFile(new URL(`../../../preseason/xo/${file[0]}`,import.meta.url)));}catch{res.end('Preview file unavailable');}
}).listen(port,'127.0.0.1',()=>console.log(`Local offline inspector: http://127.0.0.1:${port}. Not a payment app.`));
