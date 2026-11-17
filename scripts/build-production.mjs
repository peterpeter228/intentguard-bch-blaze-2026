import { mkdir, copyFile, cp, writeFile, readdir, stat, readFile, rm } from 'node:fs/promises';
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
  SOURCE_REPO_URL: '<a href="https://github.com/peterpeter228/intentguard-bch-blaze-2026">BCH BLAZE 2026 contest repository target</a> (publication not yet verified)',
  NEW_REPO_URL: '<a href="https://github.com/peterpeter228/intentguard-bch-blaze-2026">https://github.com/peterpeter228/intentguard-bch-blaze-2026</a> (target for an independent contest copy from baseline 78e6ab6b; publication not yet verified)',
  PRE_HACK_DEMO_URL: '<a href="https://intentguard-pdyx17t6x-peterpeter228s-projects.vercel.app/">Pre-event offline demonstration</a> — not mainnet-usable' })) banner = banner.replaceAll('TODO_OWNER_' + field, decided);
if (banner.includes('TODO_OWNER_')) throw Error('UNRESOLVED_OWNER_PLACEHOLDER');
await writeFile(bannerPath, banner);
await build({ entryPoints: ['core/server.ts'], outfile: join(out, 'server.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', legalComments: 'eof' });
for (const name of ['package.json', 'package-lock.json']) await copyFile(name, join(out, name));
for (const target of ['public/notices', 'notices']) await cp('notices', join(out, target), { recursive: true });
await writeFile(join(out, 'RUNTIME.md'), `# Runtime contract — visitor-wallet increment\n\nNode24 with locked production dependencies and retained LGPL/third-party notices. Vercel publishes public/ using exact API rewrites and /payment.js -> /visitor-payment.js. Railway startup: INTENTGUARD_MODE=visitor-wallet PORT=8080 INTENTGUARD_PUBLIC_ROOT=./public node server.mjs. No server wallet or journal open/create/migrate. Existing INTENTGUARD_PAYMENT_DIR is ignored in visitor mode; --create-payment-journal is refused. Do not run any bootstrap or original-volume experiment. Browser IndexedDB stores public operation/input reservations only; deletion/rollback/other origins/devices defeat global duplicate prevention.\n\nThe complete repo-root notices/ tree is copied to public/notices/ and notices/. The server exposes /notices, /notices/, /notices/index.html, and the exact listed notice filenames; unlisted notice paths are not served by the server. GET /health reports status, mode and the zero mainnet cap. GET /api/payment-config returns the configured flow's public config and mode, or 503 PAYMENT_JOURNAL_REQUIRED when no flow exists.\n\nRollback only to a previously accepted STATELESS visitor artifact with the same environment. Reverting to historical public-demo journal startup is NOT a volume-safe authorized rollback. Keep the original volume untouched. No deployment here; exact-candidate acceptance and separate owner approval for the exact main change and production deployment are required.\n\nLegacy private-loopback and historical public-demo remain separate, explicitly configured paths; their journals never authorize visitor mainnet effects. HTTPS Host/Origin allowlists remain; Railway's health-check Host is admitted only for GET /health and GET /pay. No arbitrary proxy, wildcard CORS, key endpoint or automatic broadcast. After visitor confirmation, sign-only (broadcast:false), full-byte verification and a separate delivery approval, the app may relay identical signed bytes once to a fixed mainnet node; alternatively the visitor may select exclusive Electron Cash native handoff. The server independently rebuilds and verifies the plan using fresh sources but cannot attest human confirmation. Per-process dedupe is not durable across restarts/instances; retained browser reservations are not global exactly-once. Cancellation after relay begins cannot recall bytes already sent. Outcome stays UNKNOWN until fresh original-hash observations. No live wallet/payment evidence implied.\n`);
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
const manifest = { kind: 'PRODUCTION_DISTRIBUTION', files, totalBytes: files.reduce((n, f) => n + f.bytes, 0), notices: { publishedDirectory: 'public/notices', retainedDirectory: 'notices', entryPoint: '/notices/' }, externalRuntime: { node: '>=24', dependencies, nativeRebuild: ['sqlite3', 'better-sqlite3'], dependencyBytes: 'record separately from installed runtime' }, deployment: 'NOT_PERFORMED' };
await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
