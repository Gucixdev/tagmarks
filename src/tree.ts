// Groups bookmarks into a tree by tag path: `games/rpg` puts a bookmark under games > rpg. A bookmark with several tags
// appears under each of them (it is one bookmark, counted once in `total`). Bookmarks without tags go under `(untagged)`.
import type { Bookmark } from './query.ts';

export type Group = { name: string; path: string; items: Bookmark[]; kids: Group[]; total: number };

export const UNTAGGED = '(untagged)';

export function groupByTag(list: Bookmark[]): Group {
  const root: Group = { name: '', path: '', items: [], kids: [], total: 0 };
  const find = (g: Group, parts: string[]): Group => {
    let cur = g;
    for (const part of parts) {
      const path = cur.path ? cur.path + '/' + part : part;
      let k = cur.kids.find((x) => x.name === part);
      if (!k) { k = { name: part, path, items: [], kids: [], total: 0 }; cur.kids.push(k); }
      cur = k;
    }
    return cur;
  };
  for (const b of list) {
    const tags = b.tags.length ? b.tags : [UNTAGGED];
    const seen = new Set<string>();
    for (const t of tags) {
      const parts = t.split('/').map((s) => s.trim()).filter(Boolean);
      if (!parts.length) continue;
      const g = find(root, parts);
      if (!g.items.includes(b)) g.items.push(b);
      seen.add(g.path);
    }
  }
  const count = (g: Group): Set<Bookmark> => {
    const s = new Set<Bookmark>(g.items);
    for (const k of g.kids) for (const b of count(k)) s.add(b);
    g.total = s.size;
    return s;
  };
  count(root);
  const sort = (g: Group) => { g.kids.sort((a, b) => (a.name === UNTAGGED ? 1 : b.name === UNTAGGED ? -1 : a.name.localeCompare(b.name))); g.kids.forEach(sort); };
  sort(root);
  return root;
}

// every bookmark of a group and below, once each, in tree order (what "open all" opens)
export function flatten(g: Group): Bookmark[] {
  const seen = new Set<Bookmark>(), out: Bookmark[] = [];
  const walk = (x: Group) => { for (const b of x.items) if (!seen.has(b)) { seen.add(b); out.push(b); } x.kids.forEach(walk); };
  walk(g);
  return out;
}
