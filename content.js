/**
 * Force New Tab - content.js
 *
 * Intercepts middle-clicks on JS-driven elements (buttons, divs, etc.)
 * that don't have a real <a> ancestor. Plain anchor links are left alone —
 * the browser already opens those in a new tab on middle-click.
 *
 * Fallback chain:
 *   1. data-* attributes
 *   2. Child <a href> scan
 *   3. Page JS hooks (window.open, history API, location.*) — via page-world.js
 *   4. Click replay (synthetic mouse events)
 *   5. URL change watcher (snap back + open captured URL)
 *   6. Tab duplication (last resort)
 *
 * Communicates with page-world.js via a MessageChannel so hostile page JS
 * cannot interfere with activation signals.
 */

(function () {
  "use strict";

  if (window.__forceNewTabInstalled) return;
  window.__forceNewTabInstalled = true;

  // ─── MessageChannel setup ──────────────────────────────────────────────────
  const channel = new MessageChannel();
  const port    = channel.port1;

  port.onmessage = function (e) {
    if (e.data === "ready") {
      console.debug("[ForceNewTab] page-world connected via MessageChannel");
    } else if (e.data && e.data.url) {
      resolve(e.data.url);
    }
  };

  if (typeof window.__forceNewTabConnect === "function") {
    window.__forceNewTabConnect(channel.port2);
  } else {
    window.__forceNewTabPendingPort = channel.port2;
  }

  function activatePageWorld(on) {
    port.postMessage(on ? "activate" : "deactivate");
  }

  // ─── Unified resolution state ──────────────────────────────────────────────
  let clickSession = 0;

  let state = {
    resolved:       false,
    active:         false,
    urlBefore:      null,
    clickTarget:    null,
    clickX:         0,
    clickY:         0,
    snapBackTimer:  null,
    giveUpTimer:    null,
  };

  function resetState() {
    clickSession++;
    clearInterval(state.snapBackTimer);
    clearTimeout(state.giveUpTimer);
    state.resolved      = false;
    state.active        = false;
    state.urlBefore     = null;
    state.clickTarget   = null;
    state.clickX        = 0;
    state.clickY        = 0;
    state.snapBackTimer = null;
    state.giveUpTimer   = null;
    activatePageWorld(false);
  }

  function resolve(url) {
    if (state.resolved) return false;
    if (!url) return false;
    state.resolved = true;
    try {
      const abs = new URL(url, document.baseURI).href;
      browser.runtime.sendMessage({ action: "openTab", url: abs });
    } catch {
      // Malformed URL — still mark resolved so nothing else fires
    }
    resetState();
    return true;
  }

  function giveUp(reason) {
    if (state.resolved) return;
    console.debug("[ForceNewTab] Gave up:", reason);
    resetState();
  }

  // ─── DOM helpers ───────────────────────────────────────────────────────────

  function findAnchor(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.tagName === "A") return node;
      node = node.parentElement;
    }
    return null;
  }

  function isRealLink(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute("href");
    if (!href || href === "#" || href.startsWith("javascript:")) return false;
    return true;
  }

  // Layer 1: data-* attributes on element or ancestors
  function resolveDataUrl(el) {
    const attrs = [
      "data-href", "data-url", "data-link", "data-target",
 "data-navigate", "data-route", "data-src", "data-redirect"
    ];
    let node = el;
    while (node && node !== document.body) {
      for (const a of attrs) {
        const v = node.getAttribute?.(a);
        if (v && v !== "#" && !v.startsWith("javascript:")) return v;
      }
      node = node.parentElement;
    }
    return null;
  }

  // Layer 2: scan nearby container for a child <a href>
  function findChildAnchor(el) {
    let container = el;
    for (let i = 0; i < 5; i++) {
      if (!container || container === document.body) break;
      container = container.parentElement;
    }
    if (!container) return null;
    for (const a of container.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (href && href !== "#" && !href.startsWith("javascript:")) return href;
    }
    return null;
  }

  // ─── Duplication helper ────────────────────────────────────────────────────
  function requestDuplication(x, y) {
    state.resolved = true;
    activatePageWorld(false);
    browser.runtime.sendMessage({ action: "duplicateAndClick", x, y });
    clearInterval(state.snapBackTimer);
    clearTimeout(state.giveUpTimer);
  }

  // ─── Main mousedown handler ────────────────────────────────────────────────
  document.addEventListener("mousedown", function (e) {
    if (e.button !== 1) return;
    if (e.ctrlKey || e.shiftKey || e.metaKey) return;

    const anchor = findAnchor(e.target);
    if (isRealLink(anchor)) return;   // browser handles real anchors natively

    e.preventDefault();
    e.stopImmediatePropagation();

    resetState();
    state.urlBefore   = window.location.href;
    state.clickTarget = e.target;
    state.clickX      = e.clientX;
    state.clickY      = e.clientY;

    const savedTarget = e.target;
    const savedX      = e.clientX;
    const savedY      = e.clientY;
    const savedUrl    = window.location.href;

    // ── Layer 1: data-* attributes ───────────────────────────────────────────
    const dataUrl = resolveDataUrl(e.target);
    if (dataUrl && resolve(dataUrl)) return;

    // ── Layer 2: child anchor scan ───────────────────────────────────────────
    const childUrl = findChildAnchor(e.target);
    if (childUrl && resolve(childUrl)) return;

    // ── Layers 3–6: async fallback chain ─────────────────────────────────────
    state.active = true;
    activatePageWorld(true);

    const thisSession = ++clickSession;

    setTimeout(function () {
      if (clickSession !== thisSession) return; // already resolved, bail out

      // ── Layer 4: click replay ──────────────────────────────────────────────
      activatePageWorld(true);

      const opts = {
        bubbles: true, cancelable: true, view: window,
        button: 0, buttons: 1,
        clientX: savedX, clientY: savedY
      };
      try {
        savedTarget.dispatchEvent(new MouseEvent("mousedown", opts));
        savedTarget.dispatchEvent(new MouseEvent("mouseup",   opts));
        savedTarget.dispatchEvent(new MouseEvent("click",     opts));
      } catch (err) {
        console.error("[ForceNewTab] Click replay failed:", err);
      }

      // ── Layer 5: URL change watcher ────────────────────────────────────────
      state.snapBackTimer = setInterval(function () {
        if (clickSession !== thisSession) {
          clearInterval(state.snapBackTimer);
          return;
        }
        const urlNow = window.location.href;
        if (urlNow !== savedUrl) {
          clearInterval(state.snapBackTimer);
          history.replaceState(null, "", savedUrl);
          resolve(urlNow);
        }
      }, 10);

      // ── Layer 6: tab duplication ───────────────────────────────────────────
      state.giveUpTimer = setTimeout(function () {
        clearInterval(state.snapBackTimer);
        if (clickSession !== thisSession) return;
        requestDuplication(savedX, savedY);
      }, 600);

    }, 500);

  }, true);

})();
