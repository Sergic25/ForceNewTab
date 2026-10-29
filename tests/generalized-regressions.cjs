'use strict';
// Runs the actual four runtime modules together. Browser/DOM objects and clock
// are simulated; this does not certify real Firefox event delivery or Xrays.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const flush = async () => { for (let i=0;i<20;i++) await Promise.resolve(); };
const settle = async h => { await flush(); h.clock.tick(60); await flush(); };
function eventHub() {
  const handlers=[];
  return {addListener(fn){handlers.push(fn);},fire(value){for(const fn of handlers)fn(value);}};
}
function timerClock() {
  let now=10000, next=1;
  const timers=new Map();
  return {now:()=>now,setTimeout(fn,delay){const id=next++;timers.set(id,{at:now+delay,fn});return id;},
    clearTimeout(id){timers.delete(id);},tick(ms){const end=now+ms;while(true){let due;
      for(const e of timers)if(e[1].at<=end&&(!due||e[1].at<due[1].at))due=e;
      if(!due)break;timers.delete(due[0]);now=due[1].at;due[1].fn();}now=end;},size:()=>timers.size};
}
function MockHTMLElement(){}
MockHTMLElement.prototype.click=function(){this.activations=(this.activations||0)+1;if(this.onActivate)this.onActivate();if(this.throwAfterActivation)throw Error('activation handler failed');};
function matches(node,selector){
  if(selector==='a[href]')return node.localName==='a'&&node.hasAttribute('href');
  if(selector==='img'||selector==='time')return node.localName===selector;
  throw Error('Unexpected fixture selector: '+selector);
}
function el(localName,attrs={},children=[],extra={}){
  const node=Object.assign(new MockHTMLElement(),{nodeType:1,localName,tagName:localName.toUpperCase(),attrs,children,parentElement:null,ownerDocument:null,isConnected:true,
    getAttribute(name){return this.attrs[name]??null;},hasAttribute(name){return Object.hasOwn(this.attrs,name);},
    contains(other){for(let n=other;n;n=n.parentElement)if(n===this)return true;return false;},
    closest(selector){for(let n=this;n;n=n.parentElement)if(matches(n,selector))return n;return null;},
    querySelectorAll(selector){const out=[];const walk=n=>{for(const child of n.children){if(matches(child,selector))out.push(child);walk(child);}};walk(this);return out;},
    ...extra});
  for(const child of children)child.parentElement=node;
  return node;
}
function ancestry(node){const out=[];for(let n=node;n;n=n.parentElement)out.push(n);return out;}
function harness({page='https://generic.example.test/start?view=cards#top',enabled=true,navigation=true}={}){
  const h={saved:{enabled},sent:[],created:[],icons:[],titles:[],listeners:{},navListeners:[],clock:timerClock(),source:{href:page},failTabs:false,deferArm:null};
  const changes=[],ids=new Map();
  h.document={baseURI:page,getElementById:id=>ids.get(id)||null};
  h.attach=node=>{let top=node;while(top.parentElement)top=top.parentElement;const walk=n=>{n.ownerDocument=h.document;if(n.hasAttribute('id'))ids.set(n.getAttribute('id'),n);for(const child of n.children)walk(child);};walk(top);return node;};
  const webNavigation={};for(const name of ['onBeforeNavigate','onCommitted','onHistoryStateUpdated','onReferenceFragmentUpdated','onCreatedNavigationTarget'])webNavigation[name]=eventHub();
  h.origin={id:'test-runtime',tab:{id:10,windowId:4,url:page,cookieStoreId:'firefox-container-7'},frameId:0,url:page};
  const browser={
    storage:{onChanged:{addListener(fn){changes.push(fn);}},local:{
      get(defaults){return Promise.resolve({...defaults,...h.saved});},
      async set(delta){const batch={};for(const [key,value]of Object.entries(delta)){batch[key]={oldValue:h.saved[key],newValue:value};h.saved[key]=value;}for(const fn of changes)fn(batch,'local');}}},
    action:{setIcon(value){h.icons.push(value);return Promise.resolve();},setTitle(value){h.titles.push(value);return Promise.resolve();},onClicked:{addListener(fn){h.toggle=fn;}}},
    tabs:{onRemoved:eventHub(),create(value){h.created.push(value);return h.failTabs?Promise.reject(Error('tab failed')):Promise.resolve({id:99});}},
    webNavigation,
    runtime:{id:'test-runtime',getManifest:()=>({version:'4.0.0'}),getURL:file=>'moz-extension://test/'+file,
      onInstalled:{addListener(fn){h.installed=fn;}},onMessage:{addListener(fn){h.receive=fn;}},
      sendMessage(message){h.sent.push(message);if(message.type==='fnt-arm'&&h.deferArm)return h.deferArm;
        return Promise.resolve(h.receive(message,h.origin));}}
  };
  h.browser=browser;
  const common={URL,Date:{now:h.clock.now,parse:Date.parse},setTimeout:h.clock.setTimeout,clearTimeout:h.clock.clearTimeout};
  const background=vm.createContext({...common,browser});
  for(const file of ['discovery.js','background.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),background,{filename:file});
  const window={addEventListener(type,fn){h.listeners[type]=fn;}};
  if(navigation)window.navigation={addEventListener(type,fn){assert.equal(type,'navigate');h.navListeners.push(fn);}};
  const content=vm.createContext({...common,HTMLElement:MockHTMLElement,location:h.source,document:h.document,browser,window});
  for(const file of ['resolver.js','content.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),content,{filename:file});
  h.resolve=(target)=>content.FNT.resolve(ancestry(target),h.document.baseURI,h.source.href);
  h.mouse=(type,target,extra={})=>{h.attach(target);const event={type,isTrusted:true,button:1,cancelable:true,composedPath:()=>ancestry(target),
    preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};h.listeners[type](event);return event;};
  h.gesture=target=>{for(const type of ['pointerdown','mousedown','pointerup','mouseup','auxclick'])h.mouse(type,target);};
  h.nav=(url,overrides={})=>{
    const {commit=true,...properties}=overrides;
    const event={isTrusted:true,cancelable:true,navigationType:'push',destination:{url},formData:null,downloadRequest:null,
      canIntercept:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...properties};
    for(const fn of h.navListeners)fn(event);
    if(commit&&!event.defaultPrevented){h.source.href=url;h.origin.tab.url=url;browser.webNavigation.onBeforeNavigate.fire({tabId:10,frameId:0,url,timeStamp:h.clock.now()});}
    return event;};
  return h;
}
let count=0;
async function test(name,fn){await fn();await flush();count++;console.log('PASS generalized integration',name);}
function imageFixture(media='https://cdn.unrelated.test/pictures/art.jpg'){
  const image=el('img',{src:media,alt:'Artwork of a cat'},[],{currentSrc:media});
  const badge=el('span',{},[],{textContent:'ALT'});
  const button=el('button',{role:'button','aria-label':'Artwork of a cat',type:'button'},[el('div',{},[image]),badge]);
  return {image,badge,button};
}
function cardFixture(){
  const text=el('span',{},[],{textContent:'A comment'});
  const timestamp=el('a',{href:'/conversation/42','aria-label':'25 October 2026 at 00:29'});
  const avatar=el('a',{href:'/people/author'});
  const action=el('button',{'aria-label':'Reply'});
  const card=el('div',{role:'link',tabindex:'0'},[avatar,timestamp,text,action]);
  return {card,text,timestamp,action};
}
function artworkFixture(){
  const title=el('p',{id:'a-random-heading-id'},[],{textContent:'Album'});
  const link=el('a',{href:'/releases/new-album'},[title]);
  const artist=el('a',{href:'/people/musician'});
  const overlay=el('div',{role:'button','aria-labelledby':'a-random-heading-id a-random-subtitle-id'});
  const image=el('img',{src:'https://another-cdn.test/cover.jpg'});
  const play=el('button',{'aria-label':'Play'});
  const card=el('div',{role:'listitem','aria-labelledby':'a-random-heading-id'},[overlay,image,link,artist,play]);
  return {card,overlay,image,link,artist,play};
}
(async()=>{
  await test('ordinary anchor retains direct single background opening and source container',async()=>{
    const h=harness();await flush();const label=el('span');el('a',{href:'/target'},[label]);h.gesture(label);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/target');
    assert.equal(h.created[0].active,false);assert.equal(h.created[0].cookieStoreId,'firefox-container-7');
    assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,0);assert.equal(label.activations,undefined);
  });
  await test('post image works on an unrelated site and CDN without pressing the source',async()=>{
    const h=harness();await flush();const f=imageFixture();h.gesture(f.image);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,f.image.currentSrc);assert.equal(f.button.activations,undefined);
    assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,0);
  });
  await test('ALT overlay uses its labelled image on an unrelated site',async()=>{
    const h=harness();await flush();const f=imageFixture();h.gesture(f.badge);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,f.image.currentSrc);assert.equal(f.button.activations,undefined);
  });
  await test('renamed comment card uses existing timestamp permalink without source activation',async()=>{
    const h=harness();await flush();const f=cardFixture();h.gesture(f.text);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/conversation/42');
    assert.equal(f.card.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('renamed artwork card follows accessible title rather than image or artist',async()=>{
    const h=harness();await flush();const f=artworkFixture();h.gesture(f.overlay);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/releases/new-album');
    assert.equal(f.overlay.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('raw artwork image retains associated album navigation precedence',async()=>{
    const h=harness();await flush();const f=artworkFixture();h.gesture(f.image);await flush();
    assert.equal(h.created[0].url,'https://generic.example.test/releases/new-album');
  });
  await test('nested action is not redirected to surrounding card',async()=>{
    const h=harness();await flush();const f=artworkFixture();h.attach(f.play);
    assert.equal(h.resolve(f.play),null);
  });
  for(const destination of ['https://accounts.example.test/signin?continue=%2Fmusic','https://join.other.test/create?return_to=%2Fhome']){
    await test('unknown account control captures destination dynamically: '+new URL(destination).hostname,async()=>{
      const h=harness();await flush();const label=el('span',{},[],{textContent:'Any translated label'});
      const button=el('button',{type:'button'},[label]);let navigation;
      button.onActivate=()=>{assert.ok(h.sent.some(m=>m.type==='fnt-arm'));navigation=h.nav(destination);};
      const before=h.source.href;h.gesture(label);await flush();
      assert.equal(button.activations,1);assert.equal(navigation.defaultPrevented,true);
      assert.equal(h.source.href,before);await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,destination);
      assert.equal(h.sent.filter(m=>m.type==='fnt-captured').length,1);
      h.clock.tick(9000);await flush();await settle(h); assert.equal(h.created.length,1);assert.equal(h.clock.size(),0);
    });
  }
  await test('synchronous repeated native navigations are suppressed with one result',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});const events=[];
    target.onActivate=()=>{events.push(h.nav('https://destination.test/first'));events.push(h.nav('https://destination.test/second'));};
    const before=h.source.href;h.gesture(target);await flush();
    assert.ok(events.every(e=>e.defaultPrevented));assert.equal(h.source.href,before);await settle(h); assert.equal(h.created.length,1);
    assert.equal(h.created[0].url,'https://destination.test/first');assert.equal(h.sent.filter(m=>m.type==='fnt-captured').length,1);
  });
  await test('navigation emitted asynchronously after one activation is captured',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.gesture(target);await flush();
    const before=h.source.href;const event=h.nav('https://delayed.test/route');await flush();
    assert.equal(event.defaultPrevented,true);assert.equal(h.source.href,before);await settle(h); assert.equal(h.created.length,1);assert.equal(target.activations,1);
  });
  await test('no native navigation is intercepted without an acknowledged user attempt',async()=>{
    const h=harness();await flush();const event=h.nav('https://normal.test/page');await flush();
    assert.equal(event.defaultPrevented,undefined);assert.equal(h.created.length,0);assert.equal(h.source.href,'https://normal.test/page');
  });
  await test('untrusted, traverse, form and download events are not cancelled',async()=>{
    for(const properties of [{isTrusted:false},{navigationType:'traverse'},{formData:{}},{downloadRequest:'file.pdf'},{cancelable:false}]){
      const h=harness();await flush();h.gesture(el('button',{type:'button'}));await flush();
      const event=h.nav('https://ignored.test/target',{...properties,commit:false});await flush();
      assert.equal(event.defaultPrevented,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-captured'),false);
    }
  });
  await test('non-cancelable navigation keeps previous observer opening fallback',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});
    target.onActivate=()=>h.nav('https://fallback.test/page',{cancelable:false});h.gesture(target);await flush();h.clock.tick(60);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://fallback.test/page');
  });
  await test('unsupported native API retains previous source-navigation discovery',async()=>{
    const h=harness({navigation:false});await flush();const target=el('button',{type:'button'});
    target.onActivate=()=>h.nav('https://older.test/page');h.gesture(target);await flush();h.clock.tick(60);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://older.test/page');assert.equal(target.activations,1);
  });
  await test('expired pending content cannot swallow a later unrelated navigation',async()=>{
    const h=harness();await flush();h.gesture(el('button',{type:'button'}));await flush();h.clock.tick(7501);
    const event=h.nav('https://unrelated.test/later');await flush();h.clock.tick(1000);await flush();
    assert.equal(event.defaultPrevented,undefined);assert.equal(h.created.length,0);
  });
  await test('new trusted input cancels old capture ownership',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.gesture(target);await flush();
    h.mouse('mousedown',el('div'),{button:0});const event=h.nav('https://unrelated.test/new-action');await flush();h.clock.tick(1000);
    assert.equal(event.defaultPrevented,undefined);assert.equal(h.created.length,0);
  });
  await test('disabled saved mode leaves source events and navigation untouched',async()=>{
    const h=harness({enabled:false});await flush();const target=el('button',{type:'button'});
    assert.equal(h.mouse('mousedown',target).stopped,undefined);
    const event=h.nav('https://normal.test/disabled');await flush();assert.equal(event.defaultPrevented,undefined);assert.equal(h.created.length,0);
  });
  await test('form controls retain activation exclusion',async()=>{
    const h=harness();await flush();const input=el('input',{type:'text'});el('form',{},[input]);h.gesture(input);await flush();
    assert.equal(h.sent.length,0);assert.equal(input.activations,undefined);
  });
  await test('failed destination opening is not retried after cancelled source navigation',async()=>{
    const h=harness();await flush();h.failTabs=true;const target=el('button',{type:'button'});
    target.onActivate=()=>h.nav('https://failure.test/page');const before=h.source.href;h.gesture(target);await flush();h.clock.tick(9000);await flush();
    await settle(h); assert.equal(h.created.length,1);assert.equal(h.source.href,before);assert.equal(h.sent.filter(m=>m.type==='fnt-captured').length,1);
  });
  await test('handler exception after capture does not discard the captured destination',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});
    target.children=[];target.onActivate=()=>h.nav('https://captured.test/then-throws');target.throwAfterActivation=true;
    h.gesture(target);await flush();await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://captured.test/then-throws');
  });
  await test('stale frame or attempt cannot capture another operation',async()=>{
    const h=harness();await flush();h.gesture(el('button',{type:'button'}));await flush();
    const arm=h.sent.find(m=>m.type==='fnt-arm');
    const badFrame=await h.receive({type:'fnt-captured',attemptId:arm.attemptId,url:'https://bad.test/'},{...h.origin,frameId:8});
    const badToken=await h.receive({type:'fnt-captured',attemptId:'obsolete',url:'https://bad.test/'},h.origin);
    assert.equal(badFrame.ok,false);assert.equal(badToken.ok,false);assert.equal(h.created.length,0);
    h.nav('https://owned.test/destination');await flush();await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://owned.test/destination');
  });
  await test('late native observer notification cannot duplicate a captured result',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});target.onActivate=()=>h.nav('https://one.test/result');
    h.gesture(target);await flush();
    for(const name of ['onBeforeNavigate','onCommitted','onHistoryStateUpdated'])h.browser.webNavigation[name].fire({tabId:10,frameId:0,url:'https://one.test/result',timeStamp:h.clock.now()});
    h.clock.tick(1000);await flush();await settle(h); assert.equal(h.created.length,1);
  });

  await test('reported Bluesky image remains direct with original markup',async()=>{
    const page='https://bsky.app/profile/womensartbluesky.bsky.social/post/3myogvioii225';
    const media='https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:u2zs2typsklaohqmfyxiunvy/bafkreify7n3wp4lfmfjvjku3gmfbuy24ztpswt5olbv5gjjzu5zt7clsye';
    const h=harness({page});await flush();const f=imageFixture(media);
    el('div',{role:'link','data-testid':'feedItem-by-womensartbluesky.bsky.social'},[f.button]);
    h.gesture(f.image);await flush();await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,media);assert.equal(f.button.activations,undefined);
  });
  await test('reported Bluesky comment remains direct with original markup',async()=>{
    const h=harness({page:'https://bsky.app/profile/womensartbluesky.bsky.social/post/3myogvioii225'});await flush();
    const f=cardFixture();f.card.attrs['data-testid']='postThreadItem-by-bnerlich.bsky.social';
    f.timestamp.attrs.href='/profile/bnerlich.bsky.social/post/3myoopycfkc2q';
    h.gesture(f.text);await flush();await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://bsky.app/profile/bnerlich.bsky.social/post/3myoopycfkc2q');assert.equal(f.card.activations,undefined);
  });
  await test('reported Spotify artwork remains direct with original identifiers',async()=>{
    const h=harness({page:'https://open.spotify.com/'});await flush();const f=artworkFixture();
    f.card.attrs['data-encore-id']='card';f.card.attrs['aria-labelledby']='card-title-spotify:album:7aJuG4TFXa2hmE4z1yxc3n-2';
    const title=f.link.children[0];title.attrs.id=f.card.attrs['aria-labelledby'];
    f.overlay.attrs['aria-labelledby']=title.attrs.id+' unrelated-subtitle';
    f.link.attrs.href='/album/7aJuG4TFXa2hmE4z1yxc3n';
    h.gesture(f.overlay);await flush();await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://open.spotify.com/album/7aJuG4TFXa2hmE4z1yxc3n');assert.equal(f.overlay.activations,undefined);
  });
  for(const [id,destination]of [
    ['login-button','https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F'],
    ['signup-button','https://www.spotify.com/signup?forward_url=https%3A%2F%2Fopen.spotify.com%2F']]){
    await test('reported Spotify '+id+' retains opening without source navigation',async()=>{
      const h=harness({page:'https://open.spotify.com/'});await flush();
      const label=el('span');const button=el('button',{'data-testid':id,type:'button'},[label]);let native;
      button.onActivate=()=>{native=h.nav(destination);};const before=h.source.href;h.gesture(label);await flush();
      assert.equal(native.defaultPrevented,true);assert.equal(h.source.href,before);await settle(h); assert.equal(h.created.length,1);assert.equal(h.created[0].url,destination);
    });
  }


  await test('captured navigation waits for the shared native-target settling interval',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});
    target.onActivate=()=>h.nav('https://settle.test/result');h.gesture(target);await flush();
    assert.equal(h.created.length,0);h.clock.tick(59);await flush();assert.equal(h.created.length,0);
    h.clock.tick(1);await flush();assert.equal(h.created.length,1);
  });
  await test('page-created native target wins during captured-navigation settling',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});let native;
    target.onActivate=()=>{native=h.nav('https://one-native.test/result');};h.gesture(target);await flush();
    assert.equal(native.defaultPrevented,true);assert.equal(h.created.length,0);
    h.browser.webNavigation.onCreatedNavigationTarget.fire({sourceTabId:10,sourceFrameId:0,tabId:11,url:'about:blank',timeStamp:h.clock.now()});
    h.clock.tick(1000);await flush();assert.equal(h.created.length,0);assert.equal(h.clock.size(),0);
  });


  await test('owned native capture overrides an earlier weak navigation candidate',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});
    target.onActivate=()=>{
      h.browser.webNavigation.onBeforeNavigate.fire({tabId:10,frameId:0,url:'https://weak.test/unrelated',timeStamp:h.clock.now()});
      h.nav('https://strong.test/actual-button-destination');
    };
    h.gesture(target);await flush();assert.equal(h.created.length,0);
    await settle(h);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://strong.test/actual-button-destination');
    h.clock.tick(1000);await flush();assert.equal(h.created.length,1);
  });
  await test('duplicate owned capture cannot replace the first strong captured destination',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});
    target.onActivate=()=>h.nav('https://strong.test/first');
    h.gesture(target);await flush();const arm=h.sent.find(message=>message.type==='fnt-arm');
    await h.receive({type:'fnt-captured',attemptId:arm.attemptId,url:'https://strong.test/duplicate'},h.origin);
    await settle(h);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://strong.test/first');
  });

  console.log(count+' generalized integration checks passed (real modules, mocked DOM/browser; Firefox retest still required).');
})().catch(error=>{console.error(error);process.exitCode=1;});


