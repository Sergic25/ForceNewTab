/* Runs the real discovery module against a fake clock and browser events.
 * These tests do not establish Firefox event timing, attribution or focus.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "discovery.js"), "utf8");

function clock() {
  let now = 10_000, next = 1;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, delay) {
      const id = next++;
      timers.set(id, {at: now + delay, fn});
      return id;
    },
    clearTimeout(id) {timers.delete(id);},
    tick(ms) {
      const target = now + ms;
      while (true) {
        let due = null;
        for (const entry of timers) {
          if (entry[1].at <= target && (!due || entry[1].at < due[1].at)) due = entry;
        }
        if (!due) break;
        timers.delete(due[0]); now = due[1].at; due[1].fn();
      }
      now = target;
    },
    size: () => timers.size
  };
}
function event() {
  const listeners = [];
  return {addListener(fn) {listeners.push(fn);}, fire(details) {
    for (const listener of listeners) listener(details);
  }};
}
function harness({enabled = true, opening} = {}) {
  const timer = clock(), opened = [];
  const webNavigation = {};
  for (const name of ["onBeforeNavigate","onCommitted","onHistoryStateUpdated",
    "onReferenceFragmentUpdated","onCreatedNavigationTarget"]) webNavigation[name] = event();
  const browser = {webNavigation, tabs:{onRemoved:event()}};
  const context = vm.createContext({URL, Date:{now:timer.now},
    setTimeout:timer.setTimeout, clearTimeout:timer.clearTimeout});
  vm.runInContext(source, context, {filename:"discovery.js"});
  let mode = enabled;
  const api = context.FNTDiscovery.install(browser, {
    isEnabled: () => mode,
    open(url, tab) {opened.push({url,tab}); return opening ? opening(url,tab) : Promise.resolve({ok:true});}
  });
  const sender = {tab:{id:4,windowId:2,cookieStoreId:"firefox-container-3"},frameId:0};
  const request = {attemptId:"attempt-1",beforeURL:"https://example.test/start"};
  return {timer,browser,api,sender,request,opened,
    setEnabled(value) {mode = value;},
    arm(message = request, origin = sender) {return api.arm(message, origin);},
    fire(name = "onHistoryStateUpdated", extra = {}) {
      webNavigation[name].fire({tabId:4,frameId:0,url:"https://example.test/destination",
        timeStamp:timer.now(),...extra});
    }};
}

let count = 0;
async function test(name, run) {
  await run(); count++; console.log("PASS discovery",name);
}
(async () => {
  await test("valid arm and one busy session per source tab", () => {
    const h = harness(); assert.equal(h.arm().ok,true);
    assert.equal(h.arm({...h.request,attemptId:"attempt-2"}).reason,"busy");
    h.fire(); h.timer.tick(60);
    assert.equal(h.opened.length,1); assert.equal(h.timer.size(),0);
  });
  await test("rejects malformed attempt IDs baselines and source scope", () => {
    const h = harness();
    for (const message of [
      {...h.request,attemptId:""}, {...h.request,attemptId:"x".repeat(129)},
      {...h.request,attemptId:7}, {...h.request,beforeURL:"javascript:alert(1)"},
      {...h.request,beforeURL:"https://a:b@example.test/"}, {...h.request,beforeURL:"/relative"}
    ]) assert.equal(h.arm(message).reason,"invalid");
    for (const sender of [
      {}, {tab:{id:-1,windowId:2},frameId:0},
      {tab:{id:4,windowId:NaN},frameId:0}, {...h.sender,frameId:-1}
    ]) assert.equal(h.arm(h.request,sender).reason,"invalid");
    assert.equal(h.timer.size(),0);
  });
  for (const type of ["onBeforeNavigate","onCommitted","onHistoryStateUpdated","onReferenceFragmentUpdated"]) {
    await test(type+" discovers a changed URL after settling", () => {
      const h = harness(); h.arm(); h.fire(type); h.timer.tick(59);
      assert.equal(h.opened.length,0); h.timer.tick(1);
      assert.equal(h.opened.length,1); assert.equal(h.opened[0].url,"https://example.test/destination");
      assert.equal(h.opened[0].tab.id,4);
      assert.equal(h.opened[0].tab.windowId,2);
      assert.equal(h.opened[0].tab.cookieStoreId,"firefox-container-3");
    });
  }
  await test("same baseline and unsupported destinations are ignored", () => {
    const h = harness(); h.arm();
    for (const url of [h.request.beforeURL,"javascript:alert(1)","data:text/plain,x",
      "file:///tmp/a","https://a:b@example.test/","http://["]) h.fire(undefined,{url});
    h.timer.tick(100); assert.equal(h.opened.length,0);
    h.fire(undefined,{url:"https://example.test/start#new"});
    h.timer.tick(60); assert.equal(h.opened.length,1);
  });
  await test("iframe scope accepts original frame or top frame but ignores siblings", () => {
    for (const accepted of [7,0]) {
      const h = harness(); h.arm(h.request,{...h.sender,frameId:7});
      h.fire(undefined,{frameId:8}); h.timer.tick(60); assert.equal(h.opened.length,0);
      h.fire(undefined,{frameId:accepted}); h.timer.tick(60); assert.equal(h.opened.length,1);
    }
  });
  await test("iframe attempts compare top events with the known top URL", () => {
    const h = harness();
    const request = {...h.request,beforeURL:"https://frame.test/content"};
    const sender = {...h.sender,frameId:7,tab:{...h.sender.tab,url:"https://example.test/top"}};
    h.arm(request,sender);
    h.fire(undefined,{frameId:0,url:"https://example.test/top"});
    h.fire(undefined,{frameId:7,url:"https://frame.test/content"});
    h.timer.tick(60); assert.equal(h.opened.length,0);
    h.fire(undefined,{frameId:0,url:"https://example.test/new-top"});
    h.timer.tick(60); assert.equal(h.opened.length,1);
    assert.equal(h.opened[0].url,"https://example.test/new-top");
  });
  await test("iframe destinations are not compared with another frame's baseline", () => {
    const h = harness();
    h.arm({...h.request,beforeURL:"https://frame.test/content"},
      {...h.sender,frameId:7,tab:{...h.sender.tab,url:"https://example.test/top"}});
    h.fire(undefined,{frameId:7,url:"https://example.test/top"});
    h.timer.tick(60); assert.equal(h.opened.length,1);
    assert.equal(h.opened[0].url,"https://example.test/top");
  });
  await test("old and malformed timestamps are ignored; absent timestamp is accepted", () => {
    const h = harness(); h.arm();
    h.fire(undefined,{timeStamp:h.timer.now()-1});
    h.fire(undefined,{timeStamp:NaN}); h.timer.tick(60); assert.equal(h.opened.length,0);
    h.fire(undefined,{timeStamp:undefined}); h.timer.tick(60); assert.equal(h.opened.length,1);
  });
  await test("first valid URL wins across redirects and duplicate notifications", () => {
    const h = harness(); h.arm(); h.fire("onBeforeNavigate",{url:"https://example.test/first"});
    h.fire("onBeforeNavigate",{url:"https://example.test/redirected"});
    h.fire("onCommitted",{url:"https://example.test/redirected"});
    h.fire(); h.timer.tick(60); h.fire(); h.timer.tick(60);
    assert.equal(h.opened.length,1); assert.equal(h.opened[0].url,"https://example.test/first");
  });
  await test("native about:blank target wins during the settling interval", () => {
    const h = harness(); h.arm(); h.fire(); h.timer.tick(20);
    h.browser.webNavigation.onCreatedNavigationTarget.fire({
      sourceTabId:4,sourceFrameId:0,tabId:9,url:"about:blank",timeStamp:h.timer.now()});
    h.timer.tick(9_000); assert.equal(h.opened.length,0); assert.equal(h.timer.size(),0);
    assert.equal(h.arm({...h.request,attemptId:"later"}).ok,true);
  });
  await test("unrelated old malformed and same-tab native targets do not consume", () => {
    const h = harness(); h.arm();
    const native = {sourceTabId:4,sourceFrameId:0,tabId:9,timeStamp:h.timer.now()};
    for (const extra of [
      {sourceTabId:5}, {sourceFrameId:8}, {tabId:4}, {tabId:-1},
      {timeStamp:h.timer.now()-1}
    ]) h.browser.webNavigation.onCreatedNavigationTarget.fire({...native,...extra});
    h.fire(); h.timer.tick(60); assert.equal(h.opened.length,1);
  });
  await test("native target without candidate consumes without opening another tab", () => {
    const h = harness(); h.arm();
    h.browser.webNavigation.onCreatedNavigationTarget.fire({
      sourceTabId:4,sourceFrameId:0,tabId:9,url:"https://example.test/native"});
    h.fire(); h.timer.tick(60); assert.equal(h.opened.length,0); assert.equal(h.timer.size(),0);
  });
  await test("attempt IDs and frame scope protect against stale cancellation", () => {
    const h = harness(); h.arm();
    assert.equal(h.api.cancel({...h.request,attemptId:"stale"},h.sender).cancelled,false);
    assert.equal(h.api.cancel(h.request,{...h.sender,frameId:7}).cancelled,false);
    assert.equal(h.api.cancel(h.request,h.sender).cancelled,true);
    assert.equal(h.timer.size(),0);
    h.arm({...h.request,attemptId:"new"});
    assert.equal(h.api.cancel(h.request,h.sender).cancelled,false);
    h.fire(); h.timer.tick(60); assert.equal(h.opened.length,1);
  });
  await test("expiry releases source tab and removes every timer", () => {
    const h = harness(); h.arm(); h.timer.tick(8_000);
    assert.equal(h.timer.size(),0);
    h.fire(); h.timer.tick(60); assert.equal(h.opened.length,0);
    assert.equal(h.arm({...h.request,attemptId:"new"}).ok,true);
  });
  await test("source tab removal cancels a pending candidate", () => {
    const h = harness(); h.arm(); h.fire();
    h.browser.tabs.onRemoved.fire(4); h.timer.tick(60);
    assert.equal(h.opened.length,0); assert.equal(h.timer.size(),0);
  });
  await test("disabled arm and mode change before settlement do not open", () => {
    const h = harness({enabled:false}); assert.equal(h.arm().reason,"disabled");
    h.setEnabled(true); h.arm(); h.fire(); h.setEnabled(false); h.timer.tick(60);
    assert.equal(h.opened.length,0); assert.equal(h.timer.size(),0);
  });
  await test("cancelAll clears independent tab sessions and candidates", () => {
    const h = harness(); h.arm(); h.fire();
    h.arm(h.request,{...h.sender,tab:{id:5,windowId:2}});
    h.api.cancelAll(); h.timer.tick(9_000);
    assert.equal(h.opened.length,0); assert.equal(h.timer.size(),0);
  });
  await test("same destination in independent tabs is not URL-deduplicated", () => {
    const h = harness(); h.arm(); h.arm(h.request,{...h.sender,tab:{id:5,windowId:2}});
    h.fire(); h.fire(undefined,{tabId:5}); h.timer.tick(60);
    assert.equal(h.opened.length,2);
    h.arm({...h.request,attemptId:"again"}); h.fire(); h.timer.tick(60);
    assert.equal(h.opened.length,3);
  });
  await test("session is consumed before an asynchronous open finishes", () => {
    const h = harness({opening:() => new Promise(() => {})});
    h.arm(); h.fire(); h.timer.tick(60);
    h.fire(); h.timer.tick(60); assert.equal(h.opened.length,1);
    assert.equal(h.arm({...h.request,attemptId:"next"}).ok,true);
  });
  await test("throwing and rejected opens do not retry", async () => {
    for (const opening of [
      () => {throw Error("closed");},
      () => Promise.reject(Error("denied"))
    ]) {
      const h = harness({opening}); h.arm(); h.fire(); h.timer.tick(60);
      await Promise.resolve(); h.fire(); h.timer.tick(9_000);
      assert.equal(h.opened.length,1); assert.equal(h.timer.size(),0);
    }
  });
  console.log(count+" discovery tests passed (mocked browser events and clock).");
})().catch(error => {console.error(error); process.exitCode = 1;});

