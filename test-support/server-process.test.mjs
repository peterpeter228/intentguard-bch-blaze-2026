import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { spawnServerProcess } from './server-process.mjs';

const options = { readyText: 'SERVER_READY', startupTimeoutMs: 2000, shutdownTimeoutMs: 300 };
test('server lifecycle accepts split readiness and stops idempotently', { timeout: 5000 }, async () => {
  const server = spawnServerProcess(['-e', "process.stdout.write('SERVER_');setTimeout(()=>process.stdout.write('READY'),10);setInterval(()=>{},1000)"], options);
  try { await server.ready; } finally { await server.stop(); await server.stop(); }
  assert(server.child.exitCode !== null || server.child.signalCode !== null);
});
test('startup crash reports exit code and stderr, then cleanup does not hang', { timeout: 5000 }, async () => {
  const server = spawnServerProcess(['-e', "process.stderr.write('missing native binding');process.exit(23)"], options);
  try { await assert.rejects(server.ready, /exitCode=23.*missing native binding/); }
  finally { await server.stop(); }
  assert.equal(server.child.exitCode, 23);
});
test('cleanup after an already observed exit resolves instead of waiting for another exit', { timeout: 5000 }, async () => {
  const server = spawnServerProcess(['-e', "console.log('SERVER_READY');setTimeout(()=>process.exit(0),30)"], options);
  const exited = once(server.child, 'exit');
  try { await server.ready; await exited; assert.equal(server.child.exitCode, 0); }
  finally { await server.stop(); }
});
test('silent successful exit is not readiness', { timeout: 5000 }, async () => {
  const server = spawnServerProcess(['-e', 'process.exit(0)'], options);
  try { await assert.rejects(server.ready, /exited before ready; exitCode=0/); }
  finally { await server.stop(); }
});
test('missing executable fails promptly and cleanup resolves', { timeout: 5000 }, async () => {
  const server = spawnServerProcess([], { ...options, command: '/__intentguard_missing_test_executable__' });
  try { await assert.rejects(server.ready, /Server process error.*ENOENT/); }
  finally { await server.stop(); }
});
test('startup timeout is bounded and its child is terminated', { timeout: 5000 }, async () => {
  const server = spawnServerProcess(['-e', 'setInterval(()=>{},1000)'], { ...options, startupTimeoutMs: 100 });
  try { await assert.rejects(server.ready, /Server startup timeout/); }
  finally { await server.stop(); }
  assert(server.child.exitCode !== null || server.child.signalCode !== null);
});
test('shutdown escalates when a ready child ignores SIGTERM', { timeout: 5000, skip: process.platform === 'win32' }, async () => {
  const server = spawnServerProcess(['-e', "process.on('SIGTERM',()=>{});console.log('SERVER_READY');setInterval(()=>{},1000)"], options);
  try { await server.ready; } finally { await server.stop(); }
  assert.equal(server.child.signalCode, 'SIGKILL');
});
