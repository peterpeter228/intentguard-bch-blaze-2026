import assert from 'node:assert/strict';
import { test } from 'node:test';
import { binToHex, decodeTransaction, encodeDataPush, encodeTransaction, hashTransaction, hexToBin, type Output, type Transaction } from '@bitauth/libauth';
import { completeMergedOutput, compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import { fixture } from '../../core/fixtures.js';
import { verifyCandidate } from '../../core/guard.js';
import { AUTHORITY, createTrancheTemplate, FEE_SATOSHIS, SYNTHETIC_BENEFICIARY } from './template.js';
import { runTrancheLab, syntheticCase, verifySynthetic, verifyParentBoundSynthetic } from './lab.js';
const config = { payoutSatoshis: '1000', delayBlocks: 6 };
const decode = (hex: string): Transaction => { const tx = decodeTransaction(hexToBin(hex)); if (typeof tx === 'string') throw Error(tx); return tx; };
const reject = (tx: Transaction, outputs: Output[], label: string) => assert.notEqual(verifySynthetic(tx, outputs), true, label);

test('official XO template / P2SH32 normal paths N=1,2,100 and payout/delay boundaries', () => {
  for (const p of [config, { payoutSatoshis: '546', delayBlocks: 1 }, { payoutSatoshis: '1000000000', delayBlocks: 65535 }]) for (const n of [1, 2, 100]) {
    const c = syntheticCase(p, n), r = runTrancheLab(p, n);
    assert.equal(verifySynthetic(c.transaction, [c.sourceOutput]), true);
    assert.equal(r.outputCount, n === 1 ? 1 : 2);
    assert.equal(r.feeSatoshis, '1000'); assert(r.serializedBytes < 1000);
    assert(c.transaction.outputs.every(o => o.valueSatoshis > 0n));
    assert.equal(c.sourceOutput.lockingBytecode.length, 35);
    assert.equal(binToHex(c.transaction.outputs.at(-1)!.lockingBytecode), SYNTHETIC_BENEFICIARY);
    assert(Object.isFrozen(r)); assert(Object.isFrozen(r.limits));
    for (const key of Object.keys(AUTHORITY) as (keyof typeof AUTHORITY)[]) assert.equal(r[key], false);
  }
});

test('continuation output attacks fail against actual XO-produced transaction', () => {
  const attacks: Record<string, (t: Transaction) => void> = {
    'wrong beneficiary': t => { t.outputs[1]!.lockingBytecode[3] = t.outputs[1]!.lockingBytecode[3]! ^ 1; },
    'payout +1': t => { t.outputs[1]!.valueSatoshis++; },
    'payout -1': t => { t.outputs[1]!.valueSatoshis--; },
    'reserve +1 / fee -1': t => { t.outputs[0]!.valueSatoshis++; },
    'reserve -1 / fee +1': t => { t.outputs[0]!.valueSatoshis--; },
    'extra output': t => { t.outputs.push(structuredClone(t.outputs[1]!)); },
    'missing payout': t => { t.outputs.pop(); },
    'early final': t => { t.outputs.shift(); },
    'no outputs': t => { t.outputs = []; },
    'reordered outputs': t => { t.outputs.reverse(); },
    'changed reserve script': t => { t.outputs[0]!.lockingBytecode[2] = t.outputs[0]!.lockingBytecode[2]! ^ 1; },
    'changed delay in next reserve': t => { t.outputs[0]!.lockingBytecode = syntheticCase({ ...config, delayBlocks: 7 }, 1).sourceOutput.lockingBytecode; },
    'changed payout in next reserve': t => { t.outputs[0]!.lockingBytecode = syntheticCase({ ...config, payoutSatoshis: '1001' }, 1).sourceOutput.lockingBytecode; }
  };
  for (const [name, mutate] of Object.entries(attacks)) { const c = syntheticCase(config, 2); mutate(c.transaction); reject(c.transaction, [c.sourceOutput], name); }
});

test('final branch cannot leave extra reserve, change payee, payout or fee', () => {
  for (const name of ['extra reserve', 'payee', 'payout +1', 'payout -1', 'missing']) {
    const c = syntheticCase(config, 1);
    if (name === 'extra reserve') c.transaction.outputs.push({ ...c.sourceOutput, valueSatoshis: 546n });
    if (name === 'payee') c.transaction.outputs[0]!.lockingBytecode[3] = c.transaction.outputs[0]!.lockingBytecode[3]! ^ 1;
    if (name === 'payout +1') c.transaction.outputs[0]!.valueSatoshis++;
    if (name === 'payout -1') c.transaction.outputs[0]!.valueSatoshis--;
    if (name === 'missing') c.transaction.outputs = [];
    reject(c.transaction, [c.sourceOutput], name);
  }
});

test('version, locktime, sequence disable/time flags, below delay and reserved bits rejected on both branches', () => {
  for (const n of [1, 2]) for (const [name, value] of [['version', 1], ['version', 3], ['locktime', 1], ['sequence', 0], ['sequence', 5], ['sequence', 7], ['sequence', 0x80000006], ['sequence', 0x00400006], ['sequence', 0x00010006], ['sequence', 0xffffffff]] as const) {
    const c = syntheticCase(config, n);
    if (name === 'version') c.transaction.version = value;
    else if (name === 'locktime') c.transaction.locktime = value;
    else c.transaction.inputs[0]!.sequenceNumber = value;
    reject(c.transaction, [c.sourceOutput], `${n} ${name} ${value}`);
  }
});

test('malformed funding nonmultiple, zero, below reserve and overcap rejected by actual script', () => {
  for (const n of [1, 2]) for (const value of [0n, 1n, 1999n, 2001n, 202000n, 202001n]) {
    const c = syntheticCase(config, n); c.sourceOutput.valueSatoshis = value;
    // Set matching reserve for continuation where possible to isolate the source invariant.
    if (n === 2 && value > 2000n) c.transaction.outputs[0]!.valueSatoshis = value - 2000n;
    reject(c.transaction, [c.sourceOutput], `${n} invalid source ${value}`);
  }
});

test('FT and all NFT capabilities forbidden on source and every output on both paths', () => {
  for (const n of [1, 2]) for (const where of [-1, ...Array.from({ length: n === 1 ? 1 : 2 }, (_, i) => i)]) for (const kind of ['ft', 'none', 'mutable', 'minting'] as const) {
    const c = syntheticCase(config, n), o = where === -1 ? c.sourceOutput : c.transaction.outputs[where]!;
    o.token = { category: new Uint8Array(32).fill(0x44), amount: kind === 'ft' ? 1n : 0n, ...(kind !== 'ft' ? { nft: { capability: kind, commitment: new Uint8Array() } } : {}) };
    reject(c.transaction, [c.sourceOutput], `${n} ${where} ${kind}`);
  }
  // Balanced tokens avoid relying only on token-conservation failure.
  for (const kind of ['ft', 'none', 'mutable', 'minting'] as const) {
    const c = syntheticCase(config, 2);
    const token = { category: new Uint8Array(32).fill(0x44), amount: kind === 'ft' ? 1n : 0n, ...(kind !== 'ft' ? { nft: { capability: kind, commitment: new Uint8Array([1]) } } : {}) };
    c.sourceOutput.token = token; c.transaction.outputs[0]!.token = structuredClone(token);
    reject(c.transaction, [c.sourceOutput], `balanced ${kind}`);
  }
});

test('XO merged multiple reserve inputs and donor inputs cannot bypass single-input invariant', () => {
  for (const donor of [false, true]) {
    const c = syntheticCase(config, 2), input = structuredClone(c.merged.inputs[0]!);
    input.outpointIndex = 1;
    if (donor) { input.unlockingBytecode = new Uint8Array(); input.valueSatoshis = 5000n; }
    c.merged.inputs.push(input);
    const built = decode(c.build().serializedTransaction);
    assert.equal(built.inputs.length, 2);
    reject(built, [c.sourceOutput, donor ? { valueSatoshis: 5000n, lockingBytecode: new Uint8Array([0x51]) } : structuredClone(c.sourceOutput)], donor ? 'donor input' : 'second reserve');
  }
  const c = syntheticCase(config, 2); c.transaction.inputs = []; reject(c.transaction, [], 'missing input');
});

test('redeem script substitution and unlocking stack injection fail', () => {
  for (const attack of ['delay', 'fee', 'extra stack', 'missing redeem']) {
    const c = syntheticCase(config, 2);
    if (attack === 'delay') c.transaction.inputs[0]!.unlockingBytecode = encodeDataPush(syntheticCase({ ...config, delayBlocks: 5 }, 2).redeem);
    if (attack === 'fee') {
      const template = structuredClone(c.template); template.lockingScripts.tranche!.lockingType = 'p2s';
      template.scripts.covenant = template.scripts.covenant!.replaceAll('<2000>', '<1999>');
      c.transaction.inputs[0]!.unlockingBytecode = encodeDataPush(compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'tranche', {}));
    }
    if (attack === 'extra stack') c.transaction.inputs[0]!.unlockingBytecode = Uint8Array.from([0x51, ...c.transaction.inputs[0]!.unlockingBytecode]);
    if (attack === 'missing redeem') c.transaction.inputs[0]!.unlockingBytecode = new Uint8Array();
    reject(c.transaction, [c.sourceOutput], attack);
  }
});

