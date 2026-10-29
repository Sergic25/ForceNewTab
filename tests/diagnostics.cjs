'use strict';
// Mocked DOM/API safety checks, not a claim of real-site Firefox coverage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root,'diagnostics.js'),'utf8');
const bgSource = fs.readFileSync(path.join(root,'diagnostic-background.js'),'utf8');
const now = 1792962000000;
class Clock extends Date {constructor(...a) {super(...(a.length?a:[now]));} static now() {return now;}}
const clean = x => JSON.parse(JSON.stringify(x));
const flush = () => new Promise(resolve => setImmediate(resolve));
const recording = (token='one-shot',expires=now+120000) => ({token,expires});
function deferred() {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function el(tag,attrs={},children=[]) {
  const n={nodeType:1,localName:tag,attrs,children,getAttribute(k) {return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;},
    hasAttribute(k) {return Object.hasOwn(this.attrs,k);}};
  for(const c of children)c.parentElement=n;return n;
}
function event(nodes=[el('a',{href:'/go'})],extra={}) {
  return {type:'pointerdown',isTrusted:true,button:1,composedPath:()=>nodes,
    preventDefault() {throw Error('Gesture cancelled');},stopPropagation() {throw Error('Gesture stopped');},
    stopImmediatePropagation() {throw Error('Gesture stopped');},...extra};
}
function content(o={}) {
  const listeners={},changes=[],sent=[],gets=[];
  const context=vm.createContext({URL,Date:Clock,document:o.document||{baseURI:'https://example.test/base/'},
    location:{href:'https://user:password@example.test/feed?secret=PAGE_SECRET#PRIVATE'},
    FNT:o.FNT||{resolve:()=>null},FNTInspection:o.inspection,FNTAppData:o.appData,FNTButtonEvidence:o.buttonEvidence,FNTOutcomeTrace:o.outcomeTrace,FNTIsolation:o.isolation,FNTIsolationTarget:o.targetModule,
    fetch() {throw Error('Unexpected network request');},XMLHttpRequest() {throw Error('Unexpected network request');},
    WebSocket() {throw Error('Unexpected network request');},
    window:{addEventListener(t,fn,flags) {(listeners[t]||=[]).push({fn,flags});}},
    browser:{storage:{onChanged:{addListener:fn=>changes.push(fn)},local:{get(defaults) {
      gets.push(defaults);return o.get?o.get(defaults):Promise.resolve({fntRecordNextClick:o.initial||null});
    }}},runtime:{getManifest:()=>({version:o.runtimeVersion||'2.0.1'}),sendMessage(m) {sent.push(clean(m));return o.send?o.send(m):Promise.resolve({saved:true});}}}});
  vm.runInContext(source,context,{filename:'diagnostics.js'});
  return {api:context.FNTDiagnostics,listeners,sent,gets,
    change(v,area='local') {for(const fn of changes)fn({fntRecordNextClick:{newValue:v}},area);},
    fire(e=event()) {for(const {fn} of listeners[e.type]||[])fn(e);}};
}
function background(o={}) {
  const state={fntRecordNextClick:recording(),fntLastClickReport:null,...o.state},writes=[],reads=[];
  let listener,failure=!!o.failFirstWrite;
  const context=vm.createContext({Date:Clock,fetch() {throw Error('Unexpected network request');},
    browser:{runtime:{id:'extension@example.test',getURL:f=>'moz-extension://fixture/'+f,
      onMessage:{addListener:fn=>{listener=fn;}}},storage:{local:{async get(defaults) {
      reads.push(defaults);if(o.get)await o.get();return {...defaults,...clean(state)};
    },async set(values) {if(failure) {failure=false;throw Error('Storage failed');}
      writes.push(clean(values));Object.assign(state,clean(values));}}}}});
  vm.runInContext(bgSource,context,{filename:'diagnostic-background.js'});
  const sender={id:'extension@example.test',tab:{id:7},frameId:0,url:'https://example.test/'};
  const prefs={id:sender.id,url:'moz-extension://fixture/changelog.html'};
  const report={schemaVersion:1,capturedAt:new Clock().toISOString(),eventType:'pointerdown',
    page:{url:'https://example.test/feed',hadQuery:true,hadFragment:false},path:[],nearby:[]};
  return {state,writes,reads,sender,prefs,report,
    message:(extra={})=>({type:'fnt-diagnostic',recordingToken:'one-shot',report:clean(report),...extra}),
    send:(m,from=sender)=>listener(m,from),
    control:(command,token='replacement',from=prefs)=>listener({type:'fnt-diagnostic-control',command,token},from)};
}
const tests=[];function test(name,fn) {tests.push({name,fn});}
test('redacts credentials, query keys/values and fragments',()=>{
  assert.deepEqual(clean(content().api.redactURL('https://u:SECRET@example.test/path?q=SECRET#SECRET')),
    {url:'https://example.test/path',hadQuery:true,hadFragment:true});
});
test('resolves relative destinations before redaction',()=>{
  assert.deepEqual(clean(content().api.redactURL('../go?token=SECRET#part')),
    {url:'https://example.test/go',hadQuery:true,hadFragment:true});
});
test('rejects non-web and malformed addresses',()=>{
  for(const v of ['javascript:alert(1)','data:text/plain,SECRET','file:///private','about:config','http://[','',null,42])
    assert.equal(content().api.redactURL(v),null,String(v));
});
test('preserves ports and encoded paths',()=>{
  assert.deepEqual(clean(content().api.redactURL('http://example.test:8080/a%20b?privateKey=value')),
    {url:'http://example.test:8080/a%20b',hadQuery:true,hadFragment:false});
});
test('omits oversized URL paths without a misleading truncated address',()=>{
  const r=content().api.redactURL('https://example.test/'+'PRIVATE'.repeat(200)+'?secret=yes');
  assert.equal(r.url,'https://example.test/[long-path-omitted]');assert.equal(r.hadQuery,true);
});
test('only whitelisted metadata is read and stored',()=>{
  const n=el('button',{role:'link',tabindex:'0',type:'button','aria-labelledby':'heading-id',
    'aria-describedby':'help-id','aria-label':'PRIVATE_LABEL',onclick:'PRIVATE_CODE',
    class:'PRIVATE_CLASS',name:'PRIVATE_NAME',value:'PRIVATE_VALUE','data-href':'/go?secret=PRIVATE_QUERY#PRIVATE_HASH'});
  for(const k of ['textContent','innerHTML','outerHTML','className','value'])
    Object.defineProperty(n,k,{get() {throw Error('Sensitive property read: '+k);}});
  const r=clean(content().api.snapshot(event([n])));
  assert.deepEqual(r.path[0],{tag:'button',role:'link',tabindex:'0',type:'button','aria-labelledby':'heading-id',
    'aria-describedby':'help-id','data-href':{url:'https://example.test/go',hadQuery:true,hadFragment:true},hasLabel:true,hasInlineClick:true});
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('redacts page, image, nearby and resolver URLs',()=>{
  const image=el('img',{src:'https://cdn.test/image?signature=PRIVATE_IMAGE#PRIVATE_HASH'});
  const owner=el('article',{},[image,el('a',{href:'/next?secret=PRIVATE_LINK'})]);
  const r=clean(content({FNT:{resolve:()=>'https://u:PRIVATE@example.test/destination?token=PRIVATE_RESOLVER#PRIVATE_HASH'}}).api.snapshot(event([image,owner])));
  assert.equal(r.page.url,'https://example.test/feed');assert.equal(r.path[0].image.url,'https://cdn.test/image');
  assert.equal(r.knownResolution.url,'https://example.test/destination');
  assert.equal(r.nearby.find(s=>s.pathIndex===1).links[0].href.url,'https://example.test/next');
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE|password|secret=|signature=|token=/);
});
test('excludes html/body and caps path at twenty elements',()=>{
  const r=clean(content().api.snapshot(event([el('span'),el('body'),el('html'),...Array.from({length:30},()=>el('div')),{nodeType:9}])));
  assert.equal(r.path.length,20);assert.equal(r.pathTruncated,true);
  assert.ok(r.path.every(x=>!['body','html'].includes(x.tag)));
});
test('caps nearby scopes at four and sampled links at twelve',()=>{
  const nodes=Array.from({length:8},()=>el('article',{},Array.from({length:30},(_,i)=>el('a',{href:'/target/'+i}))));
  const r=clean(content().api.snapshot(event(nodes)));assert.equal(r.nearby.length,4);
  for(const s of r.nearby) {assert.equal(s.links.length,12);assert.ok(s.visited<=60);assert.equal(s.truncated,true);}
});
test('bounds traversal for a component with thousands of children',()=>{
  let reads=0;const n=el('article',{},Array.from({length:2000},()=>el('div')));
  for(const c of n.children)Object.defineProperty(c,'children',{get() {reads++;return [];}});
  const r=clean(content().api.snapshot(event([n])));assert.equal(r.nearby[0].visited,60);
  assert.ok(reads<=60);assert.equal(r.nearby[0].truncated,true);
});
test('contains resolver exceptions without copying private error messages',()=>{
  const r=clean(content({FNT:{resolve() {throw Error('PRIVATE_ERROR');}}}).api.snapshot(event()));
  assert.equal(r.resolverError,true);assert.equal(r.knownResolution,null);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_ERROR/);
});
test('contains broken DOM getters without running page handlers',()=>{
  const n=el('div');n.getAttribute=n.hasAttribute=()=>{throw Error('PRIVATE_ERROR');};
  n.click=()=>{throw Error('Unexpected click');};assert.equal(content().api.snapshot(event([n])).path[0].tag,'div');
});
test('limits total snapshot size',()=>{
  const children=Array.from({length:12},(_,i)=>el('a',{href:'https://example.test/'+'p'.repeat(700)+i}));
  const nodes=Array.from({length:20},()=>el('article',{role:'link','aria-labelledby':'i'.repeat(128)},children));
  const r=clean(content().api.snapshot(event(nodes)));assert.ok(JSON.stringify(r).length<=22000);assert.equal(r.sizeLimited,true);
});

test('resolution uses the complete event path even when its preview stops at twenty',()=>{
  const nodes=Array.from({length:24},()=>el('div'));
  nodes.push(el('a',{href:'/beyond-preview?private=SECRET'}));
  const h=content({FNT:{resolve:path=>path.find(n=>n.getAttribute('href'))?.getAttribute('href')}});
  const report=clean(h.api.snapshot(event(nodes)));
  assert.equal(report.path.length,20);assert.equal(report.pathTruncated,true);
  assert.equal(report.knownResolution.url,'https://example.test/beyond-preview');
  assert.equal(report.knownResolution.hadQuery,true);assert.doesNotMatch(JSON.stringify(report),/SECRET/);
});
test('detailed inspection receives the complete path without changing navigation',()=>{
  const nodes=Array.from({length:25},()=>el('div'));let inspected;
  const h=content({inspection:{inspect(path,base){inspected={path,base};return {status:'inspected',anchorCount:0};}}});
  const report=clean(h.api.snapshot(event(nodes)));
  assert.equal(inspected.path,nodes);assert.equal(inspected.base,'https://example.test/base/');
  assert.equal(report.inspection.anchorCount,0);assert.equal(h.sent.length,0);
});
test('inspection exceptions are contained without copying error text',()=>{
  const h=content({inspection:{inspect(){throw Error('PRIVATE_INSPECTION_DETAIL');}}});
  const report=clean(h.api.snapshot(event()));
  assert.equal(report.inspection.status,'read-error');
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_INSPECTION_DETAIL/);
});

