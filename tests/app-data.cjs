'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'app-data.js'),'utf8');
const core=fs.readFileSync(path.join(root,'resolver.js'),'utf8');
const base='https://example.test/start';
const clean=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function element(tag='div',attrs={},children=[]){
 const node={nodeType:1,localName:tag,attrs:{...attrs},children,parentElement:null,isContentEditable:false,
 getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;},hasAttribute(name){return Object.hasOwn(this.attrs,name);},
 querySelectorAll(selector){const found=[];function visit(current){for(const child of current.children){if(selector==='a[href]'&&child.localName==='a'&&child.hasAttribute('href'))found.push(child);if(selector==='img'&&child.localName==='img')found.push(child);if(selector==='time'&&child.localName==='time')found.push(child);visit(child);}}visit(this);return found;},
 contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;},
 closest(selector){for(let n=this;n;n=n.parentElement)if(selector==='a[href]'&&n.localName==='a'&&n.hasAttribute('href'))return n;return null;},
 getRootNode(){return {getElementById(){return null;}};}};
 for(const child of children)child.parentElement=node;
 node.wrappedJSObject=node;return node;
}
function card(props={},attrs={}){const child=element('span'),owner=element('div',{role:'link',...attrs},[child]);owner.__reactProps$fixture=props;return {owner,child,path:[child,owner]};}
function harness({initial,ordinary=()=>null,real=false,get}={}){
 const listeners=[],gets=[];
 const context=vm.createContext({URL,Date,Promise,fetch(){throw Error('network');},XMLHttpRequest(){throw Error('network');},
 browser:{storage:{onChanged:{addListener:fn=>listeners.push(fn)},local:{get(value){gets.push(value);return get?get(value):Promise.resolve({fntAppDataEnabled:initial});}}}}});
 if(real)vm.runInContext(core,context);else context.FNT=Object.freeze({safeURL:(raw,b=base)=>new URL(raw,b).href,resolve:ordinary});
 const original=context.FNT;
 vm.runInContext(source,context,{filename:'app-data.js'});
 return {context,original,gets,listeners,inspect:(p,b=base)=>clean(context.FNTAppData.inspect(p,b)),resolve:(p,b=base)=>context.FNT.resolve(p,b,b),
 change(value,area='local',key='fntAppDataEnabled'){for(const fn of listeners)fn({[key]:{newValue:value}},area);}};
}
let passed=0;const tests=[];function test(name,fn){tests.push({name,fn});}
test('fresh installation resolves immediately without storage or feature switches',async()=>{
 const h=harness(),f=card({href:'/target'});
 assert.equal(h.resolve(f.path),'https://example.test/target');await flush();assert.equal(h.resolve(f.path),'https://example.test/target');
 assert.equal(h.gets.length,0);assert.equal(h.listeners.length,0);
 assert.equal(h.context.FNT.safeURL,h.original.safeURL);assert.ok(Object.isFrozen(h.context.FNT));
});
test('a successful ordinary destination bypasses app data in both resolve and inspect',async()=>{
 const h=harness({ordinary:()=>'/ordinary'}),f=card({href:'/other'});let touched=0;
 Object.defineProperty(f.owner,'wrappedJSObject',{get(){touched++;throw Error('private');}});await flush();
 assert.equal(h.resolve(f.path),'/ordinary');assert.equal(h.inspect(f.path).report.status,'dom-resolved');assert.equal(touched,0);
});
test('automatic routing opens a unique explicit current React host href',async()=>{
 const h=harness({}),f=card({href:'/entries/123?sort=new#reply'});await flush();
 assert.equal(h.resolve(f.path),'https://example.test/entries/123?sort=new#reply');
 const r=h.inspect(f.path);assert.equal(r.report.modeEnabled,true);assert.equal(r.report.status,'exact-host-address-found');assert.equal(r.report.uniqueExactHostAddresses,1);
});
test('legacy saved false cannot disable automatic routes or their inspection',async()=>{
 const h=harness({initial:false}),f=card({to:'/entries/42'});await flush();
 assert.equal(h.resolve(f.path),'https://example.test/entries/42');const r=h.inspect(f.path);assert.equal(r.destination,'https://example.test/entries/42');assert.equal(r.report.modeEnabled,true);assert.equal(h.gets.length,0);
});
test('known real links, cards and images retain actual original resolver results',async()=>{
 const h=harness({real:true});await flush();
 const image=element('img',{src:'https://media.example.test/photo.jpg'}),link=element('a',{href:'/record'},[image]);
 Object.defineProperty(link,'wrappedJSObject',{get(){throw Error('must not read');}});
 assert.equal(h.resolve([image,link]),'https://example.test/record');
 assert.equal(h.resolve([element('img',{src:'https://media.example.test/photo.jpg'})]),'https://media.example.test/photo.jpg');
});
test('ambiguous ordinary anchors cannot be overridden by private navigation data',async()=>{
 const h=harness({real:true}),f=card({href:'/guessed'});await flush();
 f.owner.children.push(element('a',{href:'/one'}),element('a',{href:'/two'}));for(const n of f.owner.children)n.parentElement=f.owner;
 assert.equal(h.resolve(f.path),null);assert.equal(h.inspect(f.path).report.status,'ordinary-anchor-present');
});
test('empty unsafe and placeholder explicit DOM metadata keep precedence',async()=>{
 const h=harness({real:true});await flush();
 for(const attrs of [{'data-url':''},{'data-href':'javascript:bad()'},{href:'#'}]){const f=card({href:'/private'},attrs);assert.equal(h.resolve(f.path),null);assert.equal(h.inspect(f.path).report.status,'dom-metadata-present');}
});
test('only the nearest semantic component may supply a private route',async()=>{
 const h=harness({}),f=card({href:'/outer'}),li=element('li',{},[f.child]);f.owner.children=[li];li.parentElement=f.owner;await flush();
 assert.equal(h.resolve([f.child,li,f.owner]),null);assert.equal(h.inspect([f.child,li,f.owner]).report.status,'explicit-link-owner-required');
});
test('buttons forms editable disabled and nested action controls are excluded',async()=>{
 const h=harness({});await flush();
 const cases=[element('button'),element('form'),element('input'),element('textarea'),element('select'),element('label'),element('summary'),element('div',{role:'button'}),element('div',{'aria-disabled':'true'}),element('div',{disabled:''})];
 const editable=element();editable.isContentEditable=true;cases.push(editable);
 for(const target of cases){const f=card({href:'/private'});target.parentElement=f.owner;assert.equal(h.resolve([target,f.owner]),null);assert.equal(h.inspect([target,f.owner]).report.status,'action-form-or-editable-exclusion');}
});
test('a button pretending to be a link is still excluded',async()=>{
 const h=harness({}),owner=element('button',{role:'link'});owner.__reactProps$fixture={href:'/bad'};await flush();assert.equal(h.resolve([owner]),null);
});
test('current host to accepts root and complete HTTP addresses',async()=>{
 const h=harness({});await flush();
 for(const [to,expected] of [['/one','https://example.test/one'],['https://other.test/two','https://other.test/two'],['http://other.test/three','http://other.test/three']])assert.equal(h.resolve(card({to}).path),expected);
});
test('framework-relative addresses and non-web schemes are not guessed',async()=>{
 const h=harness({});await flush();
 for(const to of ['next','../next','?x=1','#dialog','//other.test/path','javascript:bad()','data:text/plain,a','custom:thing'])assert.equal(h.resolve(card({to}).path),null,to);
});
test('credentials malformed URLs and route templates are rejected',async()=>{
 const h=harness({});await flush();
 for(const href of ['https://u:p@example.test/path','http://[','/entries/:id','/entries/[id]','/entries/{id}','/entries/*rest','/entries/%5Bid%5D'])assert.equal(h.resolve(card({href}).path),null,href);
});
test('structured to uses only literal pathname search and hash',async()=>{
 const h=harness({});await flush();
 assert.equal(h.resolve(card({to:{pathname:'/entries/3',search:'?q=a',hash:'#reply'}}).path),'https://example.test/entries/3?q=a#reply');
 for(const to of [{pathname:'relative'},{pathname:'/x',query:{q:1}},{name:'entry',params:{id:1}},{pathname:'/x',search:1},{pathname:'/x',hash:'bad'},{path:'/x'}])assert.equal(h.resolve(card({to}).path),null);
});
test('conflicting host addresses and distinct query routes are rejected',async()=>{
 const h=harness({});await flush();
 for(const props of [{href:'/one',to:'/two'},{href:'/same?q=1',to:'/same?q=2'}]){const f=card(props);assert.equal(h.resolve(f.path),null);assert.equal(h.inspect(f.path).report.status,'conflicting-exact-host-addresses');}
 assert.equal(h.resolve(card({href:'/same',to:'/same'}).path),'https://example.test/same');
});
test('an invalid second navigation field prevents silently selecting the first',async()=>{
 const h=harness({});await flush();assert.equal(h.resolve(card({href:'/one',to:{name:'other'}}).path),null);
});
test('ordinary getters and handlers are never deliberately called',async()=>{
 const h=harness({});let calls=0;const props={onClick(){calls++;throw Error('clicked');},id:'DO_NOT_COPY_ID'};
 Object.defineProperty(props,'href',{enumerable:true,get(){calls++;return '/private';}});await flush();
 const r=h.inspect(card(props).path);assert.equal(r.destination,null);assert.equal(r.report.status,'exact-host-address-rejected');assert.ok(r.report.accessorsSkipped>0);assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(r),/DO_NOT_COPY_ID/);
});
test('route objects do not invoke getters or coercion methods',async()=>{
 const h=harness({});let calls=0;const to={pathname:'/ok',toString(){calls++;return '/bad';}};
 Object.defineProperty(to,'search',{enumerable:true,get(){calls++;return '?private=1';}});await flush();
 assert.equal(h.resolve(card({to}).path),null);assert.equal(calls,0);
});
test('a proxy reflection trap is reported rather than claimed harmless',async()=>{
 const h=harness({});let traps=0;const f=card();f.owner.wrappedJSObject=new Proxy({}, {ownKeys(){traps++;throw Error('PRIVATE_TRAP_MESSAGE');}});await flush();
 assert.equal(h.resolve(f.path),null);const r=h.inspect(f.path);assert.ok(traps>0);assert.equal(r.report.readErrors,true);assert.equal(r.report.reflectionMayRunProxyTraps,true);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_TRAP_MESSAGE/);
});
test('a host props accessor cannot execute to manufacture a route',async()=>{
 const h=harness({}),f=card();let calls=0;delete f.owner.__reactProps$fixture;
 Object.defineProperty(f.owner,'__reactProps$fixture',{get(){calls++;return {href:'/bad'};}});await flush();assert.equal(h.resolve(f.path),null);assert.equal(calls,0);
});
test('changing current props revalidates the destination on each resolution',async()=>{
 const h=harness({}),f=card({href:'/one'});await flush();assert.equal(h.resolve(f.path),'https://example.test/one');f.owner.__reactProps$fixture={href:'/two'};assert.equal(h.resolve(f.path),'https://example.test/two');
});
test('ancestor and stale fiber addresses are evidence only',async()=>{
 const h=harness({}),f=card({onClick(){throw Error('handler');}});f.owner.__reactFiber$fixture={stateNode:f.owner,tag:5,memoizedProps:{},return:{tag:0,memoizedProps:{to:'/ancestor'},return:null}};await flush();
 const r=h.inspect(f.path);assert.equal(r.destination,null);assert.equal(r.report.status,'evidence-only');assert.ok(r.report.candidates.some(c=>c.source.startsWith('react-fiber')&&c.address?.url==='https://example.test/ancestor'));assert.equal(h.resolve(f.path),null);
});
test('fiber traversal stops before an outside DOM host ancestor',async()=>{
 const h=harness(),f=card();f.owner.__reactFiber$fixture={stateNode:f.owner,tag:5,memoizedProps:{},return:{tag:5,stateNode:element(),memoizedProps:{href:'/OUTSIDE'},return:null}};
 const r=h.inspect(f.path);assert.doesNotMatch(JSON.stringify(r),/OUTSIDE/);assert.equal(r.destination,null);
});
test('identifier-only props never manufacture a route or expose identifier values',async()=>{
 const h=harness({}),f=card({storyId:'PRIVATE_ID',item:{rest_id:'PRIVATE_REST',title:'PRIVATE_TITLE'},onPress(){throw Error('handler');}});await flush();
 const r=h.inspect(f.path);assert.equal(r.destination,null);assert.ok(r.report.identifierFields>=2);assert.equal(r.report.status,'no-explicit-address-found');assert.doesNotMatch(JSON.stringify(r),/PRIVATE_ID|PRIVATE_REST|PRIVATE_TITLE/);
});
test('arbitrary model media or profile URLs remain evidence only',async()=>{
 const h=harness({}),f=card({item:{url:'https://media.test/picture?private=VALUE',profile:{url:'https://people.test/profile'}}});await flush();
 const r=h.inspect(f.path);assert.equal(r.destination,null);assert.equal(r.report.status,'evidence-only');assert.ok(r.report.candidateCount>0);assert.doesNotMatch(JSON.stringify(r.report),/VALUE/);
});
test('missing or invisible framework markers degrade to ordinary fallback',async()=>{
 const h=harness({}),owner=element('div',{role:'link'});await flush();assert.equal(h.resolve([owner]),null);const r=h.inspect([owner]);assert.equal(r.report.frameworks.length,0);assert.equal(r.destination,null);
});
test('Vue navigation data is recorded as evidence without automatic routing',async()=>{
 const h=harness({}),owner=element('div',{role:'link'});owner.__vnode={props:{to:'/vue-route'}};owner.__vueParentComponent={props:{href:'/component-route'}};await flush();
 const r=h.inspect([owner]);assert.deepEqual(r.report.frameworks,['vue']);assert.equal(r.destination,null);assert.equal(h.resolve([owner]),null);assert.equal(r.report.status,'evidence-only');
});
test('sensitive unrelated fields are not read or copied into a report',()=>{
 const h=harness(),props={to:'/route?secret=DO_NOT_COPY_QUERY#DO_NOT_COPY_HASH',item:{title:'DO_NOT_COPY_TITLE',id:'DO_NOT_COPY_ID'}};let calls=0;
 for(const name of ['password','cookie','authToken','sessionData','children','toJSON'])Object.defineProperty(props,name,{enumerable:true,get(){calls++;throw Error('private');}});
 const r=h.inspect(card(props).path);assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(r.report),/DO_NOT_COPY_|password|cookie|authToken|sessionData|toJSON/);
 assert.ok(r.report.candidates.some(c=>c.address?.hadQuery===true&&c.address.hadFragment===true));
});
test('bounded evidence scans do not invalidate a complete exact host address',async()=>{
 const h=harness({}),props={href:'/candidate'};for(let i=0;i<150;i++)props['field'+i]={item:{url:'/extra'+i}};await flush();
 const f=card(props),r=h.inspect(f.path);assert.equal(r.destination,'https://example.test/candidate');assert.equal(r.report.partial,true);assert.equal(r.report.hostInspectionComplete,true);assert.equal(r.report.evidenceComplete,false);assert.equal(r.report.status,'exact-host-address-found');assert.equal(h.resolve(f.path),'https://example.test/candidate');assert.ok(JSON.stringify(r.report).length<=9000);
});
test('oversized navigation addresses have bounded redacted samples',()=>{
 const h=harness(),props={};for(let i=0;i<20;i++)props['item'+i]={url:'https://example.test/'+'x'.repeat(1000)+i};
 const r=h.inspect(card(props).path);assert.ok(JSON.stringify(r.report).length<=9000);assert.ok(r.report.candidates.some(c=>c.address?.url.endsWith('[long-path-omitted]')));
});
test('pending legacy storage and later false changes cannot disable automatic routing',async()=>{
 const read=deferred(),h=harness({get:()=>read.promise}),f=card({href:'/route'});assert.equal(h.resolve(f.path),'https://example.test/route');h.change(false);
 read.resolve({fntAppDataEnabled:false});await flush();assert.equal(h.resolve(f.path),'https://example.test/route');assert.equal(h.gets.length,0);assert.equal(h.listeners.length,0);
});
test('legacy nonboolean unrelated and nonlocal settings cannot change automatic routing',async()=>{
 const h=harness(),f=card({href:'/route'});await flush();for(const [value,area,key]of [[false,'sync','fntAppDataEnabled'],[false,'local','other'],['false','local','fntAppDataEnabled'],[false,'local','fntAppDataEnabled']]){h.change(value,area,key);assert.equal(h.resolve(f.path),'https://example.test/route');}
 assert.equal(h.listeners.length,0);
});
test('automatic routing does not depend on unavailable or failed storage',async()=>{
 for(const get of [()=>{throw Error('read');},()=>Promise.reject(Error('read'))]){const h=harness({get}),f=card({href:'/route'});await flush();assert.equal(h.resolve(f.path),'https://example.test/route');assert.equal(h.gets.length,0);}
});
test('failed page access does not interrupt the ordinary unknown-control fallback',async()=>{
 const h=harness({}),f=card();Object.defineProperty(f.owner,'wrappedJSObject',{get(){throw Error('private');}});await flush();assert.equal(h.resolve(f.path),null);assert.equal(h.inspect(f.path).report.readErrors,true);
});

