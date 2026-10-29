'use strict';
// Modelled from the rendered public Bluesky post and Spotify card DOM observed
// during this review. These are DOM/API simulations, not Firefox/site certification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const bskyPage = 'https://bsky.app/profile/womensartbluesky.bsky.social/post/3myogvioii225';
const bskyMedia = 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:u2zs2typsklaohqmfyxiunvy/bafkreify7n3wp4lfmfjvjku3gmfbuy24ztpswt5olbv5gjjzu5zt7clsye';
const bskyComment = 'https://bsky.app/profile/bnerlich.bsky.social/post/3myoopycfkc2q';
const spotifyPage = 'https://open.spotify.com/';
const albumId = '7aJuG4TFXa2hmE4z1yxc3n';
const albumURL = 'https://open.spotify.com/album/' + albumId;
let count = 0;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function test(name, fn) { await fn(); count++; console.log('PASS site adapter', name); }

function MockHTMLElement() {}
MockHTMLElement.prototype.click = function () { this.activations = (this.activations || 0) + 1; };
function matches(node, selector) {
  if (selector === 'a[href]') return node.localName === 'a' && node.hasAttribute('href');
  if (selector === 'img') return node.localName === 'img';
  throw Error('Unexpected test selector: ' + selector);
}
function element(localName, attrs = {}, children = [], extra = {}) {
  const node = Object.assign(new MockHTMLElement(), {nodeType: 1, localName, attrs, children,
    parentElement: null, ownerDocument: null, isConnected: true,
    hasAttribute(key) {return Object.hasOwn(this.attrs, key);},
    getAttribute(key) {return this.attrs[key] ?? null;},
    querySelectorAll(selector) {
      const found = [];
      const walk = parent => { for (const child of parent.children) {if (matches(child, selector)) found.push(child); walk(child);} };
      walk(this); return found;
    },
    closest(selector) {for (let n = this; n; n = n.parentElement) if (matches(n, selector)) return n; return null;},
    contains(other) {for (let n = other; n; n = n.parentElement) if (n === this) return true; return false;},
    ...extra});
  for (const child of children) child.parentElement = node;
  return node;
}
function attach(nodes, page) {
  const ids = new Map();
  const document = {baseURI: page, getElementById: id => ids.get(id) || null};
  const seen = new Set();
  const walk = node => {
    if (!node || seen.has(node)) return;
    seen.add(node); node.ownerDocument = document;
    if (node.hasAttribute('id')) ids.set(node.getAttribute('id'), node);
    for (const child of node.children) walk(child);
  };
  for (const node of nodes) {let top = node; while (top.parentElement) top = top.parentElement; walk(top);}
  return document;
}
function pathFrom(node) {const nodes = []; for (let n = node; n; n = n.parentElement) nodes.push(n); return nodes;}
function imageFixture(options = {}) {
  const label = 'Painted stained glass artwork featuring an image of a cat sitting on a pile of books';
  const image = element('img', {src: options.src || bskyMedia, alt: label}, [], {currentSrc: options.currentSrc || ''});
  const badge = element('span', {}, [], {textContent: 'ALT'});
  const imageWrapper = element('div', {'data-expoimage': 'true'}, [image]);
  const button = element('button', {role: 'button', 'aria-label': options.label || label, type: 'button'}, [imageWrapper, badge]);
  return {image, button, badge};
}
function cardFixture(options = {}) {
  const author = options.author || 'bnerlich.bsky.social';
  const content = element('span', {}, [], {textContent: "I'd love that!"});
  const avatar = element('a', {href: '/profile/' + author}, []);
  const profile = element('a', {href: '/profile/' + author}, []);
  const time = element('a', {href: options.href || '/profile/' + author + '/post/3myoopycfkc2q', 'aria-label': '25 October 2026 at 00:29'});
  const action = element('button', {role: 'button', 'aria-label': 'Reply (0 replies)'});
  const extraLinks = options.extraLinks || [];
  const card = element('div', {role: 'link', tabindex: '0', 'data-testid': (options.prefix || 'postThreadItem-by-') + author},
    [avatar, profile, time, content, action, ...extraLinks]);
  return {card, content, time, action};
}
function spotifyFixture(options = {}) {
  const titleId = 'card-title-spotify:album:' + albumId + '-2';
  const subtitleId = 'card-subtitle-spotify:album:' + albumId + '-2';
  const title = element('p', {id: titleId}, [], {textContent: 'Album title'});
  const titleLink = element('a', {href: options.href || '/album/' + albumId}, [title]);
  const artist = element('a', {href: '/artist/1234567890'}, [], {textContent: 'Artist'});
  const artwork = element('img', {src: 'https://i.scdn.co/image/test-cover'});
  const overlay = element('div', {role: 'button', 'aria-labelledby': titleId + ' ' + subtitleId});
  const play = element('button', {'aria-label': 'Play Album title'});
  const card = element('div', {'data-encore-id': 'card', role: 'listitem', 'aria-labelledby': titleId}, [artwork, overlay, titleLink, artist, play]);
  return {card, overlay, title, titleLink, artist, play, artwork, titleId};
}
const resolver = vm.createContext({URL});
vm.runInContext(fs.readFileSync(path.join(root, 'resolver.js'), 'utf8'), resolver);
function resolve(nodes, page = bskyPage, base = page) {
  attach(nodes, base);
  return resolver.FNT.resolve(nodes, base, page);
}
async function contentGesture(target, page) {
  const nodes = pathFrom(target);
  const document = attach(nodes, page);
  const handlers = {}, sent = [];
  const browser = {storage: {onChanged: {addListener() {}}, local: {get: () => Promise.resolve({enabled: true})}},
    runtime: {sendMessage(message) {sent.push(message); return Promise.resolve({ok: true});}}};
  const context = vm.createContext({URL, Date, HTMLElement: MockHTMLElement, document, location: {href: page}, browser,
    window: {addEventListener(type, handler) {handlers[type] = handler;}}});
  for (const file of ['resolver.js', 'content.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  await flush();
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick']) {
    const event = {type, isTrusted: true, button: 1, cancelable: true, composedPath: () => nodes,
      preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}};
    handlers[type](event); assert.ok(event.prevented && event.stopped, type + ' is suppressed');
  }
  await flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'fnt-open', 'known route bypasses discovery');
  for (const node of nodes) assert.equal(node.activations, undefined, 'source control was not activated');
  return sent[0].url;
}

