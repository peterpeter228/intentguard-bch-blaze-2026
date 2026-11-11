import { mkdir, copyFile, writeFile, readdir, stat, readFile, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'esbuild';

const out = resolve('dist/production');
await rm(out, { recursive: true, force: true }); // Generated owned output only; never carry stale assets.
await mkdir(join(out, 'public'), { recursive: true });
for (const [source, target] of [['core/index.html', 'index.html'], ['core/payment.html', 'pay.html'], ['core/request.html', 'request.html'], ['core/style.css', 'style.css'],
  ['dist/core/app.js', 'app.js'], ['dist/core/request.js', 'request.js'], ['dist/core/payment.js', 'payment.js']]) await copyFile(source, join(out, 'public', target));
const bannerPath = join(out, 'public/index.html');
let banner = await readFile(bannerPath, 'utf8');
for (const [field, decided] of Object.entries({ SLIDES_URL: '<a href="https://docs.google.com/presentation/d/1TwJWG2ECG8dBk-DYNTwLw9T35JaWD5BTvXSxTPKQVIk/edit?usp=sharing">Introduction slides</a>',
  EMBER2026_ADDRESS: 'bitcoincash:zzkuruucxhqr7sx77ee8uyvvagw7atrf3520fhy2ds', OLD_REPO_URL: 'https://github.com/peterpeter228/intentguard-bch (private)',
  NEW_REPO_URL: 'Owner will specify public contest repository after contest starts' })) banner = banner.replace('TODO_OWNER_' + field, decided);
banner = banner.replace('Owner-controlled fields are missing.', 'Pre-hackathon demo URL remains owner-pending.');
await writeFile(bannerPath, banner);
await build({ entryPoints: ['core/server.ts'], outfile: join(out, 'server.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', legalComments: 'eof' });
for (const name of ['package.json', 'package-lock.json']) await copyFile(name, join(out, name));
await mkdir(join(out, 'notices'), { recursive: true });
for (const source of ['review/post-argon/LICENSE-WizardConnect-upstream.txt', 'review/post-argon/license-evidence.json', 'preseason/xo/fixtures/LICENSE-XO.txt']) await copyFile(source, join(out, 'notices', source.split('/').at(-1)));
await writeFile(join(out, 'RUNTIME.md'), `# Runtime contract — PRESEASON\n\nNode24 plus locked production dependencies. Dockerfile retains runtime dependencies and notices only; verify the official base image digest before deployment.\n\nVercel publishes ONLY public/ with the repository vercel.json exact HTTPS API rewrites. Railway uses a single writer with /data/intentguard-payments (0700), payments.sqlite (0600). Set INTENTGUARD_MODE=public-demo, PORT=8080, INTENTGUARD_PUBLIC_ROOT=./public and INTENTGUARD_PAYMENT_DIR=/data/intentguard-payments. No wallet credentials in either cloud. Public API allows config/read/get only; mainnet cap0, offline unsigned builds only.\n\nFirst private bootstrap ONLY: node server.mjs --create-payment-journal. Creation is exclusive, not an automatic missing-store fallback. Prepare the separately labelled unsigned persistence draft through loopback HTTP, stop, then deploy with strict node server.mjs in public-demo mode. Update startCommand AND redeploy before the restart proof: restarting the initial deployment would repeat its create flag. Missing/corrupt/unsafe stores refuse; never repair/reset UNKNOWN. Persist the SAME volume and directory.\n\nDefault private-loopback binds 127.0.0.1:8788. PORT is validated in either mode; public-demo binds 0.0.0.0 and permits only the two frozen production HTTPS authorities. Forwarded headers grant no authority. No wildcard CORS, bootstrap route, signer or key endpoint. LGPL/upstream notices retained. Local smoke is not public browser, persistence or payment evidence.\n`);
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
