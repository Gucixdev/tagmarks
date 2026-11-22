// Tab sessions: the open tabs of a window saved under a name. A session is stored as plain data and shown in the same
// tag tree as bookmarks: every tab becomes an entry tagged `session/<name>` (plus the tags you gave the session), so
// `#session/work`, "open all" and the rest of the query language work on sessions with no extra code.
import type { Bookmark } from './query.ts';

export type SessionTab = { url: string; title: string };
export type Session = { tabs: SessionTab[]; tags: string[]; saved: number };
export type Sessions = Record<string, Session>;

const OK_URL = /^(https?|ftp|file):/i;

export function cleanName(s: string): string {
  return s.trim().toLowerCase().replace(/[()"]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
}

// keeps only real pages (no about:, moz-extension:), drops repeats, keeps order
export function sessionTabs(tabs: { url?: string; title?: string }[]): SessionTab[] {
  const seen = new Set<string>(), out: SessionTab[] = [];
  for (const t of tabs) {
    if (!t.url || !OK_URL.test(t.url) || seen.has(t.url)) continue;
    seen.add(t.url);
    out.push({ url: t.url, title: t.title || t.url });
  }
  return out;
}

// saving under an existing name replaces it; an empty result (nothing but about: pages) is refused
export function saveSession(all: Sessions, name: string, tabs: { url?: string; title?: string }[], tags: string[], now: number): Sessions | null {
  const n = cleanName(name), list = sessionTabs(tabs);
  if (!n || !list.length) return null;
  return { ...all, [n]: { tabs: list, tags: [...tags], saved: now } };
}

export function deleteSession(all: Sessions, name: string): Sessions {
  const n = { ...all };
  delete n[name];
  return n;
}

export function sessionBookmarks(all: Sessions, tagsOfUrl: (url: string) => string[]): Bookmark[] {
  const out: Bookmark[] = [];
  for (const name of Object.keys(all).sort()) {
    const s = all[name];
    s.tabs.forEach((t, i) => {
      const tags = ['session/' + name, ...s.tags, ...tagsOfUrl(t.url)];
      out.push({ id: 's:' + name + ':' + i, title: t.title, url: t.url, folder: 'session/' + name, tags: [...new Set(tags)] });
    });
  }
  return out;
}

// text form, so a session can be shared or kept in git: `# name<TAB>tag,tag` then `url<TAB>title` lines
export function exportSessions(all: Sessions): string {
  const lines: string[] = [];
  for (const name of Object.keys(all).sort()) {
    lines.push('# ' + name + '\t' + all[name].tags.join(','));
    for (const t of all[name].tabs) lines.push(t.url + '\t' + t.title.replace(/[\t\n]/g, ' '));
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}

export function importSessions(text: string, now: number): Sessions {
  const out: Sessions = {};
  let cur: string | null = null;
  for (const line of text.split('\n')) {
    if (line.startsWith('# ')) {
      const [raw, tags = ''] = line.slice(2).split('\t');
      cur = cleanName(raw);
      if (cur) out[cur] = { tabs: [], tags: tags.split(',').map((x) => x.trim()).filter(Boolean), saved: now };
    } else if (cur && line.includes('\t') && OK_URL.test(line)) {
      const i = line.indexOf('\t');
      out[cur].tabs.push({ url: line.slice(0, i), title: line.slice(i + 1) || line.slice(0, i) });
    }
  }
  for (const k of Object.keys(out)) if (!out[k].tabs.length) delete out[k];
  return out;
}

// the save box takes `work #job #docs`: the name first, then tags
export function parseSessionInput(s: string): { name: string; tags: string[] } {
  const i = s.indexOf('#');
  const head = i < 0 ? s : s.slice(0, i);
  const tags = i < 0 ? [] : s.slice(i).split('#').map((x) => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
  return { name: cleanName(head), tags: [...new Set(tags)] };
}
