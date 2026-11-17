'use strict';
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
for (const file of ['tools/build.cjs','tests/run.cjs',
  ...['diagnostics','report-ui','inspection','button-evidence','outcome-background','package-parity'].map(name => 'testing/tests/' + name + '.cjs')]) {
  const result = spawnSync(process.execPath, [path.join(root, file)], {encoding: 'utf8'});
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr || result.error || '');
    process.exit(result.status || 1);
  }
  console.log(result.stdout.trim().split(/\r?\n/).at(-1));
}
console.log('Public regressions, restored diagnostics and package parity all passed. Native Firefox retest remains required.');
