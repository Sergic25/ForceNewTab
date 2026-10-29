/* Automatic background-copy fallback, controlled by the toolbar. No source control is activated here. */
(() => {
  "use strict";
  const operations = new Map(), recent = new Map();
  // Resolve only the toolbar state; no independent feature preference exists.
  let enabled = true, modeReady = false, modeReadFailed = false, enabledRevision = 0;
  const initialEnabledRevision = enabledRevision;
  const ready = (async () => {
    try {
      const values = await browser.storage.local.get({enabled: true});
      if (enabledRevision === initialEnabledRevision) enabled = values.enabled !== false;
      modeReady = true;
    } catch { if (!modeReady) modeReadFailed = true; }
  })();
  const now = () => Date.now();
  function address(raw) {
    if (typeof raw !== "string" || raw.length > 2048) return null;
    try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
  }
  function owner(sender) {
    return sender?.id === browser.runtime.id && sender.frameId === 0 && Number.isInteger(sender.tab?.id) && sender.tab.id >= 0 &&
      Number.isInteger(sender.tab.windowId) && sender.tab.windowId >= 0;
  }
  function validationReason(message, sender) {
    if (typeof message?.requestId !== "string" || !message.requestId.length || message.requestId.length > 100) return "invalid-request-id";
    const beforeURL = address(message.beforeURL);
    if (!beforeURL) return "invalid-source-address";
    const expectedOrigin = new URL(beforeURL).origin;
    // Firefox's messaging URL may describe the document when its conduit
    // opened, before a same-document SPA route change. It authenticates the
    // origin, while fresh tabs.get() below authenticates the current address.
    if (sender.url !== undefined) {
      const senderURL = address(sender.url);
      if (!senderURL || new URL(senderURL).origin !== expectedOrigin) return "sender-origin-mismatch";
    }
    if (sender.origin !== undefined && (typeof sender.origin !== "string" || sender.origin !== expectedOrigin)) return "sender-origin-mismatch";
    try {
      const serialized = JSON.stringify(message);
      if (typeof serialized !== "string") return "invalid-request-shape";
      if (serialized.length > 7000) return "request-too-large";
      if (globalThis.FNTIsolationTarget?.validDescriptor(message.target) !== true) return "invalid-target-descriptor";
    } catch { return "invalid-request-shape"; }
    return null;
  }
  function senderAddressMatches(message, sender) {
    const beforeURL = address(message?.beforeURL), senderURL = address(sender?.url);
    return beforeURL && senderURL ? senderURL === beforeURL : undefined;
  }
  function activationReason(response) {
    return ["activation-dispatched", "activation-threw", "already-activated"].includes(response?.reason)
      ? response.reason : "activation-unconfirmed";
  }
  function status(op, state, reason, copyKept = false) {
    const summary = {state, reason, activated: op.mayActivated === true, copyKept: copyKept === true, updatedAt: now(), build: "2.0.1"};
    if (state === "activated" || state === "uncertain") summary.effectConfirmed = false;
    if (typeof op.senderAddressMatchesCurrent === "boolean") summary.senderAddressMatchesCurrent = op.senderAddressMatchesCurrent;
    try {
      const version = browser.runtime.getManifest?.().version;
      if (typeof version === "string" && version.length <= 16 && /^\d+(?:\.\d+){0,3}(?:[a-z][0-9a-z.-]*)?$/i.test(version)) summary.manifestVersion = version;
    } catch {}
    try { void Promise.resolve(browser.storage.local.set({fntLastIsolationResult: summary})).catch(() => {}); } catch {}
    return Promise.resolve();
  }
  function stop(op, reason) {
    if (!op || op.cancelled) return;
    op.cancelled = true; op.cancelReason = reason; op.stop({kind: "stop"});
  }
  function alive(op) {
    return !op.cancelled && now() < op.deadline && modeReady && enabled;
  }
  async function bounded(op, fn, initializing = false) {
    const usable = () => !op.cancelled && now() < op.deadline && (initializing || (modeReady && enabled));
    if (!usable()) throw new Error("stopped");
    const result = await Promise.race([Promise.resolve().then(fn).then(value => ({kind: "value", value}), () => ({kind: "error"})), op.stopped]);
    if (result.kind !== "value" || !usable()) throw new Error(result.kind);
    return result.value;
  }
  function delay(op, ms) {
    return bounded(op, () => new Promise(resolve => {
      const id = setTimeout(() => { op.timers.delete(id); resolve(); }, ms);
      op.timers.add(id);
    }));
  }
  async function sourceUnchanged(op) {
    const tab = await bounded(op, () => browser.tabs.get(op.sourceId));
    return tab && address(tab.url) === op.beforeURL && tab.windowId === op.source.windowId &&
      !!tab.incognito === !!op.source.incognito && (!op.source.cookieStoreId || tab.cookieStoreId === op.source.cookieStoreId);
  }
  function matchesSource(copy, source) {
    return copy && Number.isInteger(copy.id) && copy.id >= 0 && copy.id !== source.id && copy.windowId === source.windowId &&
      !!copy.incognito === !!source.incognito && (!source.cookieStoreId || copy.cookieStoreId === source.cookieStoreId);
  }
  function cleanupStep(fn) {
    return new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; resolve({ok: false}); } }, 1000);
      Promise.resolve().then(fn).then(value => {
        if (!settled) { settled = true; clearTimeout(timer); resolve({ok: true, value}); }
      }, () => { if (!settled) { settled = true; clearTimeout(timer); resolve({ok: false}); } });
    });
  }
  async function removeUnused(op) {
    if (op.workerId === null || op.workerGone || op.userTouched || op.mayActivated) return false;
    try {
      const lookup = await cleanupStep(() => browser.tabs.get(op.workerId));
      if (!lookup.ok) return false;
      const tab = lookup.value;
      // Input can arrive while the lookup is pending. Viewing alone does not
      // cancel replay, but an active or interacted-with copy is never closed.
      if (op.userTouched || op.mayActivated || tab?.active) return false;
      if (!tab || tab.id !== op.workerId) return false;
      op.cleaning = true; try { const removed = await cleanupStep(() => browser.tabs.remove(op.workerId)); if (!removed.ok) return false; op.workerGone = true; return true; } finally { op.cleaning = false; }
    } catch { return false; }
  }
  function keep(op) { return op.workerId !== null && !op.workerGone; }
  async function preFailure(op, reason, cancelled = false) {
    await removeUnused(op);
    if (op.userTouched && op.cancelReason === "copy-input") { reason = "copy-input"; cancelled = true; }
    const kept = keep(op);
    await status(op, cancelled ? "cancelled" : "failed", reason, kept);
    const canFallback = !cancelled && (!op.cancelled || op.cancelReason === "timed-out") && !op.userTouched && !kept && enabled &&
      (modeReady || (modeReadFailed && op.readFailureFallbackSafe === true));
    return {fallback: canFallback, activated: false, reason};
  }
  async function run(op, message, sender) {
    try {
      await bounded(op, () => ready, true);
      if (!enabled) return await preFailure(op, "disabled");
      if (!modeReady) {
        // A definitive settings failure must not claim and swallow the gesture.
        // Decline copying, and let the source's original guarded discovery run.
        if (!modeReadFailed) return await preFailure(op, "toolbar-state-unavailable");
        const currentSource = await bounded(op, () => browser.tabs.get(op.sourceId), true);
        if (!currentSource || address(currentSource.url) !== op.beforeURL || currentSource.windowId !== sender.tab.windowId)
          return await preFailure(op, "source-changed");
        op.readFailureFallbackSafe = true;
        return await preFailure(op, "toolbar-read-failed");
      }
      op.source = await bounded(op, () => browser.tabs.get(op.sourceId));
      if (!op.source || address(op.source.url) !== op.beforeURL || op.source.windowId !== sender.tab.windowId) return await preFailure(op, "source-changed");
      await status(op, "preparing", "restoring-copy");
      const duplication = Promise.resolve().then(() => browser.tabs.duplicate(op.sourceId, {active: false}));
      // A late duplicate can still be cleaned up, but must never receive a click.
      duplication.then(copy => {
        if ((op.finished || op.cancelled || now() >= op.deadline) && !op.mayActivated && Number.isInteger(copy?.id) && copy.id >= 0 && copy.id !== op.sourceId) {
          const late = {...op, workerId: copy.id, workerGone: false};
          void removeUnused(late);
        }
      }, () => {});
      const copy = await bounded(op, () => duplication);
      if (!matchesSource(copy, op.source)) {
        // A returned tab belongs to this duplicate request even if its context is wrong.
        if (Number.isInteger(copy?.id) && copy.id >= 0 && copy.id !== op.sourceId) op.workerId = copy.id;
        return await preFailure(op, "copy-context-mismatch");
      }
      op.workerId = copy.id;
      let prepared = null, preparedAt = 0;
      while (alive(op)) {
        let response;
        try {
          response = await bounded(op, () => browser.tabs.sendMessage(op.workerId, {type: "fnt-isolate-prepare", nonce: op.nonce,
            beforeURL: op.beforeURL, target: message.target}, {frameId: 0}));
        } catch {
          if (!alive(op)) throw new Error("stopped");
        }
        // A used-nonce acknowledgement takes precedence even if a malformed
        // response also claims that input prevented activation.
        if (response?.activated === true) {
          op.mayActivated = true;
          const reason = activationReason(response);
          await status(op, reason === "activation-unconfirmed" ? "uncertain" : "activated", reason, keep(op));
          return {fallback: false, activated: true, reason};
        }
        if (response?.userInteracted === true) {
          op.userTouched = true; stop(op, "copy-input");
          return await preFailure(op, "copy-input", true);
        }
        const documentNonce = response?.documentNonce, preparationNonce = response?.preparationNonce;
        if (response?.ok === true && response.ready === true &&
            typeof documentNonce === "string" && documentNonce.length > 0 && documentNonce.length <= 100 &&
            typeof preparationNonce === "string" && preparationNonce.length > 0 && preparationNonce.length <= 100) {
          // Wait for the same document and actual matched control to settle.
          // This gives delayed page initialization time; it cannot prove handlers are ready.
          const stable = prepared?.documentNonce === documentNonce && prepared?.preparationNonce === preparationNonce;
          if (stable && now() - preparedAt >= 1500) {
            if (!await sourceUnchanged(op)) return await preFailure(op, "source-changed");
            const currentCopy = await bounded(op, () => browser.tabs.get(op.workerId));
            if (!matchesSource(currentCopy, op.source) || op.userTouched) {
              return await preFailure(op, "copy-used-or-changed", op.userTouched);
            }
            if (!alive(op)) throw new Error("stopped");
            // From this point, loss of the acknowledgement cannot authorize replay.
            op.mayActivated = true;
            let result;
            try {
              result = await bounded(op, () => browser.tabs.sendMessage(op.workerId, {type: "fnt-isolate-execute", nonce: op.nonce,
                beforeURL: op.beforeURL, target: message.target, documentNonce, preparationNonce}, {frameId: 0}));
            } catch {
              await status(op, "uncertain", "activation-response-unavailable", keep(op));
              return {fallback: false, activated: true, reason: "activation-response-unavailable"};
            }
            if (result?.userInteracted === true && result.activated !== true) {
              op.userTouched = true; stop(op, "copy-input");
              if (result.activated === false) {
                op.mayActivated = false;
                return await preFailure(op, "copy-input", true);
              }
              // Dispatch already happened. An incomplete input reply cannot
              // prove that the control was never invoked.
              await status(op, "uncertain", "activation-unconfirmed", keep(op));
              return {fallback: false, activated: true, reason: "activation-unconfirmed"};
            }
            if (result?.activated === false) {
              // The worker explicitly confirmed that it did not invoke the control.
              op.mayActivated = false;
              return await preFailure(op, "copy-target-changed");
            }
            const reason = result?.activated === true ? activationReason(result) : "activation-unconfirmed";
            await status(op, reason === "activation-unconfirmed" ? "uncertain" : "activated", reason, keep(op));
            return {fallback: false, activated: true, reason};
          }
          if (!stable) { prepared = {documentNonce, preparationNonce}; preparedAt = now(); }
        } else { prepared = null; preparedAt = 0; }
        await delay(op, 250);
      }
      return await preFailure(op, op.cancelReason || "timed-out", op.cancelReason !== "timed-out");
    } catch {
      if (op.mayActivated) {
        await status(op, "uncertain", "activation-response-unavailable", keep(op));
        return {fallback: false, activated: true, reason: "activation-response-unavailable"};
      }
      return await preFailure(op, op.cancelReason || (now() >= op.deadline ? "timed-out" : "copy-unavailable"), op.cancelled && op.cancelReason !== "timed-out");
    } finally {
      op.finished = true;
      for (const id of op.timers) clearTimeout(id);
      op.timers.clear(); clearTimeout(op.deadlineTimer);
      if (operations.get(op.sourceId) === op) operations.delete(op.sourceId);
      recent.set(op.sourceId + ":" + op.requestId, now() + 60000);
      for (const [id, expires] of recent) if (expires <= now()) recent.delete(id);
      while (recent.size > 100) recent.delete(recent.keys().next().value);
    }
  }
  function start(message, sender) {
    if (!owner(sender)) return Promise.resolve({fallback: false, activated: false, reason: "invalid-request"});
    const rejection = validationReason(message, sender);
    if (rejection) {
      void status({mayActivated: false, senderAddressMatchesCurrent: senderAddressMatches(message, sender)}, "rejected", rejection);
      return Promise.resolve({fallback: false, activated: false, reason: "invalid-request", rejectionReason: rejection});
    }
    const existing = operations.get(sender.tab.id);
    if (existing) return existing.requestId === message.requestId ? existing.promise : Promise.resolve({fallback: false, activated: false, reason: "busy"});
    const recentId = sender.tab.id + ":" + message.requestId;
    if ((recent.get(recentId) || 0) > now()) return Promise.resolve({fallback: false, activated: false, reason: "already-consumed"});
    let stopResolve;
    const op = {sourceId: sender.tab.id, requestId: message.requestId, beforeURL: address(message.beforeURL),
      workerId: null, workerGone: false, userTouched: false, mayActivated: false, finished: false, cancelled: false,
      senderAddressMatchesCurrent: senderAddressMatches(message, sender),
      started: now(), deadline: now() + 15000, timers: new Set(), stopped: new Promise(resolve => { stopResolve = resolve; })};
    op.stop = stopResolve;
    try { op.nonce = crypto.randomUUID(); } catch {
      void status(op, "failed", "nonce-unavailable");
      return Promise.resolve({fallback: true, activated: false, reason: "nonce-unavailable"});
    }
    operations.set(op.sourceId, op);
    op.deadlineTimer = setTimeout(() => stop(op, "timed-out"), 15000);
    op.promise = run(op, message, sender);
    return op.promise;
  }
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.hasOwn(changes, "enabled")) return;
    enabledRevision++;
    enabled = changes.enabled.newValue !== false;
    modeReady = true;
    modeReadFailed = false;
    if (!enabled) for (const op of operations.values()) stop(op, "disabled");
  });
  const declineReasons = new Set(["document-unavailable","not-control","disconnected-control","adopted-control","subframe","root-unavailable","closed-shadow-root","inaccessible-shadow-root","shadow-depth-limit","root-cycle","ancestor-limit","ancestor-cycle","form-or-editable","disabled-control","hidden-control","submit-or-reset","nested-control","label-too-long","missing-label-or-identity","identity-too-long","invalid-tag","invalid-descriptor","candidate-limit","aggregate-candidate-limit","ambiguous-shadow-host","shadow-host-not-found","control-not-found","ambiguous-control","read-error","target-changed","target-unavailable"]);
  async function declined(message, sender) {
    if (!owner(sender)) return {ok: false};
    await ready;
    if (!modeReady || !enabled) return {ok: false};
    const reason = typeof message.reason === "string" && declineReasons.has(message.reason) ? message.reason : "target-unavailable";
    await status({mayActivated: false}, "declined", reason, false);
    return {ok: true};
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === "fnt-isolate-start") return start(message, sender);
    if (message?.type === "fnt-isolate-declined") return declined(message, sender);
    if (message?.type === "fnt-isolate-worker-input") {
      if (!owner(sender) || typeof message.nonce !== "string" || !message.nonce.length || message.nonce.length > 100) return Promise.resolve({ok: false, cancelled: false});
      for (const op of operations.values()) {
        if (op.workerId === sender.tab.id && op.nonce === message.nonce) {
          op.userTouched = true; stop(op, "copy-input");
          return Promise.resolve({ok: true, cancelled: true});
        }
      }
      return Promise.resolve({ok: false, cancelled: false});
    }
    if (message?.type !== "fnt-isolate-cancel") return undefined;
    if (!owner(sender) || typeof message.requestId !== "string") return Promise.resolve({ok: false});
    const op = operations.get(sender.tab.id);
    const matched = op && op.requestId === message.requestId;
    if (matched) stop(op, "source-input");
    return Promise.resolve({ok: true, cancelled: !!matched});
  });
  for (const event of [browser.webNavigation?.onBeforeNavigate, browser.webNavigation?.onCommitted]) event?.addListener(details => {
    const op = operations.get(details?.tabId);
    if (op && details.frameId === 0 && (details.timeStamp === undefined || (Number.isFinite(details.timeStamp) && details.timeStamp >= op.started))) stop(op, "source-navigation");
  });
  browser.tabs.onRemoved.addListener(tabId => {
    for (const op of operations.values()) {
      if (op.sourceId === tabId) stop(op, "source-closed");
      if (op.workerId === tabId) { op.workerGone = true; if (!op.cleaning) { op.userTouched = true; stop(op, "copy-closed"); } }
    }
  });
})();