test('outer form editable and disabled ancestors retain the original exclusion',async()=>{
 const h=harness({});await flush();
 const ancestors=[element('form'),element('div',{disabled:''}),element('div',{'aria-disabled':'true'}),element('button',{type:'submit'}),element('button',{type:'reset'}),element('div',{role:'textbox'}),element('div',{role:'combobox'}),element('div',{role:'listbox'})];
 const editable=element();editable.isContentEditable=true;ancestors.push(editable);
 for(const ancestor of ancestors){const f=card({href:'/must-not-open'});f.owner.parentElement=ancestor;assert.equal(h.resolve([...f.path,ancestor]),null);assert.equal(h.inspect([...f.path,ancestor]).report.status,'action-form-or-editable-exclusion');}
});
test('automatic routing never reflects deep props or fiber and Vue evidence',async()=>{
 const h=harness({});let reflection=0;
 const props=new Proxy({href:'/minimal'}, {ownKeys(){reflection++;throw Error('deep reflection');}});
 const f=card(props);
 for(const key of ['__reactFiber$fixture','__vnode','__vueParentComponent'])Object.defineProperty(f.owner,key,{get(){reflection++;throw Error('evidence getter');}});
 await flush();assert.equal(h.resolve(f.path),'https://example.test/minimal');assert.equal(reflection,0);
 const report=h.inspect(f.path).report;assert.ok(reflection>0);assert.equal(report.evidenceComplete,false);assert.equal(report.hostInspectionComplete,true);
});
test('rejected bare identifier strings do not become report URLs',()=>{
 const h=harness(),r=h.inspect(card({url:'PRIVATE_IDENTIFIER',item:{path:'PRIVATE_PATH',pathname:'PRIVATE_PATHNAME',to:'PRIVATE_TO'}}).path);
 assert.equal(r.destination,null);assert.doesNotMatch(JSON.stringify(r.report),/PRIVATE_IDENTIFIER|PRIVATE_PATH|PRIVATE_PATHNAME|PRIVATE_TO/);
 for(const candidate of r.report.candidates)assert.equal(candidate.address,null);
});
test('partial owner marker lookup cannot authorize a private destination',async()=>{
 const h=harness({}),f=card({href:'/candidate'});for(let i=0;i<150;i++)f.owner['extra'+i]=true;await flush();
 assert.equal(h.resolve(f.path),null);const r=h.inspect(f.path);assert.equal(r.report.hostInspectionComplete,false);assert.equal(r.destination,null);
});
test('cyclic fiber evidence is marked partial and never supplies a route',()=>{
 const h=harness(),f=card();const fiber={stateNode:f.owner,tag:5,memoizedProps:{url:'/evidence'}};fiber.return=fiber;f.owner.__reactFiber$fixture=fiber;
 const r=h.inspect(f.path);assert.equal(r.destination,null);assert.equal(r.report.evidenceComplete,false);assert.equal(r.report.partial,true);
});


