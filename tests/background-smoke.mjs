// Loads dist/background.js against a recording stand-in for `browser`, then flips the switches through storage.onChanged.
import assert from 'node:assert/strict';
const calls = [], L = {};
const reg = (name) => ({ addListener: (f) => { (L[name] ||= []).push(f); } });
let store = { modules: { trackerBlock: true, autoDiscard: true, darkMode: true } };
const tabs = [{ id: 1, url: 'https://a.example/', active: true, pinned: false, audible: false, discarded: false, lastAccessed: 0 }, { id: 2, url: 'https://b.example/', active: false, pinned: false, audible: false, discarded: false, lastAccessed: 0 }];
globalThis.browser = {
  webRequest: { onBeforeRequest: reg('req') }, tabs: { onRemoved: reg('rm'), onUpdated: reg('upd'), query: async () => tabs, insertCSS: async (id) => calls.push('css' + id), removeCSS: async () => {}, discard: async (ids) => calls.push('discard' + ids) },
  alarms: { onAlarm: reg('alarm'), create: (n) => calls.push('alarm+'), clear: () => calls.push('alarm-') },
  storage: { onChanged: reg('chg'), local: { get: async () => store } }, cookies: { getAllCookieStores: async () => [], getAll: async () => [], remove: async () => {} },
};
await import('../dist/background.js'); await new Promise((r) => setTimeout(r, 50));
const block = L.req[0]({ url: 'https://www.google-analytics.com/x.js', documentUrl: 'https://a.example/', type: 'script' });
assert.deepEqual(block, { cancel: true }, 'tracker blocked');
assert.deepEqual(L.req[0]({ url: 'https://www.google-analytics.com/', documentUrl: 'https://a.example/', type: 'main_frame' }), {}, 'a page itself is never blocked');
assert.ok(calls.includes('alarm+') && calls.includes('css1') && calls.includes('css2'), 'switches applied on start: ' + calls);
L.alarm[0]({ name: 'tagmarks-discard' }); await new Promise((r) => setTimeout(r, 20));
assert.ok(calls.includes('discard2') && !calls.some((c) => c === 'discard1,2'), 'only the inactive tab is unloaded: ' + calls);
L.chg[0]({ modules: { newValue: { trackerBlock: false } } }, 'local'); await new Promise((r) => setTimeout(r, 20));
assert.deepEqual(L.req[0]({ url: 'https://www.google-analytics.com/x.js', documentUrl: 'https://a.example/', type: 'script' }), {}, 'switch off at once');
assert.ok(calls.includes('alarm-'), 'alarm cleared');
console.log('background smoke ok');
