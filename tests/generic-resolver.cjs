'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'resolver.js'), 'utf8');
const context = vm.createContext({URL, Date});
vm.runInContext(source, context);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS generic resolver', name); }
function match(node, selector) {
  if (selector === 'a[href]') return node.localName === 'a' && node.hasAttribute('href');
  if (selector === 'img' || selector === 'time') return node.localName === selector;
  throw Error('Unsupported mock selector ' + selector);
}
function el(tag, attrs = {}, children = [], extra = {}) {
  const node = {nodeType:1, localName:tag, attrs:{...attrs}, children, parentElement:null,
    hasAttribute(name) { return Object.hasOwn(this.attrs,name); },
    getAttribute(name) { return this.attrs[name] ?? null; },
    querySelectorAll(selector) {
      const found = [];
      const visit = current => {for (const child of current.children) {if (match(child,selector)) found.push(child); visit(child);}};
      visit(this); return found;
    },
    closest(selector) {for (let n=this;n;n=n.parentElement) if (match(n,selector)) return n; return null;},
    contains(other) {for (let n=other;n;n=n.parentElement) if (n===this) return true; return false;},
    getRootNode() {return this.ownerDocument;},
    ...extra};
  for (const child of children) child.parentElement=node;
  return node;
}
function prepare(node) {
  let root=node;while(root.parentElement)root=root.parentElement;
  const ids=new Map();
  const document={getElementById:id=>ids.get(id)||null};
  const visit=current=>{current.ownerDocument=document;if(current.hasAttribute('id'))ids.set(current.getAttribute('id'),current);for(const child of current.children)visit(child);};
  visit(root);
  const nodes=[];for(let n=node;n;n=n.parentElement)nodes.push(n);
  return nodes;
}
function resolve(node, base='https://example.test/start') {
  return context.FNT.resolve(prepare(node),base,base);
}
function card(options={}) {
  const id=options.id||'record-heading-Ω';
  const title=el('p',{id});
  const link=el('a',{href:options.href||'/records/42'},[title]);
  const artist=el('a',{href:'/people/7'},[],{textContent:'Author'});
  const image=el('img',{src:'https://media.example.test/cover.jpg'});
  const overlay=el('div',{role:'button','aria-labelledby':id+' subtitle-42'});
  const play=el('button',{'aria-label':'Play record',type:'button'});
  const owner=el(options.tag||'div',{'aria-labelledby':id,...(options.tag?{}:{role:'listitem'})},[image,overlay,link,artist,play]);
  return {owner,title,link,artist,image,overlay,play,id};
}
function post(options={}) {
  const content=el('span',{},[],{textContent:'Card text'});
  const profile=el('a',{href:'/people/7'});
  const time=el('a',{href:options.href||'/entries/89','aria-label':'25 October 2026 at 00:29'});
  const action=el('button',{type:'button','aria-label':'Reply'});
  const owner=el('div',{role:'link'},[profile,time,content,action,...(options.extra||[])]);
  return {owner,profile,time,content,action};
}
test('safe URLs remain HTTP(S) without credentials and reject placeholders',()=>{
  for(const value of ['#','','javascript:alert(1)','data:text/plain,x','https://u:p@example.test/a','http://['])
    assert.equal(context.FNT.safeURL(value,'https://example.test/'),null,value);
  assert.equal(context.FNT.safeURL('../go','https://example.test/path/'),'https://example.test/go');
});
test('real enclosing href outranks metadata and media',()=>{
  const image=el('img',{src:'https://cdn.example.test/image.jpg','data-url':'/wrong'});
  el('a',{href:'/correct'},[image]);
  assert.equal(resolve(image),'https://example.test/correct');
});
test('area href retains normal direct-link behavior',()=>{
  assert.equal(resolve(el('area',{href:'/map-target'})),'https://example.test/map-target');
});
test('placeholder anchor can still expose a literal image destination',()=>{
  const image=el('img',{src:'https://cdn.example.test/image.jpg'});el('a',{href:'#'},[image]);
  assert.equal(resolve(image),'https://cdn.example.test/image.jpg');
});
test('explicit nearest metadata outranks card inference',()=>{
  const f=card();f.overlay.attrs['data-href']='/explicit';
  assert.equal(resolve(f.overlay),'https://example.test/explicit');
});
test('empty unsafe metadata ends resolution rather than falling to another ancestor',()=>{
  const image=el('img',{src:'https://cdn.example.test/image.jpg','data-url':''});el('div',{'data-href':'/outer'},[image]);
  assert.equal(resolve(image),null);
  image.attrs['data-url']='javascript:alert(1)';assert.equal(resolve(image),null);
});
test('shared accessible title selects navigation instead of artwork or author',()=>{
  const f=card();assert.equal(resolve(f.overlay),'https://example.test/records/42');
  assert.equal(resolve(f.image),'https://example.test/records/42');
  assert.equal(resolve(f.artist),'https://example.test/people/7');
});
test('title relations work after rehosting renaming IDs and changing route shapes',()=>{
  for(const [origin,id,route] of [['https://alpha.test/','unrelated-label','/documents?id=9'],['https://beta.test:9443/','cabecera','/42/notes#view']]){
    const f=card({id,href:route});assert.equal(resolve(f.overlay,origin),new URL(route,origin).href);
  }
});
test('native article and li boundaries support the same accessible relationship',()=>{
  for(const tag of ['article','li'])assert.equal(resolve(card({tag}).overlay),'https://example.test/records/42');
});
test('an associated title outside the component cannot supply a route',()=>{
  const f=card();f.owner.children=f.owner.children.filter(n=>n!==f.link);f.link.parentElement=null;el('div',{},[f.owner,f.link]);
  assert.equal(resolve(f.overlay),null);
});
test('multiple referenced navigation destinations are terminally ambiguous',()=>{
  const f=card();const title=el('p',{id:'other-heading'});const link=el('a',{href:'/another'},[title]);f.owner.children.push(link);link.parentElement=f.owner;f.owner.attrs['aria-labelledby']+=' other-heading';
  assert.equal(resolve(f.overlay),null);assert.equal(resolve(f.image),null,'do not downgrade conflicting navigation to raw artwork');
});
test('duplicate labelled links to one destination remain unambiguous',()=>{
  const f=card();const title=el('p',{id:'second-heading'});const link=el('a',{href:'/records/42'},[title]);f.owner.children.push(link);link.parentElement=f.owner;f.owner.attrs['aria-labelledby']+=' second-heading';
  assert.equal(resolve(f.overlay),'https://example.test/records/42');
});
test('separate Play buttons without shared title references stay actions',()=>{
  const f=card();assert.equal(resolve(f.play),null);
});
test('disabled overlays and disabled semantic owners are not redirected',()=>{
  const f=card();f.overlay.attrs['aria-disabled']='true';assert.equal(resolve(f.overlay),null);
  const g=card();g.owner.attrs.disabled='';assert.equal(resolve(g.overlay),null);
});
test('shared native navigation button works without any site identifier',()=>{
  const f=card();const label=el('span');const button=el('button',{type:'button','aria-labelledby':f.id},[label]);f.owner.children.push(button);button.parentElement=f.owner;
  assert.equal(resolve(label),'https://example.test/records/42');
});
test('accessible timestamp selects the card permalink not profile or unrelated links',()=>{
  const f=post({extra:[el('a',{href:'/tag/art'}),el('a',{href:'/quote/77'})]});
  assert.equal(resolve(f.content),'https://example.test/entries/89');
});
test('timestamp card behavior is independent of domain and route naming',()=>{
  for(const page of ['https://social-one.test/feed','https://other.test/workspace/']){
    const f=post({href:'/unusual?entry=89'});assert.equal(resolve(f.content,page),new URL('/unusual?entry=89',page).href);
  }
});
test('rel bookmark is generic permalink evidence',()=>{
  const content=el('span');const link=el('a',{href:'/bookmark-target',rel:'noopener bookmark'});
  el('article',{},[content,el('a',{href:'/author'}),link]);
  assert.equal(resolve(content),'https://example.test/bookmark-target');
});
test('standard time datetime identifies a permalink without localized prose parsing',()=>{
  const content=el('span');const link=el('a',{href:'/dated'},[el('time',{datetime:'2026-10-25T00:29:00Z'})]);
  el('article',{},[content,el('a',{href:'/author'}),link]);
  assert.equal(resolve(content),'https://example.test/dated');
});
test('nested quote-card timestamps are not owned by the outer card',()=>{
  const nested=post({href:'/quoted-entry'});const outer=post({extra:[nested.owner]});
  assert.equal(resolve(outer.content),'https://example.test/entries/89');
  assert.equal(resolve(nested.content),'https://example.test/quoted-entry');
});
test('links inside nested action controls do not become parent permalinks',()=>{
  const internal=el('a',{href:'/action-target','aria-label':'25 October 2026 at 01:00'});
  const button=el('button',{},[internal]);const f=post({extra:[button]});
  assert.equal(resolve(f.content),'https://example.test/entries/89');
});
test('two owned timestamp destinations are ambiguous',()=>{
  const f=post({extra:[el('a',{href:'/another-entry','aria-label':'25 October 2026 at 01:00'})]});
  assert.equal(resolve(f.content),null);
});
test('one owned href identifies a generic explicit role-link container',()=>{
  const content=el('span');el('div',{role:'link'},[content,el('a',{href:'/somewhere'})]);
  assert.equal(resolve(content),'https://example.test/somewhere');
});
test('multiple ordinary hrefs in a role-link container are not first-link guessed',()=>{
  const content=el('span');el('div',{role:'link'},[content,el('a',{href:'/one'}),el('a',{href:'/two'})]);
  assert.equal(resolve(content),null);
});
test('a broad article with only an author link is not assumed to be that author',()=>{
  const content=el('span');el('article',{},[content,el('a',{href:'/author'})]);assert.equal(resolve(content),null);
});
test('nested Reply and editable controls do not become surrounding card navigation',()=>{
  const f=post();assert.equal(resolve(f.action),null);
  const field=el('div',{role:'textbox'},[],{isContentEditable:true});f.owner.children.push(field);field.parentElement=f.owner;
  assert.equal(resolve(field),null);
});
test('unlinked images use their real selected source on any media host',()=>{
  for(const src of ['https://media-one.test/photo','https://media-two.test/assets/photo.png']){
    assert.equal(resolve(el('img',{src})),src);
  }
  assert.equal(resolve(el('img',{src:'https://media.test/small'},[],{currentSrc:'https://media.test/selected'})),'https://media.test/selected');
});
test('an ALT or image overlay can resolve its one labelled image',()=>{
  const badge=el('span');const image=el('img',{src:'https://media.test/art','alt':'Artwork'});
  el('button',{type:'button',role:'button','aria-label':'Artwork'},[image,badge]);
  assert.equal(resolve(badge),'https://media.test/art');
});
test('mismatched labels and multi-image overlays are not guessed',()=>{
  const badge=el('span');el('button',{'aria-label':'Other'},[el('img',{src:'https://media.test/a',alt:'Artwork'}),badge]);assert.equal(resolve(badge),null);
  const second=el('span');el('button',{'aria-label':'Artwork'},[el('img',{src:'https://media.test/a',alt:'Artwork'}),el('img',{src:'https://media.test/b',alt:'Artwork'}),second]);assert.equal(resolve(second),null);
});
test('disabled and explicitly decorative images are not destinations',()=>{
  const image=el('img',{src:'https://media.test/art'});el('button',{disabled:''},[image]);assert.equal(resolve(image),null);
  assert.equal(resolve(el('img',{src:'https://media.test/art','aria-hidden':'true'})),null);
  assert.equal(resolve(el('img',{src:'https://media.test/art',role:'presentation'})),null);
});
test('unsupported image protocols do not become extension tab requests',()=>{
  for(const src of ['data:image/png,x','blob:https://example.test/id','javascript:alert(1)'])assert.equal(resolve(el('img',{src})),null);
});
test('old login and signup test IDs do not manufacture account URLs',()=>{
  for(const id of ['login-button','signup-button']){
    assert.equal(resolve(el('button',{'data-testid':id,type:'button'}),'https://open.spotify.com/'),null);
    assert.equal(resolve(el('button',{'data-testid':id,type:'button'}),'https://unrelated.test/'),null);
  }
});
test('production resolver has no site domains routes custom test IDs or label prefixes',()=>{
  for(const value of ['bsky.app','spotify.com','reddit.com','data-testid','data-encore-id','feedItem-by-','postThreadItem-by-','card-title-spotify:','/profile/','/album/'])
    assert.equal(source.includes(value),false,value);
});
console.log(passed+' generic resolver tests passed (pure DOM simulations).');


