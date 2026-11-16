# tagmarks

Firefox sidebar for bookmarks with tags. Your bookmarks stay Firefox's own; the tags live in the extension's storage,
keyed by URL.

- tags can be nested: `games/rpg` puts a bookmark under games > rpg, and `#games` finds everything below it
- search language: `#tag`, `-#tag`, `url:x`, `title:x`, `folder:x`, `"a phrase"`, `A OR B`, `( )`; a space means AND
- results are shown as a tree grouped by tag; **open all** opens a group (and its sub-groups) as tabs, in a tab group when
  your Firefox has them
- saved queries: name the current query (`work/reading`), reuse it as `@work/reading`, also inside other queries
  (`@work/reading -#done`); a loop or unknown name matches nothing
- tags export/import as text: one line per bookmark, `url<TAB>tag,tag`

## Build and test

    ./build      # TypeScript -> dist/ with Node's own type stripper, no npm; needs Node 23.2 or newer
    ./bench      # query and tree timings on 20000 generated bookmarks (all under 40 ms here)
    ./test       # unit tests of the query language, tree and tags (node:test)

Load `dist/` in Firefox through `about:debugging` > This Firefox > Load Temporary Add-on > `dist/manifest.json`.
Open the sidebar with Alt+B.

## Status

Query language, tree and tag code are covered by tests. The sidebar page was checked in a real headless Firefox with a fake
`browser` API (`tests/fake-browser.js`); the real bookmarks API was not exercised, and Firefox blocks automation from
opening `moz-extension://` pages. Per-container settings are a separate extension, ctxprefs. Not done yet: a signed release, nested display of saved queries.
