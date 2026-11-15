import { mkdir, copyFile, writeFile, readdir, stat, readFile, rm } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { build } from 'esbuild';

const out = resolve('dist/production');
await rm(out, { recursive: true, force: true }); // Generated owned output only; never carry stale assets.
await mkdir(join(out, 'public'), { recursive: true });
for (const [source, target] of [['core/index.html', 'index.html'], ['core/payment.html', 'pay.html'], ['core/request.html', 'request.html'], ['core/style.css', 'style.css'],
  ['dist/core/app.js', 'app.js'], ['dist/core/request.js', 'request.js'], ['dist/core/payment.js', 'payment.js'], ['dist/core/visitor-payment.js', 'visitor-payment.js']]) await copyFile(source, join(out, 'public', target));
const bannerPath = join(out, 'public/index.html');
let banner = await readFile(bannerPath, 'utf8');
for (const [field, decided] of Object.entries({ SLIDES_URL: '<a href="https://docs.google.com/presentation/d/1TwJWG2ECG8dBk-DYNTwLw9T35JaWD5BTvXSxTPKQVIk/edit?usp=sharing">Introduction slides</a>',
  EMBER2026_ADDRESS: 'bitcoincash:zzkuruucxhqr7sx77ee8uyvvagw7atrf3520fhy2ds', OLD_REPO_URL: 'https://github.com/peterpeter228/intentguard-bch (private)',
  NEW_REPO_URL: 'peterpeter228/intentguard-bch-blaze-2026 — post-kickoff placeholder; not yet created or published',
  PRE_HACK_DEMO_URL: '<a href="https://intentguard-pdyx17t6x-peterpeter228s-projects.vercel.app/">Pre-event offline demonstration</a> — not mainnet-usable' })) banner = banner.replace('TODO_OWNER_' + field, decided);
banner = banner.replace('Owner-controlled fields are missing.', 'Owner-selected fixed pre-event offline demonstration; not contest-period work.');
await writeFile(bannerPath, banner);
await build({ entryPoints: ['core/server.ts'], outfile: join(out, 'server.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', legalComments: 'eof' });
for (const name of ['package.json', 'package-lock.json']) await copyFile(name, join(out, name));
await mkdir(join(out, 'notices'), { recursive: true });
for (const source of ['review/post-argon/LICENSE-WizardConnect-upstream.txt', 'review/post-argon/license-evidence.json', 'preseason/xo/fixtures/LICENSE-XO.txt']) await copyFile(source, join(out, 'notices', source.split('/').at(-1)));
await writeFile(join(out, 'RUNTIME.md'), `# Runtime contract — visitor-wallet increment\n\nNode24 with locked production dependencies and retained LGPL/third-party notices. Vercel publishes public/ using exact API rewrites and /payment.js -> /visitor-payment.js. Railway startup: INTENTGUARD_MODE=visitor-wallet PORT=8080 INTENTGUARD_PUBLIC_ROOT=./public node server.mjs. No server wallet, mainnet sender or journal open/create/migrate. Existing INTENTGUARD_PAYMENT_DIR is ignored in visitor mode; --create-payment-journal is refused. Do not run any bootstrap or original-volume experiment. Browser IndexedDB stores public operation/input reservations only; deletion/rollback/other origins/devices defeat global duplicate prevention.\n\nRollback only to a previously accepted STATELESS visitor artifact with the same environment. Reverting to historical public-demo journal startup is NOT a volume-safe authorized rollback. Keep original volume untouched. No deployment here; exact-candidate independent acceptance and owner main-change gate required.\n\nLegacy private-loopback and historical public-demo remain separate, explicitly configured paths; their journals never authorize visitor mainnet effects. HTTPS Host/Origin allowlists and GET /pay-only Railway health Host admission remain. No arbitrary proxy, wildcard CORS, key endpoint or auto-broadcast. Visitor signs once with broadcast:false, exact bytes checked before explicit Electron Cash4.4.6.1 native handoff; app/server never executes that command. Handoff is UNKNOWN until fresh original-hash observations. No live wallet/payment evidence implied.\n`);
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
