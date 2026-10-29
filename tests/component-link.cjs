'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','component-link.js'),'utf8');
const context=vm.createContext({URL});vm.runInContext(source,context);
const find=context.FNTComponentLink.find;
const base='https://example.test/home';
function fixture({links=[{pathname:'/news/42'}],owner={},hostProps={href:undefined},baseURL=base}={}){
 const host={tag:5,stateNode:owner,memoizedProps:hostProps,return:null,child:null,sibling:null,alternate:null};
 let child=host;const layers=[];
 for(const link of links){const node={tag:0,memoizedProps:link===undefined?{}:{link},child,return:null,sibling:null,alternate:null};child.return=node;layers.push(node);child=node;}
 const container={tag:5,stateNode:{},memoizedProps:{link:{pathname:'/outside-not-owned'}},child,return:null,sibling:null};child.return=container;
 const root={tag:3,stateNode:{},child:container,return:null,sibling:null};root.stateNode.current=root;container.return=root;
 return {owner,hostProps,host,layers,container,root,args:{owner,pageOwner:owner,hostProps:[hostProps],fibers:[host],base:baseURL}};
}
function rootContexts(f, count) {
 let child=f.container;f.contexts=[];
 for(let i=0;i<count;i++){
  const node={tag:10,memoizedProps:{link:{pathname:'/outside-context-must-not-route'}},child,sibling:null,return:null,alternate:null};
  child.return=node;f.contexts.push(node);child=node;
 }
 f.root.child=child;child.return=f.root;return f;
}
function run(f){return find(f.args);}
function noRoute(f){const r=run(f);assert.equal(r.destination,null);return r.report;}
let count=0;function test(name,fn){fn();count++;console.log('PASS component link',name);}

