import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, search, type Bookmark } from '../src/query.ts';
import { groupByTag, flatten, UNTAGGED } from '../src/tree.ts';
import { normTag, parseTags, setTags, allTags, renameTag, exportTags, importTags } from '../src/tags.ts';

const B = (id: string, title: string, url: string, tags: string[] = [], folder = ''): Bookmark => ({ id, title, url, folder, tags });
const L = [
  B('1', 'Godot docs', 'https://docs.godotengine.org', ['games/engine', 'docs']),
  B('2', 'Blender manual', 'https://docs.blender.org', ['3d', 'docs']),
  B('3', 'Hollow Knight wiki', 'https://hollowknight.wiki', ['games/metroidvania']),
  B('4', 'Cat pictures', 'https://cats.example', [], 'Fun/Pets'),
  B('5', 'Rust book', 'https://doc.rust-lang.org/book', ['dev/rust', 'docs']),
];
const ids = (l: Bookmark[]) => l.map((b) => b.id).join('');

test('empty query matches everything', () => assert.equal(ids(search(L, '')), '12345'));
test('free text matches title or url, case-insensitive', () => {
  assert.equal(ids(search(L, 'GODOT')), '1');
  assert.equal(ids(search(L, 'example')), '4');
});
test('#tag and tag: are the same, a tag also matches its sub-tags', () => {
  assert.equal(ids(search(L, '#docs')), '125');
  assert.equal(ids(search(L, 'tag:docs')), '125');
  assert.equal(ids(search(L, '#games')), '13');
  assert.equal(ids(search(L, '#games/engine')), '1');
  assert.equal(ids(search(L, '#gam')), '', 'a tag is not a prefix of letters');
});
test('and / or / not / parentheses', () => {
  assert.equal(ids(search(L, '#docs #games')), '1');
  assert.equal(ids(search(L, '#docs AND #games')), '1');
  assert.equal(ids(search(L, '#3d OR #dev')), '25');
  assert.equal(ids(search(L, '#docs -#games')), '25');
  assert.equal(ids(search(L, '#docs NOT #games')), '25');
  assert.equal(ids(search(L, '(#3d OR #games) #docs')), '12');
  assert.equal(ids(search(L, '#a OR #3d #docs')), '2', 'and binds tighter than or');
});
test('field prefixes and folder', () => {
  assert.equal(ids(search(L, 'url:blender')), '2');
  assert.equal(ids(search(L, 'title:wiki')), '3');
  assert.equal(ids(search(L, 'folder:pets')), '4');
  assert.equal(ids(search(L, 'url:docs title:manual')), '2');
});
test('quotes keep a phrase, also after a prefix or a minus', () => {
  assert.equal(ids(search(L, '"hollow knight"')), '3');
  assert.equal(ids(search(L, 'title:"rust book"')), '5');
  assert.equal(ids(search(L, '#docs -"rust book"')), '12');
});
test('the words AND/OR/NOT in quotes are plain text', () => {
  assert.deepEqual(parse('"OR"'), { t: 'term', field: 'any', value: 'or' });
});
test('broken queries never throw', () => {
  for (const q of ['(', ')', '((#a', '#a))', 'OR', 'AND OR NOT', '-', '#', '"', 'title:', 'NOT']) assert.doesNotThrow(() => search(L, q), q);
  assert.equal(ids(search(L, '(#3d')), '2', 'a missing ) closes at the end');
});

test('groupByTag: nested by path, counts once, untagged last', () => {
  const g = groupByTag(L);
  assert.deepEqual(g.kids.map((k) => k.name), ['3d', 'dev', 'docs', 'games', UNTAGGED]);
  const games = g.kids.find((k) => k.name === 'games')!;
  assert.deepEqual(games.kids.map((k) => k.name), ['engine', 'metroidvania']);
  assert.equal(games.total, 2);
  assert.equal(g.total, 5, 'a bookmark under two tags is one bookmark');
  assert.equal(g.kids.find((k) => k.name === 'docs')!.total, 3);
  assert.equal(g.kids.at(-1)!.items[0].id, '4');
});
test('flatten: every bookmark once, in tree order', () => {
  const g = groupByTag(L);
  assert.equal(ids(flatten(g)), '25134', '3d(2) dev(5) docs(1) games(3) untagged(4); repeats skipped');
  assert.equal(new Set(flatten(g)).size, 5);
  assert.equal(flatten(g.kids.find((k) => k.name === 'games')!).map((b) => b.id).join(''), '13');
});
test('empty and slash-only tags do not crash the tree', () => {
  const g = groupByTag([B('x', 't', 'u', ['/', ' '])]);
  assert.equal(g.total, 0);
});

test('tags: normalise, parse, set, rename, count', () => {
  assert.equal(normTag(' #Games / RPG  Classics '), 'games/rpg-classics');
  assert.deepEqual(parseTags('a, #b ,a\nc d'), ['a', 'b', 'c-d']);
  const m = setTags({}, '1', ['games/rpg', 'docs']);
  assert.deepEqual(setTags(m, '1', []), {}, 'no tags removes the entry');
  assert.deepEqual(m, { '1': ['games/rpg', 'docs'] }, 'setTags does not change its input');
  assert.deepEqual(renameTag(m, 'games', 'play'), { '1': ['play/rpg', 'docs'] });
  assert.deepEqual(renameTag({ a: ['games', 'games/x'] }, 'games', 'x'), { a: ['x', 'x/x'] });
  assert.deepEqual(renameTag({ a: ['games', 'play'] }, 'games', 'play'), { a: ['play'] }, 'merging two tags keeps one');
  assert.deepEqual(allTags({ a: ['x', 'y'], b: ['x'] }), [{ tag: 'x', n: 2 }, { tag: 'y', n: 1 }]);
});
test('export / import round trip', () => {
  const m = { '1': ['a', 'b/c'], '2': [], '3': ['d'] };
  const urls: Record<string, string> = { '1': 'https://a', '2': 'https://b', '3': 'https://c' };
  const t = exportTags(m, (id) => urls[id]);
  assert.equal(t, 'https://a\ta,b/c\nhttps://c\td\n');
  const back = importTags(t);
  assert.deepEqual([...back], [['https://a', ['a', 'b/c']], ['https://c', ['d']]]);
  assert.equal(importTags('junk\n\t\nurl\t\n').size, 0);
});
