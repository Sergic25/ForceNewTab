'use strict';
// Background-copy tests simulate tab APIs and time; they do not run Firefox.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','isolation-background.js'),'utf8');
const flush=async()=>{for(let i=0;i<60;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function hub(){const handlers=[];return{addListener(fn){handlers.push(fn);},fire(...values){for(const fn of handlers)fn(...values);}};}
function harness(options={}){
 let time=1000,next=0,listener;const timers=new Map(),settings=hub(),removed=hub(),activated=hub();
 const navigation={onBeforeNavigate:hub(),onCommitted:hub()};
 const state={enabled:true,...options.state},writes=[],messages=[],duplicates=[],removals=[],reads=[];
 const sourceTab={id:1,windowId:2,url:'https://generic.test/start',cookieStoreId:'firefox-container-2',incognito:false,active:true};
 const tabs=new Map([[1,{...sourceTab}]]);let prepareCount=0,nonceCount=0;
 const api={webNavigation:navigation,runtime:{id:'fnt-test',getManifest:options.manifestVersion===undefined?undefined:()=>({version:options.manifestVersion}),onMessage:{addListener(fn){listener=fn;}}},
  storage:{onChanged:settings,local:{get(defaults){reads.push(JSON.parse(JSON.stringify(defaults)));if(options.initialThrow)throw Error('settings read unavailable');if(options.initial)return options.initial.promise;return Promise.resolve({...defaults,...state});},set(value){if(options.set)return options.set(value,state,writes);if(options.failStorage)return Promise.reject(Error('storage unavailable'));writes.push(JSON.parse(JSON.stringify(value)));Object.assign(state,value);return Promise.resolve();}}},
  tabs:{onRemoved:removed,onActivated:activated,get(id){if(options.get)return options.get(id,tabs);return tabs.has(id)?Promise.resolve({...tabs.get(id)}):Promise.reject(Error('tab missing'));},
   duplicate(id,properties){duplicates.push({id,properties});if(options.duplicate)return options.duplicate(id,properties,tabs);const tab={...tabs.get(id),id:10,active:false,...options.copy};tabs.set(10,tab);return Promise.resolve({...tab});},
   remove(id){removals.push(id);if(options.remove)return options.remove(id,tabs);tabs.delete(id);removed.fire(id);return Promise.resolve();},
   sendMessage(id,message,frame){messages.push({id,message,frame});if(message.type==='fnt-isolate-prepare'){prepareCount++;return options.prepare?options.prepare(prepareCount,message,tabs):Promise.resolve({ok:true,ready:true,documentNonce:'document-1',preparationNonce:'preparation-1'});}
    if(message.type==='fnt-isolate-execute')return options.execute?options.execute(message,tabs):Promise.resolve({activated:true,reason:'activation-dispatched'});throw Error('unknown worker message');}}};
 const clock={now:()=>time,tick(ms){const end=time+ms;for(;;){let due;for(const entry of timers)if(entry[1].at<=end&&(!due||entry[1].at<due[1].at))due=entry;if(!due)break;timers.delete(due[0]);time=due[1].at;due[1].fn();}time=end;}};
 vm.runInNewContext(source,{browser:api,URL,Date:{now:clock.now},crypto:{randomUUID(){if(options.nonceThrow)throw Error('nonce unavailable');return 'nonce-'+(++nonceCount);}},
  FNTIsolationTarget:{validDescriptor(value){return value?.version===1&&value.valid===true;}},
  setTimeout(fn,delay){const id=++next;timers.set(id,{fn,at:time+delay});return id;},clearTimeout(id){timers.delete(id);}});
 const sender={id:'fnt-test',frameId:0,url:sourceTab.url,tab:{...sourceTab}};
 const request=(requestId='gesture-1')=>({type:'fnt-isolate-start',requestId,beforeURL:sourceTab.url,target:{version:1,valid:true}});
 return {state,writes,messages,duplicates,removals,reads,tabs,sender,request,clock,timers,api,navigation,
  send:(message=request(),from=sender)=>listener(message,from),
  change(delta,area='local'){Object.assign(state,delta);settings.fire(Object.fromEntries(Object.entries(delta).map(([k,v])=>[k,{newValue:v}])) ,area);},
  close(id){tabs.delete(id);removed.fire(id);},activate(id){const tab=tabs.get(id);if(tab){for(const other of tabs.values())if(other.windowId===tab.windowId)other.active=false;tab.active=true;}activated.fire({tabId:id,windowId:tab?.windowId??2});}};
}
async function finish(h,p,limit=18000){let done=false,value,error;p.then(v=>{done=true;value=v;},e=>{done=true;error=e;});await flush();for(let passed=0;!done&&passed<limit;passed+=250){await advance(h,250);}if(error)throw error;assert.equal(done,true,'operation did not settle');return value;}
async function advance(h,ms){for(let passed=0;passed<ms;){const step=Math.min(250,ms-passed);h.clock.tick(step);await flush();passed+=step;}}
let count=0;async function test(name,fn){await fn();count++;console.log('PASS isolation background',name);}
(async()=>{
 await test('unrelated core and content messages keep their original responder',()=>{const h=harness();for(const type of ['fnt-open','fnt-arm','fnt-captured','fnt-diagnostic','other'])assert.equal(h.send({type}),undefined);});
 await test('fresh toolbar ON automatically prepares one copy without a separate preference',async()=>{const h=harness();const result=await finish(h,h.send());assert.equal(result.activated,true);assert.equal(h.duplicates.length,1);assert.deepEqual(h.reads,[{enabled:true}]);assert.equal(Object.hasOwn(h.state,'fntIsolationEnabled'),false);});
 await test('legacy false copy preference cannot disable automatic toolbar ON behavior',async()=>{const h=harness({state:{fntIsolationEnabled:false}});const result=await finish(h,h.send());assert.equal(result.activated,true);assert.equal(h.duplicates.length,1);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.state.fntIsolationEnabled,false);assert.deepEqual(h.reads,[{enabled:true}]);});
 await test('global toolbar OFF prevents duplication',async()=>{const h=harness({state:{enabled:false}});await finish(h,h.send());assert.equal(h.duplicates.length,0);});
 await test('sender identity, source frame and window must be valid',async()=>{for(const override of [{id:'other'}, {frameId:1}, {tab:{id:-1,windowId:2}}, {tab:{id:1,windowId:-1}}, {url:'https://other.test/'}]){const h=harness();const r=await h.send(h.request(),{...h.sender,...override});assert.equal(r.reason,'invalid-request');assert.equal(h.duplicates.length,0);}});
 await test('malformed IDs, unsafe URLs and descriptors are rejected',async()=>{for(const update of [{requestId:''},{requestId:'x'.repeat(101)},{beforeURL:'about:blank'},{beforeURL:'https://u:secret@generic.test/start'},{target:{version:1,valid:false}},{target:{version:1,valid:true,padding:'x'.repeat(8000)}}]){const h=harness();const r=await h.send({...h.request(),...update});assert.equal(r.reason,'invalid-request');assert.equal(h.duplicates.length,0);}});
 await test('valid decline saves a fixed reason without copying arbitrary fields',async()=>{
  const h=harness();await flush();const r=await h.send({type:'fnt-isolate-declined',reason:'closed-shadow-root',label:'PRIVATE_LABEL',url:'https://private.test/account',nonce:'PRIVATE_NONCE'});await flush();
  assert.equal(r.ok,true);assert.deepEqual(JSON.parse(JSON.stringify(h.state.fntLastIsolationResult)),{state:'declined',reason:'closed-shadow-root',activated:false,copyKept:false,updatedAt:h.clock.now(),build:'2.0.1'});assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE|private.test/);assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);
 });
 await test('declines from other extensions frames and invalid tabs cannot change storage',async()=>{
  for(const override of [{id:'foreign'},{frameId:1},{tab:{id:-1,windowId:2}},{tab:{id:1,windowId:-1}}]){const h=harness();await flush();const r=await h.send({type:'fnt-isolate-declined',reason:'read-error'},{...h.sender,...override});assert.equal(r.ok,false);assert.equal(h.writes.length,0);}
 });
 await test('toolbar OFF ignores decline reports after settings settle',async()=>{
  const h=harness({state:{enabled:false}});const r=await h.send({type:'fnt-isolate-declined',reason:'read-error'});assert.equal(r.ok,false);assert.equal(h.writes.length,0);
 });
 await test('legacy false copy preference does not block authenticated decline status',async()=>{
  const h=harness({state:{fntIsolationEnabled:false}});const r=await h.send({type:'fnt-isolate-declined',reason:'read-error'});assert.equal(r.ok,true);assert.equal(h.state.fntLastIsolationResult.state,'declined');assert.equal(h.state.fntLastIsolationResult.reason,'read-error');
 });
 await test('unknown decline reasons are replaced rather than stored',async()=>{
  for(const reason of ['PRIVATE_LABEL',null,{},'a'.repeat(100),'read-error PRIVATE']){const h=harness();await flush();await h.send({type:'fnt-isolate-declined',reason});assert.equal(h.state.fntLastIsolationResult.reason,'target-unavailable');assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE/);}
 });
 await test('nonce failure saves status before returning the unchanged preactivation fallback',async()=>{
  const h=harness({nonceThrow:true});await flush();const r=await h.send();await flush();assert.equal(r.fallback,true);assert.equal(r.activated,false);assert.equal(h.state.fntLastIsolationResult.state,'failed');assert.equal(h.state.fntLastIsolationResult.reason,'nonce-unavailable');assert.equal(h.duplicates.length,0);
 });
 await test('expanded bounded request can carry a shadow-host descriptor while oversized requests reject',async()=>{
  const h=harness();const request=h.request();request.target.padding='x'.repeat(5500);assert.ok(JSON.stringify(request).length>5500);assert.equal((await finish(h,h.send(request))).activated,true);
  const bad=harness();const oversized=bad.request();oversized.target.padding='x'.repeat(7500);assert.equal((await bad.send(oversized)).reason,'invalid-request');assert.equal(bad.duplicates.length,0);
 });
 await test('one inactive copy uses the source context and one top-frame activation',async()=>{const h=harness();const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.deepEqual(JSON.parse(JSON.stringify(h.duplicates)),[{id:1,properties:{active:false}}]);const calls=h.messages.filter(x=>x.message.type==='fnt-isolate-execute');assert.equal(calls.length,1);assert.equal(calls[0].id,10);assert.equal(calls[0].frame.frameId,0);assert.equal(calls[0].message.documentNonce,'document-1');assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.state,'activated');assert.equal(h.timers.size,0);});
 await test('one stable document and preparation token must settle for 1500ms before the single click',async()=>{const h=harness();const p=h.send();await flush();assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,1);await advance(h,1499);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);await advance(h,1);await finish(h,p);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,7);const execute=h.messages.filter(x=>x.message.type==='fnt-isolate-execute');assert.equal(execute.length,1);assert.equal(execute[0].message.preparationNonce,'preparation-1');});
 await test('cold restoration retries absent receiver without creating more copies',async()=>{const h=harness({prepare:n=>n<4?Promise.reject(Error('not loaded')):Promise.resolve({ok:true,ready:true,documentNonce:'document-1',preparationNonce:'preparation-1'})});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(h.duplicates.length,1);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,10);});
 await test('a new worker document restarts stability verification',async()=>{const h=harness({prepare:n=>Promise.resolve({ok:true,ready:true,documentNonce:n===1?'old':'new',preparationNonce:'preparation-1'})});await finish(h,h.send());assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,8);assert.equal(h.messages.at(-1).message.documentNonce,'new');});
 await test('a replaced target token restarts settling within the same document',async()=>{
  const h=harness({prepare:n=>Promise.resolve({ok:true,ready:true,documentNonce:'same-document',preparationNonce:n===1?'old-target':'new-target'})});const p=h.send();await flush();await advance(h,1500);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);await advance(h,250);const r=await finish(h,p);assert.equal(r.activated,true);const calls=h.messages.filter(x=>x.message.type==='fnt-isolate-execute');assert.equal(calls.length,1);assert.equal(calls[0].message.preparationNonce,'new-target');assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,8);
 });
 await test('a temporarily unready control must complete a new settling interval',async()=>{
  const h=harness({prepare:n=>Promise.resolve(n===4?{ready:false}:{ok:true,ready:true,documentNonce:'same-document',preparationNonce:'same-target'})});await finish(h,h.send());assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,11);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);
 });
 await test('a delayed handler can become ready before the one copied activation',async()=>{
  let effects=0;const h=harness({execute:()=>{if(h.clock.now()>=2000)effects++;return Promise.resolve({activated:true,reason:'activation-dispatched'});}});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(effects,1);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.state.fntLastIsolationResult.effectConfirmed,false);
 });
 await test('missing and malformed preparation tokens cannot activate or extend the 15-second budget',async()=>{
  for(const preparationNonce of [undefined,null,0,{},'', 'p'.repeat(101)]){const h=harness({prepare:()=>Promise.resolve({ok:true,ready:true,documentNonce:'document-1',preparationNonce})});const started=h.clock.now();const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.equal(h.clock.now()-started,15000);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.equal(h.timers.size,0);}
 });
 await test('continuous target replacement cannot extend the fixed deadline or cause an activation',async()=>{
  const h=harness({prepare:n=>Promise.resolve({ok:true,ready:true,documentNonce:'same-document',preparationNonce:'replacement-'+n})});const started=h.clock.now();const r=await finish(h,h.send());assert.equal(h.clock.now()-started,15000);assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.equal(r.reason,'timed-out');assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.equal(h.duplicates.length,1);assert.deepEqual(h.removals,[10]);assert.equal(h.timers.size,0);
 });
 await test('unready or invalid document acknowledgements cannot trigger activation',async()=>{const h=harness({prepare:()=>Promise.resolve({ok:true,ready:true,documentNonce:''})});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.deepEqual(h.removals,[10]);assert.equal(h.timers.size,0);});
 await test('copy context mismatches fail before pressing and clean only the owned copy',async()=>{for(const copy of [{windowId:3},{cookieStoreId:'firefox-container-other'},{incognito:true}]){const h=harness({copy});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.equal(h.messages.length,0);assert.deepEqual(h.removals,[10]);assert.equal(h.tabs.has(1),true);}});
 await test('source URL changes before duplication prevent all worker activity',async()=>{const h=harness();h.tabs.get(1).url='https://generic.test/elsewhere';const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(h.duplicates.length,0);});
 await test('source URL changes while worker restores prevent activation',async()=>{const h=harness({prepare:(n,m,tabs)=>{if(n===2)tabs.get(1).url='https://generic.test/elsewhere';return Promise.resolve({ok:true,ready:true,documentNonce:'doc',preparationNonce:'preparation-1'});}});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.deepEqual(h.removals,[10]);});
 await test('duplicate transport failure permits one original fallback',async()=>{const h=harness({duplicate:()=>Promise.reject(Error('cannot duplicate'))});const r=await finish(h,h.send());assert.equal(r.fallback,true);assert.equal(r.activated,false);assert.equal(h.messages.length,0);});
 await test('execute acknowledgement loss never replays or closes the copy',async()=>{const h=harness({execute:()=>Promise.reject(Error('navigation unloaded content'))});const r=await finish(h,h.send());assert.equal(r.fallback,false);assert.equal(r.activated,true);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.state,'uncertain');});
 await test('dispatch and thrown activation acknowledgements retain their fixed reason without retry',async()=>{
  for(const reason of ['activation-dispatched','activation-threw','already-activated']){const h=harness({execute:()=>Promise.resolve({activated:true,reason})});const r=await finish(h,h.send());assert.equal(r.reason,reason);assert.equal(r.fallback,false);assert.equal(h.state.fntLastIsolationResult.reason,reason);assert.equal(h.state.fntLastIsolationResult.effectConfirmed,false);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);assert.equal((await h.send()).reason,'already-consumed');}
 });
 await test('a consumed prepare acknowledgement is preserved and never issues another click',async()=>{
  const h=harness({prepare:()=>Promise.resolve({activated:true,reason:'already-activated'})});const r=await finish(h,h.send());assert.equal(r.reason,'already-activated');assert.equal(r.fallback,false);assert.equal(h.state.fntLastIsolationResult.reason,'already-activated');assert.equal(h.state.fntLastIsolationResult.effectConfirmed,false);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.equal(h.removals.length,0);
 });
 await test('unknown activation reasons are not persisted and cannot authorize a retry',async()=>{
  const h=harness({execute:()=>Promise.resolve({activated:true,reason:'PRIVATE_PAGE_REASON'})});const r=await finish(h,h.send());assert.equal(r.reason,'activation-unconfirmed');assert.equal(r.fallback,false);assert.equal(h.state.fntLastIsolationResult.state,'uncertain');assert.equal(h.state.fntLastIsolationResult.effectConfirmed,false);assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE/);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);
 });
 await test('an unacknowledged execute reply remains uncertain and retains the copy',async()=>{const h=harness({execute:()=>Promise.resolve({})});const r=await finish(h,h.send());assert.equal(r.fallback,false);assert.equal(r.activated,true);assert.equal(h.state.fntLastIsolationResult.state,'uncertain');assert.equal(h.removals.length,0);});
 await test('definitive no-activation response permits cleanup and original fallback',async()=>{const h=harness({execute:()=>Promise.resolve({activated:false})});const r=await finish(h,h.send());assert.equal(r.fallback,true);assert.equal(r.activated,false);assert.deepEqual(h.removals,[10]);});
 await test('hanging execute is bounded and treated as possibly activated',async()=>{const wait=deferred();const h=harness({execute:()=>wait.promise});const r=await finish(h,h.send());assert.equal(r.fallback,false);assert.equal(r.activated,true);assert.equal(h.removals.length,0);assert.equal(h.timers.size,0);});
 await test('duplicate requests share the same in-flight operation',async()=>{const h=harness();const first=h.send(),second=h.send();const result=await finish(h,first);assert.deepEqual(await second,result);assert.equal(h.duplicates.length,1);const again=await h.send();assert.equal(again.reason,'already-consumed');assert.equal(h.duplicates.length,1);});
 await test('different simultaneous gesture in one source cannot create an extra copy',async()=>{const h=harness();const first=h.send();const other=await h.send(h.request('other'));assert.equal(other.reason,'busy');await finish(h,first);assert.equal(h.duplicates.length,1);});
 await test('another source tab can prepare independently',async()=>{let nextCopy=10;const h=harness({duplicate:(id,props,tabs)=>{const copy={...tabs.get(id),id:nextCopy++,active:false};tabs.set(copy.id,copy);return Promise.resolve(copy);}});h.tabs.set(3,{...h.tabs.get(1),id:3});const first=h.send();const second=h.send({...h.request('other'),beforeURL:h.request().beforeURL},{...h.sender,tab:{...h.sender.tab,id:3}});await finish(h,first);await finish(h,second);assert.equal(h.duplicates.length,2);});
 await test('only the owning source and request may cancel',async()=>{const h=harness();const p=h.send();await flush();for(const [requestId,sender] of [['wrong',h.sender],['gesture-1',{...h.sender,frameId:1}],['gesture-1',{...h.sender,id:'other'}]]){const result=await h.send({type:'fnt-isolate-cancel',requestId},sender);assert.notEqual(result.cancelled,true);}const done=await h.send({type:'fnt-isolate-cancel',requestId:'gesture-1'});assert.equal(done.cancelled,true);const result=await finish(h,p);assert.equal(result.fallback,false);assert.equal(result.activated,false);assert.deepEqual(h.removals,[10]);});
 await test('turning the global toolbar off cancels before activation',async()=>{const h=harness();const p=h.send();await flush();h.change({enabled:false});const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.deepEqual(h.removals,[10]);});
 await test('legacy copy preference changes cannot cancel an automatic operation',async()=>{const h=harness();const p=h.send();await flush();h.change({fntIsolationEnabled:false});const r=await finish(h,p);assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);});
 await test('nonlocal toolbar events do not change behavior',async()=>{const h=harness();await flush();h.change({enabled:false},'sync');const r=await finish(h,h.send());assert.equal(r.activated,true);});
 await test('newer toolbar ON overrides a stale initial OFF storage response',async()=>{const initial=deferred(),h=harness({initial});h.change({enabled:true});const p=h.send();initial.resolve({enabled:false,fntIsolationEnabled:false});const r=await finish(h,p);assert.equal(r.activated,true);assert.equal(h.duplicates.length,1);});
 await test('newer toolbar OFF overrides a stale initial ON storage response',async()=>{const initial=deferred(),h=harness({initial});h.change({enabled:false});const p=h.send();initial.resolve({enabled:true,fntIsolationEnabled:true});const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);});
 await test('a legacy copy setting change cannot discard the saved toolbar OFF state',async()=>{const initial=deferred(),h=harness({initial});h.change({fntIsolationEnabled:true});const p=h.send();initial.resolve({enabled:false,fntIsolationEnabled:false});const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(h.duplicates.length,0);});
 await test('viewing a restoring copy allows one activation without closing either tab',async()=>{
  const h=harness();const p=h.send();await flush();h.activate(10);const r=await finish(h,p);assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);assert.equal(h.tabs.get(10).active,true);assert.equal(h.state.fntLastIsolationResult.copyKept,true);
 });
 await test('a copy already active at the final lookup can still execute exactly once',async()=>{
  const h=harness({copy:{active:true}});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);
 });
 await test('switching to the copy then away and back does not reset stable preparation',async()=>{
  const h=harness();const p=h.send();await flush();h.activate(10);h.activate(1);h.activate(10);const r=await finish(h,p);assert.equal(r.activated,true);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-prepare').length,7);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);
 });
 await test('an active unused copy is preserved when its target changed',async()=>{
  const h=harness({execute:()=>Promise.resolve({activated:false})});const p=h.send();await flush();h.activate(10);const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.copyKept,true);
 });
 await test('passive viewing then leaving permits cleanup of an unused inactive copy',async()=>{
  const h=harness({prepare:()=>Promise.resolve({ok:true,ready:false})});const p=h.send();await flush();h.activate(10);h.activate(1);const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.deepEqual(h.removals,[10]);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);
 });
 await test('authenticated copy input cancels before activation and preserves an inactive copy',async()=>{
  const h=harness();const p=h.send();await flush();const nonce=h.messages[0].message.nonce;const from={...h.sender,tab:{...h.tabs.get(10)}};
  const notice=await h.send({type:'fnt-isolate-worker-input',nonce,label:'PRIVATE_INPUT',value:'PRIVATE_TYPED_VALUE'},from);assert.equal(notice.ok,true);assert.equal(notice.cancelled,true);
  const r=await finish(h,p);assert.equal(r.reason,'copy-input');assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.removals.length,0);assert.equal(h.tabs.get(10).active,false);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.equal(h.state.fntLastIsolationResult.state,'cancelled');assert.equal(h.state.fntLastIsolationResult.reason,'copy-input');assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE|nonce-/);
 });
 await test('copy input remains protected after switching away from an active copy',async()=>{
  const h=harness();const p=h.send();await flush();h.activate(10);await h.send({type:'fnt-isolate-worker-input',nonce:h.messages[0].message.nonce},{...h.sender,tab:{...h.tabs.get(10)}});h.activate(1);
  const r=await finish(h,p);assert.equal(r.reason,'copy-input');assert.equal(r.fallback,false);assert.equal(r.activated,false);assert.equal(h.removals.length,0);assert.equal(h.tabs.has(10),true);
 });
 await test('foreign frames tabs and wrong nonces cannot cancel a worker or write status',async()=>{
  const h=harness();const p=h.send();await flush();const nonce=h.messages[0].message.nonce,from={...h.sender,tab:{...h.tabs.get(10)}},writes=h.writes.length;
  const cases=[[nonce,{...from,id:'other'}],[nonce,{...from,frameId:1}],[nonce,h.sender],[nonce,{...from,tab:{...from.tab,id:99}}],[nonce,{...from,tab:{...from.tab,windowId:-1}}],['wrong',from],['',from],['x'.repeat(101),from],[null,from]];
  for(const [value,sender]of cases){const r=await h.send({type:'fnt-isolate-worker-input',nonce:value},sender);assert.equal(r.ok,false);assert.equal(r.cancelled,false);assert.equal(h.writes.length,writes);}
  const r=await finish(h,p);assert.equal(r.activated,true);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);
 });
 await test('input reported before prepare readiness preserves the copy and skips source fallback',async()=>{
  for(const active of [false,true]){const h=harness({copy:{active},prepare:()=>Promise.resolve({ok:true,ready:false,activated:false,userInteracted:true,reason:'PRIVATE_REASON'})});const r=await finish(h,h.send());assert.equal(r.reason,'copy-input');assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.messages.length,1);assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.state,'cancelled');assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE/);}
 });
 await test('a definitive execute input rejection retains active and inactive copies',async()=>{
  for(const active of [false,true]){const h=harness({copy:{active},execute:()=>Promise.resolve({activated:false,userInteracted:true,reason:'copy-input'})});const r=await finish(h,h.send());assert.equal(r.reason,'copy-input');assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.state,'cancelled');assert.equal(h.state.fntLastIsolationResult.activated,false);}
 });
 await test('already activated prepare acknowledgements beat mixed input flags and never replay',async()=>{
  const h=harness({prepare:()=>Promise.resolve({ok:true,ready:false,activated:true,userInteracted:true,reason:'copy-input'})});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.messages.length,1);assert.equal(h.messages.some(x=>x.message.type==='fnt-isolate-execute'),false);assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.activated,true);
 });
 await test('an activated execute acknowledgement beats mixed input flags',async()=>{
  const h=harness({execute:()=>Promise.resolve({activated:true,userInteracted:true,reason:'copy-input'})});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.activated,true);
 });
 await test('incomplete execute input acknowledgement remains uncertain without cleanup or retry',async()=>{
  const h=harness({execute:()=>Promise.resolve({userInteracted:true,reason:'copy-input'})});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.state.fntLastIsolationResult.state,'uncertain');assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.removals.length,0);
 });
 await test('copy input after execute dispatch cannot authorize retry or source fallback',async()=>{
  const wait=deferred(),h=harness({execute:()=>wait.promise});const p=h.send();await flush();await advance(h,1500);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);
  await h.send({type:'fnt-isolate-worker-input',nonce:h.messages[0].message.nonce},{...h.sender,tab:{...h.tabs.get(10)}});const r=await finish(h,p);wait.resolve({activated:false,userInteracted:true});await flush();assert.equal(r.activated,true);assert.equal(r.fallback,false);assert.equal(h.state.fntLastIsolationResult.state,'uncertain');assert.equal(h.removals.length,0);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);
 });
 await test('input received during cleanup lookup prevents closing the copy',async()=>{
  const wait=deferred();let lookups=0;const h=harness({execute:()=>Promise.resolve({activated:false}),get:(id,tabs)=>{if(id===10&&++lookups===2)return wait.promise;return Promise.resolve({...tabs.get(id)});}});const p=h.send();await flush();await advance(h,1500);assert.equal(lookups,2);
  await h.send({type:'fnt-isolate-worker-input',nonce:h.messages[0].message.nonce},{...h.sender,tab:{...h.tabs.get(10)}});wait.resolve({...h.tabs.get(10)});const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(r.reason,'copy-input');assert.equal(h.removals.length,0);assert.equal(h.state.fntLastIsolationResult.state,'cancelled');
 });
 await test('closing the source cancels and removes an untouched copy',async()=>{const h=harness();const p=h.send();await flush();h.close(1);const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.deepEqual(h.removals,[10]);});
 await test('closing the copy is treated as cancellation without pressing the source',async()=>{const h=harness();const p=h.send();await flush();h.close(10);const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.removals.length,0);});
 await test('a late duplicate after timeout is never pressed and is cleaned safely',async()=>{const wait=deferred();const h=harness({duplicate:()=>wait.promise});const p=h.send();await flush();const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,true);h.tabs.set(10,{...h.tabs.get(1),id:10,active:false});wait.resolve({...h.tabs.get(10)});await flush();assert.deepEqual(h.removals,[10]);assert.equal(h.messages.length,0);});
 await test('hanging initial settings read is deadline bounded without source fallback',async()=>{const initial=deferred(),h=harness({initial});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);assert.equal(h.timers.size,0);});
 await test('a definitive toolbar read failure declines copying but permits guarded original discovery',async()=>{
  const h=harness({initialThrow:true});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.equal(r.reason,'toolbar-read-failed');assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);assert.equal(h.state.fntLastIsolationResult.reason,'toolbar-read-failed');
 });
 await test('an asynchronously rejected toolbar read permits fallback without creating or activating a copy',async()=>{
  const initial=deferred(),h=harness({initial});const p=h.send();await flush();assert.equal(h.duplicates.length,0);initial.reject(Error('storage read unavailable'));const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,true);assert.equal(r.reason,'toolbar-read-failed');assert.equal(h.messages.length,0);assert.equal(h.duplicates.length,0);assert.equal(h.timers.size,0);
 });
 await test('known toolbar OFF still blocks fallback after a definitive initial read failure',async()=>{
  const h=harness({initialThrow:true});await flush();h.change({enabled:false});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);
 });
 await test('toolbar OFF while a failing settings request is pending cancels without fallback',async()=>{
  const initial=deferred(),h=harness({initial});const p=h.send();await flush();h.change({enabled:false});initial.reject(Error('storage unavailable'));const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);assert.equal(h.timers.size,0);
 });
 await test('a failed settings read does not bypass fresh source path query fragment or window checks',async()=>{
  for(const change of [{url:'https://generic.test/changed'},{url:'https://generic.test/start?changed=1'},{url:'https://generic.test/start#changed'},{windowId:3}]){
   const h=harness({initialThrow:true});Object.assign(h.tabs.get(1),change);const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(r.reason,'source-changed');assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);
  }
 });
 await test('an unavailable current source after a failed settings read cannot authorize fallback',async()=>{
  const h=harness({initialThrow:true,get:()=>Promise.reject(Error('source unavailable'))});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);assert.equal(h.timers.size,0);
 });
 await test('a hanging source lookup after a failed settings read stays deadline bounded without fallback',async()=>{
  const lookup=deferred(),h=harness({initialThrow:true,get:()=>lookup.promise});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);assert.equal(h.timers.size,0);
 });
 await test('toolbar OFF during failed-read source validation prevents both copying and fallback',async()=>{
  const lookup=deferred(),h=harness({initialThrow:true,get:()=>lookup.promise});const p=h.send();await flush();h.change({enabled:false});lookup.resolve({...h.tabs.get(1)});const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);
 });
 await test('a failed-read request grants original fallback at most once',async()=>{
  const h=harness({initialThrow:true});const first=await finish(h,h.send());assert.equal(first.fallback,true);assert.equal(first.activated,false);const replay=await h.send();assert.equal(replay.fallback,false);assert.equal(replay.reason,'already-consumed');assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);
 });
 await test('a later toolbar ON event recovers automatic copying after the initial read failed',async()=>{
  const h=harness({initialThrow:true});const blocked=await finish(h,h.send());assert.equal(blocked.activated,false);assert.equal(blocked.fallback,true);assert.equal(blocked.reason,'toolbar-read-failed');assert.equal(h.duplicates.length,0);
  h.change({enabled:true});const resumed=await finish(h,h.send(h.request('after-toolbar-on')));assert.equal(resumed.activated,true);assert.equal(h.duplicates.length,1);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);
 });
 await test('source navigation invalidates replay even when its address is unchanged',async()=>{for(const event of ['onBeforeNavigate','onCommitted']){const h=harness();const p=h.send();await flush();h.navigation[event].fire({tabId:1,frameId:0,timeStamp:h.clock.now(),url:'https://generic.test/start'});const r=await finish(h,p);assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.deepEqual(h.removals,[10]);}});
 await test('worker and stale source navigation events do not cancel a valid operation',async()=>{const h=harness();const p=h.send();await flush();h.navigation.onBeforeNavigate.fire({tabId:10,frameId:0,timeStamp:h.clock.now()});h.navigation.onBeforeNavigate.fire({tabId:1,frameId:0,timeStamp:0});h.navigation.onBeforeNavigate.fire({tabId:1,frameId:1,timeStamp:h.clock.now()});const r=await finish(h,p);assert.equal(r.activated,true);});
 await test('a duplicate resolving during timeout cleanup is never orphaned or pressed',async()=>{const wait=deferred(),h=harness({duplicate:()=>wait.promise});const p=h.send();await flush();h.clock.tick(15000);h.tabs.set(10,{...h.tabs.get(1),id:10,active:false});wait.resolve({...h.tabs.get(10)});await finish(h,p);await flush();assert.deepEqual(h.removals,[10]);assert.equal(h.messages.length,0);});
 await test('hanging status storage cannot block preparation or activation',async()=>{const wait=deferred(),h=harness({set:()=>wait.promise});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);});
 await test('hanging cleanup lookup is bounded and cannot authorize fallback',async()=>{const wait=deferred(),h=harness({get:(id,tabs)=>id===10?wait.promise:Promise.resolve({...tabs.get(id)})});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.equal(h.removals.length,0);assert.equal(h.timers.size,0);});
 await test('hanging cleanup removal is bounded without closing a different tab',async()=>{const wait=deferred(),h=harness({copy:{windowId:3},remove:()=>wait.promise});const r=await finish(h,h.send());assert.equal(r.activated,false);assert.equal(r.fallback,false);assert.deepEqual(h.removals,[10]);assert.equal(h.tabs.has(1),true);assert.equal(h.timers.size,0);});
 await test('status stores no target labels, URLs or request nonces',async()=>{const h=harness();await finish(h,h.send());const value=JSON.stringify(h.writes);assert.doesNotMatch(value,/generic\.test|gesture-1|nonce-|document-1|target/);assert.equal(h.state.fntLastIsolationResult.copyKept,true);});
 await test('storage write failures do not turn one activation into a retry',async()=>{const h=harness({failStorage:true});const r=await finish(h,h.send());assert.equal(r.activated,true);assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);});
 await test('a same-origin sender URL from an earlier SPA route is accepted using the current tab address',async()=>{
  const h=harness({manifestVersion:'2.0.1'}),beforeURL='https://generic.test/app/item?view=current#selected';h.tabs.get(1).url=beforeURL;
  const sender={...h.sender,url:'https://generic.test/landing?old=yes#initial',origin:'https://generic.test'};
  const r=await finish(h,h.send({...h.request(),beforeURL},sender));assert.equal(r.activated,true);assert.equal(h.duplicates.length,1);assert.equal(h.duplicates[0].properties.active,false);
  assert.equal(h.messages.filter(x=>x.message.type==='fnt-isolate-execute').length,1);assert.equal(h.messages.at(-1).message.beforeURL,beforeURL);
  assert.equal(h.state.fntLastIsolationResult.senderAddressMatchesCurrent,false);assert.equal(h.state.fntLastIsolationResult.build,'2.0.1');assert.equal(h.state.fntLastIsolationResult.manifestVersion,'2.0.1');
 });
 await test('same-origin sender query and fragment differences do not become stale route errors',async()=>{
  for(const senderURL of ['https://generic.test/start?old=1','https://generic.test/start#old','https://generic.test/elsewhere?old=1#old']){
   const h=harness();const r=await finish(h,h.send(h.request(),{...h.sender,url:senderURL}));assert.equal(r.activated,true);assert.equal(h.duplicates.length,1);assert.equal(h.state.fntLastIsolationResult.senderAddressMatchesCurrent,false);
  }
 });
 await test('sender origin validation rejects other hosts protocols and ports even when a route looks similar',async()=>{
  for(const url of ['https://other.test/start','http://generic.test/start','https://generic.test:444/start','about:blank','data:text/plain,test','https://user:PRIVATE@generic.test/start']){
   const h=harness();const r=await h.send(h.request(),{...h.sender,url});await flush();assert.equal(r.activated,false);assert.equal(r.rejectionReason,'sender-origin-mismatch');assert.equal(h.duplicates.length,0);assert.equal(h.state.fntLastIsolationResult.state,'rejected');assert.equal(h.state.fntLastIsolationResult.reason,'sender-origin-mismatch');assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE|other.test/);
  }
 });
 await test('an optional sender origin must agree with both the trusted origin and current requested page',async()=>{
  for(const origin of ['https://other.test','http://generic.test','https://generic.test:444','null','https://generic.test/path',null]){
   const h=harness();const r=await h.send(h.request(),{...h.sender,url:'https://generic.test/old-route',origin});await flush();assert.equal(r.rejectionReason,'sender-origin-mismatch');assert.equal(h.duplicates.length,0);assert.equal(h.state.fntLastIsolationResult.reason,'sender-origin-mismatch');
  }
  const h=harness();const r=await finish(h,h.send(h.request(),{...h.sender,url:undefined,origin:'https://generic.test'}));assert.equal(r.activated,true);
 });
 await test('live source URL still must exactly match requested path query and fragment',async()=>{
  for(const url of ['https://generic.test/start?other=1','https://generic.test/start#other','https://generic.test/another']){
   const h=harness();h.tabs.get(1).url=url;const r=await finish(h,h.send(h.request(),{...h.sender,url:'https://generic.test/old-route'}));assert.equal(r.activated,false);assert.equal(r.reason,'source-changed');assert.equal(h.duplicates.length,0);assert.equal(h.messages.length,0);
  }
 });
 await test('same-origin sender acceptance does not relax source window or copied container validation',async()=>{
  const changed=harness();changed.tabs.get(1).windowId=3;const bad=await finish(changed,changed.send(changed.request(),{...changed.sender,url:'https://generic.test/landing'}));assert.equal(bad.activated,false);assert.equal(changed.duplicates.length,0);
  const container=harness({copy:{cookieStoreId:'other-container'}});const r=await finish(container,container.send(container.request(),{...container.sender,url:'https://generic.test/landing'}));assert.equal(r.activated,false);assert.equal(container.messages.length,0);assert.deepEqual(container.removals,[10]);
 });
 await test('authenticated invalid start requests save precise fixed rejection reasons',async()=>{
  const cases=[[{requestId:''},'invalid-request-id'],[{beforeURL:'about:blank'},'invalid-source-address'],[{target:{version:1,valid:false}},'invalid-target-descriptor'],[{target:{version:1,valid:true,padding:'x'.repeat(8000)}},'request-too-large']];
  for(const [update,reason]of cases){const h=harness({manifestVersion:'2.0.1'});const r=await h.send({...h.request(),...update});await flush();assert.equal(r.reason,'invalid-request');assert.equal(r.rejectionReason,reason);assert.equal(r.fallback,false);assert.equal(h.state.fntLastIsolationResult.state,'rejected');assert.equal(h.state.fntLastIsolationResult.reason,reason);assert.equal(h.state.fntLastIsolationResult.build,'2.0.1');assert.equal(h.state.fntLastIsolationResult.manifestVersion,'2.0.1');assert.equal(h.duplicates.length,0);}
 });
 await test('cyclic own requests reject without retaining their fields or exception text',async()=>{
  const h=harness(),request=h.request();request.circular=request;request.private='PRIVATE_CONTENT';const r=await h.send(request);await flush();assert.equal(r.rejectionReason,'invalid-request-shape');assert.equal(h.state.fntLastIsolationResult.state,'rejected');assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE_CONTENT|circular/);assert.equal(h.duplicates.length,0);
 });
 await test('foreign senders cannot write rejected status even for malformed requests',async()=>{
  for(const override of [{id:'foreign'},{frameId:2},{tab:{id:1,windowId:-1}},{}]){
   const h=harness();const from=Object.keys(override).length?{...h.sender,...override}:{};const r=await h.send({...h.request(),requestId:''},from);await flush();assert.equal(r.reason,'invalid-request');assert.equal(h.writes.length,0);assert.equal(h.duplicates.length,0);
  }
 });
 await test('status metadata omits unavailable or malformed manifest versions and never records sender addresses',async()=>{
  for(const manifestVersion of ['PRIVATE_VERSION_TOO_LONG','PRIVATE',{},undefined]){
   const h=harness({manifestVersion});await h.send({...h.request(),requestId:''},{...h.sender,url:'https://generic.test/private-route?PRIVATE=1'});await flush();const status=h.state.fntLastIsolationResult;assert.equal(status.manifestVersion,undefined);assert.equal(status.build,'2.0.1');assert.equal(status.senderAddressMatchesCurrent,false);assert.doesNotMatch(JSON.stringify(h.writes),/PRIVATE|private-route/);
  }
 });
 console.log(count+' isolation background checks passed (mocked tabs, not native Firefox).');
})().catch(error=>{console.error(error);process.exitCode=1;});





