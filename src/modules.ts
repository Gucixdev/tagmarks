// The modules: small things other extensions do, as switches in one config. Everything here is plain logic with no
// browser calls, so it is unit tested; background.ts wires it to the real events.
export type Config = {
  cookieAutoDelete: boolean;   // when a tab closes, delete cookies of sites that are no longer open
  darkMode: boolean;           // dark pages by inverting the page colours (images and video stay as they are)
  trackerBlock: boolean;       // block third-party requests to known tracker domains
  autoDiscard: boolean;        // unload tabs you have not looked at for a while
  keepCookies: string[];       // hosts whose cookies cookieAutoDelete never touches
  darkExclude: string[];       // hosts darkMode skips
  trackers: string[];          // extra tracker domains on top of the built-in list
  discardMinutes: number;
};

export const DEFAULTS: Config = { cookieAutoDelete: false, darkMode: false, trackerBlock: false, autoDiscard: false, keepCookies: [], darkExclude: [], trackers: [], discardMinutes: 30 };

export const SWITCHES = ['cookieAutoDelete', 'darkMode', 'trackerBlock', 'autoDiscard'] as const;

// a short built-in list; the full lists are what uBlock Origin is for, this only catches the loudest
export const BUILTIN_TRACKERS = ['doubleclick.net', 'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com', 'facebook.net', 'connect.facebook.com', 'scorecardresearch.com', 'hotjar.com', 'segment.io', 'mixpanel.com', 'adnxs.com', 'criteo.com', 'taboola.com', 'outbrain.com', 'quantserve.com', 'amplitude.com'];

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x).trim().toLowerCase().replace(/^\./, '')).filter(Boolean) : []);

// whatever is in storage or in an imported file becomes a valid Config; unknown keys are dropped
export function normaliseConfig(raw: unknown): Config {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const m = Number(r.discardMinutes);
  return {
    cookieAutoDelete: r.cookieAutoDelete === true, darkMode: r.darkMode === true, trackerBlock: r.trackerBlock === true, autoDiscard: r.autoDiscard === true,
    keepCookies: list(r.keepCookies), darkExclude: list(r.darkExclude), trackers: list(r.trackers),
    discardMinutes: Number.isFinite(m) ? Math.min(1440, Math.max(1, Math.round(m))) : DEFAULTS.discardMinutes,
  };
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

// `a.b.example.com` is under `example.com`; `badexample.com` is not
export function under(host: string, domain: string): boolean {
  const d = domain.replace(/^\./, '').toLowerCase();
  return !!d && (host === d || host.endsWith('.' + d));
}

// ---- cookie autodelete

// cookies whose domain belongs to no open tab and is not kept
export function cookiesToDelete<C extends { domain: string }>(cookies: C[], openHosts: string[], keep: string[]): C[] {
  return cookies.filter((c) => !openHosts.some((h) => under(h, c.domain) || under(c.domain.replace(/^\./, ''), h)) && !keep.some((k) => under(c.domain.replace(/^\./, ''), k)));
}

// ---- tracker block

// a rough "same site": the last two labels (wrong for co.uk style names, which only makes blocking a bit more eager)
export function site(host: string): string { return host.split('.').slice(-2).join('.'); }

export function isTracker(requestUrl: string, pageUrl: string | undefined, extra: string[]): boolean {
  const h = hostOf(requestUrl), p = pageUrl ? hostOf(pageUrl) : '';
  if (!h || (p && site(h) === site(p))) return false;       // first party is never blocked
  return BUILTIN_TRACKERS.some((d) => under(h, d)) || extra.some((d) => under(h, d));
}

// ---- auto discard

export type TabInfo = { id: number; active: boolean; pinned: boolean; audible: boolean; discarded: boolean; lastAccessed: number; url?: string };

export function toDiscard(tabs: TabInfo[], now: number, idleMinutes: number): number[] {
  const idle = idleMinutes * 60000;
  return tabs.filter((t) => !t.active && !t.pinned && !t.audible && !t.discarded && t.url && /^(https?|file):/i.test(t.url) && now - t.lastAccessed >= idle).map((t) => t.id);
}

// ---- dark mode

export const DARK_CSS = 'html{filter:invert(1) hue-rotate(180deg) !important;background:#fff}img,picture,video,canvas,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg) !important}';

export function darkFor(url: string, exclude: string[]): string {
  const h = hostOf(url);
  return h && /^(https?|file):/i.test(url) && !exclude.some((d) => under(h, d)) ? DARK_CSS : '';
}
