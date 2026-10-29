(() => {
  "use strict";
  let gesture = null;
  let pending = null;
  let epoch = 0;
  let attemptNumber = 0;
  let enabled = true;
  let stateRevision = 0;
  function send(message) {
    try { return Promise.resolve(browser.runtime.sendMessage(message)).catch(() => null); }
    catch { return Promise.resolve(null); }
  }
  function invalidate(keepActivated = false) {
    epoch++;
    gesture = null;
    if (pending && !(keepActivated && pending.activated)) {
      void send({type: "fnt-cancel", attemptId: pending.id});
      pending = null;
    }
  }
  function applyMode(value) {
    const next = value !== false;
    if (next !== enabled) { enabled = next; invalidate(); }
  }
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.hasOwn(changes, "enabled")) return;
    stateRevision++;
    applyMode(changes.enabled.newValue);
  });
  const initialRevision = stateRevision;
  browser.storage.local.get({enabled: true}).then(saved => {
    if (stateRevision === initialRevision) applyMode(saved.enabled);
  }, () => {});

  function activationTarget(path) {
    const nodes = path.filter(node => node && node.nodeType === 1);
    // Navigation intent does not authorize submitting/editing a form. These
    // exclusions are deliberately structural, not guesses based on English text.
    if (nodes.some(node => ["form", "input", "textarea", "select", "option", "label", "summary"].includes(node.localName) ||
        node.isContentEditable || node.hasAttribute("disabled") ||
        node.getAttribute("aria-disabled") === "true" ||
        (node.localName === "button" && ["submit", "reset"].includes(node.getAttribute("type"))))) return null;
    const semantic = nodes.find(node => ["a", "button"].includes(node.localName) ||
      ["link", "button"].includes(node.getAttribute("role")));
    return semantic && typeof semantic.click === "function" ? semantic :
      nodes.find(node => typeof node.click === "function") || null;
  }

  function stillEligible(target) {
    const path = [];
    for (let node = target; node;) {
      path.push(node);
      node = node.parentElement || node.getRootNode?.()?.host || null;
    }
    return activationTarget(path) === target;
  }

  async function discover(target) {
    const id = Date.now().toString(36) + "-" + (++attemptNumber);
    const ownedEpoch = epoch;
    pending = {id, activated: false, activating: false, captured: false, deadline: Date.now() + 7_500};
    const ack = await send({type: "fnt-arm", attemptId: id, beforeURL: location.href});
    if (!ack?.ok || !enabled || epoch !== ownedEpoch || pending?.id !== id ||
        Date.now() > pending.deadline ||
        !target.isConnected || target.ownerDocument !== document || !stillEligible(target)) {
      void send({type: "fnt-cancel", attemptId: id});
      if (pending?.id === id) pending = null;
      return;
    }
    // The background observer is now armed. It survives a full source unload.
    const attempt = pending;
    attempt.activated = true;
    attempt.activating = true;
    try {
      HTMLElement.prototype.click.call(target);
    } catch {
      if (!attempt.captured) void send({type: "fnt-cancel", attemptId: id});
      if (pending?.id === id) pending = null;
    } finally {
      attempt.activating = false;
      if (attempt.captured && pending?.id === id) pending = null;
    }
  }

  // Native browser navigation, not a page-world patch or website adapter.
  // Firefox 147+ exposes this EventTarget to content scripts.
  window.navigation?.addEventListener("navigate", event => {
    const attempt = pending;
    if (!enabled || !attempt?.activated || !event.isTrusted || !event.cancelable ||
        event.navigationType === "traverse" || event.formData != null || event.downloadRequest != null) return;
    if (Date.now() > attempt.deadline) {
      pending = null;
      void send({type: "fnt-cancel", attemptId: attempt.id});
      return;
    }
    const url = FNT.safeURL(event.destination?.url, document.baseURI);
    if (!url || url === location.href) return;
    // canIntercept may be false for cross-origin URLs. Cancellation is a
    // separate capability: preventDefault is sufficient when cancelable.
    event.preventDefault();
    if (!event.defaultPrevented) return;
    event.stopImmediatePropagation();
    if (attempt.captured) return;
    attempt.captured = true;
    void send({type: "fnt-captured", attemptId: attempt.id, url});
    // Keep a synchronous activation's remaining navigations suppressed, without
    // retaining a hook that could swallow unrelated later page activity.
    if (!attempt.activating && pending?.id === attempt.id) pending = null;
  });

  function block(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  function handle(event) {
    if (!event.isTrusted) return;
    if (event.type === "pointercancel") { invalidate(); return; }
    if (!enabled) return;
    if (event.button !== 1) {
      if (event.type === "pointerdown" || event.type === "mousedown") invalidate();
      return;
    }
    block(event);
    if (event.type === "pointerdown" || event.type === "mousedown") {
      // BEGIN isolated-shift press
      const isolationShift = event.shiftKey === true || (event.type === "mousedown" &&
        gesture?.isolationShift === true && gesture.target === activationTarget(event.composedPath()));
      // END isolated-shift press
      invalidate();
      gesture = {url: FNT.resolve(event.composedPath(), document.baseURI, location.href),
        target: activationTarget(event.composedPath()), started: Date.now(),
        released: false, releaseURL: null, releaseTarget: null};
      // BEGIN isolated-shift latch
      try {
        if (!gesture.url && isolationShift && globalThis.FNTIsolation?.isEnabled?.() === true) gesture.isolationShift = true;
      } catch {}
      // END isolated-shift latch
    }
    if (!gesture) return;
    if (Date.now() - gesture.started > 60_000) { invalidate(); return; }
    if (event.type === "mouseup" || event.type === "pointerup") {
      gesture.released = true;
      gesture.releaseURL = FNT.resolve(event.composedPath(), document.baseURI, location.href);
      gesture.releaseTarget = activationTarget(event.composedPath());
    }
    if (event.type !== "auxclick") return;
    const completed = gesture;
    gesture = null;
    if (!completed.released) return;
    const destination = FNT.resolve(event.composedPath(), document.baseURI, location.href);
    if (completed.url) {
      if (destination === completed.url && completed.releaseURL === completed.url)
        void send({type: "fnt-open", url: destination});
      return;
    }
    const target = activationTarget(event.composedPath());
    if (destination || !target || target !== completed.target || target !== completed.releaseTarget) return;
    // BEGIN isolated-copy hook
    const isolatedEpoch = epoch, isolatedURL = location.href;
    let isolated = null;
    try { isolated = globalThis.FNTIsolation?.tryStart(target, {shiftKey: !!event.shiftKey || completed.isolationShift === true}); } catch {}
    if (isolated) {
      void Promise.resolve(isolated).then(result => {
        if (result?.fallback === true && result.activated === false && enabled &&
            epoch === isolatedEpoch && location.href === isolatedURL && target.isConnected &&
            target.ownerDocument === document && stillEligible(target)) void discover(target);
      }).catch(() => {});
      return;
    }
    // END isolated-copy hook
    void discover(target);
  }
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "auxclick", "click", "pointercancel"]) {
    window.addEventListener(type, handle, {capture: true, passive: false});
  }
  // BEGIN isolated-shift keyboard
  window.addEventListener("keydown", event => {
    if (!event.isTrusted) return;
    let modifier = false, pendingIsolation = false;
    try {
      modifier = globalThis.FNTIsolation?.isModifierGesture?.(event) === true;
      pendingIsolation = modifier && globalThis.FNTIsolation?.isPending?.() === true;
    } catch {}
    if (modifier && gesture && !gesture.url) { gesture.isolationShift = true; return; }
    if (pendingIsolation) return;
    invalidate();
  }, true);
  // END isolated-shift keyboard
  // A source navigation must not tear down an already-armed background observer.
  window.addEventListener("blur", () => { invalidate(true); }, true);
  window.addEventListener("pagehide", () => { invalidate(true); }, true);
})();

