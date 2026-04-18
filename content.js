/**
 * Force New Tab - content.js
 *
 * Only intercepts middle-clicks on JS-driven elements (buttons, divs, etc.)
 * that don't have a real <a> ancestor. Plain anchor links are left alone —
 * the browser already opens those in a new tab on middle-click.
 */

(function () {
  "use strict";

  if (window.__forceNewTabInstalled) return;
  window.__forceNewTabInstalled = true;

  // ─────────────────────────────────────────────
  // Inject into page world to intercept
  // window.open / history.pushState / replaceState
  // (content script patches are invisible to page JS)
  // ─────────────────────────────────────────────
  const pageScript = document.createElement("script");
  pageScript.textContent = `
(function () {
  if (window.__forceNewTabPageInstalled) return;
  window.__forceNewTabPageInstalled = true;

  let pending  = false;
  let consumed = false;

  window.addEventListener("__forceNewTab_activate", function (e) {
    pending  = e.detail.active;
    if (e.detail.active) consumed = false;
  });

  function emit(url) {
    if (consumed) return;
    consumed = true;
    window.dispatchEvent(new CustomEvent("__forceNewTab_url", { detail: { url } }));
  }

  const _open = window.open.bind(window);
  Object.defineProperty(window, "open", {
    get: () => function (url, ...args) {
      if (pending && url) { emit(url); return null; }
      return _open(url, ...args);
    },
    set: () => {},
    configurable: false
  });

  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState = function (state, title, url) {
    if (pending && url) { emit(String(url)); return; }
    return _push(state, title, url);
  };
  history.replaceState = function (state, title, url) {
    if (pending && url) { emit(String(url)); return; }
    return _replace(state, title, url);
  };
})();
  `;
  (document.head || document.documentElement).prepend(pageScript);
  pageScript.remove();

  // ─────────────────────────────────────────────
  // Check whether the clicked element has a real
  // <a href> ancestor the browser can handle itself
  // ─────────────────────────────────────────────
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
    // If it has a real navigable href the browser handles middle-click fine
    return true;
  }

  // ─────────────────────────────────────────────
  // Resolve a URL from data-* attributes only
  // (used when there's no usable <a href>)
  // ─────────────────────────────────────────────
  function resolveDataUrl(el) {
    let node = el;
    while (node && node !== document.body) {
      const attrs = [
        "data-href", "data-url", "data-link", "data-target",
        "data-navigate", "data-route", "data-src", "data-redirect"
      ];
      for (const a of attrs) {
        const v = node.getAttribute?.(a);
        if (v && v !== "#" && !v.startsWith("javascript:")) {
          return v;
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // Open tab (one-shot per click)
  // ─────────────────────────────────────────────
  let clickConsumed = false;

  function openTab(url) {
    if (!url || clickConsumed) return false;
    try {
      const abs = new URL(url, document.baseURI).href;
      clickConsumed = true;
      browser.runtime.sendMessage({ action: "openTab", url: abs });
      return true;
    } catch {
      return false;
    }
  }

  window.addEventListener("__forceNewTab_url", function (e) {
    openTab(e.detail.url);
  });

  // ─────────────────────────────────────────────
  // Main handler
  // ─────────────────────────────────────────────
  document.addEventListener("mousedown", function (e) {
    if (e.button !== 1) return;
    if (e.ctrlKey || e.shiftKey || e.metaKey) return;

    const anchor = findAnchor(e.target);

    // ✅ Real link: let the browser do its thing, don't interfere
    if (isRealLink(anchor)) return;

    // 🔲 JS-driven element: take over
    clickConsumed = false;

    window.dispatchEvent(new CustomEvent("__forceNewTab_activate", {
      detail: { active: true }
    }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("__forceNewTab_activate", {
        detail: { active: false }
      }));
      clickConsumed = false;
    }, 500);

    e.preventDefault();
    e.stopImmediatePropagation();

    // Try data-* attributes first
    const dataUrl = resolveDataUrl(e.target);
    if (dataUrl) {
      openTab(dataUrl);
      return;
    }

    // Otherwise wait for page JS to call window.open / history.pushState
    // (handled by the page-world patches above)

  }, true);

})();
