'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const suites=['core-regressions.cjs','discovery.cjs','generic-resolver.cjs','generalized-regressions.cjs','migration-audit.cjs','diagnostics.cjs','report-ui.cjs','inspection.cjs','app-data.cjs','component-link.cjs','app-data-integration.cjs','button-evidence.cjs','outcome-background.cjs','isolation-target.cjs','isolation-content.cjs','isolation-background.cjs','isolation-integration.cjs','shift-isolation-flow.cjs','shadow-isolation-flow.cjs','legacy-regressions.cjs'];
let failed=false;
for(const suite of suites){
 const result=spawnSync(process.execPath,[path.join(__dirname,suite)],{encoding:'utf8'});
 if(result.status!==0){failed=true;console.error('FAIL '+suite);console.error(result.stdout||'');console.error(result.stderr||result.error||'');}
 else console.log((result.stdout||'').trim().split(/\r?\n/).at(-1));
}
if(failed)process.exitCode=1;
else console.log('All twenty packaged suites passed. These simulate DOM/browser APIs; no native Firefox integration claim.');

