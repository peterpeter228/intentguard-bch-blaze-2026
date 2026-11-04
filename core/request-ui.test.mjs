/** Minimal DOM event harness. This is NOT real-browser acceptance evidence. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
let caseId = 0;
async function harness() {
  let now = 1800000000123, nextTimer = 0; const elements = new Map(), timers = new Map(), downloads = [], urls = new Map();
  const originals = { document: globalThis.document, window: globalThis.window, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, now: Date.now, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  class Element {
    value = ''; checked = false; disabled = false; hidden = false; textContent = ''; open = false; href = ''; download = '';
    listeners = new Map();
    addEventListener(name, fn) { const list = this.listeners.get(name) ?? []; list.push(fn); this.listeners.set(name, list); }
    emit(name) { if (name === 'click' && this.disabled) return; for (const fn of this.listeners.get(name) ?? []) fn({ target: this }); }
    click() { if (this.download) downloads.push({ name: this.download, blob: urls.get(this.href) }); else this.emit('click'); }
  }
  const el = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const documentEvents = new Element(), windowEvents = new Element();
  globalThis.document = { getElementById: el, createElement: () => new Element(), hidden: false, addEventListener: (...a) => documentEvents.addEventListener(...a) };
  globalThis.window = { addEventListener: (...a) => windowEvents.addEventListener(...a) };
  globalThis.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id); Date.now = () => now;
  URL.createObjectURL = blob => { const id = `blob:offline-test-${urls.size}`; urls.set(id, blob); return id; }; URL.revokeObjectURL = () => {};
  await import(`../dist/core/request-ui.js?state-case=${++caseId}`);
  const click = id => el(id).click();
  const edit = (id, value, event = true) => { el(id).value = value; if (event) el(id).emit('input'); };
  const acknowledge = () => { el('funding-ack').checked = true; el('funding-ack').emit('change'); };
  const ready = (token = false) => { click(token ? 'example-token' : 'example-bch'); click('request-review'); click('request-confirm'); acknowledge(); click('plan-build'); assert.equal(el('plan-status').textContent, 'OFFLINE PLAN · NOT APPROVED TO PAY'); };
  return { el, click, edit, acknowledge, ready, downloads, timers, windowEvents, documentEvents, setNow: n => { now = n; }, getNow: () => now, restore() { globalThis.document = originals.document; globalThis.window = originals.window; globalThis.setTimeout = originals.setTimeout; globalThis.clearTimeout = originals.clearTimeout; Date.now = originals.now; URL.createObjectURL = originals.create; URL.revokeObjectURL = originals.revoke; } };
}
async function withHarness(run) { const h = await harness(); try { await run(h); } finally { h.restore(); } }
function noPlan(h) { assert.equal(h.el('plan-export').disabled, true); assert.equal(h.el('plan-technical').textContent, ''); assert.equal(h.el('plan-details').open, false); assert.notEqual(h.el('plan-status').textContent, 'OFFLINE PLAN · NOT APPROVED TO PAY'); }

test('explicit full scenario needs request review and separate funding acknowledgement before planning', () => withHarness(async h => {
  assert.equal(h.el('plan-build').disabled, true); h.click('example-bch'); assert.equal(h.el('plan-build').disabled, true); assert.match(h.el('funding-origin').textContent, /SYNTHETIC/);
  h.click('request-review'); h.acknowledge(); assert.equal(h.el('plan-build').disabled, true); h.click('request-confirm'); assert.equal(h.el('plan-build').disabled, false);
  h.click('plan-build'); assert.match(h.el('plan-summary').textContent, /Transaction fee: 219/); h.click('plan-export'); assert.equal(h.downloads.length, 1);
  const report = JSON.parse(await h.downloads[0].blob.text()); assert.equal(report.kind, 'intentguard-offline-plan-report'); assert.equal(report.contextKind, 'synthetic-example');
  for (const flag of ['canSign', 'broadcastable', 'receiptValid', 'networkVerified', 'ownershipVerified']) assert.equal(report[flag], false);
  assert.equal('parentHex' in report, false); assert.equal('unsignedHex' in report, false);
}));

test('request input events clear funding, reviewed state, prior result and download permission', () => withHarness(h => {
  h.ready(); h.el('plan-details').open = true; h.edit('request-bch', '0.00002'); noPlan(h); assert.equal(h.el('funding-parent').value, ''); assert.equal(h.el('funding-ack').checked, false); assert.equal(h.el('request-status').textContent, 'NO DRAFT'); assert.equal(h.el('plan-build').disabled, true);
}));

test('request fields changed without events cannot export an obsolete plan or request', () => withHarness(h => {
  h.ready(); h.edit('request-bch', '0.00002', false); h.click('plan-export'); noPlan(h); assert.equal(h.downloads.length, 0); assert.equal(h.el('funding-parent').value, '');
  h.ready(); h.edit('request-address', 'changed-without-event', false); h.click('request-export'); assert.equal(h.downloads.length, 0); assert.equal(h.el('request-status').textContent, 'NO DRAFT');
}));

test('silent funding-rate and observation-time edits require a new acknowledgement even when content binding might stay equal', () => withHarness(h => {
  for (const id of ['funding-rate', 'funding-observed']) {
    h.ready(); h.edit(id, id === 'funding-rate' ? '1200' : new Date(h.getNow()-1000).toISOString().replace(/\.\d{3}Z$/, 'Z'), false); h.click('plan-export');
    noPlan(h); assert.equal(h.downloads.length, 0); assert.equal(h.el('funding-ack').checked, false); assert.match(h.el('plan-summary').textContent, /FORM_FUNDING_CHANGED/);
  }
}));

test('funding edits retain request review but invalidate plan, close details and reset acknowledgement', () => withHarness(h => {
  h.ready(true); h.el('plan-details').open = true; h.edit('funding-rate', '1200'); noPlan(h); assert.equal(h.el('request-status').textContent, 'LOCALLY REVIEWED · NOT APPROVED TO PAY'); assert.equal(h.el('funding-ack').checked, false);
  h.acknowledge(); h.click('plan-build'); assert.match(h.el('plan-summary').textContent, /SUPPLIED OFFLINE CLAIMS/); assert.match(h.el('plan-summary').textContent, /Token amount: 400 base units/);
}));

test('failed rebuild replaces old output rather than retaining a success or downloadable plan', () => withHarness(h => {
  h.ready(); h.edit('funding-parent', '00'); h.acknowledge(); h.click('plan-build'); noPlan(h); assert.equal(h.el('plan-status').textContent, 'REJECTED'); assert.match(h.el('plan-summary').textContent, /FORM_PARENT_HEX/);
  h.ready(); h.edit('funding-rate', '3000'); h.acknowledge(); h.click('plan-build'); noPlan(h); assert.match(h.el('plan-summary').textContent, /FEE_LIMIT/);
}));

test('request expiry and funding staleness are rechecked on download/focus without trusting timers', () => withHarness(h => {
  h.ready(); h.setNow(h.getNow()+120001); h.click('plan-export'); noPlan(h); assert.equal(h.downloads.length, 0); assert.match(h.el('plan-summary').textContent, /STALE_OR_INVALID_SNAPSHOT/);
  h.ready(); const expiry=Date.parse(h.el('request-expiry').value); h.setNow(expiry); h.windowEvents.emit('focus'); noPlan(h); assert.equal(h.el('request-status').textContent, 'NO DRAFT'); assert.equal(h.el('funding-parent').value, '');
}));

test('observation timer clears active result and disables rebuild until context is checked again', () => withHarness(h => {
  h.ready(); const timer = [...h.timers.values()].find(t => t.delay > 1000 && t.delay <= 120001); assert.ok(timer); h.setNow(h.getNow()+120001); timer.callback(); noPlan(h); assert.equal(h.el('funding-ack').checked, false); assert.equal(h.el('plan-build').disabled, true); assert.match(h.el('plan-summary').textContent, /observation expired/);
}));

test('clear, replacement scenario and malformed request import cannot retain prior funding or success', () => withHarness(h => {
  h.ready(); h.click('funding-clear'); noPlan(h); assert.equal(h.el('funding-parent').value, ''); assert.match(h.el('request-status').textContent, /LOCALLY REVIEWED/);
  h.ready(); h.click('request-clear'); noPlan(h); assert.equal(h.el('request-id').value, ''); assert.equal(h.el('funding-parent').value, '');
  h.ready(); h.click('example-token'); noPlan(h); assert.equal(h.el('request-status').textContent, 'NO DRAFT'); assert.equal(h.el('funding-ack').checked, false);
  h.edit('request-import', '{'); h.click('request-import-run'); noPlan(h); assert.equal(h.el('funding-parent').value, ''); assert.equal(h.el('request-status').textContent, 'REJECTED');
}));

test('silent pre-review request edits cannot reuse teaching funds and edited funding is not mislabeled as an untouched example', () => withHarness(h => {
  h.click('example-bch'); h.edit('request-bch', '0.00002', false); h.click('request-review'); assert.equal(h.el('funding-parent').value, ''); noPlan(h);
  h.click('example-bch'); h.click('request-review'); h.click('request-confirm'); h.edit('funding-rate', '1200', false); h.acknowledge(); h.click('plan-build'); assert.match(h.el('funding-origin').textContent, /SUPPLIED OFFLINE CLAIMS/); assert.match(h.el('plan-summary').textContent, /SUPPLIED OFFLINE CLAIMS/);
}));

test('re-review checks prior request fields regardless of funding origin or an existing review', () => withHarness(h => {
  h.click('example-bch'); h.edit('request-bch', '0.00002', false); h.edit('funding-rate', '1200'); h.click('request-review'); assert.equal(h.el('funding-parent').value, ''); noPlan(h);
  h.ready(); h.edit('request-bch', '0.00002', false); h.click('request-review'); assert.equal(h.el('funding-parent').value, ''); noPlan(h);
}));
