import {open} from 'node:fs/promises';
async function readBounded(path:string):Promise<string>{const file=await open(path,'r');try{const bytes=Buffer.alloc(262145);let used=0;while(used<bytes.length){const r=await file.read(bytes,used,bytes.length-used,null);if(r.bytesRead===0)break;used+=r.bytesRead;}if(used>262144)throw new Error('Document exceeds256KiB');return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used));}finally{await file.close();}}
import {inspectInvitation} from './inspect.js';
import {fixtureInput} from './fixture.js';
const args=process.argv.slice(2);
if(args.length===1 && args[0]==='--synthetic') {
 console.log(JSON.stringify(inspectInvitation(fixtureInput()),null,2));
} else if(args.length===4 && (args[2]==='chipnet'||args[2]==='mainnet')) {
 try {console.log(JSON.stringify(inspectInvitation({templateJson:await readBounded(args[0]!),invitationJson:await readBounded(args[1]!),network:args[2],expectedTemplateIdentifier:args[3]!,now:Date.now()}),null,2));} catch {console.error('Unable to read local input files.');process.exitCode=1;}
} else { console.error('Usage: npm run xo:inspect -- <template.json> <invitation.json> <chipnet|mainnet> <independently-reviewed-template-hash>\nOr: npm run xo:inspect -- --synthetic\nLocal read-only inspection only; never payment approval.'); process.exitCode=2; }
