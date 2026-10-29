'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','isolation-content.js'),'utf8');
const clean=x=>JSON.parse(JSON.stringify(x));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const descriptor={version:1,tag:'button',role:'',type:'button',label:{kind:'text',value:'Open example'},attrs:{},customAncestors:['sample-action']};
function harness(o={}){
 const changes=[],listeners={},messages=[],gets=[],writes=[];let receiver,ids=0;
 const doc={nodeType:9,baseURI:'https://example.test/start',readyState:'complete'};
 const wrapper={nodeType:1,localName:'sample-action',isConnected:true,ownerDocument:doc,parentElement:null,getAttribute:()=>null,hasAttribute:()=>false,getRootNode:()=>doc};
 const target={nodeType:1,localName:'button',isConnected:true,ownerDocument:doc,parentElement:wrapper,getRootNode:()=>doc,
  textContent:'Open example',getAttribute:name=>name==='type'?'button':null,hasAttribute:()=>false,form:null};
 doc.querySelectorAll=()=>[target];
 let matched=target,described=clean(descriptor),route=null,activations=0;
 function NativeElement(){}
 NativeElement.prototype.click=function(){assert.equal(this,target);activations++;if(o.onClick)o.onClick();};
 target.click=()=>{throw Error('page override used');};
 const window={addEventListener(t,fn,flags){(listeners[t]||=[]).push({fn,flags});}};window.top=o.nested?{}:window;
 doc.defaultView=window;
 const location={href:'https://example.test/start'};
 const browser={runtime:{id:'own-extension',sendMessage(m){messages.push(clean(m));return o.send?o.send(m):Promise.resolve({fallback:false,activated:true,reason:'done'});},onMessage:{addListener(fn){receiver=fn;}}},storage:{onChanged:{addListener(fn){changes.push(fn);}},local:{get(defaults){gets.push(defaults);return o.get?o.get(defaults):Promise.resolve({...defaults,...o.saved});},set(value){writes.push(value);return Promise.resolve();}}}};
 const context=vm.createContext({URL,Date,Promise,Math,Set,HTMLElement:NativeElement,document:doc,window,location,browser,crypto:{randomUUID:()=> 'nonce-'+(++ids)},
 FNT:{resolve(){return route;}},FNTIsolationTarget:{describe(){if(o.describeThrow)throw Error('PRIVATE_DESCRIBE_ERROR');return described;},audit(){return o.audit?o.audit():{reason:'target-unavailable'};},validDescriptor(value){return value?.version===1;},find(){if(o.findThrow)throw Error('PRIVATE_FIND_ERROR');return matched?{ok:true,target:matched}:{ok:false,target:null,reason:'not-found'};}}});
 if(o.realTarget)vm.runInContext(fs.readFileSync(path.join(__dirname,'..','isolation-target.js'),'utf8'),context,{filename:'isolation-target.js'});
 vm.runInContext(source,context,{filename:'isolation-content.js'});
 const sender={id:'own-extension',url:'moz-extension://own/background.html'};
 const request=(type,extra={})=>({type,nonce:'operation',beforeURL:location.href,target:clean(descriptor),...extra});
 return {context,doc,target,location,window,listeners,messages,gets,writes,sender,request,activations:()=>activations,
 api:context.FNTIsolation,receive:(m,from=sender)=>receiver(m,from),
 setMatch(value){matched=value;},setDescriptor(value){described=value;},setRoute(value){route=value;},
 change(key,value,area='local'){for(const fn of changes)fn({[key]:{newValue:value}},area);},
 fire(type,extra={}){for(const {fn}of listeners[type]||[])fn({type,isTrusted:true,...extra});}};
}
const tests=[];function test(name,fn){tests.push({name,fn});}
const enabled={enabled:true};
test('fresh storage automatically copies an unresolved control without a modifier or writes',async()=>{const h=harness();await flush();const result=await h.api.tryStart(h.target);assert.equal(result.activated,true);assert.equal(h.messages.length,1);assert.equal(h.messages[0].type,'fnt-isolate-start');assert.equal(h.activations(),0);assert.equal(h.writes.length,0);assert.deepEqual(clean(h.gets[0]),{enabled:true});});
test('ordinary middle click requests one copy without requiring any modifier',async()=>{
 for(const gesture of [{shiftKey:false},{},undefined]){
  const h=harness({saved:enabled});await flush();const result=await h.api.tryStart(h.target,gesture);
  assert.equal(h.messages.length,1);assert.equal(h.messages[0].type,'fnt-isolate-start');assert.equal(result.fallback,false);assert.equal(h.activations(),0);assert.equal(h.writes.length,0);
 }
});
test('legacy false isolation preference cannot disable automatic copying or worker activation',async()=>{const h=harness({saved:{fntIsolationEnabled:false}});await flush();assert.equal((await h.api.tryStart(h.target)).activated,true);assert.equal(h.messages[0].type,'fnt-isolate-start');const prepare=h.request('fnt-isolate-prepare');const ready=await h.receive(prepare);assert.equal(ready.ready,true);assert.equal((await h.receive({...prepare,type:'fnt-isolate-execute',documentNonce:ready.documentNonce,preparationNonce:ready.preparationNonce})).activated,true);assert.equal(h.activations(),1);assert.equal(h.writes.length,0);});
test('toolbar off and nested frames do not claim gestures',async()=>{for(const opts of [{saved:{...enabled,enabled:false}},{saved:enabled,nested:true}]){const h=harness(opts);await flush();assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);}});
test('already resolved routes bypass isolation',async()=>{const h=harness({saved:enabled});await flush();h.setRoute('https://example.test/destination');assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);assert.equal(h.messages.length,0);});
test('ambiguous unavailable and disconnected targets bypass isolation',async()=>{for(const mode of ['descriptor','match','disconnected']){const h=harness({saved:enabled});await flush();if(mode==='descriptor')h.setDescriptor(null);if(mode==='match')h.setMatch(null);if(mode==='disconnected')h.target.isConnected=false;assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);}});
test('declined descriptor records only its fixed audit reason and still returns null',async()=>{
 const h=harness({saved:enabled,audit:()=>({reason:'closed-shadow-root',label:'PRIVATE_LABEL',value:'PRIVATE_FORM'})});await flush();h.setDescriptor(null);
 assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);assert.deepEqual(h.messages,[{type:'fnt-isolate-declined',reason:'closed-shadow-root'}]);assert.equal(h.activations(),0);assert.doesNotMatch(JSON.stringify(h.messages),/PRIVATE/);
});
test('declined matching target records a safe changed-target fallback',async()=>{
 const h=harness({saved:enabled,audit:()=>({reason:'eligible'})});await flush();h.setMatch(null);assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);assert.deepEqual(h.messages,[{type:'fnt-isolate-declined',reason:'target-changed'}]);
});
test('decline auditing is skipped for OFF and known destinations without modifiers',async()=>{
 for(const mode of ['off','known']){let probes=0;const h=harness({saved:mode==='off'?{enabled:false}:enabled,audit:()=>{probes++;return{reason:'missing-label-or-identity'};}});await flush();h.setDescriptor(null);if(mode==='known')h.setRoute('https://example.test/already');assert.equal(h.api.tryStart(h.target,{shiftKey:false}),null);assert.equal(probes,0);assert.equal(h.messages.length,0);}
});
test('ordinary unresolved controls still need a valid unique descriptor',async()=>{
 const h=harness({saved:enabled,audit:()=>({reason:'ambiguous-control'})});await flush();h.setDescriptor(null);
 assert.equal(h.api.tryStart(h.target,{shiftKey:false}),null);assert.deepEqual(h.messages,[{type:'fnt-isolate-declined',reason:'ambiguous-control'}]);assert.equal(h.activations(),0);
});
test('global toolbar toggles copying while obsolete isolation changes are ignored',async()=>{
 const h=harness({saved:{enabled:false,fntIsolationEnabled:false}});await flush();assert.equal(h.api.tryStart(h.target),null);h.change('fntIsolationEnabled',true);assert.equal(h.api.tryStart(h.target),null);
 h.change('enabled',true);assert.equal((await h.api.tryStart(h.target)).activated,true);h.change('fntIsolationEnabled',false);assert.equal(h.api.isEnabled(),true);assert.equal((await h.api.tryStart(h.target)).activated,true);h.change('enabled',false);assert.equal(h.api.tryStart(h.target),null);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-start').length,2);assert.equal(h.activations(),0);assert.equal(h.writes.length,0);
});
test('known ordinary-click destinations bypass copy and audit altogether',async()=>{
 let audits=0;const h=harness({saved:enabled,audit:()=>{audits++;throw Error('known route must not be inspected');}});await flush();h.setRoute('https://example.test/known');
 assert.equal(h.api.tryStart(h.target),null);assert.equal(h.api.tryStart(h.target,{shiftKey:false}),null);assert.equal(audits,0);assert.equal(h.messages.length,0);assert.equal(h.activations(),0);
});
test('raw audit values and exceptions cannot leak through decline reporting',async()=>{
 for(const audit of [()=>({reason:'PRIVATE_LABEL'}),()=>{throw Error('PRIVATE_AUDIT_ERROR');}]){const h=harness({saved:enabled,audit});await flush();h.setDescriptor(null);assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);assert.doesNotMatch(JSON.stringify(h.messages),/PRIVATE/);assert.ok(['target-unavailable','read-error'].includes(h.messages[0].reason));}
});
test('describe and find failures report read-error without re-running the audit',async()=>{
 for(const option of ['describeThrow','findThrow']){let probes=0;const h=harness({saved:enabled,[option]:true,audit:()=>{probes++;throw Error('audit should not run');}});await flush();assert.equal(h.api.tryStart(h.target,{shiftKey:true}),null);assert.equal(probes,0);assert.deepEqual(h.messages,[{type:'fnt-isolate-declined',reason:'read-error'}]);}
});
test('shift gesture sends one bounded background request without source activation',async()=>{const h=harness({saved:enabled});await flush();const result=await h.api.tryStart(h.target,{shiftKey:true});assert.equal(h.messages.length,1);assert.equal(h.messages[0].type,'fnt-isolate-start');assert.equal(h.messages[0].beforeURL,h.location.href);assert.deepEqual(h.messages[0].target,descriptor);assert.equal(h.activations(),0);assert.equal(result.fallback,false);});
test('definitive preactivation failure permits fallback on the same source',async()=>{const h=harness({saved:enabled,send:()=>Promise.resolve({fallback:true,activated:false,reason:'not-ready'})});await flush();const out=await h.api.tryStart(h.target,{shiftKey:true});assert.equal(out.fallback,true);assert.equal(out.activated,false);assert.equal(h.activations(),0);});
test('activated and ambiguous responses never authorize source fallback',async()=>{for(const response of [{fallback:true,activated:true},{fallback:true},{fallback:false,activated:false},null]){const h=harness({saved:enabled,send:()=>Promise.resolve(response)});await flush();assert.equal((await h.api.tryStart(h.target,{shiftKey:true})).fallback,false);}});
test('transport throw or rejection never replays the source',async()=>{for(const mode of ['throw','reject']){const h=harness({saved:enabled,send(){if(mode==='throw')throw Error('private transport');return Promise.reject(Error('private transport'));}});await flush();assert.equal((await h.api.tryStart(h.target,{shiftKey:true})).fallback,false);assert.equal(h.activations(),0);}});
test('trusted new input cancels pending copy and suppresses stale fallback',async()=>{for(const type of ['pointerdown','mousedown','keydown','pagehide']){const d=deferred(),h=harness({saved:enabled,send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();const p=h.api.tryStart(h.target,{shiftKey:true});h.fire(type);d.resolve({fallback:true,activated:false});assert.equal((await p).fallback,false);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,1);}});
test('untrusted input does not invalidate a pending gesture',async()=>{const d=deferred(),h=harness({saved:enabled,send:()=>d.promise});await flush();const p=h.api.tryStart(h.target,{shiftKey:true});h.fire('keydown',{isTrusted:false});d.resolve({fallback:true,activated:false});assert.equal((await p).fallback,true);});
test('changed source address target or newly resolved route blocks delayed fallback',async()=>{for(const mode of ['url','target','route']){const d=deferred(),h=harness({saved:enabled,send:()=>d.promise});await flush();const p=h.api.tryStart(h.target,{shiftKey:true});if(mode==='url')h.location.href='https://example.test/elsewhere';if(mode==='target')h.setMatch({});if(mode==='route')h.setRoute('https://example.test/now-known');d.resolve({fallback:true,activated:false});assert.equal((await p).fallback,false);}});
test('disabling the global toolbar cancels pending isolation and suppresses its stale fallback',async()=>{const d=deferred(),h=harness({send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();const p=h.api.tryStart(h.target);h.change('enabled',false);d.resolve({fallback:true,activated:false});assert.equal((await p).fallback,false);assert.equal(h.messages.at(-1).type,'fnt-isolate-cancel');});
test('obsolete isolation storage changes cannot cancel a pending automatic copy',async()=>{const d=deferred(),h=harness({saved:{fntIsolationEnabled:false},send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();const p=h.api.tryStart(h.target);h.change('fntIsolationEnabled',false);h.change('fntIsolationEnabled',true);assert.equal(h.api.isPending(),true);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,0);d.resolve({fallback:false,activated:true});assert.equal((await p).activated,true);});
test('a newer toolbar change wins over the initial storage read',async()=>{const d=deferred(),h=harness({get:()=>d.promise});h.change('enabled',false);d.resolve({enabled:true,fntIsolationEnabled:true});await flush();assert.equal(h.api.tryStart(h.target),null);h.change('enabled',true);assert.equal((await h.api.tryStart(h.target)).activated,true);});
test('non-local changes cannot turn on a disabled toolbar',async()=>{const h=harness({saved:{enabled:false}});await flush();h.change('enabled',true,'sync');assert.equal(h.api.tryStart(h.target),null);});
test('worker ignores unrelated messages without stealing a response',async()=>{const h=harness({saved:enabled});await flush();assert.equal(h.receive({type:'fnt-open'}),undefined);});
test('worker requires own background sender',async()=>{const h=harness({saved:enabled});await flush();for(const sender of [{id:'other'},{id:'own-extension',tab:{id:7}}])assert.equal((await h.receive(h.request('fnt-isolate-prepare'),sender)).ready,false);});
test('worker rejects malformed nonce descriptor and mismatched source URL',async()=>{const h=harness({saved:enabled});await flush();for(const patch of [{nonce:''},{nonce:'n'.repeat(101)},{target:{}},{beforeURL:'https://example.test/another'}])assert.equal((await h.receive(h.request('fnt-isolate-prepare',patch))).ready,false);});
test('worker waits for completed document and unique ready target',async()=>{const h=harness({saved:enabled});await flush();h.doc.readyState='loading';assert.equal((await h.receive(h.request('fnt-isolate-prepare'))).ready,false);h.doc.readyState='complete';h.setMatch(null);assert.equal((await h.receive(h.request('fnt-isolate-prepare'))).ready,false);});
test('worker prepares and activates its exact node once using native click',async()=>{const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));assert.equal(p.ok,true);assert.equal(p.ready,true);const e=h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce});assert.equal((await h.receive(e)).activated,true);assert.equal(h.activations(),1);assert.equal((await h.receive(e)).activated,true);assert.equal((await h.receive(h.request('fnt-isolate-prepare'))).activated,true);assert.equal(h.activations(),1);});
test('worker execute before prepare or with wrong document nonce never clicks',async()=>{const h=harness({saved:enabled});await flush();assert.equal((await h.receive(h.request('fnt-isolate-execute'))).activated,false);await h.receive(h.request('fnt-isolate-prepare'));assert.equal((await h.receive(h.request('fnt-isolate-execute',{documentNonce:'wrong'}))).activated,false);assert.equal(h.activations(),0);});
test('worker refuses changed target descriptor or rerendered node',async()=>{for(const mode of ['descriptor','node']){const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));const e=h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce});if(mode==='descriptor')e.target.label.value='Different';if(mode==='node')h.setMatch({...h.target});assert.equal((await h.receive(e)).activated,false);assert.equal(h.activations(),0);}});
test('worker cannot execute after global mode is disabled',async()=>{const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));h.change('enabled',false);assert.equal((await h.receive(h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce}))).activated,false);assert.equal(h.activations(),0);});
test('handler throw is treated as activated and is never retried',async()=>{const h=harness({saved:enabled,onClick(){throw Error('handler private detail');}});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));const e=h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce});const out=await h.receive(e);assert.equal(out.activated,true);assert.equal(out.reason,'activation-threw');await h.receive(e);assert.equal(h.activations(),1);assert.doesNotMatch(JSON.stringify(out),/private detail/);});
test('viewing another tab does not discard a prepared worker target',async()=>{const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));h.fire('blur');assert.equal((await h.receive(h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce}))).activated,true);assert.equal(h.activations(),1);});
test('source and worker interoperate with the actual locator module',async()=>{
 const h=harness({saved:enabled,realTarget:true});await flush();
 const sourceResult=await h.api.tryStart(h.target);assert.equal(sourceResult.fallback,false);assert.equal(h.messages[0].target.tag,'button');assert.equal(h.activations(),0);
 const prepare=h.request('fnt-isolate-prepare',{target:h.messages[0].target});const ready=await h.receive(prepare);assert.equal(ready.ready,true);
 const execute={...prepare,type:'fnt-isolate-execute',documentNonce:ready.documentNonce,preparationNonce:ready.preparationNonce};assert.equal((await h.receive(execute)).activated,true);assert.equal(h.activations(),1);
});
test('worker activation ledger is bounded without forgetting consumed nonces',async()=>{
 const h=harness({saved:enabled});await flush();let first;
 for(let i=0;i<17;i++){
  const request=h.request('fnt-isolate-prepare',{nonce:'bounded-'+i});const p=await h.receive(request);assert.equal(p.ready,true);
  const execute={...request,type:'fnt-isolate-execute',documentNonce:p.documentNonce,preparationNonce:p.preparationNonce};if(!i)first=execute;
  const result=await h.receive(execute);assert.equal(result.activated,i<16);
 }
 assert.equal(h.activations(),16);assert.equal((await h.receive(first)).activated,true);assert.equal(h.activations(),16);
});
test('state helpers report automatic copy availability and the global toolbar',async()=>{
 const off=harness({saved:{enabled:false}});await flush();assert.equal(off.api.isEnabled(),false);assert.equal(off.api.isPending(),false);assert.deepEqual(clean(off.api.describeState()),{modeEnabled:true,toolbarEnabled:false,topFrame:true,pending:false});
 const on=harness();await flush();assert.equal(on.api.isEnabled(),true);assert.equal(on.api.isPending(),false);const snapshot=on.api.describeState();snapshot.modeEnabled=false;assert.equal(on.api.isEnabled(),true);assert.deepEqual(Object.keys(clean(snapshot)).sort(),['modeEnabled','pending','toolbarEnabled','topFrame']);
});
test('modifier helper recognizes only Shift while isolation is active in the top frame',async()=>{
 for(const options of [{saved:enabled},{saved:{...enabled,enabled:false}},{saved:enabled,nested:true},{}]){
  const h=harness(options);await flush();const active=options.saved?.enabled!==false&&!options.nested;
  assert.equal(h.api.isModifierGesture({key:'Shift'}),active);
  for(const key of ['Escape','a','Alt','Control','Meta','shift',undefined])assert.equal(h.api.isModifierGesture({key}),false);
 }
});
test('pure Shift keydown while the copy is pending preserves the request and fallback',async()=>{
 const d=deferred(),h=harness({saved:enabled,send:()=>d.promise});await flush();
 const result=h.api.tryStart(h.target,{shiftKey:true});assert.equal(h.api.isPending(),true);
 h.fire('keydown',{key:'Shift',preventDefault(){throw Error('modifier was cancelled');},stopImmediatePropagation(){throw Error('modifier was stopped');}});
 assert.equal(h.api.isPending(),true);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,0);
 d.resolve({fallback:true,activated:false});assert.equal((await result).fallback,true);assert.equal(h.api.isPending(),false);
});
test('Escape and typed keys still cancel a pending copy',async()=>{
 for(const key of ['Escape','a']){
  const d=deferred(),h=harness({saved:enabled,send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();
  const result=h.api.tryStart(h.target,{shiftKey:true});h.fire('keydown',{key});
  assert.equal(h.api.isPending(),false);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,1);
  assert.doesNotMatch(JSON.stringify(h.messages),/Escape|Control|Meta|Alt/);
  d.resolve({fallback:true,activated:false});assert.equal((await result).fallback,false);
 }
});
test('Shift is not exempt after the global toolbar is switched off',async()=>{const h=harness();await flush();assert.equal(h.api.isModifierGesture({key:'Shift'}),true);h.change('enabled',false);assert.equal(h.api.isEnabled(),false);assert.equal(h.api.isModifierGesture({key:'Shift'}),false);});
test('source blur preserves a pending request without sending cancellation',async()=>{
 const d=deferred(),h=harness({saved:enabled,send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();const p=h.api.tryStart(h.target);h.fire('blur');assert.equal(h.api.isPending(),true);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,0);d.resolve({fallback:false,activated:true});assert.equal((await p).activated,true);
});
test('tab-switch modifiers and browser navigation chords preserve pending source copy',async()=>{
 for(const event of [{key:'Control'},{key:'Alt'},{key:'Meta'},{key:'Shift'},{key:'Tab',ctrlKey:true},{key:'Tab',ctrlKey:true,shiftKey:true},{key:'PageUp',ctrlKey:true},{key:'PageDown',metaKey:true},{key:'Tab',altKey:true},...[1,2,3,4,5,6,7,8,9].flatMap(key=>[{key:String(key),ctrlKey:true},{key:String(key),metaKey:true}])]){
  const d=deferred(),h=harness({saved:enabled,send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();const p=h.api.tryStart(h.target);h.fire('keydown',event);assert.equal(h.api.isPending(),true,JSON.stringify(event));assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,0);d.resolve({fallback:false,activated:true});await p;
 }
});
test('ordinary Tab and browser-unrelated shortcuts still cancel pending source action',async()=>{
 for(const event of [{key:'Tab'},{key:'Escape'},{key:'a'},{key:'1'},{key:'0',ctrlKey:true},{key:'s',ctrlKey:true}]){
  const d=deferred(),h=harness({saved:enabled,send:m=>m.type==='fnt-isolate-start'?d.promise:Promise.resolve({})});await flush();const p=h.api.tryStart(h.target);h.fire('keydown',event);assert.equal(h.api.isPending(),false);assert.equal(h.messages.filter(m=>m.type==='fnt-isolate-cancel').length,1);d.resolve({fallback:true,activated:false});assert.equal((await p).fallback,false);
 }
});
test('worker interaction before the first prepare prevents every replay without leaking input',async()=>{
 for(const type of ['pointerdown','mousedown','keydown']){
  const h=harness({saved:enabled});await flush();h.fire(type,{key:'PRIVATE_TYPED_VALUE'});const p=await h.receive(h.request('fnt-isolate-prepare'));assert.equal(p.activated,false);assert.equal(p.userInteracted,true);assert.equal(p.reason,'copy-input');assert.equal(h.messages.length,0);const e=await h.receive(h.request('fnt-isolate-execute',{documentNonce:'unknown'}));assert.equal(e.userInteracted,true);assert.equal(h.activations(),0);assert.doesNotMatch(JSON.stringify(p),/PRIVATE/);
 }
});
test('input after prepare clears target synchronously and notifies the background once',async()=>{
 const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));h.fire('pointerdown',{key:'PRIVATE_INPUT'});h.fire('mousedown');assert.deepEqual(h.messages,[{type:'fnt-isolate-worker-input',nonce:'operation'}]);const e=await h.receive(h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce}));assert.equal(e.activated,false);assert.equal(e.userInteracted,true);assert.equal(h.activations(),0);const again=await h.receive(h.request('fnt-isolate-prepare'));assert.equal(again.userInteracted,true);assert.doesNotMatch(JSON.stringify(h.messages),/PRIVATE/);
});
test('lost worker input notification cannot authorize a later execute',async()=>{
 const h=harness({saved:enabled,send(){throw Error('transport unavailable');}});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));h.fire('keydown',{key:'a'});const e=await h.receive(h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce}));assert.equal(e.userInteracted,true);assert.equal(e.activated,false);assert.equal(h.activations(),0);
});
test('untrusted events do not block worker replay',async()=>{
 const h=harness({saved:enabled});await flush();h.fire('pointerdown',{isTrusted:false});h.fire('keydown',{key:'a',isTrusted:false});const p=await h.receive(h.request('fnt-isolate-prepare'));assert.equal(p.ready,true);h.fire('mousedown',{isTrusted:false});assert.equal((await h.receive(h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce}))).activated,true);assert.equal(h.activations(),1);assert.equal(h.messages.length,0);
});
test('passive tab-navigation keys before prepare are not mistaken for page interaction',async()=>{
 const h=harness({saved:enabled});await flush();for(const event of [{key:'Control'},{key:'Alt'},{key:'Meta'},{key:'Shift'},{key:'Tab',ctrlKey:true},{key:'PageUp',ctrlKey:true},{key:'PageDown',metaKey:true},{key:'Tab',altKey:true},...[1,2,3,4,5,6,7,8,9].flatMap(key=>[{key:String(key),ctrlKey:true},{key:String(key),metaKey:true}])])h.fire('keydown',event);h.fire('blur');const p=await h.receive(h.request('fnt-isolate-prepare'));assert.equal(p.ready,true);assert.equal((await h.receive(h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce}))).activated,true);
});
test('worker tab-navigation keys after prepare preserve exactly one activation',async()=>{
 const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));for(const event of [{key:'Control'},{key:'Alt'},{key:'Meta'},{key:'Shift'},{key:'Tab',ctrlKey:true},{key:'PageUp',ctrlKey:true},{key:'PageDown',metaKey:true},{key:'Tab',altKey:true},...[1,2,3,4,5,6,7,8,9].flatMap(key=>[{key:String(key),ctrlKey:true},{key:String(key),metaKey:true}])])h.fire('keydown',event);h.fire('blur');const e=h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce});assert.equal((await h.receive(e)).activated,true);assert.equal((await h.receive(e)).activated,true);assert.equal(h.activations(),1);assert.equal(h.messages.length,0);
});
test('consumed nonce cannot become an unactivated reply after input or disabling',async()=>{
 const h=harness({saved:enabled});await flush();const p=await h.receive(h.request('fnt-isolate-prepare'));const e=h.request('fnt-isolate-execute',{documentNonce:p.documentNonce,preparationNonce:p.preparationNonce});assert.equal((await h.receive(e)).activated,true);h.fire('pointerdown');h.change('enabled',false);h.location.href='https://example.test/changed';assert.equal((await h.receive(e)).activated,true);assert.equal(h.activations(),1);const foreign=await h.receive(e,{id:'foreign'});assert.equal(foreign.activated,false);
});
test('loading worker binds cancellation before a prepared target exists',async()=>{
 const h=harness({saved:enabled});await flush();h.doc.readyState='loading';const request=h.request('fnt-isolate-prepare');assert.equal((await h.receive(request)).reason,'document-loading');h.fire('pointerdown');h.fire('mousedown');h.fire('keydown',{key:'a'});assert.deepEqual(h.messages,[{type:'fnt-isolate-worker-input',nonce:'operation'}]);h.location.href='https://example.test/user-navigation';h.change('enabled',false);h.doc.readyState='complete';
 for(const type of ['fnt-isolate-prepare','fnt-isolate-execute']){const reply=await h.receive({...request,type});assert.equal(reply.userInteracted,true);assert.equal(reply.activated,false);assert.equal(reply.reason,'copy-input');}assert.equal(h.activations(),0);assert.equal(h.messages.length,1);
});
test('foreign malformed and subframe prepare requests cannot bind worker cancellation',async()=>{
 for(const setting of ['foreign','sender-tab','malformed','subframe']){
  const h=harness({saved:enabled,nested:setting==='subframe'});await flush();h.doc.readyState='loading';const request=h.request('fnt-isolate-prepare',setting==='malformed'?{nonce:'n'.repeat(101)}:{});const sender=setting==='foreign'?{id:'foreign'}:setting==='sender-tab'?{id:'own-extension',tab:{id:99}}:h.sender;assert.equal((await h.receive(request,sender)).ready,false);h.fire('pointerdown');h.fire('mousedown');assert.equal(h.messages.length,0);assert.equal(h.activations(),0);
 }
});
test('worker input acknowledgement precedes changed address settings and descriptor checks',async()=>{
 const h=harness({saved:enabled});await flush();h.fire('pointerdown');const request=h.request('fnt-isolate-prepare');h.location.href='https://example.test/changed-by-user';h.change('enabled',false);request.target={};for(const type of ['fnt-isolate-prepare','fnt-isolate-execute']){const reply=await h.receive({...request,type});assert.equal(reply.userInteracted,true);assert.equal(reply.activated,false);}assert.equal(h.activations(),0);
});
test('repeated preparation keeps the same token only for the same concrete node',async()=>{
 const h=harness();await flush();const request=h.request('fnt-isolate-prepare');const first=await h.receive(request);const second=await h.receive(request);assert.equal(first.preparationNonce,second.preparationNonce);assert.equal(typeof first.preparationNonce,'string');
 const replacement={...h.target};h.setMatch(replacement);const changed=await h.receive(request);assert.notEqual(changed.preparationNonce,first.preparationNonce);assert.equal(changed.documentNonce,first.documentNonce);
 const stale=await h.receive({...request,type:'fnt-isolate-execute',documentNonce:first.documentNonce,preparationNonce:first.preparationNonce});assert.equal(stale.activated,false);assert.equal(h.activations(),0);
 h.setMatch(h.target);const latest=await h.receive(request);assert.notEqual(latest.preparationNonce,changed.preparationNonce);const exec={...request,type:'fnt-isolate-execute',documentNonce:latest.documentNonce,preparationNonce:latest.preparationNonce};assert.equal((await h.receive(exec)).activated,true);assert.equal((await h.receive(exec)).activated,true);assert.equal(h.activations(),1);
});
test('loading or a temporarily missing target discards its old readiness token',async()=>{
 for(const mode of ['loading','missing']){const h=harness();await flush();const request=h.request('fnt-isolate-prepare');const before=await h.receive(request);if(mode==='loading')h.doc.readyState='loading';else h.setMatch(null);assert.equal((await h.receive(request)).ready,false);h.doc.readyState='complete';h.setMatch(h.target);const after=await h.receive(request);assert.notEqual(after.preparationNonce,before.preparationNonce);assert.equal((await h.receive({...request,type:'fnt-isolate-execute',documentNonce:before.documentNonce,preparationNonce:before.preparationNonce})).activated,false);assert.equal(h.activations(),0);}
});
test('a new request or descriptor restarts target readiness even on the same node',async()=>{
 const h=harness();await flush();const request=h.request('fnt-isolate-prepare');const a=await h.receive(request);const other={...request,nonce:'new-operation'};const b=await h.receive(other);assert.notEqual(a.preparationNonce,b.preparationNonce);const changed={...other,target:{...other.target,label:{kind:'text',value:'changed'}}};const c=await h.receive(changed);assert.notEqual(b.preparationNonce,c.preparationNonce);assert.equal(h.activations(),0);
});
test('missing or incorrect preparation tokens cannot execute a prepared copy',async()=>{
 const h=harness();await flush();const request=h.request('fnt-isolate-prepare');const p=await h.receive(request);for(const token of [undefined,null,'wrong',{},'x'.repeat(101)]){const out=await h.receive({...request,type:'fnt-isolate-execute',documentNonce:p.documentNonce,preparationNonce:token});assert.equal(out.activated,false);}assert.equal(h.activations(),0);
});
test('toolbar OFF then ON cannot restore a discarded readiness token',async()=>{
 const h=harness();await flush();const request=h.request('fnt-isolate-prepare');const a=await h.receive(request);h.change('enabled',false);h.change('enabled',true);const b=await h.receive(request);assert.notEqual(a.preparationNonce,b.preparationNonce);assert.equal((await h.receive({...request,type:'fnt-isolate-execute',documentNonce:a.documentNonce,preparationNonce:a.preparationNonce})).activated,false);assert.equal(h.activations(),0);
});
test('all source event observations are passive',()=>{const h=harness();for(const list of Object.values(h.listeners))for(const item of list)assert.equal(item.flags.passive,true);});
(async()=>{let count=0;for(const {name,fn}of tests){await fn();count++;console.log('PASS isolation content',name);}console.log(count+' isolation content checks passed (mocked page/browser objects; not live Firefox).');})().catch(error=>{console.error(error);process.exitCode=1;});
