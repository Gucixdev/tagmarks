// Options page: one switch per module and the small lists they use. Saved to storage.local `modules`; background.ts
// listens for the change. Config can also be copied out and in as JSON, so it can live in a dotfiles repo.
import { normaliseConfig, SWITCHES, type Config } from './modules.ts';

declare const browser: any;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const LISTS = ['keepCookies', 'darkExclude', 'trackers'] as const;

function show(c: Config) {
  for (const s of SWITCHES) ($(s) as HTMLInputElement).checked = c[s];
  for (const l of LISTS) ($(l) as HTMLTextAreaElement).value = c[l].join('\n');
  ($('discardMinutes') as HTMLInputElement).value = String(c.discardMinutes);
  ($('json') as HTMLTextAreaElement).value = JSON.stringify(c, null, 2);
}

function read(): Config {
  const o: Record<string, unknown> = {};
  for (const s of SWITCHES) o[s] = ($(s) as HTMLInputElement).checked;
  for (const l of LISTS) o[l] = ($(l) as HTMLTextAreaElement).value.split('\n');
  o.discardMinutes = ($('discardMinutes') as HTMLInputElement).value;
  return normaliseConfig(o);
}

async function save(c: Config) {
  await browser.storage.local.set({ modules: c });
  show(c);
  $('status').textContent = 'saved';
}

browser.storage.local.get('modules').then((st: any) => show(normaliseConfig(st.modules)));
$('save').addEventListener('click', () => save(read()));
$('load').addEventListener('click', () => {
  try { save(normaliseConfig(JSON.parse(($('json') as HTMLTextAreaElement).value))); } catch { $('status').textContent = 'that is not valid JSON'; }
});
