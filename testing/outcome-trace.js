/* Explicit-recording-only observation. Does not activate or cancel anything. */
(() => {
  "use strict";
  let active = null;
  const WINDOW_MS = 9000;
  const now = () => Date.now();
  const read = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
  function address(raw) {
    if (typeof raw !== "string") return null;
    try {
      const url = new URL(raw, document.baseURI);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      const path = url.origin + url.pathname;
      return {url: path.length <= 768 ? path : url.origin + "/[long-path-omitted]", hadQuery: !!url.search, hadFragment: !!url.hash};
    } catch { return null; }
  }
  function summary(session, status) {
    const currentAddress = read(() => location.href, "");
    return {version: 1, content: {status, elapsedMs: Math.max(0, Math.min(60000, now() - session.started)),
      syntheticClickEvents: session.clicks,
      titleChanged: read(() => document.title, null) !== session.title,
      addressChanged: currentAddress !== session.url,
      page: address(currentAddress), navigations: session.navigations.slice(0,4),
      navigationEvents: session.navigationEvents, limited: session.limited}};
  }
  function finish(status, event = null) {
    const session = active;
    if (!session) return;
    active = null;
    clearTimeout(session.timer);
    const outcome = summary(session, status);
    if (event && status === "new-input") {
      outcome.content.endInput = {type: ["pointerdown", "mousedown", "keydown"].includes(event.type) ? event.type : "other"};
      if (event.type === "keydown") outcome.content.endInput.keyCategory = ["Shift", "Control", "Alt", "Meta"].includes(event.key) ? event.key : "other";
      else outcome.content.endInput.button = Number.isInteger(event.button) && event.button >= 0 && event.button <= 5 ? event.button : -1;
    }
    try { Promise.resolve(browser.runtime.sendMessage({type: "fnt-diagnostic-update", recordingToken: session.token, outcome})).catch(() => {}); } catch {}
  }
  function start(event, token) {
    if (active) finish("new-input");
    if (typeof token !== "string" || !token.length || token.length > 100) return null;
    const path = read(() => event.composedPath(), []);
    const target = path.find(node => read(() => node.nodeType === 1, false));
    const control = path.find(node => read(() => ["a", "button"].includes(node.localName) || ["link", "button"].includes(node.getAttribute?.("role")), false));
    const session = {token, started: now(), startEvent: event, target, control, released: false,
      title: read(() => document.title, null), url: read(() => location.href, ""),
      clicks: 0, navigationEvents: 0, navigations: [], limited: false, timer: null};
    active = session;
    session.timer = setTimeout(() => finish(session.released ? "complete" : "expired"), WINDOW_MS);
    return summary(session, "observing");
  }
  globalThis.FNTOutcomeTrace = Object.freeze({start});
  const passive = {capture: true, passive: true};
  window.addEventListener("click", event => {
    const session = active;
    if (!session || event.isTrusted || event.button !== 0) return;
    const path = read(() => event.composedPath(), []);
    // A click targeted at the recorded element or its enclosing control is
    // evidence of synthetic activation, not proof of its caller's identity.
    const target = path.find(node => read(() => node.nodeType === 1, false));
    if (!target || (target !== session.target && target !== session.control)) return;
    session.clicks = Math.min(1000, session.clicks + 1);
  }, passive);
  for (const type of ["pointerdown", "mousedown", "keydown"]) window.addEventListener(type, event => {
    const session = active;
    if (!session || !event.isTrusted || event === session.startEvent) return;
    if (type === "mousedown" && event.button === 1 && !session.released && session.startEvent.type === "pointerdown") return;
    if (type === "keydown") {
      try { if (globalThis.FNTIsolation?.isModifierGesture?.(event) === true) return; } catch {}
    }
    finish("new-input", event);
  }, passive);
  for (const type of ["pointerup", "mouseup", "auxclick"]) window.addEventListener(type, event => {
    if (active && event.isTrusted && event.button === 1) active.released = true;
  }, passive);
  window.addEventListener("pagehide", () => finish("source-unloaded"), passive);
  window.navigation?.addEventListener("navigate", event => {
    const session = active;
    if (!session) return;
    session.navigationEvents = Math.min(1000, session.navigationEvents + 1);
    if (session.navigations.length >= 4) { session.limited = true; return; }
    const item = {address: address(read(() => event.destination?.url)), defaultPrevented: false,
      cancelable: !!read(() => event.cancelable, false), trusted: !!read(() => event.isTrusted, false),
      navigationType: ["push", "replace", "reload", "traverse"].includes(event.navigationType) ? event.navigationType : "unknown"};
    session.navigations.push(item);
    // Observe after the other listeners finish. Never call preventDefault,
    // stopPropagation, intercept, a router, or the clicked control.
    Promise.resolve().then(() => { item.defaultPrevented = !!read(() => event.defaultPrevented, false); }).catch(() => {});
  }, {passive: true});
})();
