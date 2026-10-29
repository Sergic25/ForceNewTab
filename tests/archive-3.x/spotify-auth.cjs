'use strict';
// Native button identities and auth endpoints were observed on Spotify's public
// web player. These are DOM/API simulations, not a Firefox integration claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sourcePage = 'https://open.spotify.com/album/7aJuG4TFXa2hmE4z1yxc3n?si=a%2Bb&highlight=spotify%3Atrack%3Aexample#track';
let count = 0;
function MockHTMLElement() {}
MockHTMLElement.prototype.click = function () {this.activations = (this.activations || 0) + 1;};
function element(localName, attrs = {}, children = [], extra = {}) {
  const node = Object.assign(new MockHTMLElement(), {nodeType:1, localName, attrs, children,
    parentElement:null, ownerDocument:null, isConnected:true,
    getAttribute(key) {return this.attrs[key] ?? null;},
    hasAttribute(key) {return Object.hasOwn(this.attrs,key);},
    ...extra});
  for (const child of children) child.parentElement = node;
  return node;
}
function routePath(target) {const nodes=[];for(let n=target;n;n=n.parentElement)nodes.push(n);return nodes;}
function fixture(id, nested = false, attrs = {}) {
  const label = element('span',{},[],{textContent:id === 'login-button' ? 'Se connecter' : 'Inscrivez-vous'});
  const button = element('button',{'data-testid':id,type:'button',...attrs},[label]);
  return {button,label,target:nested ? label : button};
}
const pure = vm.createContext({URL});
vm.runInContext(fs.readFileSync(path.join(root,'resolver.js'),'utf8'),pure);
function resolve(target, page = sourcePage, base = page) {return pure.FNT.resolve(routePath(target),base,page);}
async function test(name,fn) {await fn();count++;console.log('PASS Spotify auth',name);}
function expected(kind,page = sourcePage) {
  const endpoint = kind === 'login' ? 'https://accounts.spotify.com/login' : 'https://www.spotify.com/signup';
  return endpoint + '?' + (kind === 'login' ? 'continue' : 'forward_url') + '=' + encodeURIComponent(page);
}
const flush = async () => {for(let i=0;i<8;i++)await Promise.resolve();};
async function gesture(target, page = sourcePage) {
  const handlers={}, sent=[];
  const document={baseURI:page};
  const nodes=routePath(target);
  for(const node of nodes)node.ownerDocument=document;
  const browser={storage:{onChanged:{addListener(){}},local:{get:()=>Promise.resolve({enabled:true})}},
    runtime:{sendMessage(message){sent.push(message);return Promise.resolve({ok:true});}}};
  const context=vm.createContext({URL,Date,HTMLElement:MockHTMLElement,document,location:{href:page},browser,
    window:{addEventListener(type,handler){handlers[type]=handler;}}});
  for(const file of ['resolver.js','content.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  await flush();
  for(const type of ['pointerdown','mousedown','pointerup','mouseup','auxclick']){
    const event={type,isTrusted:true,button:1,cancelable:true,composedPath:()=>nodes,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    handlers[type](event);
    assert.ok(event.prevented && event.stopped,type+' is suppressed');
  }
  await flush();
  return {sent,nodes,handlers};
}
(async()=>{
  await test('native login button uses canonical login endpoint',()=>{
    assert.equal(resolve(fixture('login-button').target),expected('login'));
  });
  await test('native signup button uses canonical signup endpoint',()=>{
    assert.equal(resolve(fixture('signup-button').target),expected('signup'));
  });
  await test('nested button labels resolve by stable identity rather than language',()=>{
    assert.equal(resolve(fixture('login-button',true).target),expected('login'));
    assert.equal(resolve(fixture('signup-button',true).target),expected('signup'));
  });
  await test('return address preserves path query and hash with correct encoding',()=>{
    for(const [id,param,host,pathname] of [
      ['login-button','continue','accounts.spotify.com','/login'],
      ['signup-button','forward_url','www.spotify.com','/signup']]){
      const result = new URL(resolve(fixture(id).target));
      assert.equal(result.hostname,host);assert.equal(result.pathname,pathname);
      assert.equal(result.searchParams.get(param),sourcePage);
      assert.equal([...result.searchParams].length,1);
    }
  });
  await test('auth source identity and return address come from page rather than base',()=>{
    assert.equal(resolve(fixture('login-button').target,sourcePage,'https://assets.example.test/'),expected('login'));
    assert.equal(resolve(fixture('login-button').target,'https://example.test/',sourcePage),null);
  });
  await test('HTTP alternate ports and lookalike hosts are not treated as Spotify auth',()=>{
    for(const page of ['http://open.spotify.com/','https://open.spotify.com:8443/','https://open.spotify.com.example.test/','https://notopen.spotify.com/','https://example.test/']){
      assert.equal(resolve(fixture('login-button').target,page),null,page);
      assert.equal(resolve(fixture('signup-button').target,page),null,page);
    }
  });
  await test('credential-bearing page addresses are not forwarded to auth',()=>{
    assert.equal(resolve(fixture('login-button').target,'https://user:secret@open.spotify.com/'),null);
  });
  await test('disabled and aria-disabled native buttons are not redirected',()=>{
    for(const attrs of [{disabled:''},{'aria-disabled':'true'}]){
      assert.equal(resolve(fixture('login-button',false,attrs).target),null);
      assert.equal(resolve(fixture('signup-button',false,attrs).target),null);
    }
  });
  await test('English text alone and unrelated test IDs are not inferred as auth',()=>{
    assert.equal(resolve(element('button',{},[],{textContent:'Log in'})),null);
    assert.equal(resolve(element('button',{'data-testid':'play-button'},[],{textContent:'Sign up'})),null);
    assert.equal(resolve(fixture('login-button-extra').target),null);
  });
  await test('role-button div lookalikes do not match the observed native buttons',()=>{
    assert.equal(resolve(element('div',{role:'button','data-testid':'login-button'})),null);
    assert.equal(resolve(element('div',{role:'button','data-testid':'signup-button'})),null);
  });
  await test('nearest native button identity owns nested content',()=>{
    const f=fixture('login-button',true);
    f.button.attrs['data-testid']='other-button';
    const wrapper=element('div',{'data-testid':'login-button'},[f.button]);
    assert.equal(resolve(f.target),null);
    assert.equal(wrapper.children[0],f.button);
  });
  await test('existing real enclosing href keeps precedence over auth shortcut',()=>{
    const f=fixture('login-button',true);
    element('a',{href:'https://example.test/explicit-link'},[f.button]);
    assert.equal(resolve(f.target),'https://example.test/explicit-link');
  });
  for(const [id,kind] of [['login-button','login'],['signup-button','signup']]){
    for(const nested of [false,true]){
      await test(id+(nested?' nested label':' button')+' gesture opens once without source activation',async()=>{
        const f=fixture(id,nested);
        const result=await gesture(f.target);
        assert.equal(result.sent.length,1);
        assert.equal(result.sent[0].type,'fnt-open');
        assert.equal(result.sent[0].url,expected(kind));
        assert.equal(result.sent.some(message=>message.type==='fnt-arm'),false);
        for(const node of result.nodes)assert.equal(node.activations,undefined);
      });
    }
  }
  await test('disabled auth gesture neither opens nor activates the source',async()=>{
    const result=await gesture(fixture('login-button',true,{disabled:''}).target);
    assert.equal(result.sent.length,0);
    for(const node of result.nodes)assert.equal(node.activations,undefined);
  });
  await test('ordinary left click is not intercepted by the auth shortcut',async()=>{
    const f=fixture('login-button');
    const result=await gesture(f.target);
    result.sent.length=0;
    const event={type:'click',button:0,isTrusted:true,cancelable:true,
      composedPath:()=>routePath(f.target),preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    result.handlers.click(event);
    await flush();
    assert.equal(result.sent.length,0);assert.equal(event.prevented,undefined);assert.equal(event.stopped,undefined);
  });
  console.log(count+' Spotify-auth regression tests passed (mocked DOM/API; Firefox retest required).');
})().catch(error=>{console.error(error);process.exitCode=1;});