test('depth bounds are explicit and numeric identifier-map keys stay private',()=>{
 const h=harness(),r=h.inspect(card({model:{details:{nested:{url:'/TOO_DEEP'}}},indexMap:{'42':{url:'/NUMERIC_MAP_VALUE'}},items:[{url:'/array-evidence'}]}).path);
 assert.equal(r.report.partial,true);assert.equal(r.report.depthLimited,true);assert.equal(r.report.evidenceComplete,false);
 assert.doesNotMatch(JSON.stringify(r.report),/TOO_DEEP|NUMERIC_MAP_VALUE|props.indexMap.42/);
 assert.ok(r.report.candidates.some(c=>c.field==='props.items.0.url'&&c.address?.url==='https://example.test/array-evidence'));
});


test('unset host navigation props are absent while invalid present values still reject',async()=>{
 const h=harness({});await flush();
 for(const props of [{href:undefined},{href:null,to:undefined}]){
  const r=h.inspect(card(props).path);assert.equal(r.destination,null);assert.notEqual(r.report.status,'exact-host-address-rejected');assert.equal(r.report.uniqueExactHostAddresses,0);assert.equal(r.report.hostInspectionComplete,true);
 }
 const r=h.inspect(card({href:false}).path);assert.equal(r.report.status,'exact-host-address-rejected');assert.equal(r.report.candidates[0].valueType,'boolean');
});
test('disconnected and adopted controls cannot expose a private address',async()=>{
 const h=harness({});await flush();
 for(const kind of ['disconnected','adopted']){
  const f=card({href:'/must-not-open'});let reads=0;
  if(kind==='disconnected')f.owner.isConnected=false;
  else {h.context.document={};f.owner.ownerDocument={};}
  Object.defineProperty(f.owner,'wrappedJSObject',{get(){reads++;throw Error('must not unwrap');}});
  assert.equal(h.resolve(f.path),null);assert.equal(h.inspect(f.path).report.status,'disconnected-or-adopted-control');assert.equal(reads,0);
 }
});

(async()=>{for(const {name,fn} of tests){await fn();passed++;console.log('PASS app data',name);}console.log(passed+' app-data checks passed (mocked Firefox/page objects; live signed-in verification still required).');})().catch(error=>{console.error(error);process.exitCode=1;});
