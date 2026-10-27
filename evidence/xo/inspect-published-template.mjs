import { p2pkhTemplate as t } from './templates-0.0.1/package/dist/index.mjs';
import { writeFileSync } from 'node:fs';
const actions=Object.entries(t.actions??{}).map(([name,a])=>({name,transaction:a.transaction,transactionExists:typeof a.transaction==='string'?Object.hasOwn(t.transactions??{},a.transaction):null}));
const result={observedAt:new Date().toISOString(),scope:'Published official example module import and action-reference smoke check only; NOT official schema validation, engine execution, wallet, or chain test',synthetic:false,package:'@xo-cash/templates@0.0.1',keys:Object.keys(t),actions,importPassed:true,actionReferencesPassed:actions.length>0&&actions.filter(a=>a.transaction!==undefined).every(a=>a.transactionExists)};
writeFileSync(new URL('./template-smoke-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
