/**
 * Force New Tab - page-world.js
 *
 * Runs in the MAIN world (the page's own JS context) so it can hook
 * window.open, history API, and location.* directly.
 *
 * Communicates with content.js via a MessageChannel instead of CustomEvents
 * so that hostile page JS (e.g. Pinterest) cannot interfere.
 */

(function () {
    if (window.__forceNewTabPageInstalled) return;
    window.__forceNewTabPageInstalled = true;

    let active   = false;
    let consumed = false;
    let port     = null;

    // content.js calls this to hand us port2 of the MessageChannel
    window.__forceNewTabConnect = function (p) {
        port = p;
        port.onmessage = function (e) {
            if (e.data === "activate") {
                active   = true;
                consumed = false;
            } else if (e.data === "deactivate") {
                active = false;
            }
        };
        port.postMessage("ready");
    };

    // If content.js runs first it will leave a port queued here for us to pick up
    if (window.__forceNewTabPendingPort) {
        window.__forceNewTabConnect(window.__forceNewTabPendingPort);
        delete window.__forceNewTabPendingPort;
    }

    function emit(url) {
        if (consumed || !port) return;
        consumed = true;
        port.postMessage({ url });
    }

    // window.open
    const _open = window.open.bind(window);
    Object.defineProperty(window, "open", {
        get: () => function (url, ...args) {
            if (active && url) { emit(url); return null; }
            return _open(url, ...args);
        },
        set: () => {},
                          configurable: false
    });

    // history.pushState / replaceState
    const _push    = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState = function (s, t, url) {
        if (active && url) { emit(String(url)); return; }
        return _push(s, t, url);
    };
    history.replaceState = function (s, t, url) {
        if (active && url) { emit(String(url)); return; }
        return _replace(s, t, url);
    };

    // location.href setter
    const locDesc = Object.getOwnPropertyDescriptor(Location.prototype, "href");
    Object.defineProperty(Location.prototype, "href", {
        enumerable: true,
        configurable: true,
        get: function ()    { return locDesc.get.call(this); },
                          set: function (val) {
                              if (active && val) { emit(String(val)); return; }
                              locDesc.set.call(this, val);
                          }
    });

    // location.assign / location.replace
    const _assign     = window.location.assign.bind(window.location);
    const _locReplace = window.location.replace.bind(window.location);
    window.location.assign = function (url) {
        if (active && url) { emit(String(url)); return; }
        return _assign(url);
    };
    window.location.replace = function (url) {
        if (active && url) { emit(String(url)); return; }
        return _locReplace(url);
    };

})();
