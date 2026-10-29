'use strict';
// Replays original suites with automatic app-data resolution. Original files stay unchanged.
// These simulate browser delivery and cannot certify Firefox Xrays or a live website.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app-data.js'), 'utf8');
const componentSource = fs.readFileSync(path.join(root, 'component-link.js'), 'utf8');
function once(source, needle, replacement) {
  assert.equal(source.split(needle).length, 2, 'Replay harness anchor must occur exactly once: ' + needle.slice(0, 90));
  return source.replace(needle, replacement);
}
async function replay(name, adapt, expected, prefix) {
  const filename = path.join(__dirname, name);
  const before = fs.readFileSync(filename, 'utf8');
  const source = adapt(before.replace(/\r\n/g, '\n'));
  const lines = [], errors = [], simulatedProcess = {exitCode: 0};
  const sandbox = {require: createRequire(filename), __dirname, __filename: filename, URL, Date,
    process: simulatedProcess, setImmediate,
    console: {log: (...values) => lines.push(values.join(' ')), error: (...values) => errors.push(values.join(' '))}};
  await vm.runInNewContext(source, sandbox, {filename: name + '.automatic-app-data-replay'});
  assert.equal(simulatedProcess.exitCode, 0, errors.join('\n') || 'Replay failed');
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(lines.filter(line => line.startsWith(prefix)).length, expected, name + ' must run every original check plus the new integration checks');
  assert.equal(fs.readFileSync(filename, 'utf8'), before, 'Replay must never edit the original suite');
  return expected;
}
const extraCases = String.raw`
  function privateCard(props) {
    const text = el('span');
    const owner = el('div', {role:'link', tabindex:'0'}, [text]);
    Object.defineProperty(owner, 'wrappedJSObject', {value:owner, configurable:true});
    Object.defineProperty(owner, '__reactProps$integration', {value:props, writable:true, configurable:true});
    return {owner, text, props};
  }
  await test('app-data exact host href opens once without activating or changing the source', async()=>{
    const h=harness(); await flush(); assert.equal(Object.hasOwn(h.saved,'fntAppDataEnabled'),false);const f=privateCard({href:'/private/destination?view=full#part'});
    h.attach(f.text); assert.equal(h.resolve(f.text),'https://generic.example.test/private/destination?view=full#part');
    const before=h.source.href; let sourceUpdates=0;
    f.owner.onActivate=()=>{sourceUpdates++;h.nav('https://wrong.test/should-not-run');};
    h.gesture(f.text); await flush(); await settle(h);
    assert.equal(h.created.length,1); assert.equal(h.created[0].url,'https://generic.example.test/private/destination?view=full#part');
    assert.equal(h.created[0].active,false); assert.equal(h.created[0].cookieStoreId,'firefox-container-7');
    assert.equal(h.source.href,before); assert.equal(sourceUpdates,0); assert.equal(f.owner.activations,undefined);
    assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('app-data changed private props between press and release abort the gesture', async()=>{
    const h=harness(); await flush(); const f=privateCard({href:'/private/first'});
    h.mouse('pointerdown',f.text); h.mouse('mousedown',f.text);
    f.props.href='/private/recycled-card';
    for(const type of ['pointerup','mouseup','auxclick'])h.mouse(type,f.text);
    await flush(); await settle(h);
    assert.equal(h.created.length,0); assert.equal(f.owner.activations,undefined);
    assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('app-data ID-only props keep one original discovery activation', async()=>{
    const h=harness(); await flush(); const f=privateCard({storyId:'012345'}); let updates=0;
    f.owner.onActivate=()=>{updates++;h.nav('https://handler.test/id-only-result');};
    h.gesture(f.text); await flush(); await settle(h);
    assert.equal(updates,1); assert.equal(f.owner.activations,1); assert.equal(h.created.length,1);
    assert.equal(h.created[0].url,'https://handler.test/id-only-result');
    assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });
  await test('app-data ancestor fiber routes remain evidence and keep one discovery activation', async()=>{
    const h=harness(); await flush(); const f=privateCard({});
    Object.defineProperty(f.owner,'__reactFiber$integration',{value:{stateNode:f.owner,memoizedProps:{},return:{memoizedProps:{href:'/unverified-fiber-route'},return:null}}});
    f.owner.onActivate=()=>h.nav('https://handler.test/fiber-result');
    h.gesture(f.text); await flush(); await settle(h);
    assert.equal(f.owner.activations,1); assert.equal(h.created.length,1);
    assert.equal(h.created[0].url,'https://handler.test/fiber-result');
    assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });
  await test('app-data conflicting exact host addresses keep the original discovery result', async()=>{
    const h=harness(); await flush(); const f=privateCard({href:'/private/one',to:'/private/two'});
    f.owner.onActivate=()=>h.nav('https://handler.test/actual-result');
    h.gesture(f.text); await flush(); await settle(h);
    assert.equal(f.owner.activations,1); assert.equal(h.created.length,1);
    assert.equal(h.created[0].url,'https://handler.test/actual-result');
  });
  await test('app-data private address does not bypass rejected explicit metadata', async()=>{
    const h=harness(); await flush(); const f=privateCard({href:'/private/must-not-override'});
    f.owner.attrs['data-url']=''; f.owner.onActivate=()=>h.nav('https://handler.test/metadata-fallback');
    h.attach(f.text); assert.equal(h.resolve(f.text),null);
    h.gesture(f.text); await flush(); await settle(h);
    assert.equal(f.owner.activations,1); assert.equal(h.created.length,1);
    assert.equal(h.created[0].url,'https://handler.test/metadata-fallback');
  });
  await test('app-data keeps form editable disabled submit and reset ancestors excluded outside the owner', async()=>{
    for(const kind of ['form','editable','disabled','submit','reset']){
      const h=harness(); await flush(); const f=privateCard({href:'/private/excluded'});
      const outer=el(kind==='form'?'form':['submit','reset'].includes(kind)?'button':'div',kind==='disabled'?{disabled:''}:['submit','reset'].includes(kind)?{type:kind}:{},[f.owner],kind==='editable'?{isContentEditable:true}:{});
      h.attach(f.text); assert.ok(outer.contains(f.text)); assert.equal(h.resolve(f.text),null,kind);
      h.gesture(f.text); await flush(); await settle(h);
      assert.equal(h.created.length,0,kind); assert.equal(f.owner.activations,undefined,kind);
      assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false,kind);
    }
  });
  await test('legacy saved app-data false still opens directly once without source activation', async()=>{
    const h=harness(); await flush(); await h.browser.storage.local.set({fntAppDataEnabled:false}); await flush();
    const f=privateCard({href:'/private/automatic-result'});let sourceUpdates=0;f.owner.onActivate=()=>{sourceUpdates++;h.nav('https://wrong.test/legacy-false-handler');};
    h.gesture(f.text); await flush(); await settle(h);
    assert.equal(f.owner.activations,undefined);assert.equal(sourceUpdates,0);assert.equal(h.created.length,1);
    assert.equal(h.created[0].url,'https://generic.example.test/private/automatic-result');assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('global toolbar OFF keeps automatic app-data and source controls untouched', async()=>{
    const h=harness({enabled:false});await flush();const f=privateCard({href:'/private/disabled-toolbar'});let unwraps=0;
    Object.defineProperty(f.owner,'wrappedJSObject',{get(){unwraps++;throw Error('Toolbar OFF must not inspect page data');},configurable:true});
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(unwraps,0);assert.equal(f.owner.activations,undefined);assert.equal(h.created.length,0);assert.equal(h.sent.length,0);
  });

  function ownedPrivateCard(link, layers=3) {
    const f=privateCard({href:undefined});
    const host={tag:5,stateNode:f.owner,memoizedProps:f.props,child:null,sibling:null,return:null,alternate:null};
    f.components=[];let child=host;
    for(let i=0;i<layers;i++) {
      const parent={tag:0,memoizedProps:{link},child,sibling:null,return:null,alternate:null};
      child.return=parent;f.components.push(parent);child=parent;
    }
    const root={tag:3,stateNode:null,memoizedProps:null,child,sibling:null,return:null,alternate:null};
    root.stateNode={current:root};child.return=root;
    Object.defineProperty(f.owner,'__reactFiber$integration',{value:host,writable:true,configurable:true});
    f.fiber=host;f.root=root;return f;
  }
  function makeAlternate(f,link) {
    const host={tag:5,stateNode:f.owner,memoizedProps:f.props,child:null,sibling:null,return:null,alternate:f.fiber};
    const component={tag:0,memoizedProps:{link},child:host,sibling:null,return:null,alternate:null};
    const root={tag:3,stateNode:f.root.stateNode,memoizedProps:null,child:component,sibling:null,return:null,alternate:f.root};
    host.return=component;component.return=root;f.fiber.alternate=host;f.root.alternate=root;
    return {host,component,root};
  }
  await test('owned component link repeats the reported pattern without any provider route rule',async()=>{
    for(const config of [
      {page:'https://one.unrelated.test/feed',pathname:'/reports/topic-12',hostHref:undefined},
      {page:'https://another.unrelated.test/stream',pathname:'/collections/article-729',hostHref:null}
    ]) {
      const h=harness({page:config.page});await flush();const f=ownedPrivateCard({pathname:config.pathname},6);f.props.href=config.hostHref;
      let updates=0;f.owner.onActivate=()=>{updates++;h.nav('https://wrong.test/must-not-run');};
      h.attach(f.text);assert.equal(h.resolve(f.text),new URL(config.pathname,config.page).href);
      const before=h.source.href;h.gesture(f.text);await flush();await settle(h);
      assert.equal(h.created.length,1);assert.equal(h.created[0].url,new URL(config.pathname,config.page).href);
      assert.equal(h.created[0].active,false);assert.equal(h.created[0].cookieStoreId,'firefox-container-7');
      assert.equal(h.source.href,before);assert.equal(updates,0);assert.equal(f.owner.activations,undefined);
      assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
    }
  });
  await test('owned component links preserve full literal search and hash parts',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/records/64',search:'?sort=new&view=full',hash:'#replies'});
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/records/64?sort=new&view=full#replies');
    assert.equal(f.owner.activations,undefined);
  });
  await test('owned component route changes between press and release abort instead of activating',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/records/first'});
    h.mouse('pointerdown',f.text);h.mouse('mousedown',f.text);
    for(const component of f.components)component.memoizedProps.link={pathname:'/records/recycled'};
    for(const type of ['pointerup','mouseup','auxclick'])h.mouse(type,f.text);
    await flush();await settle(h);
    assert.equal(h.created.length,0);assert.equal(f.owner.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('owned component rejects a stale alternate-only route and keeps one actual discovery activation',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard(undefined);
    const stale=makeAlternate(f,{pathname:'/stale/wrong'});f.owner.__reactFiber$integration=stale.host;
    f.owner.onActivate=()=>h.nav('https://handler.test/current-destination');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/current-destination');
  });
  await test('owned component follows the verified current alternate instead of the DOM stored stale fiber',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/current/correct'});
    const stale=makeAlternate(f,{pathname:'/stale/wrong'});f.owner.__reactFiber$integration=stale.host;
    h.attach(f.text);assert.equal(h.resolve(f.text),'https://generic.example.test/current/correct');
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/current/correct');assert.equal(f.owner.activations,undefined);
  });
  await test('owned component missing current-root proof retains the existing fallback',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/unproven/route'});
    f.root.stateNode.current={tag:3};f.owner.onActivate=()=>h.nav('https://handler.test/proven-by-handler');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/proven-by-handler');
  });
  await test('owned component mismatched current host props cannot supply an address',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/mismatched/route'});
    f.fiber.memoizedProps={href:undefined};f.owner.onActivate=()=>h.nav('https://handler.test/mismatched-fallback');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/mismatched-fallback');
  });
  await test('owned component with another emitted DOM root cannot redirect the clicked owner',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/sibling/wrong'},1);
    f.fiber.sibling={tag:5,stateNode:el('div'),memoizedProps:{},child:null,sibling:null,return:f.components[0]};
    f.owner.onActivate=()=>h.nav('https://handler.test/sibling-fallback');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/sibling-fallback');
  });
  await test('owned component unsupported query objects are not silently dropped',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/records/query',query:{mode:'full'}});
    f.owner.onActivate=()=>h.nav('https://handler.test/records/query?mode=full');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/records/query?mode=full');
  });
  await test('owned component conflicting route configurations retain the original handler result',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/records/first'});
    f.components[1].memoizedProps.link={pathname:'/records/other'};
    f.owner.onActivate=()=>h.nav('https://handler.test/conflict-result');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/conflict-result');
  });
  await test('owned component link still respects an enclosing form exclusion',async()=>{
    const h=harness();await flush();const f=ownedPrivateCard({pathname:'/records/excluded'});
    const form=el('form',{},[f.owner]);h.attach(f.text);assert.ok(form.contains(f.text));assert.equal(h.resolve(f.text),null);
    h.gesture(f.text);await flush();await settle(h);
    assert.equal(h.created.length,0);assert.equal(f.owner.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });

  function addDeepRootContexts(f,count) {
    const outside=el('section',{},[f.owner]);
    const first=f.root.child;
    const boundary={tag:5,stateNode:outside,memoizedProps:{link:{pathname:'/outside/must-not-route'}},child:first,sibling:null,return:null,alternate:null};
    first.return=boundary;let child=boundary;
    for(let i=0;i<count;i++){
      const parent={tag:10,memoizedProps:{},child,sibling:null,return:null,alternate:null};
      child.return=parent;child=parent;
    }
    f.root.child=child;child.return=f.root;f.outside=outside;return f;
  }
  await test('deep root contexts still open one owned destination without activating the source',async()=>{
    for(const depth of [300,900]){
      const h=harness();await flush();const f=addDeepRootContexts(ownedPrivateCard({pathname:'/deep/direct',search:'?view=full',hash:'#story'},6),depth);
      let updates=0;f.owner.onActivate=()=>{updates++;h.nav('https://wrong.test/deep-must-not-run');};
      h.attach(f.text);assert.equal(h.resolve(f.text),'https://generic.example.test/deep/direct?view=full#story');
      const before=h.source.href;h.gesture(f.text);await flush();await settle(h);
      assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/deep/direct?view=full#story');
      assert.equal(h.created[0].active,false);assert.equal(h.source.href,before);assert.equal(updates,0);
      assert.equal(f.owner.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
    }
  });
  await test('a deep wrong current root keeps one original fallback activation',async()=>{
    const h=harness();await flush();const f=addDeepRootContexts(ownedPrivateCard({pathname:'/deep/unverified'}),300);
    f.root.stateNode.current={};f.owner.onActivate=()=>h.nav('https://handler.test/deep-current-fallback');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/deep-current-fallback');
    assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });
  await test('a root beyond the larger depth ceiling fails back once without guessing',async()=>{
    const h=harness();await flush();const f=addDeepRootContexts(ownedPrivateCard({pathname:'/deep/over-budget'}),1100);
    f.owner.onActivate=()=>h.nav('https://handler.test/deep-limit-fallback');
    h.attach(f.text);assert.equal(h.resolve(f.text),null);h.gesture(f.text);await flush();await settle(h);
    assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/deep-limit-fallback');
    assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });


  await test('typed anchorless reported shape at226 levels opens directly without source activation',async()=>{
    for(const flag of [true,false]){
      const h=harness({page:'https://different.example.test/home'});await flush();
      const link={anchorless:flag,pathname:'/stories/topic-731',...(flag?{}:{search:'?view=full',hash:'#comments'})};
      const f=addDeepRootContexts(ownedPrivateCard(link,6),217);f.components[4].memoizedProps={};
      let updates=0;f.owner.onActivate=()=>{updates++;h.nav('https://wrong.test/anchorless-handler-must-not-run');};
      h.attach(f.text);const expected='https://different.example.test/stories/topic-731'+(flag?'':'?view=full#comments');
      assert.equal(h.resolve(f.text),expected);const before=h.source.href;
      h.gesture(f.text);await flush();await settle(h);
      assert.equal(h.created.length,1);assert.equal(h.created[0].url,expected);assert.equal(h.created[0].active,false);
      assert.equal(h.created[0].cookieStoreId,'firefox-container-7');assert.equal(h.source.href,before);
      assert.equal(updates,0);assert.equal(f.owner.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
    }
  });
  await test('invalid anchorless types retain exactly one actual navigation fallback',async()=>{
    let calls=0;
    for(const value of ['true',{toString(){calls++;return 'true';}},()=>{calls++;return true;}]){
      const h=harness();await flush();const f=addDeepRootContexts(ownedPrivateCard({anchorless:value,pathname:'/must-not-open'}),217);
      f.owner.onActivate=()=>h.nav('https://handler.test/anchorless-invalid-fallback');
      h.attach(f.text);assert.equal(h.resolve(f.text),null);h.gesture(f.text);await flush();await settle(h);
      assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://handler.test/anchorless-invalid-fallback');
      assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
    }
    assert.equal(calls,0);
  });
  await test('anchorless cannot bypass unknown metadata unsupported queries or missing paths',async()=>{
    for(const link of [{anchorless:true,pathname:'/x',routeFlag:true},{anchorless:false,pathname:'/x',query:{mode:'full'}},{anchorless:true}]){
      const h=harness();await flush();const f=ownedPrivateCard(link);
      f.owner.onActivate=()=>h.nav('https://handler.test/anchorless-context-fallback?mode=full');
      h.attach(f.text);assert.equal(h.resolve(f.text),null);h.gesture(f.text);await flush();await settle(h);
      assert.equal(f.owner.activations,1);assert.equal(h.created.length,1);
      assert.equal(h.created[0].url,'https://handler.test/anchorless-context-fallback?mode=full');
      assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
    }
  });

`;
(async()=>{
  const generic=await replay('generic-resolver.cjs',source=>once(source,'vm.runInContext(source, context);',String.raw`
vm.runInContext(source, context);
const __originalResolve=context.FNT.resolve;
context.browser={storage:{onChanged:{addListener(){throw Error('Automatic routing must not subscribe to feature settings');}},local:{get(){throw Error('Automatic routing must not read feature settings');}}}};
vm.runInContext(${JSON.stringify(componentSource)}, context, {filename:'component-link.js'});
vm.runInContext(${JSON.stringify(appSource)}, context, {filename:'app-data.js'});
assert.notEqual(context.FNT.resolve,__originalResolve,'app-data wrapper must actually be installed');
`),33,'PASS generic resolver');
  const integrated=await replay('generalized-regressions.cjs',source=>{
    source=once(source,"['resolver.js','content.js']","['resolver.js','component-link.js','app-data.js','content.js']");
    const summary="  console.log(count+' generalized integration checks passed (real modules, mocked DOM/browser; Firefox retest still required).');";
    return once(source,summary,extraCases+'\n'+summary);
  },58,'PASS generalized integration');
  console.log(generic+' original resolver checks replayed with automatic app-data resolution.');
  console.log('32 original integration checks replayed with automatic app-data resolution; 26 additional real-module integration checks passed.');
  console.log((generic+integrated)+' app-data compatibility/integration checks passed (mocked browser/DOM; no native Firefox/Xray claim).');
})().catch(error=>{console.error(error);process.exitCode=1;});
