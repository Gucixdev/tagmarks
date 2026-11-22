# tagmarks

One Firefox extension instead of several: a sidebar for bookmarks and tab sessions in a searchable tag tree, plus modules
you switch on in its options (cookie autodelete, dark pages, tracker block, idle tab unloading).

The sidebar shows bookmarks with tags. Your bookmarks stay Firefox's own; the tags live in the extension's storage,
keyed by URL.

- tags can be nested: `games/rpg` puts a bookmark under games > rpg, and `#games` finds everything below it
- search language: `#tag`, `-#tag`, `url:x`, `title:x`, `folder:x`, `"a phrase"`, `A OR B`, `( )`; a space means AND
- results are shown as a tree grouped by tag; **open all** opens a group (and its sub-groups) as tabs, in a tab group when
  your Firefox has them
- saved queries: name the current query (`work/reading`), reuse it as `@work/reading`, also inside other queries
  (`@work/reading -#done`); a loop or unknown name matches nothing
- tags export/import as text: one line per bookmark, `url<TAB>tag,tag`

## Sessions

`save tabs` stores the web pages open in the window under a name (`work #job #docs`: name first, then tags). A session is
shown in the same tree as `session/<name>` and is found by `#session/work` or `#session`, so search, tags, saved queries
and **open all** work on it like on bookmarks. Saving under an existing name replaces it; `about:` pages are skipped.

## Modules (options page, the gear button)

All off by default; a switch takes effect at once. The whole config is JSON you can copy out and in (dotfiles-friendly).

- **cookie autodelete**: 15 s after a tab closes, cookies of sites no tab shows any more are deleted, per container jar;
  a keep list protects hosts
- **dark pages**: inverts page colours (images and video are inverted back); a skip list for hosts
- **block third-party trackers**: a short built-in list (+ yours); first-party and page loads are never blocked. Not a
  replacement for uBlock Origin
- **unload idle tabs**: after N minutes, never the active, pinned or playing ones

Meant to be installed alongside, not rebuilt here: uBlock Origin, Multi-Account Containers (ctxprefs adds headers/proxy per
container), Bitwarden, Mullvad Browser extension, Search by Image, Read Aloud.

## Build and test

    ./build      # TypeScript -> dist/ with Node's own type stripper, no npm; needs Node 23.2 or newer
    ./pack       # dist/ zipped into tagmarks.xpi (unsigned; load via about:debugging or an unbranded build)
    ./bench      # query and tree timings on 20000 generated bookmarks (all under 40 ms here)
    ./test       # unit tests (query, tree, tags, sessions, modules) + the background page against a stub browser

Load `dist/` in Firefox through `about:debugging` > This Firefox > Load Temporary Add-on > `dist/manifest.json`.
Open the sidebar with Alt+B.

## Status

Query language, tree and tag code are covered by tests. The sidebar page was checked in a real headless Firefox with a fake
`browser` API (`tests/fake-browser.js`); the real bookmarks API was not exercised, and Firefox blocks automation from
opening `moz-extension://` pages. Per-container settings are a separate extension, ctxprefs. Sessions and modules are tested as plain logic plus a stub-browser run of the background page; the real cookies,
webRequest, insertCSS and discard calls were not exercised in a live Firefox. Not done yet: a signed release, nested display of saved queries, folding ctxprefs in.
