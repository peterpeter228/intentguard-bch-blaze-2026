import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { driveVisitor } from '../../../../core/visitor-payment.test.mjs';

/** Bounded abstraction of the real visitor consumer, not generated-code proof. */
export async function visitorModel(destination) {
  const concrete = await driveVisitor();
  const states = [], index = new Map(), edges = [];
  const add = s => { const key = JSON.stringify(s); if (!index.has(key)) { index.set(key, states.length); states.push(s); } return index.get(key); };
  add({ phase: 'DRAFT', confirmed: false, fresh: true, durable: true, signIntent: false, signCalls: 0, checked: false, hash: false, handoffIntent: false, handoffs: 0, uncertain: false, frozenHandoffs: 0, restarted: false, callbacks: 0, agentSigns: 0, serverSends: 0 });
  for (let i = 0; i < states.length; i++) {
    if (states.length > 4000) throw Error('VISITOR_MODEL_TOO_LARGE');
    const s = states[i], edge = (action, delta) => edges.push({ from: i, to: add({ ...s, ...delta }), action });
    if (s.phase === 'DRAFT') edge('ConfirmTerms', { phase: 'CONFIRMED', confirmed: true });
    if (s.phase === 'CONFIRMED' && s.fresh && s.durable) edge('ReconstructReserveInputs', { phase: 'PREFLIGHTED' });
    if (s.phase === 'PREFLIGHTED' && s.fresh && s.durable && !s.signIntent) edge('CommitSignatureIntent', { phase: 'SIGNING', signIntent: true });
    if (s.phase === 'SIGNING' && s.fresh && s.durable && !s.signCalls && !s.restarted && !s.uncertain) edge('VisitorWalletSignOnly', { signCalls: 1 });
    if (s.signCalls && !s.hash && s.callbacks < 2 && s.durable) {
      edge('PersistCheckedOriginalCallback', { phase: s.uncertain || !s.fresh ? 'NEEDS_REVIEW' : 'POSTCHECKED', checked: true, hash: true, callbacks: s.callbacks + 1 });
      edge('PersistBadOriginalCallback', { phase: 'NEEDS_REVIEW', checked: false, hash: true, callbacks: s.callbacks + 1 });
    }
    if (s.phase === 'POSTCHECKED' && s.fresh && s.durable && !s.uncertain && !s.handoffIntent) edge('CommitNativeHandoffIntent', { phase: 'HANDOFF_RESERVED', handoffIntent: true });
    if (s.phase === 'HANDOFF_RESERVED' && s.fresh && s.durable && !s.restarted && !s.uncertain && !s.handoffs) edge('DisplayIdenticalBytesToVisitor', { phase: 'UNKNOWN', handoffs: 1, uncertain: true, frozenHandoffs: 1 });
    if (s.fresh) edge('EditExpirySessionOrSource', { fresh: false, ...(s.signIntent ? { phase: 'UNKNOWN', uncertain: true, frozenHandoffs: s.handoffs } : { phase: 'DRAFT', confirmed: false }) });
    if (s.durable) edge('PersistenceFailure', { durable: false, ...(s.signIntent ? { phase: 'UNKNOWN', uncertain: true, frozenHandoffs: s.handoffs } : { phase: 'STOPPED' }) });
    if (!s.restarted) edge('ReloadNoAuthority', { restarted: true, fresh: false, ...(s.signIntent ? { phase: 'UNKNOWN', uncertain: true, frozenHandoffs: s.handoffs } : { phase: 'DRAFT', confirmed: false }) });
    if (s.hash && s.checked && ['UNKNOWN', 'NEEDS_REVIEW'].includes(s.phase)) edge('ObserveOriginalExactBytes', { phase: 'OBSERVED' });
    if (s.phase === 'OBSERVED') edge('AgreeInclusion', { phase: 'CONFIRMED_ON_CHAIN' });
    if (['OBSERVED', 'CONFIRMED_ON_CHAIN'].includes(s.phase)) edge('ConflictReorgStale', { phase: 'UNKNOWN', uncertain: true, frozenHandoffs: s.handoffs });
    edges.push({ from: i, to: i, action: 'RefuseDuplicateOrWait' });
  }
  const scalar = v => typeof v === 'string' ? JSON.stringify(v) : typeof v === 'boolean' ? v ? 'TRUE' : 'FALSE' : String(v);
  const row = s => '[' + Object.entries(s).map(([k, v]) => k + ' |-> ' + scalar(v)).join(', ') + ']';
  const actions = [...new Set(edges.map(e => e.action))];
  const rules = ['NoAgentServerEffects', 'AtMostOneVisitorEffect', 'DurableIntentBeforeEffect', 'CheckedExactBytesBeforeHandoff', 'UnknownNeverRepeatedHandoff', 'OriginalHashBeforeReceipt'];
  await writeFile(destination + '/VisitorPayment.tla', `---------------- MODULE VisitorPayment ----------------
EXTENDS Naturals
VARIABLE s
vars == <<s>>
States == <<
${states.map(row).join(',\n')}
>>
Edges == {
${edges.map(e => `[from |-> ${e.from + 1}, to |-> ${e.to + 1}, action |-> "${e.action}"]`).join(',\n')}
}
Init == s = States[1]
${actions.map(a => `${a} == \\E e \\in Edges: /\\ e.action = "${a}" /\\ s = States[e.from] /\\ s' = States[e.to]`).join('\n')}
Next == ${actions.join(' \\/ ')}
NoAgentServerEffects == s.agentSigns = 0 /\\ s.serverSends = 0
AtMostOneVisitorEffect == s.signCalls <= 1 /\\ s.handoffs <= 1
DurableIntentBeforeEffect == (s.signCalls > 0 => s.signIntent /\\ s.confirmed) /\\ (s.handoffs > 0 => s.handoffIntent)
CheckedExactBytesBeforeHandoff == s.handoffs > 0 => s.checked /\\ s.hash /\\ s.signCalls = 1
UnknownNeverRepeatedHandoff == s.uncertain => s.handoffs <= s.frozenHandoffs
OriginalHashBeforeReceipt == s.phase \\in {"OBSERVED", "CONFIRMED_ON_CHAIN"} => s.hash /\\ s.checked
====
`);
  await writeFile(destination + '/VisitorPayment.cfg', 'INIT Init\nNEXT Next\nINVARIANT ' + rules.join(' ') + '\n');
  await writeFile(destination + '/visitor-view.mjs', `export const state = ({s}) => s.phase;\nexport const step = a => a === 'RefuseDuplicateOrWait' ? null : a;\nexport const title = 'Visitor sign-only, checked-byte native handoff, original-hash observation';\n`);
  const files = ['core/visitor-payment-ui.ts', 'core/visitor-payment-store.ts', 'core/visitor-payment-reader.ts', 'core/wallet-adapter.ts', 'core/payment-chain.ts'];
  const hashes = await Promise.all(files.map(async file => ({ file, sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
  const report = { kind: 'BOUNDED_VISITOR_ABSTRACTION_NOT_WHOLE_PROGRAM_PROOF', states: states.length, edges: edges.length, rules, concrete, hashes,
    anchors: { CommitSignatureIntent: 'VisitorPaymentStore.reserve strict IndexedDB transaction completion before wallet.sign', VisitorWalletSignOnly: 'visitor-payment-ui sign + ConnectedWallet.sign broadcast:false', PersistCheckedOriginalCallback: 'verifySignedPlan + 0x61 and VisitorPaymentStore.signed', CommitNativeHandoffIntent: 'VisitorPaymentStore.handoff commit before raw display', DisplayIdenticalBytesToVisitor: 'visitor-payment-ui broadcast exact stored signedHex; NO native command execution', ReloadNoAuthority: 'startup/active/uncertain + invalidation', ObserveOriginalExactBytes: 'parent-bound structure/hash verification + PaymentChain.observe' },
    bounds: 'one economic operation, one signature and native handoff, up to two callbacks, one reload, finite good/stale/bad persistence/source/session outcomes; duplicate tabs represented by CAS refusal',
    assumptions: ['strict-durability IndexedDB transaction commit is atomic in retained same-origin storage', 'valid-byte predicate abstracts full verifier exercised in concrete synthetic consumer', 'node inclusion is bounded trust not consensus', 'visitor may independently broadcast outside the app; model only prevents repeated app handoff'],
    excluded: ['browser-native implementation internals', 'storage deletion/rollback', 'other devices/origins/wallet actions', 'crypto/TLS correctness', 'malicious wallet broadcast ignoring false'],
    formal: 'GENERATION_ONLY; execute pinned statechart/TLC separately' };
  await writeFile(destination + '/visitor-model-source.json', JSON.stringify(report, null, 2) + '\n');
  return report;
}
