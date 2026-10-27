/** G0 compile/bundle probe only. Not mounted, no connection or wallet request. */
import { useWizardConnect } from '@wizardconnect/react';
import type { DappConnectionManager } from '@wizardconnect/dapp';
import type { ElectrumNetworkProvider } from 'cashscript';
export function ProtocolTypeProbe() {
  const state = useWizardConnect({ dappName: 'IntentGuard BCH G0', persistSession: false });
  return <output>{state.state}: SDK compile probe only, not payment capability</output>;
}
export type WalletRequest = Parameters<DappConnectionManager['signTransaction']>[0];
export type WalletOptions = Parameters<DappConnectionManager['signTransaction']>[1];
export type RawTransactionReader = ElectrumNetworkProvider['getRawTransaction'];
export type Broadcaster = ElectrumNetworkProvider['sendRawTransaction'];
// Merely type-checking broadcast:false does not establish wallet behavior.
export const syntheticRequest = { transaction: { transaction: '02000000000000000000', sourceOutputs: [], broadcast: false }, inputPaths: [] } satisfies WalletRequest;
export const signalOptions = { signal: new AbortController().signal } satisfies WalletOptions;