test('observers are passive capture listeners and default to off',()=>{
  const h=content();assert.deepEqual(Object.keys(h.listeners).sort(),['mousedown','pointerdown']);
  for(const handlers of Object.values(h.listeners))assert.deepEqual(clean(handlers[0].flags),{capture:true,passive:true});
  assert.equal(h.gets[0].fntRecordNextClick,null);
});
test('records nothing until explicitly armed',async()=>{
  const h=content();await flush();h.fire();await flush();assert.equal(h.sent.length,0);
});
test('ignores left/right/simulated clicks without consuming the arm',async()=>{
  const h=content({initial:recording()});await flush();
  h.fire(event(undefined,{button:0}));h.fire(event(undefined,{button:2}));h.fire(event(undefined,{isTrusted:false}));
  assert.equal(h.sent.length,0);h.fire();assert.equal(h.sent.length,1);
});
test('pointerdown and mousedown produce one report before async send completes',async()=>{
  const pending=deferred(),h=content({initial:recording(),send:()=>pending.promise});await flush();
  h.fire();h.fire(event(undefined,{type:'mousedown'}));h.fire();assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].type,'fnt-diagnostic');assert.equal(h.sent[0].recordingToken,'one-shot');
  pending.resolve({saved:true});await flush();
});
test('rejects expired, far-future and malformed settings',async()=>{
  for(const v of [recording('x',now),recording('x',now+120001),recording('',now+10),recording('x'.repeat(101)),{token:'x',expires:'tomorrow'}]) {
    const h=content({initial:v});await flush();h.fire();assert.equal(h.sent.length,0,JSON.stringify(v));
  }
});
test('accepts the exact two-minute expiry boundary',async()=>{
  const h=content({initial:recording('boundary',now+120000)});await flush();h.fire();assert.equal(h.sent[0].recordingToken,'boundary');
});
test('newer off update wins over stale initial storage read',async()=>{
  const first=deferred(),h=content({get:()=>first.promise});h.change(null);
  first.resolve({fntRecordNextClick:recording('stale')});await flush();h.fire();assert.equal(h.sent.length,0);
});
test('newer arm wins over stale initial storage read',async()=>{
  const first=deferred(),h=content({get:()=>first.promise});h.change(recording('new'));
  first.resolve({fntRecordNextClick:null});await flush();h.fire();assert.equal(h.sent[0].recordingToken,'new');
});
test('ignores non-local storage and supports an explicit second arm',async()=>{
  const h=content();await flush();h.change(recording('wrong'),'sync');h.fire();assert.equal(h.sent.length,0);
  h.change(recording('first'));h.fire();h.change(recording('second'));h.fire();
  assert.deepEqual(h.sent.map(m=>m.recordingToken),['first','second']);
});
test('contains synchronous storage/send failures without replaying a click',()=>{
  const h=content({get:()=>{throw Error('Storage failed');},send:()=>{throw Error('Send failed');}});
  h.fire();h.change(recording());assert.doesNotThrow(()=>h.fire());h.fire();assert.equal(h.sent.length,1);
});
test('contains asynchronous API rejections',async()=>{
  const h=content({get:()=>Promise.reject(Error('Storage failed')),send:()=>Promise.reject(Error('Send failed'))});
  await flush();h.change(recording());h.fire();await flush();assert.equal(h.sent.length,1);
});
test('background ignores unrelated messages',()=>{
  const h=background();assert.equal(h.send({type:'open-tab'}),undefined);assert.equal(h.writes.length,0);
});
test('background saves locally and disarms in one storage write',async()=>{
  const h=background();assert.deepEqual(clean(await h.send(h.message())),{saved:true});assert.equal(h.writes.length,1);
  assert.equal(h.state.fntRecordNextClick,null);assert.equal(h.state.fntLastClickReport.frameId,0);
});
test('background rejects missing/mismatched tokens',async()=>{
  for(const token of [undefined,'','wrong','x'.repeat(101)]) {
    const h=background();assert.equal((await h.send(h.message({recordingToken:token}))).saved,false);assert.equal(h.writes.length,0);
  }
});
test('background rejects untrusted or invalid frame senders',async()=>{
  for(const from of [{},{id:'other',tab:{id:1},frameId:0},{id:'extension@example.test',frameId:0},
    {id:'extension@example.test',tab:{id:-1},frameId:0},{id:'extension@example.test',tab:{id:1},frameId:-1},
    {id:'extension@example.test',tab:{id:1},frameId:1.5}]) {
    const h=background();assert.equal((await h.send(h.message(),from)).saved,false);assert.equal(h.writes.length,0);
  }
});
test('background rejects malformed, cyclic or oversized reports',async()=>{
  const cyclic={schemaVersion:1,path:[],nearby:[]};cyclic.self=cyclic;
  for(const report of [null,{}, {schemaVersion:2,path:[],nearby:[]},{schemaVersion:1,path:Array(21).fill({}),nearby:[]},
    {schemaVersion:1,path:[],nearby:Array(5).fill({})},{schemaVersion:1,path:[],nearby:[],huge:'x'.repeat(22000)},cyclic]) {
    const h=background();assert.equal((await h.send(h.message({report}))).saved,false);assert.equal(h.writes.length,0);
  }
});
test('background rejects expired and excessive recording lifetimes',async()=>{
  for(const v of [null,recording('one-shot',now),recording('one-shot',now+120001),recording('one-shot',Infinity)]) {
    const h=background({state:{fntRecordNextClick:v}});assert.equal((await h.send(h.message())).saved,false);assert.equal(h.writes.length,0);
  }
});
test('simultaneous frame reports cannot replace the first accepted report',async()=>{
  const h=background(),results=await Promise.all([h.send(h.message()),h.send(h.message(),{...h.sender,frameId:2})]);
  assert.deepEqual(results.map(r=>r.saved),[true,false]);assert.equal(h.writes.length,1);assert.equal(h.state.fntLastClickReport.frameId,0);
});
test('a storage failure does not break the serialized background queue',async()=>{
  const h=background({failFirstWrite:true});assert.equal((await h.send(h.message())).saved,false);
  assert.equal((await h.send(h.message())).saved,true);assert.equal(h.writes.length,1);
});
test('only extension Preferences may start or clear recording',async()=>{
  const h=background();for(const from of [h.sender,{...h.prefs,id:'wrong'},
    {...h.prefs,url:'moz-extension://fixture/other.html'},{...h.prefs,url:'https://example.test/changelog.html'}]) {
    assert.equal((await h.control('clear','x',from)).ok,false);assert.equal((await h.control('record','x',from)).ok,false);
  }assert.equal(h.writes.length,0);
});
test('record control replaces the old report and expires in two minutes',async()=>{
  const h=background({state:{fntLastClickReport:{old:true}}});assert.equal((await h.control('record','new-token')).ok,true);
  assert.deepEqual(h.state.fntRecordNextClick,{token:'new-token',expires:now+120000});assert.equal(h.state.fntLastClickReport,null);
});
test('clear control removes the report and arm',async()=>{
  const h=background({state:{fntLastClickReport:{old:true}}});assert.equal((await h.control('clear')).ok,true);
  assert.equal(h.state.fntLastClickReport,null);assert.equal(h.state.fntRecordNextClick,null);
});
test('invalid controls do not change storage',async()=>{
  const h=background();for(const [command,token] of [['unknown','x'],['record',''],['record','x'.repeat(101)],['record',null]])
    assert.equal((await h.control(command,token)).ok,false);assert.equal(h.writes.length,0);
});
test('clear after capture leaves no saved report',async()=>{
  const h=background(),r=await Promise.all([h.send(h.message()),h.control('clear')]);
  assert.equal(r[0].saved,true);assert.equal(r[1].ok,true);assert.equal(h.state.fntLastClickReport,null);assert.equal(h.state.fntRecordNextClick,null);
});
test('clear before capture prevents that report from being stored',async()=>{
  const h=background(),r=await Promise.all([h.control('clear'),h.send(h.message())]);
  assert.equal(r[0].ok,true);assert.equal(r[1].saved,false);assert.equal(h.state.fntLastClickReport,null);
});
test('an old click cannot consume a replacement arm',async()=>{
  const h=background(),r=await Promise.all([h.control('record','replacement'),h.send(h.message())]);
  assert.equal(r[0].ok,true);assert.equal(r[1].saved,false);assert.equal(h.state.fntRecordNextClick.token,'replacement');
});
test('the final stored report includes frame metadata within the size cap',async()=>{
  const h=background(),report=clean(h.report);report.padding='';
  report.padding='x'.repeat(22000-JSON.stringify(report).length);assert.equal(JSON.stringify(report).length,22000);
  const r=await h.send(h.message({report}));if(r.saved)assert.ok(JSON.stringify(h.state.fntLastClickReport).length<=22000);
  else assert.equal(h.writes.length,0);
});

