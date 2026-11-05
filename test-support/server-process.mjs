/** Test-only child lifecycle. Captures close at spawn, including startup failure. */
import { spawn } from 'node:child_process';

const MAX_LOG_CHARS = 4096;
export function spawnServerProcess(args, {
  command = process.execPath, readyText, startupTimeoutMs = 5000, shutdownTimeoutMs = 2000
} = {}) {
  if (typeof readyText !== 'string' || !readyText.length ||
      ![startupTimeoutMs, shutdownTimeoutMs].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new TypeError('A readiness marker and positive bounded timeouts are required');
  }
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', closed = false, stopping;
  let resolveClosed;
  // Register immediately, not in finally after exit may already have happened.
  const closedPromise = new Promise(resolve => { resolveClosed = resolve; });
  let settled = false, resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const details = () => `exitCode=${child.exitCode}; signal=${child.signalCode}; stderr=${stderr || '(empty)'}`;
  const finish = (error) => {
    if (settled) return;
    settled = true; clearTimeout(startupTimer);
    if (error) rejectReady(error); else resolveReady();
  };
  const startupTimer = setTimeout(() => finish(new Error(`Server startup timeout; ${details()}`)), startupTimeoutMs);
  child.stdout?.on('data', chunk => {
    stdout = (stdout + chunk.toString()).slice(-MAX_LOG_CHARS);
    if (stdout.includes(readyText)) finish();
  });
  child.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-MAX_LOG_CHARS); });
  // Keep an error listener after readiness too: kill errors must not be unhandled.
  child.on('error', error => finish(new Error(`Server process error: ${error.message}; ${details()}`, { cause: error })));
  child.once('close', (code, signal) => {
    closed = true;
    finish(new Error(`Server exited before ready; exitCode=${code}; signal=${signal}; stderr=${stderr || '(empty)'}`));
    resolveClosed();
  });
  const waitForClose = () => new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), shutdownTimeoutMs);
    closedPromise.then(() => { clearTimeout(timer); resolve(true); });
  });
  const stop = () => {
    if (stopping) return stopping;
    stopping = (async () => {
      if (closed) return;
      if (child.exitCode === null && child.signalCode === null && child.pid) child.kill('SIGTERM');
      if (await waitForClose()) return;
      if (child.exitCode === null && child.signalCode === null && child.pid) child.kill('SIGKILL');
      if (!await waitForClose()) throw new Error(`Server did not close after bounded shutdown; ${details()}`);
    })();
    return stopping;
  };
  return { child, ready, stop };
}
