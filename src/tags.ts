// Tag bookkeeping: normalising, adding/removing in a map id -> tags, and a text import/export so the tags are not locked
// in the browser's storage.
export type TagMap = Record<string, string[]>;

export function normTag(s: string): string {
  return s.trim().replace(/^#/, '').split('/').map((x) => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean).join('/');
}

export function parseTags(s: string): string[] {
  const out: string[] = [];
  for (const raw of s.split(/[,\n]/)) { const t = normTag(raw); if (t && !out.includes(t)) out.push(t); }
  return out;
}

export function setTags(m: TagMap, id: string, tags: string[]): TagMap {
  const n = { ...m };
  if (tags.length) n[id] = [...tags]; else delete n[id];
  return n;
}

export function allTags(m: TagMap): { tag: string; n: number }[] {
  const c = new Map<string, number>();
  for (const tags of Object.values(m)) for (const t of tags) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

// rename a tag and everything below it: games -> play makes games/rpg -> play/rpg
export function renameTag(m: TagMap, from: string, to: string): TagMap {
  const f = normTag(from), t = normTag(to), n: TagMap = {};
  for (const [id, tags] of Object.entries(m)) {
    const out: string[] = [];
    for (const x of tags) { const y = x === f || x.startsWith(f + '/') ? t + x.slice(f.length) : x; if (!out.includes(y)) out.push(y); }
    n[id] = out;
  }
  return n;
}

// one line per bookmark: url<TAB>tag,tag. Lines with no tags are skipped.
export function exportTags(m: TagMap, urlOf: (id: string) => string | undefined): string {
  const lines: string[] = [];
  for (const [id, tags] of Object.entries(m)) { const u = urlOf(id); if (u && tags.length) lines.push(u + '\t' + tags.join(',')); }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

export function importTags(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const line of text.split('\n')) {
    const i = line.indexOf('\t');
    if (i < 1) continue;
    const tags = parseTags(line.slice(i + 1));
    if (tags.length) out.set(line.slice(0, i), tags);
  }
  return out;
}