test('complete N=3 synthetic lineage consumes the previous XO reserve and exhausts exactly', () => {
  let previous: Transaction | undefined; let paid = 0n; let fees = 0n;
  for (const n of [3, 2, 1]) {
    const c = syntheticCase(config, n);
    if (previous) {
      c.merged.inputs[0]!.outpointTransactionHash = hexToBin(hashTransaction(encodeTransaction(previous)));
      c.merged.inputs[0]!.outpointIndex = 0;
      assert.deepEqual(c.sourceOutput, previous.outputs[0]);
    }
    const tx = decode(c.build().serializedTransaction);
    assert.equal(verifySynthetic(tx, [c.sourceOutput]), true);
    assert.equal(tx.inputs[0]!.outpointIndex, 0);
    if (previous) assert.equal(binToHex(tx.inputs[0]!.outpointTransactionHash), hashTransaction(encodeTransaction(previous)));
    paid += tx.outputs.at(-1)!.valueSatoshis;
    fees += c.sourceOutput.valueSatoshis - tx.outputs.reduce((a, o) => a + o.valueSatoshis, 0n);
    previous = tx;
  }
  assert.equal(paid, 3000n); assert.equal(fees, 3n * FEE_SATOSHIS); assert.equal(previous!.outputs.length, 1);
});

