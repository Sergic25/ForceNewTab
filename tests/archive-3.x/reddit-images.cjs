'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.join(__dirname,'..');
let count=0;
function test(name,fn){fn();count++;console.log('PASS Reddit',name);}
function element(localName, attrs={}, extra={}) {
  return {nodeType:1,localName,hasAttribute:k=>Object.hasOwn(attrs,k),getAttribute:k=>attrs[k],...extra};
}
const c=vm.createContext({URL});vm.runInContext(fs.readFileSync(path.join(root,'resolver.js'),'utf8'),c);
const post='https://www.reddit.com/r/pics/comments/abc123/example/';
const resolve=(nodes,page=post,base=page)=>c.FNT.resolve(nodes,base,page);
test('unlinked displayed Reddit post image resolves without guessing a URL',()=>{
 assert.equal(resolve([element('img',{src:'https://preview.redd.it/example.jpg?width=640'})]),'https://preview.redd.it/example.jpg?width=640');
});
test('browser-selected currentSrc wins over fallback src',()=>{
 assert.equal(resolve([element('img',{src:'https://preview.redd.it/small.jpg'},{currentSrc:'https://i.redd.it/large.jpg'})]),'https://i.redd.it/large.jpg');
});
test('existing enclosing link keeps precedence',()=>{
 assert.equal(resolve([element('img',{src:'https://i.redd.it/image.jpg'}),element('a',{href:'/gallery/abc123'})]),'https://www.reddit.com/gallery/abc123');
});
test('placeholder enclosing link still permits image shortcut',()=>{
 assert.equal(resolve([element('img',{src:'https://i.redd.it/image.jpg'}),element('a',{href:'#'})]),'https://i.redd.it/image.jpg');
});
test('feed handling and other-site image behavior unchanged',()=>{
 const nodes=[element('img',{src:'https://i.redd.it/image.jpg'})];
 assert.equal(resolve(nodes,'https://www.reddit.com/r/pics/'),null);
 assert.equal(resolve(nodes,'https://example.test/comments/abc123/'),null);
 assert.equal(resolve(nodes,'https://notreddit.com/comments/abc123/'),null);
});
test('page location determines site scope independently of base URL',()=>{
 const nodes=[element('img',{src:'https://i.redd.it/image.jpg'})];
 assert.equal(resolve(nodes,post,'https://cdn.example.test/'),'https://i.redd.it/image.jpg');
 assert.equal(resolve(nodes,'https://example.test/',post),null);
});
test('avatars unrelated media hosts and unsafe sources do not become image destinations',()=>{
 for(const src of ['https://styles.redditmedia.com/avatar.png','https://example.test/image.jpg','javascript:alert(1)','data:image/png,x','https://a:b@i.redd.it/image.jpg'])
   assert.equal(resolve([element('img',{src})]),null);
});
test('overlay and non-image targets do not trigger arbitrary child-image search',()=>{
 assert.equal(resolve([element('button'),element('div')]),null);
});
(async()=>{
 const handlers={},sent=[];
 function HTMLElement(){}
 HTMLElement.prototype.click=function(){this.activated=(this.activated||0)+1;};
 const document={baseURI:post};
 const context=vm.createContext({URL,Date,HTMLElement,location:{href:post},document,
  browser:{storage:{onChanged:{addListener(){}},local:{get:()=>Promise.resolve({enabled:true})}},
   runtime:{sendMessage:message=>{sent.push(message);return Promise.resolve({ok:true});}}},
  window:{addEventListener:(type,handler)=>{handlers[type]=handler;}}});
 for(const file of ['resolver.js','content.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const target=Object.assign(new HTMLElement(),element('img',{src:'https://preview.redd.it/example.jpg'},{isConnected:true,ownerDocument:document}));
 for(const type of ['pointerdown','mousedown','pointerup','mouseup','auxclick'])handlers[type]({
  type,isTrusted:true,button:1,cancelable:true,composedPath:()=>[target],preventDefault(){},stopImmediatePropagation(){}});
 await Promise.resolve();await Promise.resolve();
 assert.equal(sent.length,1);assert.equal(sent[0].type,'fnt-open');
 assert.equal(sent[0].url,'https://preview.redd.it/example.jpg');
 assert.equal(target.activated,undefined);count++;console.log('PASS Reddit content opens image directly without arming discovery or pressing source image');
 console.log(count+' Reddit regression tests passed (mocked DOM; live Reddit retest needed).');
})().catch(error=>{console.error(error);process.exitCode=1;});

