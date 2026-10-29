/* Tests execute bundled ORIGINAL v1.3.0 code and pass by reproducing its faults.
 * Mocked DOM/API only: no Firefox CSP, Xray, native-input or navigation coverage. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixture = path.join(__dirname, 'fixtures', 'legacy-v1.3');
const content = fs.readFileSync(path.join(fixture, 'content.js'), 'utf8');
const background = fs.readFileSync(path.join(fixture, 'background.js'), 'utf8');
function emitter() {
  const handlers = new Map();
  return {
    addEventListener(type, fn) {
      const entries = handlers.get(type) || [];
      entries.push(fn); handlers.set(type, entries);
    },
    dispatchEvent(e) {
      for (const fn of handlers.get(e.type) || []) fn(e);
      return true;
    }
  };
}
function element(tagName, attrs = {}, parentElement = null, anchors = []) {
  return {tagName, parentElement, getAttribute(k) {return attrs[k] ?? null;},
    querySelectorAll() {return anchors;}, dispatchEvent() {return true;}};
}
function harness() {
  const sent = [], activations = [], timers = [], nativeOpens = [];
  const window = emitter();
  const document = Object.assign(emitter(), {baseURI:'https://example.test/base/',
    body:element('BODY'), createElement() {return {remove() {}};}});
  function Location() {this.value = document.baseURI;}
  Object.defineProperty(Location.prototype, 'href', {
    configurable:true, get() {return this.value;}, set(v) {this.value = v;}
  });
  Location.prototype.assign = function(v) {this.value = v;};
  Location.prototype.replace = function(v) {this.value = v;};
  window.location = new Location();
  window.open = url => {nativeOpens.push(url); return {opened:true};};
  const history = {pushState() {}, replaceState() {}};
  class Event {
    constructor(type, opts = {}) {this.type = type; Object.assign(this, opts);}
    preventDefault() {this.defaultPrevented = true;}
    stopImmediatePropagation() {this.stopped = true;}
  }
  window.addEventListener('__forceNewTab_activate', e => activations.push(e.detail.active));
  const context = vm.createContext({window, document, history, Location, URL,
    CustomEvent:Event, MouseEvent:Event, console,
    browser:{runtime:{sendMessage(m) {sent.push(m); return Promise.resolve();}}},
    setTimeout(fn, ms) {timers.push({kind:'timeout', fn, ms}); return timers.length;},
    setInterval(fn, ms) {timers.push({kind:'interval', fn, ms}); return timers.length;},
    clearInterval(id) {if (timers[id-1]) timers[id-1].cleared = true;}
  });
  document.head = {prepend(script) {vm.runInContext(script.textContent, context);}};
  vm.runInContext(content, context, {filename:'legacy/content.js'});
  return {window, document, sent, timers, activations, nativeOpens,
    middleDown(target) {
      document.dispatchEvent(new Event('mousedown', {target, button:1, clientX:12, clientY:24}));
    }};
}
let count = 0;
function test(name, fn) {fn(); count++; console.log('PASS legacy fault reproduced:', name);}
test('data-url early return leaves hooks active with no cleanup timer', () => {
  const h = harness();
  h.middleDown(element('BUTTON', {'data-url':'/destination'}, h.document.body));
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.activations, [true]);
  assert.equal(h.timers.length, 0);
  assert.equal(h.window.open('https://unrelated.test/'), null);
  assert.equal(h.nativeOpens.length, 0);
  assert.equal(h.sent.length, 1);
});
test('ancestor search selects first unrelated child anchor', () => {
  const h = harness();
  const unrelated = element('A', {href:'/unrelated'});
  const intended = element('A', {href:'/intended'});
  let parent = element('DIV', {}, h.document.body, [unrelated, intended]);
  for (let i = 0; i < 4; i++) parent = element('DIV', {}, parent);
  h.middleDown(element('BUTTON', {}, parent));
  assert.equal(h.sent[0].url, 'https://example.test/unrelated');
  assert.deepEqual(h.activations, [true]);
  assert.equal(h.timers.length, 0);
});
test('fallback replay executes arbitrary non-navigation click effect', () => {
  const h = harness();
  let mutations = 0;
  const replayed = [];
  const button = element('BUTTON', {}, h.document.body);
  button.dispatchEvent = e => {
    replayed.push(e.type);
    if (e.type === 'click') mutations++;
    return true;
  };
  h.middleDown(button);
  assert.equal(mutations, 0);
  h.timers.find(t => t.kind === 'timeout' && t.ms === 500).fn();
  assert.deepEqual(replayed, ['mousedown', 'mouseup', 'click']);
  assert.equal(mutations, 1);
  assert.equal(h.sent.length, 0);
});
test('global URL/time dedupe drops valid gestures from separate tabs', () => {
  const created = [];
  let receive, now = 10_000;
  const context = vm.createContext({Date:{now:() => now}, browser:{
    runtime:{onMessage:{addListener(fn) {receive = fn;}}},
    tabs:{create(opts) {created.push(opts); return Promise.resolve({id:2});}}
  }});
  vm.runInContext(background, context, {filename:'legacy/background.js'});
  const message = {action:'openTab', url:'https://example.test/same'};
  receive(message, {tab:{id:1}});
  now += 100;
  receive(message, {tab:{id:9}});
  assert.equal(created.length, 1);
});
console.log(`${count} known legacy faults reproduced using the original source.`);

