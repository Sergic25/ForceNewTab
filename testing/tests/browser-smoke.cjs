'use strict';
// Optional real DOM/gesture smoke test. Firefox extension APIs are mocked.
// Set FNT_PLAYWRIGHT_MODULE to a locally installed Playwright package if needed.
const {chromium} = require(process.env.FNT_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'), dir = path.join(root, 'dist/testing');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const html = `<!doctype html><title>Generic navigation fixture</title>
<style>body{padding:25px}.card{display:flex;width:500px;padding:16px}.thumb{display:block;width:130px;height:100px;background:#ddd}.metadata{width:320px}.blank{height:55px;background:#eee}.unknown{padding:20px}</style>
<div class="card"><a class="thumb" aria-hidden="true" href="/destination?q=private"><img alt="" width="80" height="80"></a><div class="metadata"><h3><a href="/destination?q=private">Example item</a></h3><div class="blank"></div></div></div>
<a id="ordinary" href="/ordinary">Ordinary link</a><div class="unknown">Unresolved control</div>`;
(async () => {
  const server = http.createServer((req, res) => {res.setHeader('Content-Type', 'text/html'); res.end(html);});
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  let browser;
  try {
    browser = await chromium.launch({channel: 'msedge', headless: true});
    const base = 'http://127.0.0.1:' + server.address().port;
    const results = [];
    for (const selector of ['.blank', '#ordinary', '.unknown']) {
      const variants = [];
      for (const recording of [false, true]) {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/fixture');
        await page.evaluate(({manifest, recording}) => {
          const changes = [], receivers = [], state = {enabled: true};
          if (recording) state.fntRecordNextClick = {token: 'fixture-token', expires: Date.now() + 120000};
          const hub = () => ({handlers: [], addListener(fn) {this.handlers.push(fn);}});
          const result = {created: [], messages: [], activations: 0, state};
          window.fixture = result;
          window.browser = {
            runtime: {id: 'fixture', getManifest: () => manifest, getURL: file => 'moz-extension://fixture/' + file,
              onInstalled: hub(), onMessage: {addListener(fn) {receivers.push(fn);}},
              sendMessage(message) {
                result.messages.push(message);
                const sender = {id: 'fixture', tab: {id: 1, windowId: 1, url: location.href}, frameId: 0, url: location.href};
                let response;
                for (const listener of receivers) {const value = listener(message, sender); if (value !== undefined && response === undefined) response = value;}
                return Promise.resolve(response);
              }},
            storage: {onChanged: {addListener(fn) {changes.push(fn);}}, local: {
              async get(defaults) {return {...defaults, ...state};},
              async set(values) {const delta = {}; for (const [key, newValue] of Object.entries(values)) {delta[key] = {oldValue: state[key], newValue}; state[key] = newValue;} for (const listener of changes) listener(delta, 'local');}}},
            action: {setIcon: async () => {}, setTitle: async () => {}, onClicked: hub()},
            tabs: {onCreated: hub(), onRemoved: hub(), onUpdated: hub(),
              create: async options => {result.created.push(options); return {id: 2, ...options};}},
            webNavigation: Object.fromEntries(['onBeforeNavigate','onCommitted','onHistoryStateUpdated','onReferenceFragmentUpdated','onCreatedNavigationTarget'].map(name => [name, hub()]))
          };
          document.querySelector('.blank').addEventListener('click', () => {result.activations++; history.pushState({}, '', '/wrong-source');});
          document.querySelector('.unknown').addEventListener('click', () => {result.activations++; history.pushState({}, '', '/discovered');});
        }, {manifest, recording});
        for (const file of [...manifest.background.scripts, ...manifest.content_scripts[0].js])
          await page.addScriptTag({content: fs.readFileSync(path.join(dir, file), 'utf8')});
        await page.locator(selector).click({button: 'middle'});
        await page.waitForFunction(() => fixture.created.length === 1);
        if (recording) await page.waitForFunction(() => fixture.state.fntLastClickReport?.outcome?.background?.events?.length > 0);
        const value = await page.evaluate(() => ({created: fixture.created, activations: fixture.activations, url: location.href,
          core: fixture.messages.filter(m => !m.type.startsWith('fnt-diagnostic')), report: fixture.state.fntLastClickReport}));
        assert.deepEqual(errors, []);
        assert.equal(value.created.length, 1);
        assert.equal(value.created[0].active, false);
        if (selector !== '.unknown') {assert.equal(value.activations, 0); assert.equal(value.url, base + '/fixture');}
        else assert.equal(value.activations, 1);
        if (recording) {
          assert.equal(value.report.extensionVersion, manifest.version);
          assert.doesNotMatch(JSON.stringify(value.report), /q=private/);
          assert.equal(value.report.outcome.background.counts[selector === '.unknown' ? 'arm-request' : 'direct-open-request'], 1);
        } else assert.equal(value.report, undefined);
        variants.push({created: value.created, activations: value.activations, url: value.url, coreTypes: value.core.map(m => m.type)});
        await page.close();
      }
      assert.deepEqual(variants[1], variants[0], selector + ' changed with recording');
      results.push({control: selector, recordingPreservedBehavior: true});
    }
    // Render the actual options page and exercise its UI with mocked storage.
    const page = await browser.newPage({viewport: {width: 1000, height: 1100}});
    await page.goto('file:///' + path.join(dir, 'changelog.html').replaceAll('\\', '/'));
    await page.evaluate(() => {
      const state = {}, listeners = [];
      window.browser = {storage: {local: {get: async () => state}, onChanged: {addListener(fn) {listeners.push(fn);}}}, runtime: {
        sendMessage: async message => {
          Object.assign(state, {fntRecordNextClick: message.command === 'record' ? {token: message.token, expires: Date.now() + 120000} : null, fntLastClickReport: null});
          for (const fn of listeners) fn({fntRecordNextClick: {}}, 'local'); return {ok: true};
        }}};
    });
    await page.addScriptTag({content: fs.readFileSync(path.join(dir, 'report-ui.js'), 'utf8')});
    await page.locator('#record-click').click();
    await page.waitForFunction(() => document.querySelector('#report-status').textContent.startsWith('Ready'));
    await page.locator('#clear-report').click();
    await page.waitForFunction(() => document.querySelector('#report-status').textContent.startsWith('Recording is off'));
    await page.screenshot({path: path.join(root, 'dist/testing-preferences.png'), fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({path: path.join(root, 'dist/testing-preferences-mobile.png'), fullPage: true});
    console.log(JSON.stringify({browser: await browser.version(), results, optionsRecordAndClear: true,
      limitation: 'Edge DOM and trusted mouse events; mocked extension APIs, not native Firefox integration.'}, null, 2));
  } finally {await browser?.close(); await new Promise(done => server.close(done));}
})().catch(error => {console.error(error); process.exitCode = 1;});