test('reported shape resolves repeated stored link pathnames before any activation',()=>{
 const link={pathname:'/i/trending/2114492111152431201'};
 const f=fixture({links:[link,link,undefined,link,link,undefined,link]});
 const result=run(f);assert.equal(result.destination,'https://example.test/i/trending/2114492111152431201');
 assert.equal(result.report.currentFiberVerified,true);assert.equal(result.report.ownedComponents,5);
 assert.equal(result.report.uniqueAddresses,1);assert.equal(result.report.status,'owned-component-address-found');
});
test('unrelated domains and route shapes use the same generic rule',()=>{
 const f=fixture({links:[{pathname:'/catalog/release/Ω'}],baseURL:'https://unrelated.test/feed'});
 assert.equal(run(f).destination,'https://unrelated.test/catalog/release/%CE%A9');
 assert.doesNotMatch(source,/x\.com|bsky|spotify|\/i\/trending|data-testid/i);
});
test('literal link strings and complete web addresses are supported',()=>{
 for(const [link,url]of [['/other?x=1#part','https://example.test/other?x=1#part'],['https://other.test/story','https://other.test/story']])assert.equal(run(fixture({links:[link]})).destination,url);
});
test('stale expando alternate cannot replace the proven current route',()=>{
 const active=fixture({links:[{pathname:'/current'}]});
 const stale=fixture({owner:active.owner,hostProps:active.hostProps,links:[{pathname:'/stale'}]});
 stale.root.stateNode=active.root.stateNode;
 active.host.alternate=stale.host;stale.host.alternate=active.host;
 active.args.fibers=[stale.host];
 const r=run(active);assert.equal(r.destination,'https://example.test/current');assert.equal(r.report.currentCandidates,1);
});
test('a root current mismatch cannot establish currentness',()=>{
 const f=fixture();f.root.stateNode.current={};assert.equal(noRoute(f).currentFiberVerified,false);
});
test('shared current host props alone do not prove membership',()=>{
 const f=fixture();f.layers[0].child={tag:5,stateNode:{},sibling:null};
 assert.equal(noRoute(f).currentFiberVerified,false);
});
test('current host props identity must match the clicked owner record',()=>{
 const f=fixture();f.host.memoizedProps={href:undefined};assert.equal(noRoute(f).currentFiberVerified,false);
});
test('the host stateNode must be the actual clicked owner',()=>{
 const f=fixture();f.host.stateNode={};assert.equal(noRoute(f).currentFiberVerified,false);
});
test('two independently current host candidates remain ambiguous',()=>{
 const f=fixture(),other=fixture({owner:f.owner,hostProps:f.hostProps});f.args.fibers.push(other.host);
 assert.equal(noRoute(f).status,'ambiguous-current-fiber');
});
test('duplicate references to the same current host are deduplicated',()=>{
 const f=fixture();f.args.fibers.push(f.host);assert.equal(run(f).destination,'https://example.test/news/42');
});
test('extra root DOM siblings reject component ownership',()=>{
 const f=fixture();f.host.sibling={tag:5,stateNode:{},child:null,sibling:null};
 assert.equal(noRoute(f).status,'component-ownership-unverified');
});
test('root text and portal siblings cannot qualify as one owned DOM root',()=>{
 for(const tag of [4,6]){const f=fixture();f.host.sibling={tag,child:null,sibling:null};assert.equal(noRoute(f).status,'component-ownership-unverified');}
});
test('unrelated outer host properties are outside the navigation scope',()=>{
 const f=fixture({links:[undefined]});assert.equal(noRoute(f).status,'no-owned-link-address');
});
test('nested model addresses are not promoted to component link data',()=>{
 const f=fixture({links:[undefined]});f.layers[0].memoizedProps={model:{link:{pathname:'/not-a-route'}}};
 assert.equal(noRoute(f).status,'no-owned-link-address');
});
test('conflicting owned link routes are rejected',()=>{
 const f=fixture({links:[{pathname:'/first'},{pathname:'/second'}]});
 assert.equal(noRoute(f).status,'conflicting-owned-link-addresses');
});
test('query differences count as distinct routes even when reports redact values',()=>{
 const f=fixture({links:[{pathname:'/same',search:'?q=one'},{pathname:'/same',search:'?q=two'}]});
 const r=noRoute(f);assert.equal(r.status,'conflicting-owned-link-addresses');assert.equal(r.uniqueAddresses,2);
 assert.doesNotMatch(JSON.stringify(r),/\?q=one|\?q=two/);
});
test('whole link objects retain literal search and fragment parts',()=>{
 const f=fixture({links:[{pathname:'/story',search:'?view=full',hash:'#replies'}]});
 assert.equal(run(f).destination,'https://example.test/story?view=full#replies');
});
test('literal query strings are preserved without guessing object queries',()=>{
 assert.equal(run(fixture({links:[{pathname:'/search',query:'?q=hello'}]})).destination,'https://example.test/search?q=hello');
 const r=noRoute(fixture({links:[{pathname:'/search',query:{q:'PRIVATE'}}]}));
 assert.equal(r.status,'route-context-required');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('conflicting search and query values are rejected',()=>{
 const f=fixture({links:[{pathname:'/same',search:'?q=1',query:'?q=2'}]});assert.equal(noRoute(f).status,'conflicting-query-parts');
});
test('embedded and separately supplied URL parts are not silently merged',()=>{
 for(const link of [{pathname:'/x?q=1',search:''},{pathname:'/x?q=1',query:'?q=2'},{pathname:'/x#one',hash:''}])assert.equal(noRoute(fixture({links:[link]})).status,'conflicting-embedded-route-parts');
});
test('nullable optional fields and nullable wrapper link props are absent',()=>{
 const f=fixture({links:[null,{pathname:'/nullable',search:null,hash:undefined,query:undefined}]});
 assert.equal(run(f).destination,'https://example.test/nullable');
});
test('unsupported route names and parameters never become addresses',()=>{
 for(const link of [{name:'story',params:{id:'PRIVATE'}},{id:'PRIVATE'},{pathname:'/story',params:{id:'PRIVATE'}}]){
  const r=noRoute(fixture({links:[link]}));assert.equal(r.status,'route-context-required');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
 }
});
test('unknown fields are rejected without reading their values',()=>{
 let reads=0;const link={pathname:'/x'};Object.defineProperty(link,'unknown',{enumerable:true,get(){reads++;return 'PRIVATE';}});
 assert.equal(noRoute(fixture({links:[link]})).status,'route-context-required');assert.equal(reads,0);
});
test('state metadata is ignored without invoking its accessor',()=>{
 let reads=0;const link={pathname:'/x',replace:true};Object.defineProperty(link,'state',{enumerable:true,get(){reads++;return {id:'PRIVATE'};}});
 assert.equal(run(fixture({links:[link]})).destination,'https://example.test/x');assert.equal(reads,0);
});
test('relative unsafe credentialed and template routes are rejected',()=>{
 const bad=['next','../next','//other.test/x','javascript:bad()','https://user:pass@example.test/x','/story/:id','/story/[id]','/story/{id}','/story/*rest','/story/%5Bid%5D','/\\other.test/x'];
 for(const link of bad)noRoute(fixture({links:[link]}));
});
test('nonliteral link values are never coerced or called',()=>{
 let calls=0;const link={toString(){calls++;return '/bad';}};
 for(const value of [false,123,()=>{calls++;return '/bad';},link])noRoute(fixture({links:[value]}));assert.equal(calls,0);
});
test('link pathname and internal getters are skipped without invocation',()=>{
 let calls=0;const link={};Object.defineProperty(link,'pathname',{enumerable:true,get(){calls++;return '/bad';}});
 assert.equal(noRoute(fixture({links:[link]})).status,'accessor-skipped');assert.equal(calls,0);
 const f=fixture();Object.defineProperty(f.root.stateNode,'current',{get(){calls++;return f.root;}});
 assert.equal(noRoute(f).status,'accessor-skipped');assert.equal(calls,0);
});
test('a link getter cannot manufacture a component destination',()=>{
 let calls=0;const f=fixture({links:[undefined]});Object.defineProperty(f.layers[0].memoizedProps,'link',{get(){calls++;return {pathname:'/bad'};}});
 assert.equal(noRoute(f).status,'accessor-skipped');assert.equal(calls,0);
});
test('proxy reflection failures are contained without private error details',()=>{
 let calls=0;const link=new Proxy({}, {ownKeys(){calls++;throw Error('PRIVATE_REFLECTION_ERROR');}});
 const r=noRoute(fixture({links:[link]}));assert.equal(r.status,'reflection-error');assert.equal(r.readErrors,true);assert.ok(calls>0);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_REFLECTION_ERROR/);
});
test('fiber membership and ownership cycles cannot qualify',()=>{
 const membership=fixture();const wrong={tag:0};wrong.sibling=wrong;membership.layers[0].child=wrong;
 assert.equal(noRoute(membership).status,'fiber-cycle');
 const roots=fixture();roots.host.sibling=roots.host;assert.equal(noRoute(roots).status,'fiber-cycle');
 const selfAlternate=fixture();selfAlternate.host.alternate=selfAlternate.host;assert.equal(noRoute(selfAlternate).status,'fiber-cycle');
});
test('nonobject child or sibling pointers reject incomplete ownership',()=>{
 const f=fixture();f.host.sibling=()=>null;assert.equal(noRoute(f).status,'invalid-fiber-shape');
});
test('depth and component scope limits are explicit',()=>{
 const scope=fixture({links:Array.from({length:25},()=>undefined)});const r=noRoute(scope);assert.equal(r.status,'component-scope-limit');assert.equal(r.limited,true);
 const deep=rootContexts(fixture(),1100);const limited=noRoute(deep);assert.equal(limited.status,'current-path-limit');assert.equal(limited.limited,true);assert.equal(limited.currentFiberVerified,false);assert.equal(limited.maxPathDepth,1024);assert.ok(limited.membershipChecks<=8192);
});
test('large sibling ownership traversals fail rather than guess',()=>{
 const f=fixture();let node=f.host;
 for(let i=0;i<130;i++){node.sibling={tag:0,child:null,sibling:null};node=node.sibling;}
 const r=noRoute(f);assert.equal(r.status,'ownership-limit');assert.equal(r.limited,true);
});
test('excess input records and route keys explicitly stop inspection',()=>{
 const f=fixture();f.args.fibers=[f.host,f.host,f.host];assert.equal(noRoute(f).status,'host-record-limit');
 const link={pathname:'/x'};for(let i=0;i<20;i++)link['key'+i]=null;
 assert.equal(noRoute(fixture({links:[link]})).status,'route-key-limit');
});
test('report redacts URL query values fragments and credentials',()=>{
 const f=fixture({links:[{pathname:'/private/path',search:'?secret=PRIVATE_QUERY',hash:'#PRIVATE_HASH'}]});
 const r=run(f);assert.ok(r.destination.includes('PRIVATE_QUERY'));assert.doesNotMatch(JSON.stringify(r.report),/PRIVATE_QUERY|PRIVATE_HASH/);
 assert.equal(r.report.candidates[0].address.hadQuery,true);assert.equal(r.report.candidates[0].address.hadFragment,true);
});
test('large repeated routes keep the complete decision and cap the report',()=>{
 const pathname='/long/'+'p'.repeat(700);const f=fixture({links:Array.from({length:10},()=>({pathname}))});
 const r=run(f);assert.equal(r.destination,'https://example.test'+pathname);assert.ok(JSON.stringify(r.report).length<=5000);assert.equal(r.report.sizeLimited,true);
});
test('the mounted root is checked again after route reflection',()=>{
 const f=fixture();let traps=0;
 f.layers[0].memoizedProps.link=new Proxy({pathname:'/x'},{ownKeys(target){traps++;f.root.stateNode.current={};return Reflect.ownKeys(target);}});
 const r=noRoute(f);assert.equal(r.status,'current-root-changed');assert.equal(traps,1);
});
test('the global membership budget stops large sibling scans',()=>{
 const f=fixture({links:Array.from({length:12},()=>undefined)});
 for(const parent of f.layers){const actual=parent.child;let first=null,last=null;for(let i=0;i<700;i++){const n={tag:0,child:null,sibling:null};if(last)last.sibling=n;else first=n;last=n;}last.sibling=actual;parent.child=first;}
 const r=noRoute(f);assert.equal(r.status,'membership-limit');assert.equal(r.limited,true);
});

test('deep root context chains preserve the stored owned route without widening navigation scope',()=>{
 for(const depth of [300,900]){
  const f=rootContexts(fixture({links:[{pathname:'/deep/correct'},{pathname:'/deep/correct'}]}),depth);
  const result=run(f);assert.equal(result.destination,'https://example.test/deep/correct');
  assert.equal(result.report.currentFiberVerified,true);assert.equal(result.report.ownedComponents,2);
  assert.equal(result.report.currentPathLimit,1024);assert.equal(result.report.membershipLimit,8192);
  assert.ok(result.report.maxPathDepth>128);assert.ok(result.report.maxPathDepth<=1024);
  assert.ok(result.report.membershipChecks<=8192);assert.equal(result.report.limited,false);
 }
});
test('deep current alternate is selected while a stale route is ignored',()=>{
 const active=rootContexts(fixture({links:[{pathname:'/deep/current'}]}),300);
 const stale=rootContexts(fixture({owner:active.owner,hostProps:active.hostProps,links:[{pathname:'/deep/stale'}]}),300);
 stale.root.stateNode=active.root.stateNode;active.host.alternate=stale.host;stale.host.alternate=active.host;active.args.fibers=[stale.host];
 const result=run(active);assert.equal(result.destination,'https://example.test/deep/current');
 assert.equal(result.report.currentCandidates,1);assert.equal(result.report.currentFiberVerified,true);
 assert.ok(result.report.maxPathDepth>128);assert.equal(result.report.limited,false);
});
test('a deeply nested wrong current root is rejected without exhausting the budget',()=>{
 const f=rootContexts(fixture(),900);f.root.stateNode.current={};
 const result=noRoute(f);assert.equal(result.currentFiberVerified,false);assert.equal(result.limited,false);
 assert.ok(result.maxPathDepth>128);assert.ok(result.membershipChecks<=8192);
});


test('typed anchorless flags preserve complete explicit destinations',()=>{
 for(const [label,props]of [['absent',{}],['true',{anchorless:true}],['false',{anchorless:false}],['null',{anchorless:null}],['undefined',{anchorless:undefined}]]){
  const link={pathname:'/typed/story',search:'?view=full&secret=PRIVATE_QUERY',hash:'#PRIVATE_FRAGMENT',...props};
  const result=run(fixture({links:[link]}));
  assert.equal(result.destination,'https://example.test/typed/story?view=full&secret=PRIVATE_QUERY#PRIVATE_FRAGMENT',label);
  assert.equal(result.report.status,'owned-component-address-found',label);
  const candidate=result.report.candidates[0];
  if(label!=='absent')assert.equal(candidate.types.anchorless,props.anchorless===null?'null':typeof props.anchorless,label);
  assert.doesNotMatch(JSON.stringify(result.report),/PRIVATE_QUERY|PRIVATE_FRAGMENT/);
 }
 const query=run(fixture({links:[{anchorless:true,pathname:'/typed/query',query:'?q=one%20two'}]}));
 assert.equal(query.destination,'https://example.test/typed/query?q=one%20two');
});
test('nonboolean anchorless metadata is rejected without calling or coercing it',()=>{
 let calls=0;
 const object={toString(){calls++;return 'true';},toJSON(){calls++;return true;}};
 for(const value of ['PRIVATE_FLAG',0,1,object,[],()=>{calls++;return true;}]){
  const report=noRoute(fixture({links:[{anchorless:value,pathname:'/must-not-open'}]}));
  assert.equal(report.status,'invalid-anchorless-metadata');
  assert.equal(report.candidates[0].types.anchorless,typeof value);
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_FLAG|toString|toJSON/);
 }
 assert.equal(calls,0);
});
test('an anchorless accessor is skipped without executing its getter',()=>{
 let reads=0;const link={pathname:'/must-not-open'};
 Object.defineProperty(link,'anchorless',{enumerable:true,get(){reads++;return true;}});
 const report=noRoute(fixture({links:[link]}));
 assert.equal(report.status,'accessor-skipped');assert.equal(reads,0);assert.ok(report.accessorsSkipped>0);
});
test('recognizing anchorless does not permit other unknown boolean metadata',()=>{
 for(const name of ['locale','routeFlag']){
  let reads=0;const link={pathname:'/must-not-open',anchorless:true};
  Object.defineProperty(link,name,{enumerable:true,get(){reads++;return true;}});
  const report=noRoute(fixture({links:[link]}));
  assert.equal(report.status,'route-context-required');assert.equal(reads,0);
  assert.equal(noRoute(fixture({links:[{pathname:'/must-not-open',anchorless:false,[name]:true}]})).status,'route-context-required');
 }
});
test('anchorless cannot manufacture missing paths or bypass unsupported route context',()=>{
 for(const link of [{anchorless:true},{anchorless:false,pathname:undefined}])assert.equal(noRoute(fixture({links:[link]})).status,'literal-pathname-required');
 for(const link of [{anchorless:true,pathname:'/x',query:{secret:'PRIVATE_QUERY_OBJECT'}},{anchorless:false,pathname:'/x',params:{id:'PRIVATE_PARAM'}}]){
  const report=noRoute(fixture({links:[link]}));assert.equal(report.status,'route-context-required');
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE_QUERY_OBJECT|PRIVATE_PARAM/);
 }
});
test('different anchorless flags may agree on one address while route conflicts still reject',()=>{
 const same=fixture({links:[{anchorless:true,pathname:'/same',search:'?view=full'},{anchorless:false,pathname:'/same',search:'?view=full'}]});
 const accepted=run(same);assert.equal(accepted.destination,'https://example.test/same?view=full');assert.equal(accepted.report.uniqueAddresses,1);
 const different=fixture({links:[{anchorless:true,pathname:'/same',search:'?view=one'},{anchorless:false,pathname:'/same',search:'?view=two'}]});
 assert.equal(noRoute(different).status,'conflicting-owned-link-addresses');
});
test('anchorless flags remain subject to currentness and sole DOM ownership',()=>{
 const stale=fixture({links:[{anchorless:true,pathname:'/must-not-open'}]});stale.root.stateNode.current={};
 assert.equal(noRoute(stale).currentFiberVerified,false);
 const sibling=fixture({links:[{anchorless:false,pathname:'/must-not-open'}]});
 sibling.host.sibling={tag:5,stateNode:{},child:null,sibling:null};
 assert.equal(noRoute(sibling).status,'component-ownership-unverified');
});

console.log(count+' owned component-link checks passed (read-only graph simulations; native Firefox verification still required).');
