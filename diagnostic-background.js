(() => {
  "use strict";
  const KEY = "fntRecordNextClick", REPORT = "fntLastClickReport";
  const CORE = {"fnt-arm": "arm-request", "fnt-captured": "capture-request", "fnt-cancel": "cancel-request", "fnt-open": "direct-open-request", "fnt-isolate-start": "copy-request", "fnt-isolate-cancel": "copy-cancel-request", "fnt-isolate-declined": "copy-declined"};
  const FINAL = new Set(["complete", "source-unloaded", "new-input", "expired"]);
  let queue = Promise.resolve(), active = null;
  function enqueue(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }
  function live(recording) {
    return recording && typeof recording.token === "string" && recording.token.length > 0 && recording.token.length <= 100 &&
      Number.isFinite(recording.expires) && recording.expires > Date.now() && recording.expires <= Date.now() + 120000;
  }
  function source(sender) {
    return sender?.id === browser.runtime.id && Number.isInteger(sender.tab?.id) && sender.tab.id >= 0 &&
      Number.isInteger(sender.frameId) && sender.frameId >= 0;
  }
  function valid(message, sender) {
    if (!source(sender)) return false;
    if (typeof message.recordingToken !== "string" || !message.recordingToken.length || message.recordingToken.length > 100) return false;
    const report = message.report;
    if (!report || report.schemaVersion !== 1 || !Array.isArray(report.path) || report.path.length > 20 ||
        !Array.isArray(report.nearby) || report.nearby.length > 4) return false;
    try { return JSON.stringify(report).length <= 22000; } catch { return false; }
  }
  function address(value) {
    const raw = typeof value === "string" ? value : value?.url;
    if (typeof raw !== "string") return null;
    try {
      const url = new URL(raw);
      if (!["https:", "http:"].includes(url.protocol)) return null;
      const path = url.origin + url.pathname;
      return {url: path.length <= 768 ? path : url.origin + "/[long-path-omitted]",
        hadQuery: !!url.search || value?.hadQuery === true, hadFragment: !!url.hash || value?.hadFragment === true};
    } catch { return null; }
  }
  const count = (value, max = 1000) => Number.isFinite(value) && value >= 0 ? Math.min(max, Math.floor(value)) : 0;
  function content(value, initial = false) {
    if (!value || typeof value !== "object" || (initial ? value.status !== "observing" : !FINAL.has(value.status))) return null;
    const out = {status: value.status, elapsedMs: count(value.elapsedMs, 15000), syntheticClickEvents: count(value.syntheticClickEvents),
      titleChanged: value.titleChanged === true, addressChanged: value.addressChanged === true, page: address(value.page),
      navigationEvents: count(value.navigationEvents), navigations: [], limited: value.limited === true};
    if (Array.isArray(value.navigations)) {
      if (value.navigations.length > 4) out.limited = true;
      for (const nav of value.navigations.slice(0, 4)) {
        if (!nav || typeof nav !== "object") continue;
        out.navigations.push({address: address(nav.address), defaultPrevented: nav.defaultPrevented === true,
          cancelable: nav.cancelable === true, trusted: nav.trusted === true,
          navigationType: ["push", "replace", "reload", "traverse"].includes(nav.navigationType) ? nav.navigationType : "unknown"});
      }
    }
    if (value.endInput && typeof value.endInput === "object") {
      const ending = value.endInput;
      out.endInput = {type: ["pointerdown", "mousedown", "keydown"].includes(ending.type) ? ending.type : "other"};
      if (out.endInput.type === "keydown") out.endInput.keyCategory = ["Shift", "Control", "Alt", "Meta"].includes(ending.keyCategory) ? ending.keyCategory : "other";
      else out.endInput.button = Number.isInteger(ending.button) && ending.button >= 0 && ending.button <= 5 ? ending.button : -1;
    }
    return out;
  }
  function current() {
    if (!active) return null;
    if (Date.now() >= active.expires) { active = null; return null; }
    return active;
  }
  function fit(report) {
    const size = () => JSON.stringify(report).length;
    while (size() > 22000 && report.nearby.length) { report.nearby.pop(); report.sizeLimited = true; }
    while (size() > 22000 && report.path.length) { report.path.pop(); report.pathTruncated = report.sizeLimited = true; }
    for (const field of ["inspection", "appData"]) {
      if (size() > 22000 && report[field]) { report[field] = {status: "omitted-for-size"}; report.sizeLimited = true; }
    }
    while (size() > 22000 && report.outcome?.background?.events?.length) {
      report.outcome.background.events.shift(); report.outcome.background.limited = report.sizeLimited = true;
    }
    return size() <= 22000;
  }
  async function save(trace, report) {
    if (!fit(report)) return false;
    await browser.storage.local.set({[REPORT]: report});
    trace.report = report;
    return true;
  }
  async function accept(message, sender) {
    if (!valid(message, sender)) return {saved: false};
    const stored = await browser.storage.local.get({[KEY]: null});
    const recording = stored[KEY];
    if (!live(recording) || recording.token !== message.recordingToken) return {saved: false};
    const report = {...message.report, frameId: sender.frameId};
    const summary = report.outcome?.version === 1 ? content(report.outcome.content, true) : null;
    if (summary) report.outcome = {version: 1, content: summary, background: {correlationOnly: true, observerBuild: "2.0.0", events: [], counts: {}, limited: false}};
    else if (report.outcome) delete report.outcome;
    if (JSON.stringify(report).length > 22000) return {saved: false};
    await browser.storage.local.set({[KEY]: null, [REPORT]: report});
    active = summary ? {token: message.recordingToken, tabId: sender.tab.id, frameId: sender.frameId,
      windowId: sender.tab.windowId, started: Date.now(), expires: Date.now() + 15000, report, attemptId: null} : null;
    return {saved: true};
  }
  async function update(message, sender) {
    const trace = current();
    if (!trace || !source(sender) || sender.tab.id !== trace.tabId || sender.frameId !== trace.frameId || message.recordingToken !== trace.token) return {saved: false};
    try { if (JSON.stringify(message.outcome).length > 3500) return {saved: false}; } catch { return {saved: false}; }
    if (message.outcome?.version !== 1) return {saved: false};
    const summary = content(message.outcome.content);
    if (!summary) return {saved: false};
    const report = {...trace.report, outcome: {...trace.report.outcome, content: summary}};
    const saved = await save(trace, report);
    // A terminal update ends correlation even if its storage write failed.
    if (active === trace) active = null;
    return {saved};
  }
  async function note(type, options = {}) {
    const trace = current();
    if (!trace) return;
    const background = {...trace.report.outcome.background, counts: {...trace.report.outcome.background.counts}, events: [...trace.report.outcome.background.events]};
    background.counts[type] = Math.min(1000, (background.counts[type] || 0) + 1);
    const event = {type, elapsedMs: count(Date.now() - trace.started, 15000)};
    if (Number.isInteger(options.frameId)) event.frameId = options.frameId;
    if (options.url !== undefined) event.address = address(options.url);
    if (background.events.length < 16) background.events.push(event);
    else background.limited = true;
    while (JSON.stringify(background).length > 1500 && background.events.length) { background.events.splice(background.events.length > 1 ? 1 : 0, 1); background.limited = true; }
    const report = {...trace.report, outcome: {...trace.report.outcome, background}};
    await save(trace, report);
  }
  async function core(message, sender) {
    const trace = current();
    if (!trace || !source(sender) || sender.tab.id !== trace.tabId || sender.frameId !== trace.frameId) return;
    if (["fnt-isolate-start", "fnt-isolate-cancel", "fnt-isolate-declined"].includes(message.type)) {
      if (message.type !== "fnt-isolate-declined") {
        if (typeof message.requestId !== "string" || !message.requestId.length || message.requestId.length > 100) return;
        if (message.type === "fnt-isolate-start") {
          if (trace.isolationRequestId && trace.isolationRequestId !== message.requestId) return;
          trace.isolationRequestId = message.requestId;
        } else if (trace.isolationRequestId !== message.requestId) return;
      }
      await note(CORE[message.type], {frameId: sender.frameId});
      return;
    }
    if (message.type !== "fnt-open") {
      if (typeof message.attemptId !== "string" || !message.attemptId.length || message.attemptId.length > 128) return;
      if (message.type === "fnt-arm") {
        if (trace.attemptId && trace.attemptId !== message.attemptId) return;
        trace.attemptId = message.attemptId;
      } else if (trace.attemptId !== message.attemptId) return;
    }
    await note(CORE[message.type], {frameId: sender.frameId,
      ...(typeof message.url === "string" ? {url: message.url} : {})});
  }
  async function navigation(type, details) {
    const trace = current();
    if (!trace || details?.tabId !== trace.tabId || (details.frameId !== trace.frameId && details.frameId !== 0) ||
      (details.timeStamp !== undefined && (!Number.isFinite(details.timeStamp) || details.timeStamp < trace.started))) return;
    await note(type, {frameId: details.frameId, url: details.url});
  }
  async function target(details) {
    const trace = current();
    if (!trace || details?.sourceTabId !== trace.tabId || (details.sourceFrameId !== trace.frameId && details.sourceFrameId !== 0) ||
      !Number.isInteger(details.tabId) || details.tabId < 0 || details.tabId === trace.tabId ||
      (details.timeStamp !== undefined && (!Number.isFinite(details.timeStamp) || details.timeStamp < trace.started))) return;
    await note("page-created-target", {frameId: details.sourceFrameId, url: details.url});
  }
  async function created(tab) {
    const trace = current();
    if (!trace || tab?.openerTabId !== trace.tabId || !Number.isInteger(tab.id) || tab.id < 0 || tab.id === trace.tabId ||
      (Number.isInteger(trace.windowId) && tab.windowId !== trace.windowId)) return;
    await note("related-tab-created", {url: tab.pendingUrl || tab.url});
  }
  async function control(message, sender) {
    // Only the extension's own Preferences page can start or clear recording.
    if (sender?.id !== browser.runtime.id || sender.url !== browser.runtime.getURL("changelog.html")) return {ok: false};
    if (message.command === "clear") {
      active = null;
      await browser.storage.local.set({[KEY]: null, [REPORT]: null});
    } else if (message.command === "record" && typeof message.token === "string" && message.token.length > 0 && message.token.length <= 100) {
      active = null;
      await browser.storage.local.set({[KEY]: {token: message.token, expires: Date.now() + 120000}, [REPORT]: null});
    } else return {ok: false};
    return {ok: true};
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (Object.hasOwn(CORE, message?.type)) {
      // Observe only: returning a Promise would steal the navigation handler's response.
      void enqueue(() => core(message, sender)).catch(() => {});
      return undefined;
    }
    if (!["fnt-diagnostic", "fnt-diagnostic-update", "fnt-diagnostic-control"].includes(message?.type)) return undefined;
    const isControl = message.type === "fnt-diagnostic-control";
    const result = enqueue(() => isControl ? control(message, sender) : message.type === "fnt-diagnostic-update" ? update(message, sender) : accept(message, sender));
    return result.catch(() => isControl ? {ok: false} : {saved: false});
  });
  // Optional API presence keeps the observer compatible with restricted contexts and test harnesses.
  for (const [name, label] of [["onBeforeNavigate", "before-navigate"], ["onCommitted", "committed"],
    ["onHistoryStateUpdated", "history-state"], ["onReferenceFragmentUpdated", "fragment-updated"]]) {
    browser.webNavigation?.[name]?.addListener(details => { void enqueue(() => navigation(label, details)).catch(() => {}); });
  }
  browser.webNavigation?.onCreatedNavigationTarget?.addListener(details => { void enqueue(() => target(details)).catch(() => {}); });
  browser.tabs?.onCreated?.addListener(tab => { void enqueue(() => created(tab)).catch(() => {}); });
  browser.tabs?.onRemoved?.addListener(tabId => {
    void enqueue(() => { if (current()?.tabId === tabId) active = null; }).catch(() => {});
  });
})();
