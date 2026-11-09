// PRESEASON: single-operation safety gate. No keys, network, or SDK imports.
export function initialState(network) {
  return {phase:'new',network,attempts:0,engineStarts:0,reconciled:false,unknownFrom:'',publicChecked:false,freshChecked:false,published:false,verified:false};
}
export function transition(s, event, evidence={}) {
  const next={...s};
  const requirePhase=(phase)=>{if(s.phase!==phase)throw Error('OPERATION_REPLAY_REFUSED');};
  switch(event) {
    case 'claim':
      requirePhase('new');
      if(s.network!=='chipnet')throw Error('CHIPNET_REQUIRED');
      if(evidence.fileAbsent!==true)throw Error('EXISTING_SECRET_REFUSED');
      next.phase='claimed';break;
    case 'persistSecret': requirePhase('claimed');next.phase='persisting';break;
    case 'secretReady': requirePhase('persisting');next.phase='identity';break;
    case 'startEngine': requirePhase('identity');next.phase='connecting';next.engineStarts++;break;
    case 'engineReady':
      requirePhase('connecting');if(evidence.networkReady!==true)throw Error('NETWORK_REFUSED');next.phase='session';break;
    case 'startSign':
      requirePhase('session');if(evidence.fresh!==true)throw Error('EXPIRY_REFUSED');
      next.phase='signing';next.attempts++;break;
    case 'signed': requirePhase('signing');next.phase='signed';break;
    case 'checkPublic':
      requirePhase('signed');
      if(evidence.publicSafe!==true)throw Error('UNSAFE_EXPORT_REFUSED');
      if(evidence.fresh!==true)throw Error('EXPIRY_REFUSED');
      next.publicChecked=true;next.freshChecked=true;next.phase='checked';break;
    case 'startExport':
      requirePhase('checked');if(evidence.fresh!==true)throw Error('EXPIRY_REFUSED');next.phase='exporting';break;
    case 'published': requirePhase('exporting');next.published=true;next.phase='exported';break;
    case 'verified': requirePhase('exported');if(evidence.fresh!==true)throw Error('EXPIRY_REFUSED');next.verified=true;next.phase='verified';break;
    // Signing/export uncertainty is terminal. Only a proven unsigned connection-stage failure may reconcile once.
    case 'crash': if(s.phase==='new')throw Error('NO_OPERATION');next.unknownFrom=s.phase;next.phase='unknown';break;
    case 'reconcileSession':
      requirePhase('unknown');
      if(s.attempts!==0||s.unknownFrom!=='connecting'||s.reconciled||evidence.sameOwnedIdentity!==true||evidence.historyProvesNoSign!==true)throw Error('RECONCILIATION_REFUSED');
      next.reconciled=true;next.engineStarts++;next.phase='connecting';break;
    case 'doctor': return next;
    default: throw Error('INVALID_OPERATION_EVENT');
  }
  return next;
}