(async () => {
  await test('exact supplied Bluesky post image exposes its displayed CDN address', () => {
    const f = imageFixture(); assert.equal(resolve(pathFrom(f.image)), bskyMedia);
  });
  await test('Bluesky currentSrc is used when the browser chose another displayed size', () => {
    const f = imageFixture({currentSrc: bskyMedia.replace('feed_thumbnail', 'feed_fullsize')});
    assert.equal(resolve(pathFrom(f.image)), bskyMedia.replace('feed_thumbnail', 'feed_fullsize'));
  });
  await test('Bluesky ALT overlay resolves only its labelled single image', () => {
    const f = imageFixture(); assert.equal(resolve(pathFrom(f.badge)), bskyMedia);
  });
  await test('mismatched image label and multi-image buttons are not guessed', () => {
    const wrong = imageFixture({label: 'Something else'}); assert.equal(resolve(pathFrom(wrong.badge)), null);
    const many = imageFixture(); const other = element('img', {src: bskyMedia, alt: 'Second'});
    many.button.children.push(other); other.parentElement = many.button;
    assert.equal(resolve(pathFrom(many.badge)), null);
  });
  await test('Bluesky avatar and non-media CDN paths remain outside the image shortcut', () => {
    for (const src of ['https://cdn.bsky.app/img/avatar/plain/user/image', 'https://cdn.bsky.app/img/banner/plain/user/image', 'https://example.test/img/feed_thumbnail/image']) {
      const f = imageFixture({src}); assert.equal(resolve(pathFrom(f.image)), null);
    }
  });
  await test('real enclosing links keep precedence over image/card heuristics', () => {
    const f = imageFixture(); const link = element('a', {href: '/profile/another.example'}, [f.button]);
    assert.equal(resolve(pathFrom(f.image)), 'https://bsky.app/profile/another.example');
  });
  await test('comment-card background resolves its own timestamp permalink', () => {
    const f = cardFixture(); assert.equal(resolve(pathFrom(f.content)), bskyComment);
  });
  await test('post/feed card ignores profiles, route suffixes and other-author quoted links', () => {
    const f = cardFixture({prefix: 'feedItem-by-', extraLinks: [
      element('a', {href: '/profile/bnerlich.bsky.social/post/3myoopycfkc2q/liked-by'}),
      element('a', {href: '/profile/quoted.example/post/3abc123'}),
      element('a', {href: '/hashtag/Art'})]});
    assert.equal(resolve(pathFrom(f.content)), bskyComment);
  });
  await test('two distinct own-author post routes are ambiguous, never first-link guessed', () => {
    const f = cardFixture({extraLinks: [element('a', {href: '/profile/bnerlich.bsky.social/post/3different'})]});
    assert.equal(resolve(pathFrom(f.content)), null);
  });
  await test('foreign-author-only and foreign-host permalinks are not card destinations', () => {
    for (const href of ['/profile/someone.else/post/3abc123', 'https://example.test/profile/bnerlich.bsky.social/post/3abc123']) {
      const f = cardFixture({href}); assert.equal(resolve(pathFrom(f.content)), null);
    }
  });
  await test('Reply/Like/menu controls do not become the surrounding Bluesky post route', () => {
    const f = cardFixture(); assert.equal(resolve(pathFrom(f.action)), null);
    const editable = element('div', {role: 'textbox'}); f.card.children.push(editable); editable.parentElement = f.card;
    assert.equal(resolve(pathFrom(editable)), null);
  });
  await test('arbitrary role=link containers are not scanned as Bluesky post cards', () => {
    const content = element('span'); const card = element('div', {role:'link'}, [content, element('a',{href:'/profile/bnerlich.bsky.social/post/3myoopycfkc2q'})]);
    assert.equal(resolve(pathFrom(content)), null);
  });
  await test('site identity comes from page URL rather than a potentially different base', () => {
    const f = imageFixture();
    assert.equal(resolve(pathFrom(f.image), bskyPage, 'https://assets.example.test/'), bskyMedia);
    assert.equal(resolve(pathFrom(f.image), 'https://example.test/', bskyPage), null);
  });
  await test('Spotify artwork overlay resolves the labelled album title, not the artist', () => {
    const f = spotifyFixture(); assert.equal(resolve(pathFrom(f.overlay), spotifyPage), albumURL);
    assert.equal(resolve(pathFrom(f.artist), spotifyPage), 'https://open.spotify.com/artist/1234567890');
  });
  await test('Spotify image/card space uses its specific album title link', () => {
    const f = spotifyFixture(); assert.equal(resolve(pathFrom(f.artwork), spotifyPage), albumURL);
  });
  await test('Spotify Play controls without shared title labelling remain actions', () => {
    const f = spotifyFixture(); assert.equal(resolve(pathFrom(f.play), spotifyPage), null);
  });
  await test('disabled Spotify overlays are not redirected to the card', () => {
    for (const attrs of [{disabled:''}, {'aria-disabled':'true'}]) {
      const f = spotifyFixture(); Object.assign(f.overlay.attrs, attrs);
      assert.equal(resolve(pathFrom(f.overlay), spotifyPage), null);
    }
  });
  await test('Spotify title IDs outside the card cannot supply its destination', () => {
    const f = spotifyFixture(); f.card.children = f.card.children.filter(node => node !== f.titleLink); f.titleLink.parentElement = null;
    const outer = element('div', {}, [f.card, f.titleLink]);
    assert.equal(resolve(pathFrom(f.overlay), spotifyPage), null);
  });
  await test('multiple labelled Spotify routes are ambiguous', () => {
    const f = spotifyFixture(); const secondId = 'card-title-spotify:album:Second123-3';
    const secondTitle = element('p', {id:secondId});
    const secondLink = element('a', {href:'/album/Second123'}, [secondTitle]);
    f.card.children.push(secondLink); secondLink.parentElement = f.card;
    f.card.attrs['aria-labelledby'] += ' ' + secondId;
    assert.equal(resolve(pathFrom(f.overlay), spotifyPage), null);
  });
  await test('Spotify title link must be a supported route on its own host', () => {
    for (const href of ['https://example.test/album/' + albumId, '/search/query', 'javascript:alert(1)']) {
      const f = spotifyFixture({href}); assert.equal(resolve(pathFrom(f.overlay), spotifyPage), null);
    }
  });
  await test('Bluesky image gesture opens directly without native source click', async () => {
    const f = imageFixture(); assert.equal(await contentGesture(f.image,bskyPage), bskyMedia);
  });
  await test('Bluesky image-overlay gesture also avoids source activation', async () => {
    const f = imageFixture(); assert.equal(await contentGesture(f.badge,bskyPage), bskyMedia);
  });
  await test('Bluesky comment gesture opens directly without native source click', async () => {
    const f = cardFixture(); assert.equal(await contentGesture(f.content,bskyPage), bskyComment);
  });
  await test('Spotify artwork-overlay gesture opens album without native source click', async () => {
    const f = spotifyFixture(); assert.equal(await contentGesture(f.overlay,spotifyPage), albumURL);
  });
  console.log(count + ' site-adapter regression tests passed (mocked DOM/API; real Firefox retest remains required).');
})().catch(error => {console.error(error); process.exitCode = 1;});

