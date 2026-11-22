// A stand-in for the WebExtension `browser` object, so the sidebar can be loaded as a plain web page in any browser.
(() => {
  const bm = (id, title, url) => ({ id, title, url });
  const tree = [{ id: 'root', title: '', children: [
    { id: 'menu', title: 'Bookmarks Menu', children: [
      bm('1', 'Godot docs', 'https://docs.godotengine.org/'),
      bm('2', 'Blender manual', 'https://docs.blender.org/'),
      { id: 'f1', title: 'Fun', children: [bm('4', 'Cat pictures', 'https://cats.example/')] },
    ] },
    { id: 'toolbar', title: 'Bookmarks Toolbar', children: [
      bm('3', 'Hollow Knight wiki', 'https://hollowknight.wiki/'),
      bm('5', 'Rust book', 'https://doc.rust-lang.org/book/'),
      bm('6', 'about page', 'about:preferences'),
    ] },
  ] }];
  let store = { tags: { 'https://docs.godotengine.org/': ['games/engine', 'docs'], 'https://docs.blender.org/': ['3d', 'docs'],
    'https://hollowknight.wiki/': ['games/metroidvania'], 'https://doc.rust-lang.org/book/': ['dev/rust', 'docs'] } };
  const noop = { addListener() {} };
  window.__opened = [];
  window.browser = {
    bookmarks: { getTree: async () => JSON.parse(JSON.stringify(tree)), onCreated: noop, onRemoved: noop, onChanged: noop, onMoved: noop },
    storage: { local: { get: async () => JSON.parse(JSON.stringify(store)), set: async (o) => { store = { ...store, ...JSON.parse(JSON.stringify(o)) }; window.__store = store; } } },
    runtime: { openOptionsPage: async () => { window.__opts = true; } },
    tabs: { query: async () => [{ url: 'https://docs.godotengine.org/', title: 'Godot docs' }, { url: 'about:blank', title: '' }, { url: 'https://cats.example/', title: 'Cats' }], create: async (o) => { window.__opened.push(o.url); return { id: window.__opened.length }; } },
  };
})()
