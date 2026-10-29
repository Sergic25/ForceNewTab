'use strict';
// Real resolver, source isolation and core together; native delivery is simulated.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function harness({legacyEnabled,toolbar=true,known=false,form=false,appData=false,legacyAppDataEnabled}={}){
 const messages=[],listeners={},changes=[],pending=deferred();let runtimeReceiver,id=0;
 function NativeElement(){}NativeElement.prototype.click=function(){this.activations=(this.activations||0)+1;};
 const doc={nodeType:9,baseURI:'https://generic.example.test/start',readyState:'complete',getElementById:()=>null};
 function el(tag,attrs={},parent=null){const node=Object.assign(new NativeElement(),{nodeType:1,localName:tag,attrs,parentElement:parent,ownerDocument:doc,isConnected:true,
  getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;},hasAttribute(name){return Object.hasOwn(this.attrs,name);},
  querySelectorAll(){return [];},getRootNode(){return doc;},contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;}});return node;}
 const parent=form?el('form'):el('sample-action');
 const target=el(appData?'div':known?'a':'button',appData?{role:'link',tabindex:'0'}:known?{href:'/known'}:{type:'button'},parent),label=el('span',{},target);
 if(appData){target.wrappedJSObject=target;target['__reactProps$fixture']={href:'/stored-destination'};}
 const ancestry=n=>{const out=[];for(;n;n=n.parentElement)out.push(n);return out;};
 const window={addEventListener(type,fn,flags){(listeners[type]||=[]).push({fn,flags});},navigation:{addEventListener(){}}};window.top=window;doc.defaultView=window;
 const location={href:doc.baseURI};
 const browser={storage:{onChanged:{addListener(fn){changes.push(fn);}},local:{get(defaults){return Promise.resolve({...defaults,enabled:toolbar,...(legacyEnabled===undefined?{}:{fntIsolationEnabled:legacyEnabled}),...(legacyAppDataEnabled===undefined?{}:{fntAppDataEnabled:legacyAppDataEnabled})});}}},
  runtime:{id:'own-extension',onMessage:{addListener(fn){runtimeReceiver=fn;}},sendMessage(message){messages.push(JSON.parse(JSON.stringify(message)));return message.type==='fnt-isolate-start'?pending.promise:Promise.resolve({ok:true});}}};
 const descriptor={version:1};
 const context=vm.createContext({URL,Date,Promise,Math,Set,HTMLElement:NativeElement,document:doc,location,window,browser,crypto:{randomUUID:()=> 'nonce-'+(++id)},
  FNTIsolationTarget:{describe:()=>descriptor,validDescriptor:()=>true,find:()=>({ok:true,target})}});
 for(const file of ['resolver.js',...(appData?['app-data.js']:[]),'isolation-content.js','content.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const dispatch=(type,extra={})=>{const event={type,isTrusted:true,button:1,cancelable:true,shiftKey:false,key:'',composedPath:()=>ancestry(label),
   preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};
  for(const {fn}of listeners[type]||[]){fn(event);if(event.stopped)break;}return event;};
 return {target,label,messages,listeners,location,api:context.FNTIsolation,dispatch,pending,
  press(shiftKey=false,mouseShift=shiftKey){dispatch('pointerdown',{shiftKey});dispatch('mousedown',{shiftKey:mouseShift});},
  release(shiftKey=false){dispatch('pointerup',{shiftKey});dispatch('mouseup',{shiftKey});dispatch('auxclick',{shiftKey});},
  key(key,extra={}){dispatch('keydown',{button:0,key,...extra});},
  change(key,value){for(const fn of changes)fn({[key]:{newValue:value}},'local');}};
}
const requests=h=>h.messages.filter(m=>m.type==='fnt-isolate-start');
const cancels=h=>h.messages.filter(m=>m.type==='fnt-isolate-cancel');
const arms=h=>h.messages.filter(m=>m.type==='fnt-arm');
let count=0;async function test(name,fn){await fn();count++;console.log('PASS Shift isolation flow',name);}
(async()=>{
 await test('real source and core register multiple listeners in the required order',async()=>{const h=harness();await flush();assert.equal(h.listeners.keydown.length,2);assert.equal(h.listeners.pointerdown.length,2);assert.equal(h.api.isEnabled(),true);});
 await test('Shift held before pressing middle creates one copy request without source activation',async()=>{const h=harness();await flush();h.key('Shift',{shiftKey:true});h.press(true);h.release(true);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('pressing Shift while the middle button is held preserves isolation intent',async()=>{const h=harness();await flush();h.press(false);h.key('Shift',{shiftKey:true});h.release(true);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('releasing Shift before mouse release and auxclick keeps the latched intent',async()=>{const h=harness();await flush();h.press(true);h.dispatch('keyup',{button:0,key:'Shift',shiftKey:false});h.release(false);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);});
 await test('compatibility mousedown cannot erase the pointerdown Shift latch',async()=>{const h=harness();await flush();h.press(true,false);h.release(false);await flush();assert.equal(requests(h).length,1);assert.equal(h.target.activations,undefined);});
 await test('middle press then Shift press and release before auxclick remains isolated',async()=>{const h=harness();await flush();h.press(false);h.key('Shift',{shiftKey:true});h.dispatch('keyup',{button:0,key:'Shift',shiftKey:false});h.release(false);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);});
 await test('repeated Shift keydown during pending isolation does not cancel it',async()=>{const h=harness();await flush();h.press(true);h.release(true);await flush();assert.equal(h.api.isPending(),true);h.key('Shift',{shiftKey:true,repeat:true});h.key('Shift',{shiftKey:true,repeat:true});await flush();assert.equal(requests(h).length,1);assert.equal(cancels(h).length,0);h.pending.resolve({fallback:false,activated:true});await flush();assert.equal(h.api.isPending(),false);assert.equal(h.target.activations,undefined);});
 await test('Shift during pending preserves a definitive safe preactivation fallback',async()=>{const h=harness();await flush();h.press(true);h.release(true);await flush();h.key('Shift',{shiftKey:true});h.pending.resolve({fallback:true,activated:false});await flush();assert.equal(requests(h).length,1);assert.equal(cancels(h).length,0);assert.equal(arms(h).length,1);assert.equal(h.target.activations,1);});
 for(const key of ['a','Escape','Alt','Control']){
  await test(key+' cancels a held unknown gesture as before',async()=>{const h=harness();await flush();h.press(true);h.key(key);h.release(true);await flush();assert.equal(requests(h).length,0);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
  await test(key+(['Alt','Control'].includes(key)?' alone preserves pending copy preparation':' cancels pending isolation and suppresses stale fallback'),async()=>{const h=harness();await flush();h.press(true);h.release(true);await flush();h.key(key);h.pending.resolve({fallback:false,activated:true});await flush();assert.equal(cancels(h).length,['Alt','Control'].includes(key)?0:1);assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 }
 await test('legacy copy OFF does not disable automatic Shift-middle copying',async()=>{const h=harness({legacyEnabled:false});await flush();assert.equal(h.api.isEnabled(),true);h.press(true);h.release(true);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('legacy copy OFF cannot change Shift handling during a held middle click',async()=>{const h=harness({legacyEnabled:false});await flush();h.press(false);h.key('Shift',{shiftKey:true});h.release(true);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('known direct destinations keep their direct path with Shift already held',async()=>{const h=harness({known:true});await flush();h.press(true);h.release(true);await flush();assert.equal(requests(h).length,0);assert.equal(arms(h).length,0);assert.equal(h.messages.filter(m=>m.type==='fnt-open').length,1);});
 await test('Shift keydown during a known held link keeps legacy cancellation',async()=>{const h=harness({known:true});await flush();h.press(false);h.key('Shift',{shiftKey:true});h.release(true);await flush();assert.equal(requests(h).length,0);assert.equal(h.messages.filter(m=>m.type==='fnt-open').length,0);assert.equal(arms(h).length,0);});
 await test('ordinary middle click copies an unknown control when enabled',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('ordinary middle click ignores a legacy false copy setting',async()=>{const h=harness({legacyEnabled:false});await flush();h.press(false);h.release(false);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('known ordinary middle click bypasses copying completely',async()=>{const h=harness({known:true});await flush();h.press(false);h.release(false);await flush();assert.equal(requests(h).length,0);assert.equal(arms(h).length,0);const opened=h.messages.filter(m=>m.type==='fnt-open');assert.equal(opened.length,1);assert.equal(h.target.activations,undefined);});
 for(const legacySetting of [undefined,false]){
  await test('stored app destination bypasses copying with '+(legacySetting===undefined?'fresh settings':'legacy false settings'),async()=>{const h=harness({appData:true,legacyAppDataEnabled:legacySetting,legacyEnabled:legacySetting});await flush();h.press(false);h.release(false);await flush();const opened=h.messages.filter(m=>m.type==='fnt-open');assert.equal(opened.length,1);assert.equal(opened[0].url,'https://generic.example.test/stored-destination');assert.equal(requests(h).length,0);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 }
 await test('ordinary copy can use one definite preactivation fallback',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();assert.equal(requests(h).length,1);h.pending.resolve({fallback:true,activated:false});await flush();assert.equal(arms(h).length,1);assert.equal(h.target.activations,1);});
 await test('duplicate ordinary auxclick cannot create another copy or source activation',async()=>{const h=harness();await flush();h.press(false);h.release(false);h.dispatch('auxclick',{shiftKey:false});await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 for(const shiftKey of [false,true])for(const known of [false,true]){
  await test('toolbar OFF leaves '+(shiftKey?'Shift-middle':'ordinary middle')+' on '+(known?'a link':'an unknown button')+' untouched',async()=>{const h=harness({toolbar:false,known});await flush();assert.equal(h.api.isEnabled(),false);const events=['pointerdown','mousedown','pointerup','mouseup','auxclick'].map(type=>h.dispatch(type,{shiftKey}));await flush();for(const e of events){assert.equal(e.defaultPrevented,undefined);assert.equal(e.stopped,undefined);}assert.equal(h.messages.length,0);assert.equal(h.target.activations,undefined);});
 }
 for(const reenable of [false,true]){
  await test('toolbar OFF cancels a pending copy and suppresses its late fallback'+(reenable?' even after ON':''),async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();assert.equal(requests(h).length,1);h.change('enabled',false);assert.equal(h.api.isEnabled(),false);assert.equal(cancels(h).length,1);if(reenable){h.change('enabled',true);assert.equal(h.api.isEnabled(),true);}h.pending.resolve({fallback:true,activated:false});await flush();assert.equal(h.api.isPending(),false);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 }
 await test('a legacy feature-setting change cannot cancel a pending automatic copy',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();h.change('fntIsolationEnabled',false);assert.equal(h.api.isPending(),true);assert.equal(cancels(h).length,0);h.pending.resolve({fallback:false,activated:true});await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('form exclusions cannot become isolated replay targets',async()=>{const h=harness({form:true});await flush();h.press(true);h.release(true);await flush();assert.equal(requests(h).length,0);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('untrusted Shift input does not disturb an ordinary copy gesture',async()=>{const h=harness();await flush();h.press(false);h.key('Shift',{shiftKey:true,isTrusted:false});h.release(false);await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('source window blur permits the requested copy to finish without source activation',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();assert.equal(requests(h).length,1);h.dispatch('blur',{button:0});assert.equal(h.api.isPending(),true);assert.equal(cancels(h).length,0);h.pending.resolve({fallback:false,activated:true});await flush();assert.equal(h.api.isPending(),false);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 await test('source blur still prevents a stale original-page fallback',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();h.dispatch('blur',{button:0});assert.equal(cancels(h).length,0);h.pending.resolve({fallback:true,activated:false});await flush();assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 for(const [modifier,flags] of [['Control',{ctrlKey:true}],['Meta',{metaKey:true}],['Alt',{altKey:true}]]){
  await test(modifier+' plus Tab permits preparation while focus leaves the source',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();h.key(modifier,flags);h.key('Tab',flags);h.dispatch('blur',{button:0});assert.equal(cancels(h).length,0);assert.equal(h.api.isPending(),true);h.pending.resolve({fallback:false,activated:true});await flush();assert.equal(requests(h).length,1);assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 }
 await test('new source pointer input still cancels the pending copy',async()=>{const h=harness();await flush();h.press(false);h.release(false);await flush();h.dispatch('pointerdown',{button:0});assert.equal(cancels(h).length,1);h.pending.resolve({fallback:true,activated:false});await flush();assert.equal(arms(h).length,0);assert.equal(h.target.activations,undefined);});
 console.log(count+' combined Shift isolation checks passed (actual core and isolation source, mocked multi-listener DOM).');
})().catch(error=>{console.error(error);process.exitCode=1;});

