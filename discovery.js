/* Background-only discovery for navigation-first middle-click attempts.
 * Browser navigation events are correlated by tab/frame/time, not proof of
 * causality. No page API is patched, and source navigation is never rolled back.
 */
(() => {
  "use strict";
  function safeURL(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
        ? url.href : null;
    } catch { return null; }
  }

  function install(browser, {isEnabled, open}) {
    const sessions = new Map();
    const lifetime = 8_000;
    const settleDelay = 60;

    function take(session) {
      if (sessions.get(session.sourceTab.id) !== session) return false;
      sessions.delete(session.sourceTab.id);
      clearTimeout(session.expiryTimer);
      if (session.settleTimer !== null) clearTimeout(session.settleTimer);
      return true;
    }
    function finish(session) {
      if (!take(session) || !isEnabled() || !session.destination) return;
      // Ownership is consumed before open can resolve or trigger more events.
      try { Promise.resolve(open(session.destination, session.sourceTab)).catch(() => {}); }
      catch {} // Failed creation is not retried.
    }
    function validAttempt(message) {
      return typeof message?.attemptId === "string" &&
        message.attemptId.length > 0 && message.attemptId.length <= 128;
    }
    function validSource(sender) {
      return Number.isInteger(sender?.tab?.id) && sender.tab.id >= 0 &&
        Number.isInteger(sender.tab.windowId) && sender.tab.windowId >= 0 &&
        Number.isInteger(sender.frameId) && sender.frameId >= 0;
    }
    function arm(message, sender) {
      const baseline = safeURL(message?.beforeURL);
      if (!validAttempt(message) || !validSource(sender) || !baseline)
        return {ok: false, reason: "invalid"};
      if (!isEnabled()) return {ok: false, reason: "disabled"};
      if (sessions.has(sender.tab.id)) return {ok: false, reason: "busy"};
      const session = {
        attemptId: message.attemptId,
        sourceTab: {...sender.tab},
        sourceFrame: sender.frameId,
        baseline,
        // Frame URLs and top-level URLs can differ. Without a supplied top URL,
        // top-frame observation falls back to weaker tab/frame/time attribution.
        topBaseline: safeURL(sender.tab.url) || (sender.frameId === 0 ? baseline : null),
        started: Date.now(),
        destination: null,
        captured: false,
        settleTimer: null,
        expiryTimer: null
      };
      sessions.set(sender.tab.id, session);
      session.expiryTimer = setTimeout(() => take(session), lifetime);
      return {ok: true};
    }
    function cancel(message, sender) {
      if (!validAttempt(message) || !validSource(sender))
        return {ok: false, reason: "invalid"};
      const session = sessions.get(sender.tab.id);
      const owned = session && session.attemptId === message.attemptId &&
        session.sourceFrame === sender.frameId;
      return {ok: true, cancelled: !!owned && take(session)};
    }
    function capture(message, sender) {
      if (!validAttempt(message) || !validSource(sender))
        return {ok: false, reason: "invalid"};
      const session = sessions.get(sender.tab.id);
      if (!session || session.attemptId !== message.attemptId ||
          session.sourceFrame !== sender.frameId) return {ok: false, reason: "unowned"};
      if (!isEnabled() || Date.now() - session.started >= lifetime) {
        take(session);
        return {ok: false, reason: "expired-or-disabled"};
      }
      const destination = safeURL(message.url);
      if (!destination || destination === session.baseline)
        return {ok: false, reason: "invalid-destination"};
      if (!session.captured) {
        session.destination = destination;
        session.captured = true;
      }
      if (session.settleTimer === null)
        session.settleTimer = setTimeout(() => finish(session), settleDelay);
      return {ok: true};
    }
    function cancelAll() {
      for (const session of sessions.values()) take(session);
    }
    function matches(session, frameId, timeStamp) {
      if (!isEnabled()) { take(session); return false; }
      if (frameId !== session.sourceFrame && frameId !== 0) return false;
      if (timeStamp !== undefined &&
          (!Number.isFinite(timeStamp) || timeStamp < session.started)) return false;
      return true;
    }
    function observe(details) {
      const session = sessions.get(details?.tabId);
      if (!session || !matches(session, details.frameId, details.timeStamp)) return;
      const destination = safeURL(details.url);
      const baseline = details.frameId === 0 ? session.topBaseline || session.baseline : session.baseline;
      if (!destination || destination === baseline || session.destination) return;
      session.destination = destination;
      // Briefly allow a page-created navigation target to win. This is not a
      // guarantee against a native target created after the settling interval.
      session.settleTimer = setTimeout(() => finish(session), settleDelay);
    }
    function existingTarget(details) {
      const session = sessions.get(details?.sourceTabId);
      if (!session || !matches(session, details.sourceFrameId, details.timeStamp) ||
          !Number.isInteger(details.tabId) || details.tabId < 0 ||
          details.tabId === session.sourceTab.id) return;
      // window.open may first create about:blank. A target already exists, so
      // never create an additional copy merely because its URL is not ready.
      take(session);
    }
    browser.webNavigation.onBeforeNavigate.addListener(observe);
    browser.webNavigation.onCommitted.addListener(observe);
    browser.webNavigation.onHistoryStateUpdated.addListener(observe);
    browser.webNavigation.onReferenceFragmentUpdated.addListener(observe);
    browser.webNavigation.onCreatedNavigationTarget.addListener(existingTarget);
    browser.tabs.onRemoved.addListener(tabId => {
      const session = sessions.get(tabId);
      if (session) take(session);
    });
    return Object.freeze({arm, cancel, cancelAll, capture});
  }
  globalThis.FNTDiscovery = Object.freeze({install});
})();

