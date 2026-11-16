// Sidebar UI of the extension. Everything the user can influence is put into the page with textContent, never innerHTML.
import { search, type Bookmark } from './query.ts';
import { groupByTag, flatten, type Group } from './tree.ts';
import { parseTags, setTags, allTags, exportTags, importTags, type TagMap } from './tags.ts';

declare const browser: any;

type BmNode = { id: string; title?: string; url?: string; children?: BmNode[] };

let tags: TagMap = {};          // keyed by URL, so tags survive a changed bookmark id and match the text export
let all: Bookmark[] = [];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function collect(n: BmNode, path: string[], out: Bookmark[]) {
  if (n.url && /^(https?|ftp|file):/i.test(n.url)) out.push({ id: n.id, title: n.title || n.url, url: n.url, folder: path.join('/'), tags: tags[n.url] ?? [] });
  for (const c of n.children ?? []) collect(c, n.url || !n.title ? path : [...path, n.title], out);
}

async function load() {
  const st = await browser.storage.local.get('tags');
  tags = st.tags && typeof st.tags === 'object' ? st.tags : {};
  const tree: BmNode[] = await browser.bookmarks.getTree();
  all = [];
  for (const r of tree) collect(r, [], all);
}

async function save() { await browser.storage.local.set({ tags }); }

async function openAll(list: Bookmark[], name: string) {
  if (list.length > 20 && !confirm('Open ' + list.length + ' tabs?')) return;
  const ids: number[] = [];
  for (const b of list) { const t = await browser.tabs.create({ url: b.url, active: false }); ids.push(t.id); }
  if (ids.length && browser.tabs.group) {          // tab groups exist in newer Firefox only
    try { const gid = await browser.tabs.group({ tabIds: ids }); await browser.tabGroups?.update(gid, { title: name }); } catch { /* no groups here */ }
  }
}

function row(b: Bookmark): HTMLElement {
  const li = el('li', 'bm');
  const a = el('a', 'title', b.title);
  a.href = b.url; a.title = b.url;
  a.addEventListener('click', (e) => { e.preventDefault(); browser.tabs.create({ url: b.url }); });
  const t = el('span', 'tags', b.tags.join('  '));
  const edit = el('button', 'edit', 'tags');
  edit.addEventListener('click', () => {
    const inp = el('input', 'tagedit') as HTMLInputElement;
    inp.value = b.tags.join(', ');
    inp.placeholder = 'tag, games/rpg, ...';
    const done = async (ok: boolean) => {
      if (ok) { tags = setTags(tags, b.url, parseTags(inp.value)); await save(); await load(); }
      render();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
    inp.addEventListener('blur', () => done(true));
    li.replaceChildren(inp); inp.focus();
  });
  li.append(a, t, edit);
  return li;
}

function groupEl(g: Group, depth: number): HTMLElement {
  const d = el('details', 'group') as HTMLDetailsElement;
  d.open = depth < 1 || g.total <= 6;
  const s = el('summary');
  s.append(el('span', 'gname', g.name), el('span', 'count', String(g.total)));
  const open = el('button', 'openall', 'open all');
  open.addEventListener('click', (e) => { e.preventDefault(); openAll(flatten(g), g.name); });
  s.append(open);
  d.append(s);
  for (const k of g.kids) d.append(groupEl(k, depth + 1));
  if (g.items.length) { const ul = el('ul'); for (const b of g.items) ul.append(row(b)); d.append(ul); }
  return d;
}

function render() {
  const q = ($('q') as HTMLInputElement).value;
  const found = search(all, q);
  const root = groupByTag(found);
  const box = $('tree');
  box.replaceChildren();
  for (const k of root.kids) box.append(groupEl(k, 0));
  $('status').textContent = found.length + ' of ' + all.length + ' bookmarks';
  const top = allTags(tags).slice(0, 12);
  const chips = $('chips'); chips.replaceChildren();
  for (const { tag, n } of top) {
    const c = el('button', 'chip', '#' + tag + ' ' + n);
    c.addEventListener('click', () => { const i = $('q') as HTMLInputElement; i.value = (i.value.trim() + ' #' + tag).trim(); render(); });
    chips.append(c);
  }
  const openres = $('openres') as HTMLButtonElement; openres.disabled = !found.length;
  openres.onclick = () => openAll(found, q || 'bookmarks');
}

function wire() {
  $('q').addEventListener('input', render);
  $('exp').addEventListener('click', () => { ($('io') as HTMLTextAreaElement).value = exportTags(tags, (u) => u); });
  $('imp').addEventListener('click', async () => {
    const m = importTags(($('io') as HTMLTextAreaElement).value);
    for (const [u, t] of m) tags = setTags(tags, u, t);
    await save(); await load(); render();
    $('status').textContent = 'imported tags for ' + m.size + ' urls';
  });
  browser.bookmarks.onCreated?.addListener(() => load().then(render));
  browser.bookmarks.onRemoved?.addListener(() => load().then(render));
  browser.bookmarks.onChanged?.addListener(() => load().then(render));
  browser.bookmarks.onMoved?.addListener(() => load().then(render));
}

load().then(() => { wire(); render(); }).catch((e) => { $('status').textContent = 'error: ' + e; });
