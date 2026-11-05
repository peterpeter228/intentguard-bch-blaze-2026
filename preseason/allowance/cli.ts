/** Fixed synthetic demonstration only: no input file, address, transaction or real beneficiary export. */
import { runTrancheLab } from './lab.js';
if (process.argv.length !== 2) {
  process.stderr.write('This offline demo accepts no arguments.\n'); process.exitCode = 1;
} else {
  try { process.stdout.write(JSON.stringify(runTrancheLab({ payoutSatoshis: '1000', delayBlocks: 6 }, 3), null, 2) + '\n'); }
  catch { process.stderr.write('Offline tranche lab validation failed.\n'); process.exitCode = 1; }
}
