'use strict';
// Passive background outcome correlation, using mocked Firefox events/storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','diagnostic-background.js'),'utf8');
const clean=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function hub(){const handlers=[];return {addListener(fn){handlers.push(fn);},fire(value){for(const fn of handlers)fn(value);}};}
function harness(options={}){
 let now=100000,listener,fail=false;
 const state={fntRecordNextClick:{token:'record-one',expires:now+120000},fntLastClickReport:null};
 const writes=[],reads=[];
 const webNavigation={};for(const name of ['onBeforeNavigate','onCommitted','onHistoryStateUpdated','onReferenceFragmentUpdated','onCreatedNavigationTarget'])webNavigation[name]=hub();
 const tabs={onCreated:hub(),onRemoved:hub()};
 const sender={id:'extension',tab:{id:7,windowId:4},frameId:options.frameId||0};
 const prefs={id:'extension',url:'moz-extension://fixture/changelog.html'};
 const context=vm.createContext({URL,Date:{now:()=>now},browser:{runtime:{id:'extension',getURL:file=>'moz-extension://fixture/'+file,onMessage:{addListener(fn){listener=fn;}}},
  storage:{local:{async get(defaults){reads.push(clean(defaults));if(options.getGate)await options.getGate;return {...defaults,...clean(state)};},async set(values){if(fail){fail=false;throw Error('private failure');}writes.push(clean(values));Object.assign(state,clean(values));}}},webNavigation,tabs}});
 vm.runInContext(source,context);
 const report={schemaVersion:1,path:[],nearby:[],outcome:{version:1,content:{status:'observing',elapsedMs:0,syntheticClickEvents:0,titleChanged:false,addressChanged:false,page:{url:'https://example.test/start',hadQuery:false,hadFragment:false},navigations:[],navigationEvents:0,limited:false}}};
 const send=(m,from=sender)=>listener(m,from);
 const start=extra=>send({type:'fnt-diagnostic',recordingToken:'record-one',report:{...clean(report),...extra}});
 const update=(summary={},extra={})=>send({type:'fnt-diagnostic-update',recordingToken:'record-one',outcome:{version:1,content:{status:'complete',elapsedMs:9000,...summary}},...extra});
 const control=(command,token='new-token')=>send({type:'fnt-diagnostic-control',command,token},prefs);
 const core=(type,extra={},from=sender)=>send({type,attemptId:'attempt-one',...extra},from);
 return {state,writes,reads,webNavigation,tabs,sender,prefs,report,send,start,update,control,core,tick(ms){now+=ms;},failWrite(){fail=true;},now:()=>now};
}
const tests=[];function test(name,fn){tests.push({name,fn});}
test('inactive passive observation never writes or reads storage and returns undefined',async()=>{
 const h=harness();for(const type of ['fnt-arm','fnt-captured','fnt-cancel','fnt-open'])assert.equal(h.core(type,{url:'https://site.test/'}),undefined);
 h.webNavigation.onBeforeNavigate.fire({tabId:7,frameId:0,url:'https://site.test/'});h.tabs.onCreated.fire({id:9,openerTabId:7,windowId:4});await flush();assert.equal(h.reads.length,0);assert.equal(h.writes.length,0);
});
test('legacy initial report preserves original one-shot storage behavior',async()=>{
 const h=harness();assert.equal((await h.start({outcome:undefined})).saved,true);assert.equal(h.writes.length,1);assert.equal(h.state.fntRecordNextClick,null);assert.equal(h.state.fntLastClickReport.outcome,undefined);
 h.core('fnt-open',{url:'https://site.test/'});await flush();assert.equal(h.writes.length,1);
});
test('initial trace replaces supplied background with a clean observer record',async()=>{
 const h=harness(),outcome=clean(h.report.outcome);outcome.background={secret:'PRIVATE'};assert.equal((await h.start({outcome})).saved,true);
 assert.deepEqual(h.state.fntLastClickReport.outcome.background,{correlationOnly:true,observerBuild:"4.2.6",events:[],counts:{},limited:false});assert.doesNotMatch(JSON.stringify(h.state),/PRIVATE/);
});
test('queued core observation follows initial report even before its storage await resolves',async()=>{
 const h=harness();const first=h.start();assert.equal(h.core('fnt-arm'),undefined);assert.equal(h.core('fnt-captured',{url:'https://destination.test/path?q=PRIVATE#PRIVATE'}),undefined);await first;await flush();
 const bg=h.state.fntLastClickReport.outcome.background;assert.equal(bg.counts['arm-request'],1);assert.equal(bg.counts['capture-request'],1);assert.equal(bg.events[1].address.url,'https://destination.test/path');assert.doesNotMatch(JSON.stringify(bg),/PRIVATE/);
});
test('core message queued while first capture storage read is pending is retained',async()=>{
 let release;const getGate=new Promise(resolve=>{release=resolve;});const h=harness({getGate});const captured=h.start();await flush();assert.equal(h.reads.length,1);assert.equal(h.writes.length,0);
 assert.equal(h.core('fnt-arm'),undefined);assert.equal(h.core('fnt-captured',{url:'https://destination.test/pending-capture'}),undefined);await flush();assert.equal(h.writes.length,0);release();assert.equal((await captured).saved,true);await flush();
 assert.deepEqual(h.state.fntLastClickReport.outcome.background.events.map(event=>event.type),['arm-request','capture-request']);
});
test('core observations never claim acknowledgements or consume message responses',async()=>{
 const h=harness();await h.start();for(const type of ['fnt-arm','fnt-captured','fnt-cancel','fnt-open'])assert.equal(h.core(type,{url:'https://target.test/'}),undefined);await flush();
 assert.deepEqual(h.state.fntLastClickReport.outcome.background.events.map(e=>e.type),['arm-request','capture-request','cancel-request','direct-open-request']);
});
test('core messages require exact extension tab frame and owned attempt',async()=>{
 const h=harness();await h.start();h.core('fnt-captured',{url:'https://ignored.test/'});h.core('fnt-arm',{}, {...h.sender,id:'foreign'});h.core('fnt-arm',{}, {...h.sender,frameId:2});h.core('fnt-arm',{}, {...h.sender,tab:{id:8}});await flush();assert.equal(h.writes.length,1);
 h.core('fnt-arm');h.core('fnt-captured',{attemptId:'different',url:'https://ignored.test/'});h.core('fnt-arm',{attemptId:'different'});await flush();assert.equal(h.state.fntLastClickReport.outcome.background.events.length,1);
});
test('direct opening redacts credentials queries and fragments',async()=>{
 const h=harness();await h.start();h.core('fnt-open',{url:'https://PRIVATE:PRIVATE@target.test/page?PRIVATE=PRIVATE#PRIVATE'});await flush();
 assert.deepEqual(h.state.fntLastClickReport.outcome.background.events[0].address,{url:'https://target.test/page',hadQuery:true,hadFragment:true});assert.doesNotMatch(JSON.stringify(h.state),/PRIVATE/);
});
test('all navigation observation channels and existing targets are labelled separately',async()=>{
 const h=harness();await h.start();for(const name of ['onBeforeNavigate','onCommitted','onHistoryStateUpdated','onReferenceFragmentUpdated'])h.webNavigation[name].fire({tabId:7,frameId:0,url:'https://target.test/page',timeStamp:h.now()});
 h.webNavigation.onCreatedNavigationTarget.fire({sourceTabId:7,sourceFrameId:0,tabId:9,url:'about:blank',timeStamp:h.now()});h.tabs.onCreated.fire({id:9,openerTabId:7,windowId:4,url:'https://target.test/page'});await flush();
 assert.deepEqual(h.state.fntLastClickReport.outcome.background.events.map(e=>e.type),['before-navigate','committed','history-state','fragment-updated','page-created-target','related-tab-created']);
 assert.equal(h.state.fntLastClickReport.outcome.background.correlationOnly,true);
});
test('unrelated malformed and stale browser events are excluded',async()=>{
 const h=harness();await h.start();for(const extra of [{tabId:8},{frameId:2},{timeStamp:h.now()-1},{timeStamp:NaN}])h.webNavigation.onBeforeNavigate.fire({tabId:7,frameId:0,url:'https://ignored.test/',...extra});
 for(const extra of [{sourceTabId:8},{sourceFrameId:3},{tabId:7},{tabId:-1},{timeStamp:h.now()-1}])h.webNavigation.onCreatedNavigationTarget.fire({sourceTabId:7,sourceFrameId:0,tabId:9,...extra});
 h.tabs.onCreated.fire({id:9,openerTabId:8,windowId:4});h.tabs.onCreated.fire({id:7,openerTabId:7,windowId:4});h.tabs.onCreated.fire({id:9,openerTabId:7,windowId:5});await flush();assert.equal(h.writes.length,1);
});
test('nested-frame report permits annotated top-frame browser navigation only',async()=>{
 const h=harness({frameId:3});await h.start();h.webNavigation.onBeforeNavigate.fire({tabId:7,frameId:0,url:'https://target.test/'});h.webNavigation.onCommitted.fire({tabId:7,frameId:3,url:'https://target.test/'});h.webNavigation.onHistoryStateUpdated.fire({tabId:7,frameId:2,url:'https://ignored.test/'});await flush();assert.deepEqual(h.state.fntLastClickReport.outcome.background.events.map(e=>e.frameId),[0,3]);
});
test('terminal update retains background evidence while allowlisting and redacting content',async()=>{
 const h=harness();await h.start();h.core('fnt-arm');await flush();const result=await h.update({syntheticClickEvents:1,titleChanged:true,addressChanged:false,page:{url:'https://USER:PRIVATE@site.test/page?PRIVATE=yes#PRIVATE'},
  navigations:[{address:{url:'https://destination.test/path?PRIVATE=yes#PRIVATE'},defaultPrevented:true,cancelable:true,trusted:true,navigationType:'push',secret:'PRIVATE'}],navigationEvents:1,secret:'PRIVATE'});
 assert.equal(result.saved,true);const outcome=h.state.fntLastClickReport.outcome;assert.equal(outcome.background.counts['arm-request'],1);assert.equal(outcome.content.titleChanged,true);assert.equal(outcome.content.navigations[0].defaultPrevented,true);assert.equal(outcome.content.page.url,'https://site.test/page');assert.doesNotMatch(JSON.stringify(outcome),/PRIVATE|USER/);
});
test('updates reject other frames tabs extensions and tokens',async()=>{
 const h=harness();await h.start();const message={type:'fnt-diagnostic-update',recordingToken:'record-one',outcome:{version:1,content:{status:'complete'}}};
 for(const from of [{...h.sender,id:'foreign'},{...h.sender,frameId:2},{...h.sender,tab:{id:8}},{}])assert.equal((await h.send(message,from)).saved,false);
 assert.equal((await h.update({}, {recordingToken:'wrong'})).saved,false);assert.equal(h.writes.length,1);
});
test('unsupported status schema oversized and cyclic updates are rejected',async()=>{
 const h=harness();await h.start();const cyclic={version:1};cyclic.self=cyclic;
 for(const outcome of [{version:2,content:{status:'complete'}},{version:1,content:{status:'observing'}},{version:1,content:{status:'complete',secret:'x'.repeat(3500)}},cyclic,null])assert.equal((await h.update({}, {outcome})).saved,false);assert.equal(h.writes.length,1);
});
test('terminal updates close observation and cannot be replayed',async()=>{
 const h=harness();await h.start();assert.equal((await h.update()).saved,true);const n=h.writes.length;h.core('fnt-open',{url:'https://later.test/'});h.webNavigation.onBeforeNavigate.fire({tabId:7,frameId:0,url:'https://later.test/'});await flush();assert.equal((await h.update()).saved,false);assert.equal(h.writes.length,n);
});
test('trace expires after fifteen seconds without new storage access',async()=>{
 const h=harness();await h.start();h.tick(15000);h.core('fnt-arm');h.tabs.onCreated.fire({id:9,openerTabId:7,windowId:4});await flush();assert.equal((await h.update()).saved,false);assert.equal(h.writes.length,1);assert.equal(h.reads.length,1);
});
test('Clear invalidates late content and passive browser evidence',async()=>{
 const h=harness();await h.start();await h.control('clear');assert.equal((await h.update()).saved,false);h.core('fnt-arm');await flush();assert.equal(h.state.fntLastClickReport,null);assert.equal(h.writes.length,2);
});
test('replacement Record prevents old trace from consuming or overwriting its arm',async()=>{
 const h=harness();await h.start();await h.control('record');assert.equal((await h.update()).saved,false);h.core('fnt-arm');await flush();assert.equal(h.state.fntRecordNextClick.token,'new-token');assert.equal(h.state.fntLastClickReport,null);
});
test('removed feature controls are rejected without changing report ownership',async()=>{
 const h=harness();await h.start();for(const command of ['app-data','isolation'])assert.equal((await h.send({type:'fnt-diagnostic-control',command,value:true},h.prefs)).ok,false);assert.equal((await h.update()).saved,true);assert.equal(h.state.fntAppDataEnabled,undefined);assert.equal(h.state.fntIsolationEnabled,undefined);
});
test('wrong Preferences sender cannot invalidate trace',async()=>{
 const h=harness();await h.start();assert.equal((await h.send({type:'fnt-diagnostic-control',command:'clear'},h.sender)).ok,false);assert.equal((await h.update()).saved,true);
});
test('event history and background size are bounded with accurate capped counts',async()=>{
 const h=harness();await h.start();for(let i=0;i<50;i++)h.core('fnt-open',{url:'https://target.test/'+('p'.repeat(700))+'?SECRET=yes'});await flush();const bg=h.state.fntLastClickReport.outcome.background;assert.equal(bg.counts['direct-open-request'],50);assert.ok(bg.events.length<=16);assert.ok(JSON.stringify(bg).length<=1500);assert.equal(bg.limited,true);assert.doesNotMatch(JSON.stringify(bg),/SECRET/);
});
test('content summaries cap navigation arrays and counters without copying arbitrary text',async()=>{
 const h=harness();await h.start();await h.update({syntheticClickEvents:100000,navigationEvents:200000,elapsedMs:50000,navigations:Array(6).fill({navigationType:'PRIVATE',address:{url:'https://target.test/'}}),titleChanged:'PRIVATE'});const out=h.state.fntLastClickReport.outcome.content;
 assert.equal(out.syntheticClickEvents,1000);assert.equal(out.navigationEvents,1000);assert.equal(out.elapsedMs,15000);assert.equal(out.navigations.length,4);assert.equal(out.limited,true);assert.equal(out.titleChanged,false);assert.equal(out.navigations[0].navigationType,'unknown');assert.doesNotMatch(JSON.stringify(out),/PRIVATE/);
});
test('report merge trims optional preview data while respecting total size cap',async()=>{
 const h=harness();const huge={nearby:[{padding:'x'.repeat(17000)}],path:Array(20).fill({padding:'x'.repeat(150)})};assert.equal((await h.start(huge)).saved,true);h.core('fnt-arm');await flush();const nav=Array(4).fill({address:{url:'https://destination.test/'+('p'.repeat(700))}});assert.equal((await h.update({navigations:nav})).saved,true);assert.ok(JSON.stringify(h.state.fntLastClickReport).length<=22000);
});
test('storage failures do not break core observer response or serialized control queue',async()=>{
 const h=harness();await h.start();h.failWrite();assert.equal(h.core('fnt-arm'),undefined);await flush();h.core('fnt-captured',{url:'https://target.test/'});await flush();assert.equal(h.state.fntLastClickReport.outcome.background.counts['capture-request'],1);assert.equal((await h.update()).saved,true);await h.control('record');assert.equal(h.state.fntRecordNextClick.token,'new-token');
});
test('removing source tab ends its correlation window',async()=>{
 const h=harness();await h.start();h.tabs.onRemoved.fire(7);await flush();assert.equal((await h.update()).saved,false);assert.equal(h.writes.length,1);
});
test('ending input category is retained without typed character data',async()=>{
 const h=harness();await h.start();await h.update({status:'new-input',endInput:{type:'keydown',keyCategory:'Shift',key:'PRIVATE_CHARACTER',value:'PRIVATE_FORM'}});
 assert.deepEqual(h.state.fntLastClickReport.outcome.content.endInput,{type:'keydown',keyCategory:'Shift'});assert.doesNotMatch(JSON.stringify(h.state.fntLastClickReport),/PRIVATE/);
});
test('unknown ending keys and mouse buttons become safe categories',async()=>{
 for(const ending of [{type:'keydown',keyCategory:'PRIVATE_TYPED'},{type:'mousedown',button:1,key:'PRIVATE_TYPED'}]){
  const h=harness();await h.start();await h.update({status:'new-input',endInput:ending});const result=h.state.fntLastClickReport.outcome.content.endInput;
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);if(ending.type==='keydown')assert.equal(result.keyCategory,'other');else assert.equal(result.button,1);
 }
});
test('copy request observation does not consume the actual handler response',async()=>{
 const h=harness();await h.start();const message={type:'fnt-isolate-start',requestId:'copy-one',beforeURL:'https://site.test/?PRIVATE',target:{label:'PRIVATE_LABEL'}};
 assert.equal(h.send(message),undefined);await flush();assert.equal(h.state.fntLastClickReport.outcome.background.counts['copy-request'],1);assert.doesNotMatch(JSON.stringify(h.state),/PRIVATE/);
 assert.equal(h.send({type:'fnt-isolate-cancel',requestId:'copy-one'}),undefined);await flush();assert.equal(h.state.fntLastClickReport.outcome.background.counts['copy-cancel-request'],1);
});
test('copy observation requires matching source frame and bounded request identity',async()=>{
 const h=harness();await h.start();for(const from of [{...h.sender,id:'foreign'},{...h.sender,frameId:9},{...h.sender,tab:{id:8}}])h.send({type:'fnt-isolate-start',requestId:'copy-one'},from);
 h.send({type:'fnt-isolate-start',requestId:''});h.send({type:'fnt-isolate-cancel',requestId:'unowned'});await flush();assert.equal(h.state.fntLastClickReport.outcome.background.events.length,0);
 h.send({type:'fnt-isolate-declined',reason:'PRIVATE_LABEL'});await flush();assert.equal(h.state.fntLastClickReport.outcome.background.counts['copy-declined'],1);assert.doesNotMatch(JSON.stringify(h.state),/PRIVATE/);
});
(async()=>{let passed=0;for(const {name,fn} of tests){try{await fn();passed++;console.log('PASS outcome background',name);}catch(error){process.exitCode=1;console.error('FAIL outcome background',name);console.error(error.stack||error);}}console.log(passed+'/'+tests.length+' outcome background checks passed (mocked events/storage).');})();


