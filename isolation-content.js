/* Automatic background-copy fallback: source requests only; copied tab activates once. */
(() => {
  "use strict";
  let toolbar = true, toolbarRevision = 0, epoch = 0, sequence = 0;
  let pending = null, prepared = null, workerInput = false, workerNonce = null, workerInputNotified = false;
  const used = new Set();
  const read = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
  function nonce() {
    try { return crypto.randomUUID(); } catch { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2) + "-" + (++sequence); }
  }
  const documentNonce = nonce();
  const topFrame = () => read(() => window.top === window, false);
  function safePage(value) {
    if (typeof value !== "string" || !value.length || value.length > 4096) return false;
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }
  function send(message) {
    try { return Promise.resolve(browser.runtime.sendMessage(message)).catch(() => null); } catch { return Promise.resolve(null); }
  }
  function invalidate() {
    epoch++;
    const request = pending;
    pending = null;
    if (request) void send({type: "fnt-isolate-cancel", requestId: request.id});
  }
  function sameTarget(target, descriptor, strict = false) {
    if (!target || target.isConnected === false || target.ownerDocument !== document) return false;
    const lookup = () => globalThis.FNTIsolationTarget.find(descriptor, document);
    const found = strict ? lookup() : read(lookup);
    return found?.ok === true && found.target === target;
  }
  function unresolved(target) {
    const path = [], seen = new Set();
    for (let node = target; node && path.length < 512;) {
      if (seen.has(node)) return false;
      seen.add(node); path.push(node);
      node = read(() => node.parentElement || node.getRootNode?.()?.host, null);
    }
    if (path.length >= 512) return false;
    try { return typeof globalThis.FNT?.resolve === "function" && !globalThis.FNT.resolve(path, document.baseURI, location.href); }
    catch { return false; }
  }
  const declineReasons = new Set(["document-unavailable","not-control","disconnected-control","adopted-control","subframe","root-unavailable","closed-shadow-root","inaccessible-shadow-root","shadow-depth-limit","root-cycle","ancestor-limit","ancestor-cycle","form-or-editable","disabled-control","hidden-control","submit-or-reset","nested-control","label-too-long","missing-label-or-identity","identity-too-long","invalid-tag","invalid-descriptor","candidate-limit","aggregate-candidate-limit","ambiguous-shadow-host","shadow-host-not-found","control-not-found","ambiguous-control","read-error","target-changed","target-unavailable"]);
  function reportDecline(target, fallback = "target-unavailable", inspect = true) {
    let reason = fallback;
    if (inspect) {
      try {
        const audit = globalThis.FNTIsolationTarget.audit?.(target, document);
        if (declineReasons.has(audit?.reason)) reason = audit.reason;
      } catch { reason = "read-error"; }
    }
    if (!declineReasons.has(reason)) reason = "target-unavailable";
    void send({type: "fnt-isolate-declined", reason});
  }
  function tryStart(target, gesture) {
    if (!toolbar || !topFrame() || !safePage(read(() => location.href)) ||
        !globalThis.FNTIsolationTarget || !unresolved(target)) return null;
    const beforeURL = location.href;
    let descriptor;
    try { descriptor = globalThis.FNTIsolationTarget.describe(target, document); }
    catch { reportDecline(target, "read-error", false); return null; }
    if (!descriptor) { reportDecline(target); return null; }
    try {
      if (!sameTarget(target, descriptor, true)) { reportDecline(target, "target-changed"); return null; }
    } catch { reportDecline(target, "read-error", false); return null; }
    if (pending) return Promise.resolve({fallback: false, activated: false, reason: "busy"});
    const request = {id: nonce(), epoch, beforeURL, target, descriptor};
    pending = request;
    return send({type: "fnt-isolate-start", requestId: request.id, beforeURL, target: descriptor}).then(result => {
      const owned = pending === request;
      if (owned) pending = null;
      if (result?.fallback === true && result.activated === false && owned && epoch === request.epoch &&
          toolbar && location.href === beforeURL && sameTarget(target, descriptor) && unresolved(target))
        return {fallback: true, activated: false, reason: typeof result.reason === "string" ? result.reason.slice(0, 80) : "pre-activation-failure"};
      return {fallback: false, activated: result?.activated === true,
        reason: typeof result?.reason === "string" ? result.reason.slice(0, 80) : "uncertain"};
    }).catch(() => ({fallback: false, activated: false, reason: "transport-failure"}));
  }
  const isEnabled = () => toolbar && topFrame();
  const isPending = () => pending !== null;
  const isModifierGesture = event => isEnabled() && event?.key === "Shift";
  const describeState = () => ({modeEnabled: true, toolbarEnabled: toolbar, topFrame: topFrame(), pending: isPending()});
  globalThis.FNTIsolation = Object.freeze({tryStart, isEnabled, isPending, isModifierGesture, describeState});
  if (typeof browser === "undefined") return;
  function isTabNavigationKey(event) {
    if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return true;
    if ((event.ctrlKey === true || event.metaKey === true) &&
        (["Tab", "PageUp", "PageDown"].includes(event.key) || /^[1-9]$/.test(event.key))) return true;
    return event.altKey === true && event.key === "Tab";
  }
  for (const type of ["pointerdown", "mousedown", "keydown"]) window.addEventListener(type, event => {
    if (!event.isTrusted) return;
    const navigationKey = type === "keydown" && isTabNavigationKey(event);
    // Moving between tabs is not interaction with the copied document. The
    // original core still owns its usual keyboard and source-fallback guards.
    if (navigationKey && (pending || prepared)) return;
    if (type === "keydown" && isModifierGesture(event)) return;
    if (!navigationKey) {
      workerInput = true;
      const claimNonce = prepared?.nonce || workerNonce;
      prepared = null; // Block an execute message before its cancellation arrives.
      if (claimNonce && !workerInputNotified) {
        workerInputNotified = true;
        void send({type: "fnt-isolate-worker-input", nonce: claimNonce});
      }
    }
    invalidate();
  }, {capture: true, passive: true});
  // Passive tab selection or element focus changes must not discard a valid
  // worker target. Actual input above and document unload still invalidate it.
  window.addEventListener("pagehide", () => { prepared = null; invalidate(); }, {capture: true, passive: true});
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.hasOwn(changes, "enabled")) return;
    toolbarRevision++; toolbar = changes.enabled.newValue !== false;
    if (!toolbar) { prepared = null; invalidate(); }
  });
  const initialToolbarRevision = toolbarRevision;
  try { Promise.resolve(browser.storage.local.get({enabled: true})).then(saved => {
    if (toolbarRevision === initialToolbarRevision) toolbar = saved.enabled !== false;
  }, () => {}); } catch {}
  function authenticatedRequest(message, sender) {
    return sender?.id === browser.runtime.id && !sender.tab && topFrame() &&
      typeof message.nonce === "string" && message.nonce.length > 0 && message.nonce.length <= 100;
  }
  function validRequest(message) {
    return toolbar && safePage(message.beforeURL) && location.href === message.beforeURL &&
      read(() => globalThis.FNTIsolationTarget.validDescriptor(message.target), false);
  }
  browser.runtime.onMessage.addListener((message, sender) => {
    if (!["fnt-isolate-prepare", "fnt-isolate-execute"].includes(message?.type)) return undefined;
    if (!authenticatedRequest(message, sender)) return Promise.resolve({ready: false, activated: false, reason: "invalid-or-disabled"});
    // A consumed nonce acknowledges a possible earlier action even after
    // input, settings or same-document address changes. It never clicks again.
    if (used.has(message.nonce)) return Promise.resolve({ready: false, activated: true, reason: "already-activated"});
    // Bind the operation before the page finishes loading. Actual input can
    // then cancel that copy before navigation replaces this document.
    if (message.type === "fnt-isolate-prepare") workerNonce = message.nonce;
    if (workerInput) return Promise.resolve({ready: false, activated: false, userInteracted: true, reason: "copy-input"});
    if (!validRequest(message)) return Promise.resolve({ready: false, activated: false, reason: "invalid-or-disabled"});
    if (message.type === "fnt-isolate-prepare") {
      if (document.readyState !== "complete") return Promise.resolve({ready: false, activated: false, reason: "document-loading"});
      const match = read(() => globalThis.FNTIsolationTarget.find(message.target, document));
      if (!match?.ok || !match.target) { prepared = null; return Promise.resolve({ready: false, activated: false, reason: "target-not-ready"}); }
      const fingerprint = read(() => JSON.stringify(message.target));
      if (!fingerprint) return Promise.resolve({ready: false, activated: false, reason: "invalid-target"});
      prepared = {nonce: message.nonce, target: match.target, fingerprint};
      return Promise.resolve({ok: true, ready: true, activated: false, documentNonce});
    }
    const fingerprint = read(() => JSON.stringify(message.target));
    if (!prepared || prepared.nonce !== message.nonce || message.documentNonce !== documentNonce ||
        prepared.fingerprint !== fingerprint || !sameTarget(prepared.target, message.target) || document.readyState !== "complete")
      return Promise.resolve({activated: false, reason: "prepared-target-changed"});
    if (used.size >= 16) return Promise.resolve({activated: false, reason: "document-activation-limit"});
    const target = prepared.target;
    used.add(message.nonce); prepared = null;
    try {
      HTMLElement.prototype.click.call(target);
      return Promise.resolve({activated: true, reason: "activation-dispatched"});
    } catch {
      // A handler may have acted before throwing. Never authorize a replay.
      return Promise.resolve({activated: true, reason: "activation-threw"});
    }
  });
})();
