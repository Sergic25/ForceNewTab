'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = (variant, file) => fs.readFileSync(path.join(root, 'dist', variant, file));
const ship = JSON.parse(read('ship', 'manifest.json')), testing = JSON.parse(read('testing', 'manifest.json'));
const shared = [...new Set([...ship.background.scripts, ...ship.content_scripts.flatMap(s => s.js)])];
for (const file of shared) {
  assert.deepEqual(read('testing', file), read('ship', file), file + ' must be identical between variants');
  assert.deepEqual(read('ship', file), fs.readFileSync(path.join(root, file)), file + ' must be copied verbatim');
}
assert.deepEqual(testing.permissions, ship.permissions);
assert.deepEqual(testing.host_permissions, ship.host_permissions);
assert.deepEqual(testing.browser_specific_settings, ship.browser_specific_settings);
assert.deepEqual(testing.action, ship.action);
assert.equal(testing.version, ship.version);
for (const file of ['inspection.js','button-evidence.js','diagnostics.js','outcome-trace.js','diagnostic-background.js','report-ui.js']) {
  assert.equal(fs.existsSync(path.join(root, 'dist/ship', file)), false, file + ' leaked into ship build');
  assert.deepEqual(read('testing', file), fs.readFileSync(path.join(root, 'testing', file)));
}
assert.doesNotMatch(read('ship', 'changelog.html').toString(), /record-click|report-ui|click-report/);
assert.match(read('testing', 'changelog.html').toString(), /id="record-click"/);
assert.match(read('testing', 'changelog.html').toString(), /src="report-ui.js"/);
assert.equal(fs.existsSync(path.join(root, 'dist/testing/page-world.js')), false);
assert.match(read('ship', 'content.js').toString(), /deadline: Date.now\(\) \+ 7_500/);
assert.match(read('ship', 'discovery.js').toString(), /lifetime = 8_000/);
console.log('Package parity passed: shared runtime identical, diagnostics testing-only, permissions and timeouts preserved.');
