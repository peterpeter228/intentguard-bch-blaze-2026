import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { drivePayment } from '../../../../core/payment-http.test.mjs';
const destination = resolve(process.argv[2] ?? process.env.PAYMENT_EVIDENCE_DIR ?? 'dist/payment-evidence-' + Date.now());
await mkdir(destination); // exclusive: preserve earlier proof
const startedAt = new Date().toISOString();
const success = await drivePayment();
const uncertain = await drivePayment({ loss: true });
const evidence = { startedAt, finishedAt: new Date().toISOString(), success, uncertain, visualProof: 'PARENT_EMBEDDED_BROWSER_REQUIRED', liveWallet: 'NOT_RUN', publicTransaction: 'NONE' };
await writeFile(destination + '/empirical.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(await readFile(destination + '/empirical.json', 'utf8'));
