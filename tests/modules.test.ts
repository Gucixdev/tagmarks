import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseConfig, DEFAULTS, under, cookiesToDelete, isTracker, toDiscard, darkFor, DARK_CSS, site } from '../src/modules.ts';

test('config: junk becomes the defaults, bad numbers are clamped, lists are cleaned', () => {
  assert.deepEqual(normaliseConfig(null), DEFAULTS);
  assert.deepEqual(normaliseConfig('x'), DEFAULTS);
  const c = normaliseConfig({ darkMode: true, cookieAutoDelete: 'yes', discardMinutes: 99999, keepCookies: ['.Example.COM', ' ', 3], bogus: 1 });
  assert.equal(c.darkMode, true);
  assert.equal(c.cookieAutoDelete, false, 'only a real true switches a module on');
  assert.equal(c.discardMinutes, 1440);
  assert.deepEqual(c.keepCookies, ['example.com', '3']);
  assert.equal(normaliseConfig({ discardMinutes: 'x' }).discardMinutes, 30);
  assert.equal(normaliseConfig({ discardMinutes: 0 }).discardMinutes, 1);
});

test('under: subdomains yes, look-alike suffixes no', () => {
  assert.ok(under('a.b.example.com', 'example.com'));
  assert.ok(under('example.com', '.example.com'));
  assert.ok(!under('badexample.com', 'example.com'));
  assert.ok(!under('example.com', ''));
});

test('cookie autodelete keeps open sites, kept hosts and their subdomains', () => {
  const cookies = [{ domain: '.news.example' }, { domain: 'shop.example' }, { domain: '.bank.example' }, { domain: 'www.bank.example' }, { domain: '.old.example' }];
  const del = cookiesToDelete(cookies, ['www.news.example'], ['bank.example']).map((c) => c.domain);
  assert.deepEqual(del, ['shop.example', '.old.example']);
  assert.deepEqual(cookiesToDelete(cookies, [], []).length, 5);
});

test('tracker block: third party on the list only, first party never', () => {
  assert.ok(isTracker('https://www.google-analytics.com/a.js', 'https://news.example/', []));
  assert.ok(!isTracker('https://www.google-analytics.com/a.js', 'https://www.google-analytics.com/', []), 'a site may load itself');
  assert.ok(!isTracker('https://cdn.example/a.js', 'https://news.example/', []));
  assert.ok(isTracker('https://ads.mine.test/x', 'https://news.example/', ['mine.test']));
  assert.ok(!isTracker('not a url', 'https://news.example/', []));
  assert.equal(site('a.b.example.com'), 'example.com');
});

test('auto discard picks only idle, inactive, silent, unpinned web tabs', () => {
  const now = 10_000_000, m = 60000;
  const t = (id: number, o: object = {}) => ({ id, active: false, pinned: false, audible: false, discarded: false, lastAccessed: now - 40 * m, url: 'https://x.example/', ...o });
  const tabs = [t(1), t(2, { active: true }), t(3, { pinned: true }), t(4, { audible: true }), t(5, { discarded: true }), t(6, { lastAccessed: now - 5 * m }), t(7, { url: 'about:blank' }), t(8)];
  assert.deepEqual(toDiscard(tabs, now, 30), [1, 8]);
});

test('dark mode css applies to web pages and honours the exclusion list', () => {
  assert.equal(darkFor('https://a.example/', []), DARK_CSS);
  assert.equal(darkFor('https://a.example/', ['example']), '', 'a bare label is not a domain match');
  assert.equal(darkFor('https://www.a.example/', ['a.example']), '');
  assert.equal(darkFor('about:blank', []), '');
});
