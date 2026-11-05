/** Fixed synthetic demonstration only. No caller-controlled funding export. */
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import { inspectSyntheticFunding } from './funding.js';
import { syntheticCase } from './lab.js';
if (process.argv.length !== 2) { process.stderr.write('No arguments accepted; synthetic demonstration only.\n'); process.exitCode = 2; }
else {
  const parameters = { payoutSatoshis: '546', delayBlocks: 6 };
  const c = syntheticCase(parameters, 3);
  const base = { parentTransactionHex: binToHex(encodeTransaction(c.parent)), outputIndex: 0, parameters, plannedTranches: 3, policy: { feeSatPerKb: '1000', dustRelayFeeSatPerKb: '1000' } };
  c.parent.outputs[0]!.valueSatoshis++;
  const cases = [
    { name: 'baseline', request: base },
    { name: 'wrong-valid-multiple', request: { ...base, plannedTranches: 2 } },
    { name: 'wrong-remainder', request: { ...base, parentTransactionHex: binToHex(encodeTransaction(c.parent)) } },
    { name: 'high-fee-floor', request: { ...base, policy: { ...base.policy, feeSatPerKb: '1000000' } } },
    { name: 'high-dust-floor', request: { ...base, policy: { ...base.policy, dustRelayFeeSatPerKb: '2000' } } }
  ];
  process.stdout.write(JSON.stringify({ warning: 'Synthetic only. Never fund this artifact.', cases: cases.map(c => ({ name: c.name, report: inspectSyntheticFunding(c.request) })) }, null, 2) + '\n');
}
