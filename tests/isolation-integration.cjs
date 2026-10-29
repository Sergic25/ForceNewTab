'use strict';
// Replays unchanged integration fixtures with an isolated-copy hook stub.
// Real runtime modules run against mocked browser/DOM objects; not native Firefox.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const filename=path.join(__dirname,'generalized-regressions.cjs');
const before=fs.readFileSync(filename,'utf8');
function once(source,needle,replacement){assert.equal(source.split(needle).length,2,'Unique replay anchor required: '+needle.slice(0,90));return source.replace(needle,replacement);}
const extraCases=String.raw`
  function isolatedGesture(h,target){for(const type of ['pointerdown','mousedown','pointerup','mouseup','auxclick'])h.mouse(type,target,{shiftKey:true});}
  function deferredIsolation(h){let resolve;h.isolationResult=new Promise(done=>{resolve=done;});return resolve;}
  await test('isolation known anchor bypasses the new hook entirely',async()=>{
    const h=harness();await flush();const target=el('a',{href:'/known'});h.isolationResult=Promise.resolve({fallback:false,activated:true});
    isolatedGesture(h,target);await flush();assert.equal(h.isolationCalls.length,0);assert.equal(h.created.length,1);assert.equal(h.created[0].url,'https://generic.example.test/known');
  });
  await test('isolation known displayed image bypasses the new hook entirely',async()=>{
    const h=harness();await flush();const f=imageFixture();h.isolationResult=Promise.resolve({fallback:false,activated:true});
    isolatedGesture(h,f.image);await flush();assert.equal(h.isolationCalls.length,0);assert.equal(h.created.length,1);assert.equal(f.button.activations,undefined);
  });
  await test('isolation known post card bypasses the new hook entirely',async()=>{
    const h=harness();await flush();const f=cardFixture();h.isolationResult=Promise.resolve({fallback:false,activated:true});
    isolatedGesture(h,f.text);await flush();assert.equal(h.isolationCalls.length,0);assert.equal(h.created[0].url,'https://generic.example.test/conversation/42');assert.equal(f.card.activations,undefined);
  });
  await test('isolation known artwork card bypasses the new hook entirely',async()=>{
    const h=harness();await flush();const f=artworkFixture();h.isolationResult=Promise.resolve({fallback:false,activated:true});
    isolatedGesture(h,f.overlay);await flush();assert.equal(h.isolationCalls.length,0);assert.equal(h.created[0].url,'https://generic.example.test/releases/new-album');assert.equal(f.overlay.activations,undefined);
  });
  await test('isolation null hook keeps ordinary unknown-control discovery once',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.gesture(target);await flush();
    assert.equal(h.isolationCalls.length,1);assert.equal(h.isolationCalls[0].gesture.shiftKey,false);assert.equal(target.activations,1);assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });
  await test('isolation claimed Shift gesture never activates the source or arms legacy discovery',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.isolationResult=Promise.resolve({fallback:false,activated:true});
    isolatedGesture(h,target);await flush();assert.equal(h.isolationCalls.length,1);assert.equal(h.isolationCalls[0].gesture.shiftKey,true);assert.equal(h.isolationCalls[0].target,target);
    assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('isolation claimed ordinary middle click never activates the source',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.isolationResult=Promise.resolve({fallback:false,activated:true});
    h.gesture(target);await flush();assert.equal(h.isolationCalls.length,1);assert.equal(h.isolationCalls[0].gesture.shiftKey,false);assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('isolation confirmed pre-activation failure runs one legacy fallback',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.isolationResult=Promise.resolve({fallback:true,activated:false});
    isolatedGesture(h,target);await flush();assert.equal(target.activations,1);assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });
  await test('isolation already activated result cannot replay the source',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.isolationResult=Promise.resolve({fallback:true,activated:true});
    isolatedGesture(h,target);await flush();assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('isolation rejected transport leaves source unactivated',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.isolationResult=Promise.reject(Error('lost isolated acknowledgement'));
    isolatedGesture(h,target);await flush();assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  for(const input of ['key','mouse','blur','pagehide','url']){
    await test('isolation stale fallback is suppressed after '+input,async()=>{
      const h=harness();await flush();const target=el('button',{type:'button'}),resolve=deferredIsolation(h);isolatedGesture(h,target);await flush();
      if(input==='key')h.listeners.keydown({isTrusted:true});
      if(input==='mouse')h.mouse('mousedown',el('div'),{button:0});
      if(input==='blur'||input==='pagehide')h.listeners[input]();
      if(input==='url')h.source.href='https://generic.example.test/other-view';
      resolve({fallback:true,activated:false});await flush();assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
    });
  }
  await test('isolation moved-into-form target cannot run a delayed fallback',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'}),resolve=deferredIsolation(h);isolatedGesture(h,target);await flush();
    target.parentElement=el('form');resolve({fallback:true,activated:false});await flush();assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
  });
  await test('isolation blocked form never calls the new hook',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});el('form',{},[target]);isolatedGesture(h,target);await flush();
    assert.equal(h.isolationCalls.length,0);assert.equal(target.activations,undefined);assert.equal(h.sent.length,0);
  });
  await test('isolation synchronous hook failure keeps existing discovery',async()=>{
    const h=harness();await flush();const target=el('button',{type:'button'});h.isolationThrow=true;isolatedGesture(h,target);await flush();
    assert.equal(target.activations,1);assert.equal(h.sent.filter(m=>m.type==='fnt-arm').length,1);
  });
  for(const change of ['disconnected','adopted']){
    await test('isolation '+change+' target cannot run delayed fallback',async()=>{
      const h=harness();await flush();const target=el('button',{type:'button'}),resolve=deferredIsolation(h);isolatedGesture(h,target);await flush();
      if(change==='disconnected')target.isConnected=false;else target.ownerDocument={};resolve({fallback:true,activated:false});await flush();
      assert.equal(target.activations,undefined);assert.equal(h.sent.some(m=>m.type==='fnt-arm'),false);
    });
  }
`;
(async()=>{
 let source=before.replace(/\r\n/g,'\n');
 const needle='  const content=vm.createContext({...common,HTMLElement:MockHTMLElement,location:h.source,document:h.document,browser,window});';
 source=once(source,needle,`  h.isolationCalls=[];h.isolationResult=null;h.isolationThrow=false;
  const content=vm.createContext({...common,HTMLElement:MockHTMLElement,location:h.source,document:h.document,browser,window,
    FNTIsolation:{isEnabled:()=>false,isPending:()=>false,isModifierGesture:()=>false,tryStart(target,gesture){h.isolationCalls.push({target,gesture});if(h.isolationThrow)throw Error('hook failed');return h.isolationResult;}}});`);
 const summary="  console.log(count+' generalized integration checks passed (real modules, mocked DOM/browser; Firefox retest still required).');";
 source=once(source,summary,extraCases+summary);
 const lines=[],errors=[],simulatedProcess={exitCode:0};
 const sandbox={require:createRequire(filename),__dirname,__filename:filename,URL,Date,process:simulatedProcess,
  console:{log:(...v)=>lines.push(v.join(' ')),error:(...v)=>errors.push(v.join(' '))}};
 await vm.runInNewContext(source,sandbox,{filename:'generalized-regressions.isolation-hook-replay.cjs'});
 assert.equal(simulatedProcess.exitCode,0,errors.join('\n'));
 assert.equal(errors.length,0,errors.join('\n'));
 const actual=lines.filter(line=>line.startsWith('PASS generalized integration')).length;
 assert.equal(actual,52,'All32originalchecks plus20hookchecks must run');
 assert.equal(fs.readFileSync(filename,'utf8'),before,'Original integration suite must remain unchanged');
 console.log('52 isolation integration checks passed (32 unchanged compatibility replays + 20 hook checks; mocked DOM/browser).');
})().catch(error=>{console.error(error);process.exitCode=1;});
