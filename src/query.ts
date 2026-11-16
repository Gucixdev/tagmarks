// Query language for bookmarks. Words are free text (title or url), `#tag` or `tag:x` match a tag (a tag also matches its
// sub-tags: `#games` finds `games/rpg`), `url:`, `title:`, `folder:` look at one field, `-x` or `NOT x` negates,
// `OR` joins, a space or `AND` means and, parentheses group, "double quotes" keep a phrase together.

export type Bookmark = { id: string; title: string; url: string; folder: string; tags: string[] };

export type Node =
  | { t: 'and'; a: Node; b: Node }
  | { t: 'or'; a: Node; b: Node }
  | { t: 'not'; a: Node }
  | { t: 'term'; field: 'any' | 'tag' | 'url' | 'title' | 'folder'; value: string }
  | { t: 'all' };

type Tok = { k: 'word' | '(' | ')'; v: string; quoted?: boolean };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '(' || c === ')') { out.push({ k: c, v: c }); i++; continue; }
    let j = i, w = '';
    const quoted = c === '"';          // only a word that starts with a quote is literal text (so -"a b" and title:"a b" still work)
    while (j < src.length && !' \t\n()'.includes(src[j])) {
      if (src[j] === '"') {            // a quoted part, may follow a prefix such as title:"a b" or -"a b"
        j++;
        while (j < src.length && src[j] !== '"') w += src[j++];
        if (j < src.length) j++;        // closing quote (an unclosed one runs to the end)
      } else w += src[j++];
    }
    out.push({ k: 'word', v: w, quoted });
    i = j;
  }
  return out;
}

export function parse(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = () => toks[p];
  function orExpr(): Node {
    let n = andExpr();
    while (peek() && peek().k === 'word' && !peek().quoted && peek().v === 'OR') { p++; const r = andExpr(); n = { t: 'or', a: n, b: r }; }
    return n;
  }
  function andExpr(): Node {
    let n: Node | null = null;
    for (;;) {
      const t = peek();
      if (!t || t.k === ')' || (t.k === 'word' && !t.quoted && t.v === 'OR')) break;
      if (t.k === 'word' && !t.quoted && t.v === 'AND') { p++; continue; }
      const u = unary();
      n = n ? { t: 'and', a: n, b: u } : u;
    }
    return n ?? { t: 'all' };
  }
  function unary(): Node {
    const t = peek();
    if (!t || t.k === ')') return { t: 'all' };   // NOT / - with nothing after it
    if (t.k === 'word' && !t.quoted && t.v === 'NOT') { p++; return { t: 'not', a: unary() }; }
    if (t.k === 'word' && !t.quoted && t.v.startsWith('-') && t.v.length > 1) { toks[p] = { ...t, v: t.v.slice(1) }; return { t: 'not', a: unary() }; }
    if (t.k === '(') {
      p++;
      const n = orExpr();
      if (peek() && peek().k === ')') p++;   // a missing ) closes at the end
      return n;
    }
    p++;
    return term(t.v);
  }
  function term(w: string): Node {
    const m = /^(tag|url|title|folder):(.*)$/i.exec(w);
    if (m) return { t: 'term', field: m[1].toLowerCase() as 'tag', value: m[2].toLowerCase() };
    if (w.startsWith('#') && w.length > 1) return { t: 'term', field: 'tag', value: w.slice(1).toLowerCase() };
    return { t: 'term', field: 'any', value: w.toLowerCase() };
  }
  const n = orExpr();
  while (p < toks.length) { p++; }   // a stray ) is ignored
  return n;
}

const hasTag = (tags: string[], v: string) => tags.some((t) => { const x = t.toLowerCase(); return x === v || x.startsWith(v + '/'); });

export function matches(b: Bookmark, n: Node): boolean {
  switch (n.t) {
    case 'all': return true;
    case 'and': return matches(b, n.a) && matches(b, n.b);
    case 'or': return matches(b, n.a) || matches(b, n.b);
    case 'not': return !matches(b, n.a);
    case 'term': {
      const v = n.value;
      if (n.field === 'tag') return hasTag(b.tags, v);
      if (n.field === 'url') return b.url.toLowerCase().includes(v);
      if (n.field === 'title') return b.title.toLowerCase().includes(v);
      if (n.field === 'folder') return b.folder.toLowerCase().includes(v);
      return b.title.toLowerCase().includes(v) || b.url.toLowerCase().includes(v);
    }
  }
}

export function search(all: Bookmark[], q: string): Bookmark[] {
  const n = parse(q);
  return all.filter((b) => matches(b, n));
}