test('app-data inspection is opt-in through recording and stores only its report summary',async()=>{
  let probes=0;
  const appData={inspect(){probes++;return {destination:'https://example.test/story?secret=PRIVATE_DESTINATION',report:{status:'evidence-only',candidateCount:1}};}};
  const off=content({appData});await flush();off.fire();assert.equal(probes,0);
  const armed=content({appData,initial:recording()});await flush();armed.fire();
  assert.equal(probes,1);assert.equal(armed.sent[0].report.appData.status,'evidence-only');
  assert.doesNotMatch(JSON.stringify(armed.sent),/PRIVATE_DESTINATION/);
});
test('app-data report failures do not interrupt recording or copy private exception text',async()=>{
  const h=content({initial:recording(),appData:{inspect(){throw Error('PRIVATE_APP_DETAIL');}}});
  await flush();h.fire();assert.equal(h.sent.length,1);
  assert.equal(h.sent[0].report.appData.status,'read-error');
  assert.doesNotMatch(JSON.stringify(h.sent),/PRIVATE_APP_DETAIL/);
});
test('removed feature-setting commands cannot change recording or saved settings',async()=>{
  const h=background();const before=clean(h.state);
  for(const command of ['app-data','isolation'])for(const value of [true,false,'true',1,null,undefined]){
    for(const sender of [h.prefs,h.sender]){
      const result=await h.send({type:'fnt-diagnostic-control',command,value},sender);
      assert.equal(result.ok,false);
    }
  }
  assert.deepEqual(h.state,before);assert.equal(h.writes.length,0);
});

