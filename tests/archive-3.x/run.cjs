'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const clone = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject}; }
function MockHTMLElement() {}
MockHTMLElement.prototype.click = function () { if (this.nativeThrow) throw Error('activation failed'); this.activations = (this.activations || 0) + 1; if (this.onActivate) this.onActivate(); };
function el(localName, attrs = {}) { return Object.assign(new MockHTMLElement(), {nodeType: 1, localName, isConnected: true, hasAttribute: key => Object.hasOwn(attrs, key), getAttribute: key => attrs[key]}); }
const link = () => [el('span'), el('a', {href: '/destination'})];
const sender = (id = 1) => ({id: 'test', tab: {id, windowId: 3, cookieStoreId: 'firefox-container-2'}});
function harness(initial = {}, options = {}) {
  const h = {saved: {...initial}, listeners: {}, changes: [], sent: [], created: [], icons: [], titles: [], writes: [], now: 1000,
    failSave: false, tabMode: null, sendMode: null, armAck: {ok: true}, armDeferred: null, discoveryCalls: [], cancellationCalls: [], cancelAllCalls: 0, initialContentRead: options.deferContentRead ? deferred() : null};
  let getCalls = 0;
  const browser = {
    storage: {onChanged: {addListener(fn) {h.changes.push(fn);}}, local: {
      get(defaults) {
        getCalls++;
        const snapshot = {...defaults, ...h.saved};
        if (getCalls === 2 && h.initialContentRead) return h.initialContentRead.promise;
        if (options.rejectRead) return Promise.reject(Error('storage read failed'));
        return Promise.resolve(snapshot);
      },
      async set(delta) {
        h.writes.push(clone(delta));
        await Promise.resolve();
        if (h.failSave) throw Error('storage write failed');
        const changes = {};
        for (const [key, value] of Object.entries(delta)) { changes[key] = {oldValue: h.saved[key], newValue: value}; h.saved[key] = value; }
        for (const fn of h.changes) fn(changes, 'local');
      }
    }},
    action: {
      setIcon(value) {h.icons.push(clone(value)); return Promise.resolve();},
      setTitle(value) {h.titles.push(clone(value)); return Promise.resolve();},
      onClicked: {addListener(fn) {h.toggle = fn;}}
    },
    runtime: {
      id: 'test', getManifest: () => manifest, getURL: file => 'moz-extension://test/' + file,
      onMessage: {addListener(fn) {h.receive = fn;}},
      onInstalled: {addListener(fn) {h.install = fn;}},
      sendMessage(message) {
        if (h.sendMode === 'throw') throw Error('context invalidated');
        h.sent.push(clone(message));
        if (h.sendMode === 'reject') return Promise.reject(Error('background unavailable'));
        if (message.type === 'fnt-arm') return h.armDeferred ? h.armDeferred.promise : Promise.resolve(h.armAck);
        return Promise.resolve();
      }
    },
    tabs: {create(value) {
      h.created.push(clone(value));
      if (h.tabMode === 'throw') throw Error('tab closed');
      if (h.tabMode === 'reject') return Promise.reject(Error('container unavailable'));
      return Promise.resolve({id: 2});
    }}
  };
  h.browser = browser;
  const FNTDiscovery = {install(api, controls) { h.discoveryControls = controls; return {
    arm(message, origin) { h.discoveryCalls.push({message: clone(message), sender: clone(origin)}); return {ok: true}; },
    cancel(message, origin) { h.cancellationCalls.push({message: clone(message), sender: clone(origin)}); return {ok: true}; },
    cancelAll() { h.cancelAllCalls++; }
  }; }};
  const background = vm.createContext({URL, browser, FNTDiscovery});
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), background);
  h.document = {baseURI: 'https://example.test/base/'};
  const content = vm.createContext({URL, Date: {now: () => h.now}, browser, HTMLElement: MockHTMLElement, location: {href: 'https://example.test/source'},
    document: h.document,
    window: {addEventListener(type, fn) {h.listeners[type] = fn;}}});
  for (const name of ['resolver.js', 'content.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), content);
  h.FNT = content.FNT;
  h.event = (type, nodes = link(), extra = {}) => {
    for (const node of nodes) if (!Object.hasOwn(node, 'ownerDocument')) node.ownerDocument = h.document;
    const e = {type, button: 1, isTrusted: true, cancelable: true, composedPath: () => nodes,
      preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}, ...extra};
    h.listeners[type](e); return e;
  };
  h.gesture = (nodes = link()) => { for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick']) h.event(type, nodes); };
  h.change = (value, area = 'local') => { for (const fn of h.changes) fn({enabled: {newValue: value}}, area); };
  h.open = (url = 'https://example.test', origin = sender()) => h.receive({type: 'fnt-open', url}, origin);
  return h;
}
let count = 0;
async function test(name, fn) { await fn(); await flush(); count++; console.log('PASS', name); }
(async () => {
  await test('relative link; every middle event suppressed; one send', async () => {
    const h = harness(); await flush();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'auxclick', 'click']) {
      const e = h.event(type); assert.ok(e.prevented && e.stopped);
    }
    assert.equal(h.sent.length, 1); assert.equal(h.sent[0].url, 'https://example.test/destination');
  });
  await test('duplicate auxclick cannot send twice', async () => {const h = harness(); await flush(); h.gesture(); h.event('auxclick'); assert.equal(h.sent.length, 1);});
  await test('repeated gestures at the same URL open again', async () => {const h = harness(); await flush(); h.gesture(); h.gesture(); assert.equal(h.sent.length, 2);});
  await test('unknown control arms discovery without guessing image URLs', async () => {
    const h = harness(); await flush(); const target = el('img', {src: '/media'}); h.gesture([target]); assert.equal(h.sent.length, 1); assert.equal(h.sent[0].type, 'fnt-arm'); assert.equal(h.sent[0].beforeURL, 'https://example.test/source'); await flush(); assert.equal(target.activations, 1); assert.equal(h.sent.some(message => message.type === 'fnt-open'), false);
  });
  await test('explicit SPA data URL resolves relative to document base', async () => {const h = harness(); await flush(); h.gesture([el('button', {'data-href': '../route'})]); assert.equal(h.sent[0].url, 'https://example.test/route');});
  await test('anchor outranks child data attribute', () => {const h = harness(); assert.equal(h.FNT.resolve([el('span', {'data-url': '/wrong'}), ...link()], 'https://example.test/base/'), 'https://example.test/destination');});
  await test('unsafe protocols, credentials and malformed URLs rejected', () => {
    const h = harness(); for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/a', 'https://a:b@example.test', 'http://[']) assert.equal(h.FNT.safeURL(url, 'https://example.test/'), null);
  });
  await test('left, right and synthetic middle click untouched', async () => {
    const h = harness(); await flush(); for (const extra of [{button: 0}, {button: 2}, {isTrusted: false}]) assert.equal(h.event('mousedown', link(), extra).stopped, undefined);
  });
  await test('release on different destination aborts', async () => {const h = harness(); await flush(); h.event('pointerdown'); h.event('mouseup', [el('a', {href: '/other'})]); h.event('auxclick', [el('a', {href: '/other'})]); assert.equal(h.sent.length, 0);});
  await test('blur and cancel discard pending gestures', async () => {
    const h = harness(); await flush(); h.event('pointerdown'); h.listeners.blur(); h.event('mouseup'); h.event('auxclick');
    h.event('pointerdown'); h.event('pointercancel', link(), {button: -1}); h.event('mouseup'); h.event('auxclick'); assert.equal(h.sent.length, 0);
  });
  await test('background validates sender URL type scheme IDs and container', async () => {
    const h = harness(); await flush();
    for (const [url, origin] of [['javascript:alert(1)', sender()], ['https://example.test', {}], [{href: 'https://example.test'}, sender()], ['https://example.test', {...sender(), tab: {id: NaN, windowId: 3}}]]) await h.open(url, origin);
    assert.equal(h.created.length, 0); const result = await h.open(); assert.equal(result.ok, true);
    assert.equal(h.created.length, 1); assert.equal(h.created[0].active, false); assert.equal(h.created[0].cookieStoreId, 'firefox-container-2'); assert.equal(h.created[0].openerTabId, 1); assert.equal(h.created[0].windowId, 3);
  });
  await test('release must precede auxclick', async () => {const h = harness(); await flush(); h.event('pointerdown'); h.event('auxclick'); assert.equal(h.sent.length, 0);});
  await test('actual mouseup path is checked independently of auxclick', async () => {const h = harness(); await flush(); h.event('pointerdown'); h.event('mouseup', [el('a', {href: '/other'})]); h.event('auxclick'); assert.equal(h.sent.length, 0);});
  await test('fresh mouse-only down replaces interrupted gesture', async () => {const h = harness(); await flush(); h.event('pointerdown', [el('a', {href: '/old'})]); h.event('mousedown'); h.event('mouseup'); h.event('auxclick'); assert.equal(h.sent.length, 1);});
  await test('stale gestures expire and pagehide cancels', async () => {
    const h = harness(); await flush(); h.event('pointerdown'); h.now += 60_001; h.event('mouseup'); h.event('auxclick');
    h.event('pointerdown'); h.listeners.pagehide(); h.event('mouseup'); h.event('auxclick'); assert.equal(h.sent.length, 0);
  });
  await test('frame base and nearest invalid metadata resolved conservatively', () => {
    const h = harness(); assert.equal(h.FNT.resolve([el('a', {href: 'child'})], 'https://frame.test/base/'), 'https://frame.test/base/child');
    assert.equal(h.FNT.resolve([el('button', {'data-url': ''}), el('div', {'data-url': '/outer'})], 'https://example.test/'), null);
  });
  await test('same URL from two tabs and rapid repetitions are independent', async () => {const h = harness(); await flush(); await Promise.all([5, 6, 6].map(id => h.open('https://example.test', sender(id)))); assert.equal(h.created.length, 3);});
  await test('synchronous tab creation failure contained without retry', async () => {const h = harness(); await flush(); h.tabMode = 'throw'; assert.equal((await h.open()).ok, false); assert.equal(h.created.length, 1);});
  await test('rejected tab creation contained without container fallback', async () => {const h = harness(); await flush(); h.tabMode = 'reject'; assert.equal((await h.open()).ok, false); assert.equal(h.created.length, 1); assert.equal(h.created[0].cookieStoreId, 'firefox-container-2');});
  await test('saved OFF restores native events and rejects stale background messages', async () => {
    const h = harness({enabled: false}); await flush(); assert.equal(h.event('mousedown').stopped, undefined); h.gesture(); assert.equal(h.sent.length, 0);
    assert.equal((await h.open()).reason, 'disabled'); assert.equal(h.created.length, 0);
  });
  await test('initial protective mode blocks while saved mode is loading', async () => {
    const h = harness({enabled: false}, {deferContentRead: true}); assert.ok(h.event('mousedown').stopped); h.initialContentRead.resolve({enabled: false}); await flush(); assert.equal(h.event('mousedown').stopped, undefined);
  });
  await test('new storage change wins over stale initial read', async () => {
    const h = harness({}, {deferContentRead: true}); h.change(false); h.initialContentRead.resolve({enabled: true}); await flush(); assert.equal(h.event('mousedown').stopped, undefined);
  });
  await test('non-local mode changes are ignored', async () => {const h = harness(); await flush(); h.change(false, 'sync'); assert.ok(h.event('mousedown').stopped);});
  await test('mode change clears a partially completed gesture', async () => {
    const h = harness(); await flush(); h.event('pointerdown'); h.change(false); h.change(true); h.event('mouseup'); h.event('auxclick'); assert.equal(h.sent.length, 0);
  });
  await test('toolbar toggle persists OFF then ON and changes exact icon paths', async () => {
    const h = harness(); await flush(); assert.deepEqual(h.icons.at(-1).path, {48: 'icon.png', 96: 'icon@2x.png'});
    await h.toggle(); assert.equal(h.saved.enabled, false); assert.deepEqual(h.icons.at(-1).path, {48: 'icon-disabled.png', 96: 'icon-disabled@2x.png'}); assert.match(h.titles.at(-1).title, /OFF/); assert.equal(h.event('mousedown').stopped, undefined);
    await h.toggle(); assert.equal(h.saved.enabled, true); assert.deepEqual(h.icons.at(-1).path, {48: 'icon.png', 96: 'icon@2x.png'}); assert.match(h.titles.at(-1).title, /ON/); assert.ok(h.event('mousedown').stopped);
    for (const icon of h.icons) for (const file of Object.values(icon.path)) assert.ok(fs.existsSync(path.join(root, file)), file);
  });
  await test('saved mode survives a fresh background and content context', async () => {const first = harness(); await flush(); await first.toggle(); const second = harness(first.saved); await flush(); assert.equal(second.event('mousedown').stopped, undefined); assert.equal((await second.open()).reason, 'disabled'); assert.match(second.titles.at(-1).title, /OFF/);});
  await test('rapid toolbar clicks serialize without lost toggles', async () => {const h = harness(); await flush(); await Promise.all([h.toggle(), h.toggle(), h.toggle()]); assert.equal(h.saved.enabled, false); assert.deepEqual(h.writes.filter(w => Object.hasOwn(w, 'enabled')).map(w => w.enabled), [false, true, false]); assert.equal(h.event('mousedown').stopped, undefined);});
  await test('failed save retains previous mode icon and continued queue', async () => {
    const h = harness(); await flush(); const paints = h.icons.length; h.failSave = true; await h.toggle(); assert.equal(h.saved.enabled, undefined); assert.equal(h.icons.length, paints); assert.ok(h.event('mousedown').stopped); assert.equal((await h.open()).ok, true);
    h.failSave = false; await h.toggle(); assert.equal(h.saved.enabled, false); assert.equal((await h.open()).reason, 'disabled');
  });
  await test('content runtime throw and rejected message are contained', async () => {
    const h = harness(); await flush(); h.sendMode = 'throw'; assert.doesNotThrow(() => h.gesture()); h.sendMode = 'reject'; assert.doesNotThrow(() => h.gesture()); await flush(); assert.equal(h.created.length, 0);
  });
  await test('storage read failure keeps protective ON behavior', async () => {const h = harness({}, {rejectRead: true}); await flush(); assert.ok(h.event('mousedown').stopped); assert.equal((await h.open()).ok, true);});
  await test('startup alone never opens a changelog', async () => {const h = harness(); await flush(); assert.equal(h.created.length, 0);});
  await test('install opens one inactive changelog and stores version', async () => {
    const h = harness(); await flush(); await h.install({reason: 'install'}); assert.equal(h.saved.lastChangelogVersion, manifest.version); assert.equal(h.created.length, 1); assert.equal(h.created[0].url, 'moz-extension://test/changelog.html'); assert.equal(h.created[0].active, false);
  });
  await test('same version duplicate install/update events do not reopen changelog', async () => {const h = harness(); await flush(); await h.install({reason: 'install'}); await h.install({reason: 'update'}); await h.install({reason: 'update'}); assert.equal(h.created.length, 1);});
  await test('concurrent duplicate update events open changelog once', async () => {const h = harness({lastChangelogVersion: 'older'}); await flush(); await Promise.all([h.install({reason: 'update'}), h.install({reason: 'update'})]); assert.equal(h.created.length, 1);});
  await test('recorded version suppresses changelog across restart', async () => {const h = harness({lastChangelogVersion: manifest.version}); await flush(); await h.install({reason: 'update'}); assert.equal(h.created.length, 0);});
  await test('browser update and unrelated installation reasons do not open tabs', async () => {const h = harness(); await flush(); for (const reason of ['browser_update', 'shared_module_update', 'startup']) await h.install({reason}); assert.equal(h.created.length, 0);});
  await test('changelog save and tab failures are contained without tab retries', async () => {
    const h = harness(); await flush(); h.failSave = true; await h.install({reason: 'update'}); assert.equal(h.created.length, 0);
    h.failSave = false; h.tabMode = 'reject'; await h.install({reason: 'update'}); assert.equal(h.created.length, 1); await h.install({reason: 'update'}); assert.equal(h.created.length, 1);
  });

  await test('discovery waits for background ACK before one native activation', async () => {
    const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]);
    assert.equal(target.activations, undefined); assert.equal(h.sent.filter(m => m.type === 'fnt-arm').length, 1);
    const attempt = h.sent.find(m => m.type === 'fnt-arm'); assert.equal(typeof attempt.attemptId, 'string'); assert.ok(attempt.attemptId.length > 0);
    h.armDeferred.resolve({ok: true}); await flush(); assert.equal(target.activations, 1); assert.equal(h.created.length, 0);
  });
  await test('busy and disabled ACKs prevent activation and cancel the owned attempt', async () => {
    for (const reason of ['busy', 'disabled']) {
      const h = harness(); await flush(); h.armAck = {ok: false, reason}; const target = el('button'); h.gesture([target]); await flush();
      assert.equal(target.activations, undefined); assert.equal(h.sent.filter(m => m.type === 'fnt-arm').length, 1); assert.equal(h.sent.filter(m => m.type === 'fnt-cancel').length, 1);
      assert.equal(h.sent.find(m => m.type === 'fnt-arm').attemptId, h.sent.find(m => m.type === 'fnt-cancel').attemptId);
    }
  });
  await test('duplicate auxclicks never rearm or retry activation', async () => {
    const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]); h.event('auxclick', [target]);
    h.armDeferred.resolve({ok: true}); await flush(); h.event('auxclick', [target]); await flush(); assert.equal(target.activations, 1); assert.equal(h.sent.filter(m => m.type === 'fnt-arm').length, 1);
  });
  await test('fresh user down and key input invalidate activation waiting for ACK', async () => {
    for (const input of ['middle', 'left', 'key']) {
      const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]);
      if (input === 'key') h.listeners.keydown({isTrusted: true}); else h.event('mousedown', link(), {button: input === 'left' ? 0 : 1});
      h.armDeferred.resolve({ok: true}); await flush(); assert.equal(target.activations, undefined); assert.ok(h.sent.some(m => m.type === 'fnt-cancel'));
    }
  });
  await test('blur and pagehide prevent an activation still waiting for ACK', async () => {
    for (const input of ['blur', 'pagehide']) {
      const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]); h.listeners[input]();
      h.armDeferred.resolve({ok: true}); await flush(); assert.equal(target.activations, undefined); assert.ok(h.sent.some(m => m.type === 'fnt-cancel'));
    }
  });
  await test('mode change invalidates activation waiting for ACK', async () => {
    const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]); h.change(false);
    h.armDeferred.resolve({ok: true}); await flush(); assert.equal(target.activations, undefined); assert.ok(h.sent.some(m => m.type === 'fnt-cancel'));
  });
  await test('synthetic key and mouse input do not invalidate a pending user attempt', async () => {
    const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]); h.listeners.keydown({isTrusted: false});
    h.event('mousedown', link(), {button: 0, isTrusted: false}); h.armDeferred.resolve({ok: true}); await flush(); assert.equal(target.activations, 1);
  });
  await test('disconnected or adopted target cannot activate after ACK', async () => {
    for (const invalidate of [target => {target.isConnected = false;}, target => {target.ownerDocument = {};}]) {
      const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]); invalidate(target);
      h.armDeferred.resolve({ok: true}); await flush(); assert.equal(target.activations, undefined); assert.ok(h.sent.some(m => m.type === 'fnt-cancel'));
    }
  });
  await test('native prototype click bypasses target override and chooses semantic ancestor', async () => {
    const h = harness(); await flush(); const child = el('span'), target = el('button'); let overridden = 0; target.click = () => {overridden++;};
    h.gesture([child, target]); await flush(); assert.equal(target.activations, 1); assert.equal(child.activations, undefined); assert.equal(overridden, 0);
  });
  await test('different unknown press and release controls do not arm discovery', async () => {
    const h = harness(); await flush(); const one = el('button'), two = el('button'); h.event('mousedown', [one]); h.event('mouseup', [two]); h.event('auxclick', [two]); await flush(); assert.equal(h.sent.length, 0);
  });
  await test('form editable disabled and submit controls are never activated', async () => {
    const cases = [
      [el('button'), el('form')], [el('input')], [el('textarea')], [el('select')], [el('option')], [el('label')], [el('summary')],
      [el('button', {disabled: ''})], [el('button', {'aria-disabled': 'true'})], [el('button', {type: 'submit'})], [el('button', {type: 'reset'})]
    ]; const editable = el('div'); editable.isContentEditable = true; cases.push([editable]);
    for (const nodes of cases) {const h = harness(); await flush(); h.gesture(nodes); await flush(); assert.equal(h.sent.length, 0); assert.equal(nodes[0].activations, undefined);}
  });
  await test('role navigation control is activated once when URL is hidden', async () => {
    const h = harness(); await flush(); const target = el('div', {role: 'link'}); h.gesture([target]); await flush(); assert.equal(target.activations, 1); assert.equal(h.sent.filter(m => m.type === 'fnt-arm').length, 1);
  });
  await test('native activation exceptions cancel without retry', async () => {
    const h = harness(); await flush(); const target = el('button'); target.nativeThrow = true; h.gesture([target]); await flush(); h.event('auxclick', [target]); await flush();
    assert.equal(h.sent.filter(m => m.type === 'fnt-arm').length, 1); assert.equal(h.sent.filter(m => m.type === 'fnt-cancel').length, 1); assert.equal(h.created.length, 0);
  });
  await test('arm messaging throw and rejection never activate a target', async () => {
    for (const mode of ['throw', 'reject']) {const h = harness(); await flush(); h.sendMode = mode; const target = el('button'); assert.doesNotThrow(() => h.gesture([target])); await flush(); assert.equal(target.activations, undefined); assert.equal(h.created.length, 0);}
  });
  await test('blur and pagehide preserve observer after activation including synchronous unload', async () => {
    const h = harness(); await flush(); const target = el('button'); target.onActivate = () => {h.listeners.pagehide(); h.listeners.blur();}; h.gesture([target]); await flush();
    assert.equal(target.activations, 1); assert.equal(h.sent.filter(m => m.type === 'fnt-cancel').length, 0);
    h.listeners.pagehide(); h.listeners.blur(); assert.equal(h.sent.filter(m => m.type === 'fnt-cancel').length, 0);
  });
  await test('mode and subsequent user input cancel an already activated attempt', async () => {
    for (const input of ['mode', 'mouse', 'key']) {const h = harness(); await flush(); const target = el('button'); h.gesture([target]); await flush();
      if (input === 'mode') h.change(false); else if (input === 'mouse') h.event('mousedown', link(), {button: 0}); else h.listeners.keydown({isTrusted: true});
      assert.equal(target.activations, 1); assert.equal(h.sent.filter(m => m.type === 'fnt-cancel').length, 1);
    }
  });
  await test('background routes discovery arm and cancel with validated source sender', async () => {
    const h = harness(); await flush(); const message = {type: 'fnt-arm', attemptId: 'attempt-1', beforeURL: 'https://example.test/source'};
    assert.equal((await h.receive(message, sender())).ok, true); assert.equal(h.discoveryCalls.length, 1); assert.deepEqual(h.discoveryCalls[0].message, message);
    await h.receive({type: 'fnt-cancel', attemptId: 'attempt-1'}, sender()); assert.equal(h.cancellationCalls.length, 1); assert.equal(h.cancellationCalls[0].sender.tab.id, 1);
    for (const invalid of [{}, {id: 'other', tab: {id: 1, windowId: 3}}, {id: 'test', tab: {id: -1, windowId: 3}}]) {
      await h.receive(message, invalid); await h.receive({type: 'fnt-cancel', attemptId: 'attempt-1'}, invalid);
    } assert.equal(h.discoveryCalls.length, 1); assert.equal(h.cancellationCalls.length, 1);
  });
  await test('disabled background rejects arm and toggle off cancels discovery observers', async () => {
    const h = harness(); await flush(); assert.equal(h.discoveryControls.isEnabled(), true); await h.toggle(); assert.equal(h.cancelAllCalls, 1); assert.equal(h.discoveryControls.isEnabled(), false);
    const result = await h.receive({type: 'fnt-arm', attemptId: 'stale', beforeURL: 'https://example.test'}, sender()); assert.equal(result.reason, 'disabled'); assert.equal(h.discoveryCalls.length, 0);
    await h.toggle(); assert.equal(h.cancelAllCalls, 1); assert.equal(h.discoveryControls.isEnabled(), true);
  });
  await test('discovery open callback uses same background tab and container options', async () => {
    const h = harness(); await flush(); assert.equal((await h.discoveryControls.open('https://example.test/discovered', sender().tab)).ok, true); assert.deepEqual(h.created[0], {url: 'https://example.test/discovered', active: false, windowId: 3, openerTabId: 1, cookieStoreId: 'firefox-container-2'});
  });
  await test('known destinations never arm discovery or activate source control', async () => {
    const h = harness(); await flush(); const target = el('a', {href: '/known'}); h.gesture([target]); await flush(); assert.equal(target.activations, undefined); assert.equal(h.sent.length, 1); assert.equal(h.sent[0].type, 'fnt-open');
  });

  await test('placeholder href enters discovery while real fragments remain direct URLs', async () => {
    const h = harness(); await flush(); const target = el('a', {href: ' # '}); h.gesture([target]); await flush();
    assert.equal(h.FNT.safeURL('#', 'https://example.test/base/'), null); assert.equal(h.sent[0].type, 'fnt-arm'); assert.equal(target.activations, 1);
    const fragment = el('a', {href: '#section'}); h.gesture([fragment]); await flush(); assert.equal(fragment.activations, undefined); assert.equal(h.sent.at(-1).type, 'fnt-open'); assert.equal(h.sent.at(-1).url, 'https://example.test/base/#section');
  });

  await test('aria-disabled added while ACK is pending prevents activation and cancels owned session', async () => {
    const h = harness(); await flush(); const attrs = {}, target = el('button', attrs); h.armDeferred = deferred(); h.gesture([target]);
    const attempt = h.sent.find(m => m.type === 'fnt-arm'); attrs['aria-disabled'] = 'true'; h.armDeferred.resolve({ok: true}); await flush();
    assert.equal(target.activations, undefined); const cancels = h.sent.filter(m => m.type === 'fnt-cancel'); assert.equal(cancels.length, 1); assert.equal(cancels[0].attemptId, attempt.attemptId);
  });
  await test('target moved into form while ACK is pending prevents activation and cancels owned session', async () => {
    const h = harness(); await flush(); const target = el('button'); h.armDeferred = deferred(); h.gesture([target]);
    const attempt = h.sent.find(m => m.type === 'fnt-arm'); target.parentElement = el('form'); h.armDeferred.resolve({ok: true}); await flush();
    assert.equal(target.activations, undefined); const cancels = h.sent.filter(m => m.type === 'fnt-cancel'); assert.equal(cancels.length, 1); assert.equal(cancels[0].attemptId, attempt.attemptId);
  });
  await test('manifest scripts action icons and changelog references exist', () => {
    for (const file of [...manifest.background.scripts, ...manifest.content_scripts.flatMap(s => s.js), ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon), manifest.options_ui.page]) assert.ok(fs.existsSync(path.join(root, file)), file);
    assert.ok(!manifest.content_scripts.some(s => s.world === 'MAIN')); assert.ok(manifest.permissions.includes('storage'));
  });
  console.log(count + ' tests passed (mocked DOM/API; not Firefox integration tests).');
})().catch(error => {console.error(error); process.exitCode = 1;});
