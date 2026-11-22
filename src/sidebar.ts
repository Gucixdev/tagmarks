// Sidebar UI of the extension. Everything the user can influence is put into the page with textContent, never innerHTML.
import { search, type Bookmark, type Saved } from './query.ts';
import { groupByTag, flatten, type Group } from './tree.ts';
import { parseTags, setTags, allTags, exportTags, importTags, type TagMap } from './tags.ts';
import { saveSession, deleteSession, sessionBookmarks, parseSessionInput, type Sessions } from './sessions.ts';

declare const browser: any;

type BmNode = { id: string; title?: string; url?: string; children?: BmNode[] };

let tags: TagMap = {};          // keyed by URL, so tags survive a changed bookmark id and match the text export
let all: Bookmark[] = [];
let sessions: Sessions = {};     // name -> open tabs saved as a session, shown in the tree as session/<name>
let saved: Saved = {};          // name -> query text, `@name` in a query expands it

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

function collect(n: BmNode, path: string[], out: Bookmark[]) {
  if (n.url && /^(https?|ftp|file):/i.test(n.url)) out.push({ id: n.id, title: n.title || n.url, url: n.url, folder: path.join('/'), tags: tags[n.url] ?? [] });
  for (const c of n.children ?? []) collect(c, n.url || !n.title ? path : [...path, n.title], out);
}

async function load() {
  const st = await browser.storage.local.get(['tags', 'saved', 'sessions']);
  sessions = st.sessions && typeof st.sessions === 'object' ? st.sessions : {};
  tags = st.tags && typeof st.tags === 'object' ? st.tags : {};
  saved = st.saved && typeof st.saved === 'object' ? st.saved : {};
  const tree: BmNode[] = await browser.bookmarks.getTree();
  all = [];
  for (const r of tree) collect(r, [], all);
  all.push(...sessionBookmarks(sessions, (u) => tags[u] ?? []));
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
  const found = search(all, q, saved);
  const root = groupByTag(found);
  const box = $('tree');
  box.replaceChildren();
  for (const k of root.kids) box.append(groupEl(k, 0));
  $('status').textContent = found.length + ' of ' + all.length + ' entries';
  const top = allTags(tags).slice(0, 12);
  const chips = $('chips'); chips.replaceChildren();
  for (const { tag, n } of top) {
    const c = el('button', 'chip', '#' + tag + ' ' + n);
    c.addEventListener('click', () => { const i = $('q') as HTMLInputElement; i.value = (i.value.trim() + ' #' + tag).trim(); render(); });
    chips.append(c);
  }
  const sq = $('saved'); sq.replaceChildren();
  for (const name of Object.keys(saved).sort()) {
    const c = el('button', 'chip', '@' + name); c.title = saved[name];
    c.addEventListener('click', () => { const i = $('q') as HTMLInputElement; i.value = (i.value.trim() + ' @' + name).trim(); render(); });
    const x = el('button', 'chip del', '×'); x.title = 'delete saved query ' + name;
    x.addEventListener('click', async () => { const n = { ...saved }; delete n[name]; saved = n; await browser.storage.local.set({ saved }); render(); });
    sq.append(c, x);
  }
  const ss = $('sessions'); ss.replaceChildren();
  for (const name of Object.keys(sessions).sort()) {
    const c = el('button', 'chip', 'session/' + name + ' ' + sessions[name].tabs.length); c.title = 'filter by this session';
    c.addEventListener('click', () => { const i = $('q') as HTMLInputElement; i.value = (i.value.trim() + ' #session/' + name).trim(); render(); });
    const x = el('button', 'chip del', '×'); x.title = 'delete session ' + name;
    x.addEventListener('click', async () => { sessions = deleteSession(sessions, name); await browser.storage.local.set({ sessions }); await load(); render(); });
    ss.append(c, x);
  }
  const openres = $('openres') as HTMLButtonElement; openres.disabled = !found.length;
  openres.onclick = () => openAll(found, q || 'bookmarks');
}

function wire() {
  $('q').addEventListener('input', render);
  $('savebtn').addEventListener('click', async () => {
    const name = ($('savename') as HTMLInputElement).value.trim().toLowerCase().replace(/\s+/g, '-');
    const q = ($('q') as HTMLInputElement).value.trim();
    if (!name || !q || /[()"]/.test(name)) { $('status').textContent = 'type a query and a name (no quotes or brackets)'; return; }
    saved = { ...saved, [name]: q }; await browser.storage.local.set({ saved });
    ($('savename') as HTMLInputElement).value = ''; render();
  });
  $('sessbtn').addEventListener('click', async () => {
    const { name, tags: st } = parseSessionInput(($('sessname') as HTMLInputElement).value);
    const tabs = await browser.tabs.query({ currentWindow: true });
    const next = saveSession(sessions, name, tabs, st, Date.now());
    if (!next) { $('status').textContent = 'give the session a name; it needs at least one web page open'; return; }
    sessions = next; await browser.storage.local.set({ sessions });
    ($('sessname') as HTMLInputElement).value = ''; await load(); render();
  });
  $('optbtn').addEventListener('click', () => browser.runtime.openOptionsPage());
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