test('button evidence receives the full path only during an explicit recording',async()=>{
  let calls=0,seen; const nodes=Array.from({length:25},()=>el('div'));nodes[0]=el('button');
  const buttonEvidence={inspect(path){calls++;seen=path;return {status:'button-address-evidence-found',automaticUse:false};}};
  const off=content({buttonEvidence});await flush();off.fire(event(nodes));assert.equal(calls,0);
  const on=content({initial:recording(),buttonEvidence});await flush();on.fire(event(nodes));
  assert.equal(calls,1);assert.equal(seen.length,25);assert.equal(on.sent[0].report.buttonEvidence.automaticUse,false);
});
test('button evidence errors preserve the report without private error messages',async()=>{
  const h=content({initial:recording(),buttonEvidence:{inspect(){throw Error('PRIVATE_BUTTON_DATA');}}});
  await flush();h.fire();assert.equal(h.sent[0].report.buttonEvidence.status,'read-error');assert.doesNotMatch(JSON.stringify(h.sent),/PRIVATE_BUTTON_DATA/);
});
test('outcome observation starts for the accepted local click token only',async()=>{
  const calls=[];const outcomeTrace={start(e,token){calls.push({e,token});return {version:1,content:{status:'observing'}};}};
  const off=content({outcomeTrace});await flush();off.fire();assert.equal(calls.length,0);
  const on=content({initial:recording('trace-token'),outcomeTrace});await flush();on.fire();on.fire(event(undefined,{type:'mousedown'}));
  assert.equal(calls.length,1);assert.equal(calls[0].token,'trace-token');assert.equal(on.sent[0].report.outcome.content.status,'observing');
});
test('outcome startup failure cannot interrupt initial report delivery',async()=>{
  const h=content({initial:recording(),outcomeTrace:{start(){throw Error('PRIVATE_TRACE_ERROR');}}});await flush();h.fire();
  assert.equal(h.sent.length,1);assert.doesNotMatch(JSON.stringify(h.sent),/PRIVATE_TRACE_ERROR/);
});
test('gesture modifiers are booleans without recording keyboard characters',()=>{
 const h=content();const r=h.api.snapshot(event(undefined,{shiftKey:true,ctrlKey:false,altKey:true,metaKey:0,key:'PRIVATE_TYPED_CHARACTER'}));
 assert.deepEqual(clean(r.gestureInput),{shiftKey:true,ctrlKey:false,altKey:true,metaKey:false});assert.doesNotMatch(JSON.stringify(r),/PRIVATE_TYPED/);
});
test('isolation mode snapshot exposes only allowlisted boolean flags',()=>{
 const h=content({isolation:{describeState:()=>({modeEnabled:true,toolbarEnabled:false,topFrame:true,pending:1,secret:'PRIVATE_MODE_DATA'})}});
 const r=h.api.snapshot(event());assert.deepEqual(clean(r.isolationMode),{moduleAvailable:true,modeEnabled:true,toolbarEnabled:false,topFrame:true,pending:false});assert.doesNotMatch(JSON.stringify(r),/PRIVATE_MODE/);
});
test('copy eligibility records bounded reasons and root metadata without identity values',()=>{
 const control=el('button');let seen;const h=content({targetModule:{audit(node){seen=node;return {eligible:true,reason:'eligible',rootType:'open-shadow',shadowDepth:2,candidateCount:3,hostCandidates:1,label:'PRIVATE_LABEL',descriptor:{secret:'PRIVATE_DATA'}};}}});
 const r=h.api.snapshot(event([el('span'),control]));assert.equal(seen,control);assert.equal(r.copyEligibility.rootType,'open-shadow');assert.equal(r.copyEligibility.shadowDepth,2);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('known routes bypass copy audit and audit failures preserve safe reports',()=>{
 let calls=0;const targetModule={audit(){calls++;throw Error('PRIVATE_AUDIT_ERROR');}};
 const known=content({FNT:{resolve:()=>'/known'},targetModule});const a=known.api.snapshot(event([el('button')]));assert.equal(a.copyEligibility.reason,'known-destination-bypass');assert.equal(calls,0);
 const unknown=content({targetModule});const b=unknown.api.snapshot(event([el('button')]));assert.equal(b.copyEligibility.reason,'read-error');assert.doesNotMatch(JSON.stringify(b),/PRIVATE_AUDIT/);
});
test('report separates source build from installed runtime version',()=>{
 const h=content({runtimeVersion:'4.2.2'});const r=h.api.snapshot(event());assert.equal(r.diagnosticVersion,'2.0.1');assert.equal(r.extensionVersion,'4.2.2');
});
// 4.2.6 deliberately updates approved icon fingerprints; navigation hashes stay historical.
test('routing matches baseline apart from explicit isolation Shift and icon-only guards',()=>{
  const hashes={
    'resolver.js':'1f54e420ec59a7282cfedc9a142835e9da7d1afbeac07dff389025cb93d99ed0',
    'content.js':'f8b07fa1ccac9e8d95404d8a91f19f9458694f5e7a5d0e5fda87342168a80d26',
    'discovery.js':'a50174a21f1dbe3b55116cca5cf624fbace10447175c8f9b25c3b408f8e6e358',
    'background.js':'057dc907366e2981b1e2dffe178cb192765d8659cad1e6d8e489d90946f2db2e',
    'icon.png':'8546af462e77693cc0b4f9a3c67f37725f450df018e8f8e43828654a545d9345',
    'icon@2x.png':'1bdae4d4f426173e2eb7ce1aa447c4a2fd244bf74b44a415c879ac451ccd2ffa',
    'icon-disabled.png':'5eac6602cebaeaffba59933413ba894d07b74949caee31d5d4c94157eb09f4bc',
    'icon-disabled@2x.png':'630ddc2f596fcc7afbaf25a9eec8f4d8850b6c89c80d0d25550fa3de10eb3b2f'};
  for(const [file,expected] of Object.entries(hashes)) {
    let bytes=fs.readFileSync(path.join(root,file));
    if(file==='background.js') {
      let restored=bytes.toString('utf8');
      // Restore only the approved literal maps; keep the old navigation hash.
      for(const [approved,legacy]of [["{16: \"icons/enabled/icon-16.png\", 20: \"icons/enabled/icon-20.png\", 24: \"icons/enabled/icon-24.png\", 28: \"icons/enabled/icon-28.png\", 32: \"icons/enabled/icon-32.png\", 40: \"icons/enabled/icon-40.png\", 48: \"icons/enabled/icon-48.png\", 56: \"icons/enabled/icon-56.png\", 64: \"icons/enabled/icon-64.png\", 96: \"icons/enabled/icon-96.png\", 128: \"icons/enabled/icon-128.png\"}", "{48: \"icon.png\", 96: \"icon@2x.png\"}"],
["{16: \"icons/disabled/icon-16.png\", 20: \"icons/disabled/icon-20.png\", 24: \"icons/disabled/icon-24.png\", 28: \"icons/disabled/icon-28.png\", 32: \"icons/disabled/icon-32.png\", 40: \"icons/disabled/icon-40.png\", 48: \"icons/disabled/icon-48.png\", 56: \"icons/disabled/icon-56.png\", 64: \"icons/disabled/icon-64.png\", 96: \"icons/disabled/icon-96.png\", 128: \"icons/disabled/icon-128.png\"}", "{48: \"icon-disabled.png\", 96: \"icon-disabled@2x.png\"}"]]){
        assert.equal(restored.split(approved).length,2,'one exact approved icon literal');
        restored=restored.replace(approved,legacy);
      }
      bytes=Buffer.from(restored);
    }
    if(file==='content.js') {
      const text=bytes.toString('utf8');
      assert.equal(text.split('    // BEGIN isolated-copy hook').length,2,'exactly one guarded hook');
      let restored=text.replace(/    \/\/ BEGIN isolated-copy hook\r?\n[\s\S]*?    \/\/ END isolated-copy hook\r?\n/,'');
      for(const marker of ['press','latch']) restored=restored.replace(new RegExp('      // BEGIN isolated-shift '+marker+'\\r?\\n[\\s\\S]*?      // END isolated-shift '+marker+'\\r?\\n'),'');
      restored=restored.replace(/  \/\/ BEGIN isolated-shift keyboard\r?\n[\s\S]*?  \/\/ END isolated-shift keyboard\r?\n/,'  window.addEventListener("keydown", event => { if (event.isTrusted) invalidate(); }, true);\n');
      bytes=Buffer.from(restored);
    }
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected,file);
  }
});
test('diagnostics adds no permissions and precedes the unchanged click handler',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.deepEqual(m.permissions,['cookies','storage','webNavigation']);assert.deepEqual(m.host_permissions,['<all_urls>']);
  assert.deepEqual(m.content_scripts[0].js,['inspection.js','button-evidence.js','diagnostics.js','resolver.js','component-link.js','app-data.js','outcome-trace.js','isolation-target.js','isolation-content.js','content.js']);
  assert.deepEqual(m.background.scripts,['discovery.js','background.js','diagnostic-background.js','isolation-target.js','isolation-background.js']);
  assert.equal(m.content_scripts[0].run_at,'document_start');assert.deepEqual(m.options_ui,{open_in_tab:true,page:'changelog.html'});
});
(async()=>{let passed=0;for(const {name,fn} of tests) {try {await fn();passed++;console.log('PASS diagnostics',name);}
  catch(error) {console.error('FAIL diagnostics',name);console.error(error.stack||error);process.exitCode=1;}}
  console.log(passed+'/'+tests.length+' diagnostics checks passed');})();
