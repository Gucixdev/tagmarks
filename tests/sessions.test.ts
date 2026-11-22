import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSessionInput, cleanName, sessionTabs, saveSession, deleteSession, sessionBookmarks, exportSessions, importSessions } from '../src/sessions.ts';
import { search } from '../src/query.ts';
import { groupByTag, flatten } from '../src/tree.ts';

const tabs = [{ url: 'https://a.example/', title: 'A' }, { url: 'about:preferences', title: 'prefs' }, { url: 'https://a.example/', title: 'A again' }, { url: 'https://b.example/' }, { title: 'no url' }];

test('names are cleaned', () => assert.equal(cleanName('  My "Work" (x) Stuff '), 'my-work-x-stuff'));

test('only real pages are kept, once each, in order', () => {
  assert.deepEqual(sessionTabs(tabs), [{ url: 'https://a.example/', title: 'A' }, { url: 'https://b.example/', title: 'https://b.example/' }]);
});

test('saving replaces by name and refuses empty results', () => {
  let s = saveSession({}, 'Work', tabs, ['job'], 1)!;
  assert.equal(s.work.tabs.length, 2);
  s = saveSession(s, 'work', [{ url: 'https://c.example/', title: 'C' }], [], 2)!;
  assert.deepEqual(s.work.tabs.map((t) => t.url), ['https://c.example/']);
  assert.equal(saveSession(s, 'x', [{ url: 'about:blank' }], [], 3), null);
  assert.equal(saveSession(s, '  ', tabs, [], 3), null);
  assert.deepEqual(Object.keys(deleteSession(s, 'work')), []);
});

test('sessions show up in the tag tree and the query language', () => {
  const s = saveSession(saveSession({}, 'work', tabs, ['job'], 1)!, 'play', [{ url: 'https://game.example/', title: 'Game' }], [], 1)!;
  const bm = sessionBookmarks(s, (u) => (u === 'https://a.example/' ? ['docs'] : []));
  assert.equal(bm.length, 3);
  assert.equal(search(bm, '#session/work').length, 2);
  assert.equal(search(bm, '#session').length, 3, 'a tag matches its sub-tags');
  assert.equal(search(bm, '#job #docs').length, 1);
  const g = groupByTag(bm).kids.find((k) => k.name === 'session')!;
  assert.deepEqual(g.kids.map((k) => k.name), ['play', 'work']);
  assert.equal(flatten(g.kids[1]).length, 2);
});

test('text export and import round trip', () => {
  const s = saveSession({}, 'work', tabs, ['job', 'docs'], 1)!;
  const back = importSessions(exportSessions(s), 9);
  assert.deepEqual(back.work.tabs, s.work.tabs);
  assert.deepEqual(back.work.tags, ['job', 'docs']);
  assert.deepEqual(importSessions('garbage\n# \nhttps://x.example/\tX\n', 1), {});
});

test('the save box splits the name from its tags', () => {
  assert.deepEqual(parseSessionInput('Work stuff #Job #games/rpg #job'), { name: 'work-stuff', tags: ['job', 'games/rpg'] });
  assert.deepEqual(parseSessionInput('plain'), { name: 'plain', tags: [] });
  assert.deepEqual(parseSessionInput('#only'), { name: '', tags: ['only'] });
});
