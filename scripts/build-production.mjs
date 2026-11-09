import { mkdir, copyFile, writeFile, readdir, stat, readFile, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'esbuild';

const out = resolve('dist/production');
await rm(out, { recursive: true, force: true }); // Generated owned output only; never carry stale assets.
await mkdir(join(out, 'public'), { recursive: true });
for (const [source, target] of [['core/index.html', 'index.html'], ['core/payment.html', 'pay.html'], ['core/request.html', 'request.html'], ['core/style.css', 'style.css'],
  ['dist/core/app.js', 'app.js'], ['dist/core/request.js', 'request.js'], ['dist/core/payment.js', 'payment.js']]) await copyFile(source, join(out, 'public', target));
await build({ entryPoints: ['core/server.ts'], outfile: join(out, 'server.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', legalComments: 'eof' });
for (const name of ['package.json', 'package-lock.json']) await copyFile(name, join(out, name));
await mkdir(join(out, 'notices'), { recursive: true });
for (const source of ['review/post-argon/LICENSE-WizardConnect-upstream.txt', 'review/post-argon/license-evidence.json', 'preseason/xo/fixtures/LICENSE-XO.txt']) await copyFile(source, join(out, 'notices', source.split('/').at(-1)));
await writeFile(join(out, 'RUNTIME.md'), `# Runtime contract — PRESEASON, no deployment\n\nNode >=24 plus locked production dependencies (not bundled). From THIS directory:\n\nnpm ci --omit=dev --ignore-scripts --no-fund --no-audit\nnpm rebuild sqlite3 better-sqlite3\nINTENTGUARD_PUBLIC_ROOT=./public INTENTGUARD_PAYMENT_DIR=/absolute/private/new-journal node server.mjs --create-payment-journal\n\nUse task-local npm cache/HOME/headers in restricted hosts. First creation is exclusive. On restart OMIT --create-payment-journal; missing/corrupt stores refuse to open. Loopback127.0.0.1:8788 ONLY; do not expose/deploy. Persist the private journal directory on local durable disk with backups and single writer. Do not replace/reset on UNKNOWN. No ephemeral-serverless SQLite durability claim. No server wallet or secret endpoint. Mainnet cap0. Browser wallet credentials memory-only. No test signer/account/DB in this distribution. LGPL and upstream notices retained; review distribution/IP before public release.\n`);
const files = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.name !== 'manifest.json') files.push({ path: relative(out, path), bytes: (await stat(path)).size });
  }
}
await scan(out); files.sort((a, b) => a.path.localeCompare(b.path));
const dependencies = JSON.parse(await readFile('package.json', 'utf8')).dependencies;
const manifest = { kind: 'PRODUCTION_DISTRIBUTION', files, totalBytes: files.reduce((n, f) => n + f.bytes, 0), externalRuntime: { node: '>=24', dependencies, nativeRebuild: ['sqlite3', 'better-sqlite3'], dependencyBytes: 'record separately from installed runtime' }, deployment: 'NOT_PERFORMED' };
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
