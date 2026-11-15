import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { drivePayment, driveUnsignedRevision } from '../../../../core/payment-http.test.mjs';
import { visitorModel } from './visitor-model.mjs';

const destination = resolve(process.argv[2] ?? 'dist/payment-model-' + Date.now());
await mkdir(destination);
// Execute the concrete HTTP/SQLite/SDK path before constructing the bounded abstraction.
const concrete = [await driveUnsignedRevision(), await drivePayment(), await drivePayment({ loss: true })];
const states = [], ids = new Map(), edges = [], starts = [];
const add = state => { const key = JSON.stringify(state); if (!ids.has(key)) { ids.set(key, states.length); states.push(state); } return ids.get(key); };
for (const network of ['chipnet', 'mainnet']) for (const mode of ['private-loopback', 'public-demo']) for (const store of ['absent', 'healthy', 'unsafe']) starts.push(add({ network, mode, store, served: false, created: false, phase: 'STARTUP', confirmed: false, edits: 0, restarted: false, callbacks: 0,
  signReserved: false, signCalls: 0, valid: false, hash: false, sendReserved: false, sendCalls: 0, unknown: false, unknownSends: 0 }));
for (let i = 0; i < states.length; i++) {
  if (states.length > 5000) throw Error('MODEL_SCOPE_EXCEEDED');
  const s = states[i], edge = (action, changes) => edges.push({ from: i, to: add({ ...s, ...changes }), action });
  // Existing strict PaymentJournal create/open; no unsafe/missing reopen repair.
  if (s.phase === 'STARTUP') {
    if (s.store === 'healthy') edge('StrictOpenExisting', { phase: 'DRAFT', served: true });
    else edge('RefuseMissingOrUnsafeOpen', { phase: 'STOPPED' });
    if (s.store === 'absent' && s.mode === 'private-loopback') edge('ExplicitExclusiveCreate', { phase: 'DRAFT', store: 'healthy', served: true, created: true });
  }
  // UI invalidates terms; reconfirmed build uses PaymentFlow.revise and
  // PaymentJournal.reviseUnsigned CAS with retained capability/economic ID.
  if (s.phase === 'DRAFT') edge('ConfirmTerms', { phase: 'CONFIRMED', confirmed: true });
  if (s.phase === 'CONFIRMED' && !s.signReserved && s.mode === 'private-loopback') edge(s.edits ? 'ReviseUnsignedPreflight' : 'BuildPreflight', { phase: 'PREFLIGHTED' });
  if (['CONFIRMED', 'PREFLIGHTED'].includes(s.phase) && s.edits === 0) edge('EditTerms', { phase: 'DRAFT', confirmed: false, edits: 1 });
  // PaymentFlow.reserve -> FULL-sync journal commit, separate from adapter.sendSignRequest.
  if (s.phase === 'PREFLIGHTED' && s.network === 'chipnet' && !s.signReserved) edge('ReserveSignature', { phase: 'SIGNING', signReserved: true });
  if (s.phase === 'SIGNING' && !s.signCalls && !s.restarted) edge('SdkSignEffect', { signCalls: 1 });
  if (s.phase === 'SIGNING' && s.signCalls && s.callbacks < 2) {
    edge('CheckedCallback', { phase: 'POSTCHECKED', valid: true, hash: true, callbacks: s.callbacks + 1 });
    edge('BadBytesOrSignature', { phase: 'NEEDS_REVIEW', valid: false, hash: true, callbacks: s.callbacks + 1 });
  }
  if (['SIGNING', 'POSTCHECKED'].includes(s.phase)) edge('CancelOrStale', { phase: 'UNKNOWN', unknown: true, unknownSends: s.sendCalls });
  if (s.phase === 'UNKNOWN' && s.signCalls && !s.hash && s.callbacks < 2) edge('LateQuarantinedCallback', { phase: 'NEEDS_REVIEW', hash: true, callbacks: s.callbacks + 1 });
  if (s.hash && s.callbacks === 1) edge('DuplicateCallbackRefused', { callbacks: 2 });
  // PaymentFlow.broadcast: fresh evidence+crypto -> durable BROADCASTING -> ONE RPC effect.
  if (s.phase === 'POSTCHECKED' && !s.sendReserved) edge('ReserveBroadcast', { phase: 'BROADCASTING', sendReserved: true });
  if (s.phase === 'BROADCASTING' && !s.sendCalls && !s.restarted) edge('RpcSendEffect', { sendCalls: 1 });
  if (s.phase === 'BROADCASTING') edge('SendResponseLost', { phase: 'UNKNOWN', unknown: true, unknownSends: s.sendCalls });
  if (['BROADCASTING', 'UNKNOWN', 'NEEDS_REVIEW'].includes(s.phase) && s.hash && s.sendCalls) edge('ObserveOriginalBytes', { phase: 'OBSERVED' });
  if (s.phase === 'OBSERVED') edge('MatchingInclusion', { phase: 'CONFIRMED_ON_CHAIN' });
  if (['OBSERVED', 'CONFIRMED_ON_CHAIN'].includes(s.phase)) edge('SourceConflictOrReorg', { phase: 'CONFLICTED' });
  // Browser+service restart loses session/mutation credential; journal reservation remains.
  if (!s.restarted && !['DRAFT', 'CONFIRMED', 'PREFLIGHTED'].includes(s.phase)) edge('RestartNoReplay', { restarted: true,
    ...(['SIGNING', 'POSTCHECKED', 'BROADCASTING'].includes(s.phase) ? { phase: 'UNKNOWN', unknown: true, unknownSends: s.sendCalls } : {}) });
  edges.push({ from: i, to: i, action: 'RefuseDoubleClickOrWait' });
}
const scalar = v => typeof v === 'string' ? JSON.stringify(v) : typeof v === 'boolean' ? v ? 'TRUE' : 'FALSE' : String(v);
const row = s => '[' + Object.entries(s).map(([k, v]) => k + ' |-> ' + scalar(v)).join(', ') + ']';
const actions = [...new Set(edges.map(e => e.action))];
const invariants = ['MainnetCapZero', 'AtMostOneEffect', 'ConfirmedBeforeEffect', 'CheckedBytesBeforeSend', 'UnknownNeverReplacement', 'OriginalHashBeforeReceipt', 'PublicReadOnly', 'StrictStoreAdmission'];
const text = `---------------- MODULE GuardedPayment ----------------
EXTENDS Naturals
VARIABLE s
vars == <<s>>
States == <<
${states.map(row).join(',\n')}
>>
Edges == {
${edges.map(e => `[from |-> ${e.from + 1}, to |-> ${e.to + 1}, action |-> "${e.action}"]`).join(',\n')}
}
Init == s \\in {${starts.map(i => `States[${i + 1}]`).join(', ')}}
${actions.map(a => `${a} == \\E e \\in Edges: /\\ e.action = "${a}" /\\ s = States[e.from] /\\ s' = States[e.to]`).join('\n')}
Next == ${actions.join(' \\/ ')}
MainnetCapZero == s.network = "mainnet" => s.signCalls = 0 /\\ s.sendCalls = 0
AtMostOneEffect == s.signCalls <= 1 /\\ s.sendCalls <= 1
ConfirmedBeforeEffect == (s.signReserved \\/ s.sendReserved) => s.confirmed
CheckedBytesBeforeSend == s.sendCalls > 0 => s.valid /\\ s.hash /\\ s.signReserved /\\ s.sendReserved /\\ s.signCalls = 1
UnknownNeverReplacement == s.unknown => s.sendCalls <= s.unknownSends
OriginalHashBeforeReceipt == s.phase \\in {"OBSERVED", "CONFIRMED_ON_CHAIN"} => s.hash /\\ s.sendCalls = 1
PublicReadOnly == s.mode = "public-demo" => ~s.signReserved /\\ ~s.sendReserved /\\ s.signCalls = 0 /\\ s.sendCalls = 0
StrictStoreAdmission == s.served => s.store = "healthy"
====
`;
await writeFile(destination + '/GuardedPayment.tla', text);
await writeFile(destination + '/GuardedPayment.cfg', 'INIT Init\nNEXT Next\nINVARIANT ' + invariants.join(' ') + '\n');
await writeFile(destination + '/view.mjs', `export const state = ({s}) => ({STARTUP:'Validate create or strict reopen',STOPPED:'Unsafe or missing journal refused',DRAFT:'Review payment terms',CONFIRMED:'Terms independently confirmed',PREFLIGHTED:'Exact unsigned candidate ready',SIGNING:'Signature reserved; wallet may sign',POSTCHECKED:'Signed bytes cryptographically checked',BROADCASTING:'Send reserved; reply may be lost',UNKNOWN:'Uncertain: original operation only',NEEDS_REVIEW:'Signed bytes quarantined',OBSERVED:'Original bytes node-observed',CONFIRMED_ON_CHAIN:'Matching node inclusion',CONFLICTED:'Receipt invalidated by conflict'})[s.phase];\nexport const step = a => a === 'RefuseDoubleClickOrWait' || a === 'DuplicateCallbackRefused' ? null : a;\nexport const title = 'IntentGuard: strict journal admission, read-only public mode, one private send';\n`);
const sources = ['core/server.ts', 'core/payment-flow.ts', 'core/operation-store.ts', 'core/wallet-adapter.ts', 'core/payment-ui.ts', 'core/payment-chain.ts'];
const hashes = await Promise.all(sources.map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
const evidence = { kind: 'BOUNDED_CODE_ANCHORED_ABSTRACTION_NOT_WHOLE_PROGRAM_PROOF', states: states.length, edges: edges.length, hashes, concrete,
  anchors: { EditTerms: 'payment-ui invalidate clears confirmation/candidate including selected-outpoint; concrete build/preflight edits refuse stale sign', ReviseUnsignedPreflight: 'confirmed selectedOutpoint -> PaymentFlow explicit funding -> planDigest and PaymentJournal.reviseUnsigned atomic CAS/input transfer; null retains discovery', ReserveSignature: 'PaymentFlow.handle reserve / PaymentJournal.advance commit', SdkSignEffect: 'ConnectedWallet.sign validates source then official sourceOutputToRelay before sendSignRequest', CheckedCallback: 'PaymentFlow signed verifySignedPlan+0x61', ReserveBroadcast: 'PaymentFlow broadcast CAS commit', RpcSendEffect: 'PaymentChain.broadcast', RestartNoReplay: 'payment-ui invalidate/recover; journal reopen', ObserveOriginalBytes: 'PaymentChain.observe exact original bytes' },
  bounds: 'one economic operation;2 networks;1 edit;1 browser+service restart;1 reserved sign/send;up to2 callbacks;good/stale/bad evidence;doubleclick represented by refused self-step',
  assumptions: ['synchronous SQLite commit is atomic/durable per local filesystem contract', 'valid callback abstracts full verifier success, exercised by real crypto tests', 'source observation abstracts bounded independent node agreement/inclusion, not consensus'],
  excluded: ['arbitrary interleavings outside named awaits', 'unbounded inputs', 'cryptography/TLS internals', 'malicious SDK/wallet broadcasts', 'browser security', 'hardware durability'],
  hiddenSteps: ['refused doubleclick/wait self-steps', 'duplicate callback refusals'], next: 'Run pinned official /statechart against generated spec+cfg+view and retain its TLC/report/chart. Read every counterexample; replay via actual HTTP/SDK harness before calling it a code bug.' };
await writeFile(destination + '/model-source.json', JSON.stringify(evidence, null, 2) + '\n');
const visitor = await visitorModel(destination);
console.log(JSON.stringify({ visitor }, null, 2));
console.log(JSON.stringify(evidence, null, 2));
