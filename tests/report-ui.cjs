'use strict';
// UI checks use mocked extension storage/clipboard, not a real Firefox session.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','report-ui.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
let count=0;
async function check(name,fn){await fn();count++;console.log('PASS report UI',name);}
function harness({extension=true,clipboard=true,controlOK=true}={}){
 const ids=['record-click','copy-report','clear-report','report-status','click-report','isolation-status'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{disabled:false,checked:false,value:'',textContent:'',listeners:{},addEventListener(t,f){this.listeners[t]=f;},focus(){this.focused=true;},select(){this.selected=true;}}]));
 const values={},listeners=[],sets=[],copied=[],timers=[],messages=[];
 const api={storage:{local:{async get(){return {...values};},async set(v){sets.push(v);Object.assign(values,v);for(const listener of listeners)listener(Object.fromEntries(Object.keys(v).map(k=>[k,{newValue:v[k]}])),'local');}},onChanged:{addListener(f){listeners.push(f);}}}};
 api.runtime={async sendMessage(request){
  messages.push(request);
  if(!controlOK)return {ok:false};
  assert.equal(request.type,'fnt-diagnostic-control');
  if(request.command==='record'){
   assert.equal(request.token,'test-token');assert.equal('expires' in request,false);
   await api.storage.local.set({fntRecordNextClick:{token:request.token,expires:Date.now()+120000},fntLastClickReport:null});
  }else if(request.command==='clear'){
   assert.equal('token' in request,false);
   await api.storage.local.set({fntRecordNextClick:null,fntLastClickReport:null});
  }else throw Error('Unknown control command');
  return {ok:true};
 }};
 const context={document:{getElementById:id=>nodes[id]},window:{addEventListener(){}},navigator:{clipboard:{async writeText(v){if(!clipboard)throw Error('blocked');copied.push(v);}}},crypto:{randomUUID:()=> 'test-token'},Date,JSON,Number,Math,clearTimeout(){},setTimeout(f,ms){timers.push({f,ms});return timers.length;}};
 if(extension)context.browser=api;
 vm.runInNewContext(source,context);
 return {nodes,values,sets,copied,timers,messages,api};
}
(async()=>{
 await check('direct file preview cannot record or copy extension data',async()=>{
  const h=harness({extension:false});
  for(const id of ['record-click','copy-report','clear-report'])assert.ok(h.nodes[id].disabled);
  assert.match(h.nodes['report-status'].textContent,/Load this build/);
 });
 await check('recording is off by default',async()=>{
  const h=harness();await flush();
  assert.match(h.nodes['report-status'].textContent,/Recording is off/);
  assert.ok(h.nodes['copy-report'].disabled);assert.equal(h.sets.length,0);
 });
 await check('record command replaces prior report and arms a two minute token',async()=>{
  const h=harness();await flush();
  await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1,old:true}});await flush();
  const before=Date.now();h.nodes['record-click'].listeners.click();await flush();
  assert.equal(h.values.fntRecordNextClick.token,'test-token');
  assert.ok(h.values.fntRecordNextClick.expires>=before+120000);
  assert.ok(h.values.fntRecordNextClick.expires<=Date.now()+120000);
  assert.equal(h.values.fntLastClickReport,null);assert.equal(h.nodes['click-report'].value,'');
  assert.match(h.nodes['report-status'].textContent,/Ready/);assert.equal(h.messages.length,1);assert.equal(h.messages[0].command,'record');
 });
 await check('rapid repeat record commands do not race separate storage writes',async()=>{
  const h=harness();await flush();
  h.nodes['record-click'].listeners.click();h.nodes['record-click'].listeners.click();await flush();
  assert.equal(h.sets.length,1);assert.equal(h.messages.length,1);
  const failed=harness({controlOK:false});await flush();failed.nodes['record-click'].listeners.click();await flush();
  assert.equal(failed.sets.length,0);assert.equal(failed.values.fntRecordNextClick,undefined);
  assert.match(failed.nodes['report-status'].textContent,/could not be saved/);
 });
 await check('a stored report appears as reviewable JSON',async()=>{
  const h=harness();await flush();
  await h.api.storage.local.set({fntRecordNextClick:null,fntLastClickReport:{schemaVersion:1,path:[]}});await flush();
  assert.match(h.nodes['report-status'].textContent,/captured/);
  assert.ok(!h.nodes['copy-report'].disabled);
  assert.deepEqual(JSON.parse(h.nodes['click-report'].value),{schemaVersion:1,path:[]});
 });
 await check('clipboard copy requires the copy button action',async()=>{
  const h=harness();await flush();
  await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1}});await flush();
  assert.equal(h.copied.length,0);await h.nodes['copy-report'].listeners.click();
  assert.equal(h.copied.length,1);assert.equal(h.copied[0],h.nodes['click-report'].value);
 });
 await check('clear stops recording and removes the local report',async()=>{
  const h=harness();await flush();
  await h.api.storage.local.set({fntRecordNextClick:{token:'test-token',expires:Date.now()+120000},fntLastClickReport:{schemaVersion:1}});await flush();
  h.nodes['clear-report'].listeners.click();await flush();
  assert.equal(h.values.fntLastClickReport,null);assert.equal(h.values.fntRecordNextClick,null);
  assert.equal(h.nodes['click-report'].value,'');assert.ok(h.nodes['copy-report'].disabled);assert.equal(h.messages.length,1);assert.equal(h.messages[0].command,'clear');
 });
 await check('clipboard rejection selects the preview and explains Ctrl+C',async()=>{
  const h=harness({clipboard:false});await flush();
  await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1}});await flush();
  await h.nodes['copy-report'].listeners.click();
  assert.ok(h.nodes['click-report'].focused);assert.ok(h.nodes['click-report'].selected);
  assert.match(h.nodes['report-status'].textContent,/Ctrl\+C/);
 });
 await check('expired recording is shown without silently rearming',async()=>{
  const h=harness();await flush();
  await h.api.storage.local.set({fntLastClickReport:null,fntRecordNextClick:{token:'expired',expires:Date.now()-1}});await flush();
  assert.match(h.nodes['report-status'].textContent,/expired/);assert.equal(h.sets.length,1);assert.equal(h.messages.length,0);
 });
 await check('an unrelated preference change does not reload or change report controls',async()=>{
  const h=harness();await flush();
  const before=h.nodes['report-status'].textContent;
  await h.api.storage.local.set({enabled:false});await flush();
  assert.equal(h.nodes['report-status'].textContent,before);assert.equal(h.values.fntRecordNextClick,undefined);
 });

 await check('feature switches are absent and report controls work without them',async()=>{
  const h=harness();await flush();
  assert.equal(h.nodes['app-data-enabled'],undefined);assert.equal(h.nodes['isolation-enabled'],undefined);
  assert.match(h.nodes['isolation-status'].textContent,/automatically.*toolbar is ON/);
  assert.equal(h.sets.length,0);assert.equal(h.messages.length,0);
  const html=fs.readFileSync(path.join(__dirname,'..','changelog.html'),'utf8');
  assert.doesNotMatch(html,/id="(?:app-data-enabled|isolation-enabled)"/);
 });
 await check('legacy feature flags cannot change the automatic-method status',async()=>{
  const h=harness();await flush();const before=h.nodes['isolation-status'].textContent;
  await h.api.storage.local.set({fntAppDataEnabled:false,fntIsolationEnabled:false});await flush();
  assert.equal(h.nodes['isolation-status'].textContent,before);assert.equal(h.messages.length,0);
 });
 await check('rejected recording stays usable without changing toolbar or old flags',async()=>{
  const h=harness({controlOK:false});await flush();
  await h.api.storage.local.set({enabled:false,fntAppDataEnabled:false,fntIsolationEnabled:false});await flush();
  h.nodes['record-click'].listeners.click();await flush();
  assert.match(h.nodes['report-status'].textContent,/could not be saved/);
  assert.equal(h.nodes['record-click'].disabled,false);assert.equal(h.values.enabled,false);
  assert.equal(h.values.fntRecordNextClick,undefined);assert.equal(h.values.fntAppDataEnabled,false);
 });
 await check('clearing reports never changes the global toolbar state',async()=>{
  const h=harness();await flush();
  await h.api.storage.local.set({enabled:false,fntLastClickReport:{schemaVersion:1}});await flush();
  h.nodes['clear-report'].listeners.click();await flush();
  assert.equal(h.values.enabled,false);assert.equal(h.values.fntLastClickReport,null);
  assert.equal(h.messages.at(-1).command,'clear');
 });

 await check('outcome status explains the wait and final updates refresh the preview',async()=>{
  const h=harness();await flush();await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1,outcome:{version:1,content:{status:'observing'}}}});await flush();
  assert.match(h.nodes['report-status'].textContent,/10 seconds/);
  await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1,outcome:{version:1,content:{status:'complete',titleChanged:true}}}});await flush();
  assert.doesNotMatch(h.nodes['report-status'].textContent,/Watching/);assert.equal(JSON.parse(h.nodes['click-report'].value).outcome.content.titleChanged,true);
 });
 await check('safe last-copy status appears in the report without altering stored report',async()=>{
  const h=harness();await flush();await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1},fntLastIsolationResult:{state:'activated',activated:true}});await flush();
  assert.match(h.nodes['isolation-status'].textContent,/click was attempted/);assert.equal(JSON.parse(h.nodes['click-report'].value).isolationResult.activated,true);assert.equal(h.values.fntLastClickReport.isolationResult,undefined);
 });
 await check('declined copy status explains fallback and preserves its safe reason in copied report',async()=>{
 const h=harness();await flush();await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1},fntLastIsolationResult:{state:'declined',reason:'ambiguous-shadow-host',activated:false}});await flush();
 assert.match(h.nodes['isolation-status'].textContent,/Copy not started/);assert.equal(JSON.parse(h.nodes['click-report'].value).isolationResult.reason,'ambiguous-shadow-host');
 });
 await check('authenticated request rejection is visible as a safe copy result',async()=>{
 const h=harness();await flush();await h.api.storage.local.set({fntLastClickReport:{schemaVersion:1},fntLastIsolationResult:{state:'rejected',reason:'sender-origin-mismatch',build:'4.2.3',activated:false}});await flush();
 assert.match(h.nodes['isolation-status'].textContent,/rejected/);assert.equal(JSON.parse(h.nodes['click-report'].value).isolationResult.build,'4.2.3');
 });
 console.log(count+' report UI checks passed (mocked storage/clipboard; real Firefox retest still required).');
})().catch(error=>{console.error(error);process.exitCode=1;});


