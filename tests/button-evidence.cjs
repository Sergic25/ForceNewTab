'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'button-evidence.js'), 'utf8');
const base = 'https://unrelated.test/start';
const clean = value => JSON.parse(JSON.stringify(value));
function el(tag = 'button', attrs = {}, page = {}) {
  return {nodeType: 1, localName: tag, attrs, isConnected: true, wrappedJSObject: page,
    getAttribute(name) { return Object.hasOwn(attrs, name) ? attrs[name] : null; },
    hasAttribute(name) { return Object.hasOwn(attrs, name); }};
}
function harness(document) {
  const context = vm.createContext({URL, document, fetch() { throw Error('network'); }, browser: new Proxy({}, {get() {throw Error('browser API touched');}})});
  vm.runInContext(source, context, {filename: 'button-evidence.js'});
  return {context, inspect: (nodes, url = base) => clean(context.FNTButtonEvidence.inspect(nodes, url))};
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS button evidence', name); }
function only(r) { assert.equal(r.candidates.length, 1); return r.candidates[0]; }
test('module installs a read-only evidence API without browser or network access', () => {
  const h = harness(); assert.ok(Object.isFrozen(h.context.FNTButtonEvidence)); assert.equal(h.context.FNT, undefined);
  assert.equal(h.inspect([]).status, 'button-required');
});
test('nearest native button owns a nested label and exact Xray page object', () => {
  const r = harness().inspect([el('span'), el('button', {}, {url: '/destination?private=SECRET#SECRET'})]);
  assert.equal(r.status, 'button-address-evidence-found'); assert.equal(r.owners.length, 1);
  assert.equal(only(r).address.url, 'https://unrelated.test/destination'); assert.equal(only(r).automaticUse, false);
  assert.equal(r.automaticUse, false); assert.doesNotMatch(JSON.stringify(r), /SECRET/);
});
test('role button is inspected without requiring role link', () => {
  const r = harness().inspect([el('div', {role: 'button'}, {navigationURL: 'https://elsewhere.test/page'})]);
  assert.equal(only(r).field, 'navigationURL'); assert.equal(only(r).address.url, 'https://elsewhere.test/page');
});
test('nearest button prevents parent button hint substitution', () => {
  const r = harness().inspect([el('button'), el('button', {}, {url: '/outer'})]);
  assert.equal(r.owners.length, 1); assert.equal(r.candidates.length, 0);
});
test('contiguous custom ancestors are bounded to three', () => {
  const nodes = [el('button'), ...Array.from({length: 5}, (_, i) => el('generic-part-' + i, {}, {url: '/part/' + i}))];
  const r = harness().inspect(nodes); assert.equal(r.owners.length, 4); assert.equal(r.candidates.length, 3); assert.equal(r.limited, true);
});
test('ordinary ancestor stops custom element scanning', () => {
  const r = harness().inspect([el('button'), el('app-owner', {}, {url: '/owner'}), el('div'), el('outer-app', {}, {url: '/unrelated'})]);
  assert.equal(r.owners.length, 2); assert.equal(only(r).address.url, 'https://unrelated.test/owner');
});
test('semantic link boundary stops custom ancestor scanning', () => {
  const r = harness().inspect([el('button'), el('custom-owner', {role: 'link'}, {url: '/outside'})]);
  assert.equal(r.owners.length, 1); assert.equal(r.candidates.length, 0);
});
test('DOM route attributes are reported as evidence without invoking Angular', () => {
  const r = harness().inspect([el('button', {routerlink: '/route?secret=SECRET#SECRET', 'ng-reflect-router-link': '../relative'})]);
  assert.equal(r.candidates[0].source, 'dom-attribute'); assert.equal(r.candidates[0].address.url, 'https://unrelated.test/route');
  assert.equal(r.candidates[1].status, 'relative-or-context-dependent'); assert.doesNotMatch(JSON.stringify(r), /SECRET|relative"/);
});
test('current host React fields are evidence only and never execute handlers', () => {
  let calls = 0;
  const page = {__reactProps$fixture: {href: '/react', onClick() {calls++;}, other: 'PRIVATE_VALUE'}};
  const r = harness().inspect([el('button', {}, page)]); assert.deepEqual(r.frameworks, ['react']);
  assert.equal(only(r).source, 'react-current-host-evidence'); assert.equal(calls, 0); assert.doesNotMatch(JSON.stringify(r), /PRIVATE_VALUE|onClick/);
});
test('structured React link preserves evidence for supported URL parts with redaction', () => {
  const r = harness().inspect([el('button', {}, {__reactProps$x: {link: {pathname: '/route', search: '?SECRET=1', hash: '#SECRET'}}})]);
  assert.deepEqual(only(r).address, {url: 'https://unrelated.test/route', hadQuery: true, hadFragment: true});
  assert.doesNotMatch(JSON.stringify(r), /SECRET/);
});
test('unsupported structured route context is not simplified', () => {
  for (const link of [{pathname: '/route', query: {}}, {pathname: '/route?x=y', search: ''}, {pathname: '/route', search: {x: 'secret'}}]) {
    const r = harness().inspect([el('button', {}, {__reactProps$x: {link}})]); assert.equal(only(r).address, undefined);
  }
});
test('Vue vnode props are evidence without calling component methods', () => {
  const r = harness().inspect([el('button', {}, {__vnode: {props: {to: '/vue'}}})]);
  assert.deepEqual(r.frameworks, ['vue']); assert.equal(only(r).address.url, 'https://unrelated.test/vue');
});
test('Vue component props are scoped and nested app context is unread', () => {
  const component = {props: {url: '/vue-component'}};
  Object.defineProperty(component, 'appContext', {get() { throw Error('app context read'); }});
  const r = harness().inspect([el('button', {}, {__vueParentComponent: component})]);
  assert.equal(only(r).source, 'vue-component-evidence'); assert.equal(r.readErrors, false);
});
test('Angular context numeric identifier is type-only', () => {
  const r = harness().inspect([el('button', {}, {__ngContext__: 987654321})]);
  assert.deepEqual(r.frameworks, ['angular']); assert.deepEqual(r.owners[0].angularContext, {type: 'number', traversed: false});
  assert.doesNotMatch(JSON.stringify(r), /987654321/);
});
test('Angular context array bindings are never traversed', () => {
  let traps = 0; const context = new Proxy([], {get() {traps++;throw Error('binding');}, ownKeys() {traps++;throw Error('binding keys');}});
  const r = harness().inspect([el('button', {}, {__ngContext__: context})]);
  assert.deepEqual(r.owners[0].angularContext, {type: 'array', traversed: false}); assert.equal(traps, 0);
});
test('Angular object context is never searched for unrelated addresses', () => {
  let touched = 0; const context = new Proxy({}, {get() {touched++;throw Error('context read');}, ownKeys() {touched++;throw Error('context keys');}});
  const r = harness().inspect([el('button', {}, {__ngContext__: context})]);
  assert.equal(r.owners[0].angularContext.type, 'object'); assert.equal(touched, 0); assert.equal(r.candidates.length, 0);
});
test('getters for direct destinations and framework attachments are skipped', () => {
  let calls = 0; const page = {};
  for (const name of ['url', '__reactProps$fixture', '__ngContext__', '__vnode']) Object.defineProperty(page, name, {get() {calls++;throw Error('getter');}});
  const r = harness().inspect([el('button', {}, page)]); assert.equal(calls, 0); assert.ok(r.accessorsSkipped >= 4);
  assert.equal(r.owners[0].angularContext.type, 'unread'); assert.equal(r.candidates[0].status, 'accessor-or-incomplete');
});
test('structured route getters are skipped without executing page code', () => {
  let calls = 0; const link = {pathname: '/route'}; Object.defineProperty(link, 'search', {get() {calls++;return '?secret';}});
  const r = harness().inspect([el('button', {}, {__reactProps$x: {link}})]); assert.equal(calls, 0); assert.equal(only(r).status, 'accessor-or-incomplete');
});
test('own-property reflection failures are contained and explicitly marked', () => {
  const page = new Proxy({}, {getOwnPropertyDescriptor() {throw Error('trap');}, ownKeys() {throw Error('trap');}});
  const r = harness().inspect([el('button', {}, page)]); assert.equal(r.readErrors, true); assert.equal(r.reflectionMayRunProxyTraps, true);
});
test('unsafe credentials protocols and dynamic routes never become evidence addresses', () => {
  for (const url of ['https://u:SECRET@elsewhere.test/path', 'javascript:alert(1)', 'data:text/plain,SECRET', '//elsewhere.test/path', '/:id', '/[id]', '/{id}', '/path\\next']) {
    const r = harness().inspect([el('button', {}, {url})]); assert.equal(only(r).address, undefined); assert.doesNotMatch(JSON.stringify(r), /SECRET/);
  }
});
test('forms editable and disabled ancestors block all private object access', () => {
  for (const outer of [el('form'), el('input'), el('textarea'), el('select'), el('option'), el('label'), el('summary'),
    el('div', {disabled: ''}), el('div', {'aria-disabled': 'true'}), el('div', {role: 'textbox'}), el('div', {role: 'combobox'}),
    el('div', {role: 'listbox'}), {...el('div'), isContentEditable: true}]) {
    const button = el(); let reads = 0; Object.defineProperty(button, 'wrappedJSObject', {get() {reads++;throw Error('private');}});
    const r = harness().inspect([button, outer]); assert.equal(r.status, 'action-form-or-editable-exclusion'); assert.equal(reads, 0);
  }
});
test('submit and reset buttons block before private access', () => {
  for (const type of ['submit', 'reset', 'SUBMIT', 'RESET']) { const button = el('button', {type}); let reads = 0;
    Object.defineProperty(button, 'wrappedJSObject', {get() {reads++;throw Error('private');}});
    assert.equal(harness().inspect([button]).eligible, false); assert.equal(reads, 0);
  }
});
test('nested action before the nearest button is not treated as button navigation', () => {
  const r = harness().inspect([el('a', {href: '/child'}), el('button', {}, {url: '/parent'})]);
  assert.equal(r.status, 'nested-action-exclusion'); assert.equal(r.owners.length, 0);
});
test('disconnected control is rejected before private access', () => {
  const button = {...el(), isConnected: false}; let touched = 0;
  Object.defineProperty(button, 'wrappedJSObject', {get() {touched++;throw Error('private');}});
  assert.equal(harness().inspect([button]).status, 'disconnected-or-adopted-control'); assert.equal(touched, 0);
});
test('sensitive non-navigation properties and labels are never read', () => {
  const page = {url: '/destination'}, button = el('button', {'aria-label': 'PRIVATE_LABEL'}, page);
  for (const name of ['password', 'cookie', 'token', 'account', 'onClick', 'innerHTML', 'textContent', 'value']) {
    Object.defineProperty(page, name, {get() {throw Error('private');}}); Object.defineProperty(button, name, {get() {throw Error('private');}});
  }
  const r = harness().inspect([button]); assert.equal(r.readErrors, false); assert.doesNotMatch(JSON.stringify(r), /PRIVATE_LABEL|password|cookie|token|account/);
});
test('key descriptor candidate and output budgets bound large objects', () => {
  const page = Object.fromEntries(Array.from({length: 300}, (_, i) => ['__reactProps$' + i, {href: '/route' + i}]));
  for (const field of ['href', 'to', 'url', 'data-href', 'data-url', 'navigationURL', 'navigationUrl']) page[field] = '/route/' + 'x'.repeat(1000) + '?SECRET';
  const r = harness().inspect([el('button', {}, page), el('app-owner', {}, page), el('app-outer', {}, page), el('app-limit', {}, page)]);
  assert.equal(r.limited, true); assert.ok(r.candidates.length <= 12); assert.ok(r.descriptorsRead <= 192); assert.ok(r.keysInspected <= 256);
  assert.ok(JSON.stringify(r).length <= 5000); assert.doesNotMatch(JSON.stringify(r), /SECRET/);
});
test('symbol route metadata is not ignored as a complete literal route', () => {
  const link = {pathname: '/route', [Symbol('PRIVATE')]: 'SECRET'};
  const r = harness().inspect([el('button', {}, {__reactProps$x: {link}})]);
  assert.equal(only(r).status, 'route-context-required'); assert.doesNotMatch(JSON.stringify(r), /PRIVATE|SECRET/);
});
test('adopted owner is rejected before private inspection', () => {
  const document = {}, button = {...el(), ownerDocument: {}}; let touched = 0;
  Object.defineProperty(button, 'wrappedJSObject', {get() {touched++;throw Error('private');}});
  assert.equal(harness(document).inspect([button]).status, 'disconnected-or-adopted-control'); assert.equal(touched, 0);
});
test('unreadable DOM eligibility does not permit private inspection', () => {
  const button = el(); let touched = 0;
  button.getAttribute = () => {throw Error('unreadable');};
  Object.defineProperty(button, 'wrappedJSObject', {get() {touched++;throw Error('private');}});
  const r = harness().inspect([button]); assert.equal(r.status, 'inspection-incomplete'); assert.equal(r.eligible, false); assert.equal(touched, 0);
});
console.log(count + ' button evidence checks passed (record-only mocked page objects; not Firefox integration).');
