// Background page: wires the modules of modules.ts to the real browser events. Each module is off until the options
// page switches it on; every listener checks the live config, so a switch takes effect at once.
import { normaliseConfig, cookiesToDelete, isTracker, toDiscard, darkFor, hostOf, DARK_CSS, type Config } from './modules.ts';

declare const browser: any;

let cfg: Config = normaliseConfig(null);

// ---- trackers
browser.webRequest.onBeforeRequest.addListener(
  (d: any) => (cfg.trackerBlock && d.type !== 'main_frame' && isTracker(d.url, d.documentUrl || d.originUrl, cfg.trackers) ? { cancel: true } : {}),
  { urls: ['<all_urls>'] }, ['blocking']);

// ---- cookies: a sweep a little after a tab closes, per cookie store (containers keep their own jars)
let sweepTimer: ReturnType<typeof setTimeout> | undefined;
async function sweep() {
  if (!cfg.cookieAutoDelete) return;
  const tabs: any[] = await browser.tabs.query({});
  for (const store of await browser.cookies.getAllCookieStores()) {
    const hosts = tabs.filter((t) => (t.cookieStoreId ?? 'firefox-default') === store.id).map((t) => hostOf(t.url || '')).filter(Boolean);
    const all: any[] = await browser.cookies.getAll({ storeId: store.id });
    for (const c of cookiesToDelete(all, hosts, cfg.keepCookies)) {
      const url = (c.secure ? 'https://' : 'http://') + c.domain.replace(/^\./, '') + c.path;
      await browser.cookies.remove({ url, name: c.name, storeId: c.storeId, firstPartyDomain: c.firstPartyDomain }).catch(() => {});
    }
  }
}
browser.tabs.onRemoved.addListener(() => { clearTimeout(sweepTimer); sweepTimer = setTimeout(() => sweep().catch(() => {}), 15000); });

// ---- dark mode
async function dark(tab: any, on: boolean) {
  if (!tab.url) return;
  try {
    if (on) { const css = darkFor(tab.url, cfg.darkExclude); if (css) await browser.tabs.insertCSS(tab.id, { code: css, runAt: 'document_start' }); }
    else await browser.tabs.removeCSS(tab.id, { code: DARK_CSS });
  } catch { /* pages the browser does not let us touch */ }
}
browser.tabs.onUpdated.addListener((id: number, ch: any, tab: any) => { if (cfg.darkMode && ch.status === 'loading') dark({ ...tab, id }, true); });

// ---- discard
const ALARM = 'tagmarks-discard';
async function discardIdle() {
  if (!cfg.autoDiscard) return;
  const tabs: any[] = await browser.tabs.query({});
  const ids = toDiscard(tabs, Date.now(), cfg.discardMinutes);
  if (ids.length) await browser.tabs.discard(ids).catch(() => {});
}
browser.alarms.onAlarm.addListener((a: any) => { if (a.name === ALARM) discardIdle().catch(() => {}); });

async function apply(was: Config | null) {
  if (cfg.autoDiscard) browser.alarms.create(ALARM, { periodInMinutes: 1 }); else browser.alarms.clear(ALARM);
  if (!was || was.darkMode !== cfg.darkMode || was.darkExclude.join() !== cfg.darkExclude.join()) {
    for (const t of await browser.tabs.query({})) { await dark(t, false); if (cfg.darkMode) await dark(t, true); }
  }
}

browser.storage.onChanged.addListener((ch: any, area: string) => {
  if (area !== 'local' || !ch.modules) return;
  const was = cfg;
  cfg = normaliseConfig(ch.modules.newValue);
  apply(was).catch(() => {});
});
browser.storage.local.get('modules').then((st: any) => { cfg = normaliseConfig(st.modules); return apply(null); }).catch(() => {});