test('existing ordinary-payment Guard rejects this covenant without any bypass or core modification', () => {
  const c = syntheticCase(config, 2), { input } = fixture();
  input.candidateHex = binToHex(encodeTransaction(c.transaction));
  input.snapshot.parentTransactionHexes = [binToHex(encodeTransaction(c.parent))];
  input.snapshot.unspentOutpoints = [hashTransaction(encodeTransaction(c.parent)) + ':0'];
  const r = verifyCandidate(input); assert.equal(r.status, 'REJECTED'); assert(r.issues.includes('UNSUPPORTED_TRANSACTION')); assert.equal(r.canSign, false);
});

test('strict finite plain-data API rejects extra fields, accessors, malformed amounts and bounds', () => {
  for (const value of [null, [], 'x', {}, { ...config, extra: true }, { ...config, payoutSatoshis: 1000 }, ...['545', '0', '-1', '01', '1e3', '1.0', ' 1000', '1000000001'].map(payoutSatoshis => ({ ...config, payoutSatoshis })), ...[0, -1, 65536, NaN, Infinity, 1.5, '6'].map(delayBlocks => ({ ...config, delayBlocks })), Object.create(config), Object.defineProperty({ delayBlocks: 6 }, 'payoutSatoshis', { get() { throw Error('GETTER_CALLED'); }, enumerable: true }), { ...config, [Symbol('hidden')]: true }]) assert.throws(() => createTrancheTemplate(value));
  for (const n of [0, -1, 101, NaN, Infinity, 1.5]) assert.throws(() => runTrancheLab(config, n));
  assert(Object.isFrozen(AUTHORITY)); assert.throws(() => { Object.assign(AUTHORITY, { canSign: true }); });
});


test('synthetic parent binding rejects changed amount, script, hash and output index', () => {
  for (const mode of ['amount', 'script', 'hash', 'index']) {
    const c = syntheticCase(config, 2);
    assert.equal(verifyParentBoundSynthetic(c.transaction, c.parent), true);
    if (mode === 'amount') c.parent.outputs[0]!.valueSatoshis++;
    if (mode === 'script') c.parent.outputs[0]!.lockingBytecode = new Uint8Array([0x51]);
    if (mode === 'hash') c.transaction.inputs[0]!.outpointTransactionHash = new Uint8Array(32).fill(0x66);
    if (mode === 'index') c.transaction.inputs[0]!.outpointIndex = 1;
    assert.equal(verifyParentBoundSynthetic(c.transaction, c.parent), 'SYNTHETIC_PARENT_OUTPOINT_MISMATCH');
  }
  const c = syntheticCase(config, 2); c.transaction.inputs[0]!.outpointTransactionHash = new Uint8Array(32).fill(0x66);
  // Explicitly document the difference: stateless VM alone does not bind supplied prevouts.
  assert.equal(verifySynthetic(c.transaction, [c.sourceOutput]), true);
  assert.notEqual(verifyParentBoundSynthetic(c.transaction, c.parent), true);
});


test('XO helper variables and precompleted fields are not on-chain authorization', () => {
  const lied = syntheticCase(config, 2);
  const wrongVariables = [{ variableIdentifier: 'reserveSatoshis', value: 3000n }];
  const sourceCommitIdentifier = 'offline-synthetic-tranche-test';
  lied.merged.variables = wrongVariables.map(v => ({ ...v, sourceCommitIdentifier }));
  lied.merged.outputs[0] = { ...completeMergedOutput({ outputIdentifier: 'reserve', sourceCommitIdentifier }, 0, wrongVariables, lied.template, 'continue'), sourceCommitIdentifier };
  const liedBytes = decode(lied.build().serializedTransaction);
  assert.equal(liedBytes.outputs[0]!.valueSatoshis, 1000n);
  reject(liedBytes, [lied.sourceOutput], 'false reserveSatoshis serialized but covenant rejects');
  const overridden = syntheticCase(config, 2);
  overridden.merged.outputs[1]!.valueSatoshis = 1001n;
  const overriddenBytes = decode(overridden.build().serializedTransaction);
  assert.equal(overriddenBytes.outputs[1]!.valueSatoshis, 1001n);
  reject(overriddenBytes, [overridden.sourceOutput], 'precompleted field override serialized but covenant rejects');
});
