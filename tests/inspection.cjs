'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const ctx=vm.createContext({URL,Date});
vm.runInContext(fs.readFileSync(path.join(root,'resolver.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'inspection.js'),'utf8'),ctx);
const clean=value=>JSON.parse(JSON.stringify(value));
let count=0;
function test(name,fn){fn();count++;console.log('PASS inspection',name);}
function matches(node,selector){return selector==='a[href]'?node.localName==='a'&&node.hasAttribute('href'):selector==='time'&&node.localName==='time';}
function el(tag,attrs={},children=[]){
 const node={nodeType:1,localName:tag,attrs,children,parentElement:null,
  getAttribute(name){return Object.hasOwn(this.attrs,name)?this.attrs[name]:null;},
  hasAttribute(name){return Object.hasOwn(this.attrs,name);},
  querySelectorAll(selector){const found=[];const visit=n=>{for(const child of n.children){if(matches(child,selector))found.push(child);visit(child);}};visit(this);return found;},
  closest(selector){for(let n=this;n;n=n.parentElement)if(matches(n,selector))return n;return null;},
  contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;},
  getRootNode(){return this.ownerDocument;}};
 for(const child of children)child.parentElement=node;return node;
}
function prepare(target){let top=target;while(top.parentElement)top=top.parentElement;const ids=new Map();const doc={getElementById:id=>ids.get(id)||null};
 const visit=n=>{n.ownerDocument=doc;if(n.hasAttribute('id'))ids.set(n.getAttribute('id'),n);for(const child of n.children)visit(child);};visit(top);
 const nodes=[];for(let n=target;n;n=n.parentElement)nodes.push(n);return nodes;}
function inspect(target,base='https://example.test/feed'){return clean(ctx.FNTInspection.inspect(prepare(target),base));}
function resolve(target){return ctx.FNT.resolve(prepare(target),'https://example.test/feed','https://example.test/feed');}
function fixture(anchors=[]){const label=el('span',{id:'title-rel'});const wrap=el('div',{role:'link','aria-labelledby':'title-rel'},[label,...anchors]);return {label,wrap};}
test('reported long decorative card gives a complete zero-anchor census',()=>{
 const f=fixture(Array.from({length:90},()=>el('div',{},[el('span')])));const r=inspect(f.label);
 assert.equal(resolve(f.label),null);assert.equal(r.componentPathIndex,1);assert.equal(r.anchorScan.total,0);assert.equal(r.anchorScan.limited,false);assert.equal(r.evidence,'no-usable-owned-anchors');
 assert.equal(r.labelTargets[0].found,true);assert.equal(r.labelTargets[0].insideOwner,true);assert.equal(r.labelTargets[0].node.tag,'span');
});
test('owned anchor after decorative elements is inspected without the old breadth limit',()=>{
 const f=fixture([...Array.from({length:90},()=>el('div')),el('a',{href:'/records/8'})]);const r=inspect(f.label);
 assert.equal(resolve(f.label),'https://example.test/records/8');assert.equal(r.anchorScan.total,1);assert.equal(r.anchorScan.uniqueOwnedRoutes,1);assert.equal(r.evidence,'one-owned-destination');
});
test('multiple routes explain ambiguity without selecting a destination',()=>{
 const f=fixture([el('a',{href:'/one'}),el('a',{href:'/two'})]);const r=inspect(f.label);
 assert.equal(resolve(f.label),null);assert.equal(r.evidence,'multiple-owned-destinations');assert.equal(r.anchorScan.uniqueOwnedRoutes,2);assert.equal(Object.hasOwn(r,'destination'),false);
});
test('duplicate anchors retain one unique route',()=>{
 const f=fixture([el('a',{href:'/one'}),el('a',{href:'/one'})]);const r=inspect(f.label);
 assert.equal(r.anchorScan.validOwned,2);assert.equal(r.anchorScan.uniqueOwnedRoutes,1);
});
test('nested action and nested component anchors do not count as owned',()=>{
 const f=fixture([el('button',{type:'button'},[el('a',{href:'/action'})]),el('article',{},[el('a',{href:'/quoted'})])]);const r=inspect(f.label);
 assert.equal(r.anchorScan.total,2);assert.equal(r.anchorScan.excludedNested,2);assert.equal(r.anchorScan.validOwned,0);
});
test('label association reports containing anchor',()=>{
 const label=el('span',{id:'label'}),anchor=el('a',{href:'/title'},[label]);const owner=el('article',{'aria-labelledby':'label'},[anchor]);const r=inspect(label);
 assert.equal(r.labelTargets[0].closestAnchor.url.url,'https://example.test/title');assert.equal(r.labelTargets[0].closestAnchor.owned,true);assert.equal(r.labelTargets[0].insideOwner,true);
});
test('label containing an anchor is distinguished from label enclosed by one',()=>{
 const target=el('span'),label=el('h2',{id:'heading'},[el('a',{href:'/title'})]);el('div',{role:'link','aria-labelledby':'heading'},[target,label,el('a',{href:'/other'})]);const r=inspect(target);
 assert.equal(resolve(target),null);assert.equal(r.labelTargets[0].closestAnchor,null);assert.equal(r.labelTargets[0].anchorsInside.total,1);assert.equal(r.labelTargets[0].anchorsInside.samples[0].owned,true);
});
test('missing and external label targets are explicit',()=>{
 const target=el('span'),external=el('span',{id:'external'}),owner=el('div',{role:'link','aria-labelledby':'missing external'},[target]);el('main',{},[owner,external]);const r=inspect(target);
 assert.equal(r.labelTargets[0].found,false);assert.equal(r.labelTargets[1].found,true);assert.equal(r.labelTargets[1].insideOwner,false);
});
test('editable disabled nested-action and submit exclusions are shown',()=>{
 const target=el('button',{type:'submit',disabled:''});target.isContentEditable=true;el('div',{role:'link'},[target]);const r=inspect(target);
 assert.deepEqual(r.exclusions,{disabled:true,editable:true,nestedAction:true,submitOrReset:true});
});
test('URLs strip query keys values credentials and fragments from every sample',()=>{
 const f=fixture([el('a',{href:'https://name:PRIVATE_PASSWORD@example.test/a?PRIVATE_KEY=PRIVATE_VALUE#PRIVATE_FRAGMENT'}),el('a',{href:'/b?PRIVATE_KEY=PRIVATE_VALUE#PRIVATE_FRAGMENT'})]);const r=inspect(f.label);
 const text=JSON.stringify(r);assert.doesNotMatch(text,/PRIVATE|name:/);assert.equal(r.anchorScan.samples[0].usable,false);assert.equal(r.anchorScan.samples[0].url.url,'https://example.test/a');assert.equal(r.anchorScan.samples[1].url.hadQuery,true);
});
test('malformed and non-http links are unusable, not execution or scan errors',()=>{
 const f=fixture([el('a',{href:'javascript:PRIVATE'}),el('a',{href:'http://['}),el('a',{href:'#'})]);const r=inspect(f.label);
 assert.equal(r.anchorScan.unusable,3);assert.equal(r.readErrors,false);assert.equal(r.evidence,'no-usable-owned-anchors');assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('anchor work and samples are bounded with incomplete evidence',()=>{
 const f=fixture(Array.from({length:300},(_,i)=>el('a',{href:'/item/'+i})));const r=inspect(f.label);
 assert.equal(r.anchorScan.total,300);assert.equal(r.anchorScan.inspected,200);assert.equal(r.anchorScan.samples.length,6);assert.equal(r.anchorScan.limited,true);assert.equal(r.evidence,'inspection-incomplete');
});
test('label references and child-anchor samples are bounded',()=>{
 const target=el('span'),labels=Array.from({length:8},(_,i)=>el('h2',{id:'head'+i},Array.from({length:6},(_,j)=>el('a',{href:'/a/'+i+'/'+j}))));el('div',{role:'link','aria-labelledby':labels.map(n=>n.attrs.id).join(' ')},[target,...labels]);const r=inspect(target);
 assert.equal(r.labelTargets.length,4);assert.equal(r.labelTargetsLimited,true);assert.equal(r.labelTargets[0].anchorsInside.samples.length,2);assert.equal(r.labelTargets[0].anchorsInside.total,6);assert.equal(r.labelTargets[0].anchorsInside.limited,true);
});
test('query errors stay local and cannot be confused with absence',()=>{
 const f=fixture();f.wrap.querySelectorAll=()=>{throw Error('PRIVATE_QUERY_ERROR');};const r=inspect(f.label);
 assert.equal(r.anchorScan.total,null);assert.equal(r.readErrors,true);assert.equal(r.evidence,'inspection-incomplete');assert.doesNotMatch(JSON.stringify(r),/PRIVATE_QUERY_ERROR/);
});
test('private text form values handler code and framework fields are not read',()=>{
 const f=fixture([el('a',{href:'/one'})]);for(const node of new Set([f.label,f.wrap,...f.wrap.children]))for(const key of ['textContent','innerText','outerHTML','value','name','onclick','__reactProps$private'])Object.defineProperty(node,key,{get(){throw Error('PRIVATE_PROPERTY_READ');}});
 const r=inspect(f.label);assert.equal(r.readErrors,false);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_PROPERTY_READ/);
});
test('no-semantic-owner report is explicit and invokes no activation',()=>{
 const target=el('span');target.click=()=>{throw Error('ACTIVATED');};const r=inspect(target);assert.equal(r.evidence,'no-semantic-component');assert.equal(r.component,null);
});
test('bookmark and timestamp candidates are counted as marked',()=>{
 const f=fixture([el('a',{href:'/bookmark',rel:'bookmark'}),el('a',{href:'/time'},[el('time',{datetime:'2026-10-25'})]),el('a',{href:'/locale','aria-label':'25 October 2026 at 22:58'})]);const r=inspect(f.label);
 assert.equal(r.anchorScan.markedOwned,3);assert.equal(r.anchorScan.uniqueMarkedRoutes,3);
});
test('deep timestamp candidate scan explicitly marks partial inspection',()=>{
 const anchor=el('a',{href:'/entry'},[...Array.from({length:20},()=>el('time')),el('time',{datetime:'2026-10-25'})]);
 const f=fixture([anchor]);const r=inspect(f.label);assert.equal(r.anchorScan.validOwned,1);assert.equal(r.anchorScan.limited,true);assert.equal(r.evidence,'inspection-incomplete');
});
test('report remains bounded for long routes and relationship identifiers',()=>{
 const labelNodes=Array.from({length:4},(_,i)=>el('h2',{id:'heading-'+i},Array.from({length:3},(_,j)=>el('a',{href:'/route/'+i+'/'+j+'x'.repeat(700)}))));
 const target=el('span');el('div',{role:'link','aria-labelledby':labelNodes.map(n=>n.attrs.id).join(' ')},[target,...labelNodes]);
 const r=inspect(target);assert.ok(JSON.stringify(r).length<=8000);assert.equal(r.sizeLimited,true);
});
console.log(count+' inspection checks passed (read-only DOM simulations; no Firefox integration claim).');
