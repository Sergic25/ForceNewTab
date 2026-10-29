(() => {
  "use strict";
  // Optional, one-shot local report. Never changes the gesture or the page.
  const KEY = "fntRecordNextClick";
  const MAX_BYTES = 18000; // Leave room for receiver metadata.
  function read(fn, fallback = null) {
    try { return fn(); } catch { return fallback; }
  }
  function short(value, limit = 128) {
    return typeof value === "string" ? value.slice(0, limit) : null;
  }
  function redactURL(raw, base = document.baseURI) {
    if (typeof raw !== "string" || !raw.trim()) return null;
    return read(() => {
      const url = new URL(raw, base);
      if (!["http:", "https:"].includes(url.protocol)) return null;
      const address = url.origin + url.pathname;
      // Do not truncate into a misleading address or preserve query keys/values.
      if (address.length > 768) return {url: url.origin + "/[long-path-omitted]", hadQuery: !!url.search, hadFragment: !!url.hash};
      return {url: address, hadQuery: !!url.search, hadFragment: !!url.hash};
    });
  }
  function attr(node, name, limit) { return short(read(() => node.getAttribute(name)), limit); }
  function describe(node, base) {
    const item = {tag: short(read(() => node.localName), 40)};
    for (const name of ["role", "tabindex", "type", "aria-labelledby", "aria-describedby"]) {
      const value = attr(node, name, name.startsWith("aria-") ? 128 : 64);
      if (value !== null) item[name] = value;
    }
    for (const name of ["href", "data-href", "data-url"]) {
      const raw = read(() => node.getAttribute(name));
      if (raw !== null) item[name] = redactURL(raw, base);
    }
    item.hasLabel = !!attr(node, "aria-label", 1);
    item.hasInlineClick = read(() => node.hasAttribute("onclick"), false);
    if (item.tag === "img") item.image = redactURL(read(() => node.currentSrc || node.getAttribute("src")), base);
    return item;
  }
  function nearby(node, base) {
    const links = [], queue = [node];
    let visited = 0, cursor = 0;
    while (cursor < queue.length && visited < 60 && links.length < 12) {
      const child = queue[cursor++];
      visited++;
      if (read(() => ["a", "area"].includes(child.localName) && child.hasAttribute("href"), false)) {
        links.push(describe(child, base));
      }
      // Bound traversal and queued references, even for very large components.
      const children = read(() => child.children);
      const length = read(() => children.length, 0);
      for (let index = 0; index < length && queue.length < 60; index++) {
        const element = read(() => children[index]);
        if (element) queue.push(element);
      }
    }
    return {links, visited, truncated: cursor < queue.length || visited >= 60 || links.length >= 12};
  }
  function snapshot(event) {
    const base = read(() => document.baseURI, "https://invalid.example/");
    const page = read(() => location.href, base);
    const rawPath = read(() => event.composedPath(), []);
    const elements = [];
    // A composed path is browser-provided; keep only a bounded set of elements.
    for (let index = 0; index < rawPath.length && elements.length < 20; index++) {
      const node = rawPath[index];
      if (read(() => node.nodeType === 1 && !["body", "html"].includes(node.localName), false)) elements.push(node);
    }
    const report = {
      schemaVersion: 1,
      diagnosticVersion: "2.0.1",
      extensionVersion: read(() => {
        const version = browser.runtime.getManifest?.().version;
        return typeof version === "string" && /^[0-9A-Za-z._-]{1,32}$/.test(version) ? version : null;
      }),
      capturedAt: new Date().toISOString(),
      eventType: event.type,
      page: redactURL(page, base),
      knownResolution: null,
      gestureInput: {shiftKey: event.shiftKey === true, ctrlKey: event.ctrlKey === true,
        altKey: event.altKey === true, metaKey: event.metaKey === true},
      path: elements.map(node => describe(node, base)),
      nearby: [],
      pathTruncated: rawPath.filter(node => read(() => node.nodeType === 1 && !["body", "html"].includes(node.localName), false)).length > elements.length
    };
    try {
      if (globalThis.FNT?.resolve) report.knownResolution = redactURL(globalThis.FNT.resolve(rawPath, base, page), base);
    } catch { report.resolverError = true; }
    try {
      if (globalThis.FNTInspection?.inspect) report.inspection = globalThis.FNTInspection.inspect(rawPath, base);
      else report.inspection = {status: "module-unavailable"};
    } catch { report.inspection = {status: "read-error"}; }
    try {
      report.appData = globalThis.FNTAppData?.inspect ? globalThis.FNTAppData.inspect(rawPath, base).report : {status: "module-unavailable"};
    } catch { report.appData = {status: "read-error"}; }
    try {
      report.buttonEvidence = globalThis.FNTButtonEvidence?.inspect ? globalThis.FNTButtonEvidence.inspect(rawPath, base) : {status: "module-unavailable"};
    } catch { report.buttonEvidence = {status: "read-error"}; }
    try {
      if (globalThis.FNTIsolation?.describeState) {
        const state = globalThis.FNTIsolation.describeState();
        report.isolationMode = {moduleAvailable: true, modeEnabled: state?.modeEnabled === true,
          toolbarEnabled: state?.toolbarEnabled === true, topFrame: state?.topFrame === true, pending: state?.pending === true};
      } else report.isolationMode = {moduleAvailable: false};
    } catch { report.isolationMode = {moduleAvailable: false, readError: true}; }
    try {
      const control = rawPath.find(node => node && node.nodeType === 1 &&
        (node.localName === "button" || ["button", "link"].includes(node.getAttribute("role"))));
      if (report.knownResolution) report.copyEligibility = {reason: "known-destination-bypass"};
      else if (control && globalThis.FNTIsolationTarget?.audit) {
        const evidence = globalThis.FNTIsolationTarget.audit(control, document);
        const count = (value, max) => Number.isInteger(value) && value >= 0 ? Math.min(value,max) : 0;
        report.copyEligibility = {version: 1, eligible: evidence?.eligible === true,
          reason: typeof evidence?.reason === "string" && /^[a-z0-9-]{1,64}$/.test(evidence.reason) ? evidence.reason : "unavailable",
          rootType: ["document", "open-shadow", "closed-shadow", "unsupported", "unknown"].includes(evidence?.rootType) ? evidence.rootType : "unknown",
          shadowDepth: count(evidence?.shadowDepth,9), candidateCount: count(evidence?.candidateCount,10000),
          hostCandidates: count(evidence?.hostCandidates,8000), readErrors: evidence?.readErrors === true};
      } else report.copyEligibility = {reason: control ? "module-unavailable" : "control-unavailable"};
    } catch { report.copyEligibility = {reason: "read-error"}; }
    const indexes = [];
    // Semantic ancestors first; sampled div ancestors also help with unlabeled cards.
    for (let index = 0; index < elements.length; index++) {
      const node = elements[index];
      if (["body", "html"].includes(read(() => node.localName))) continue;
      if (["a", "button", "article", "li"].includes(read(() => node.localName)) ||
          ["link", "button", "article", "listitem"].includes(attr(node, "role"))) indexes.push(index);
    }
    for (const index of [0, 3, 7, 12, 17]) {
      if (elements[index] && !["body", "html"].includes(read(() => elements[index].localName)) && !indexes.includes(index)) indexes.push(index);
    }
    for (const index of indexes.slice(0, 4)) report.nearby.push({pathIndex: index, ...nearby(elements[index], base)});
    while (JSON.stringify(report).length > MAX_BYTES && report.nearby.length) { report.nearby.pop(); report.sizeLimited = true; }
    while (JSON.stringify(report).length > MAX_BYTES && report.path.length) { report.path.pop(); report.pathTruncated = true; report.sizeLimited = true; }
    if (JSON.stringify(report).length > MAX_BYTES && report.inspection) { report.inspection = {status: "omitted-for-size"}; report.sizeLimited = true; }
    if (JSON.stringify(report).length > MAX_BYTES && report.appData) { report.appData = {status: "omitted-for-size"}; report.sizeLimited = true; }
    return report;
  }
  globalThis.FNTDiagnostics = Object.freeze({redactURL, snapshot});
  if (typeof browser === "undefined") return;
  let armed = null, revision = 0;
  function apply(value) {
    armed = value && typeof value.token === "string" && value.token.length > 0 && value.token.length <= 100 &&
      Number.isFinite(value.expires) && value.expires > Date.now() && value.expires <= Date.now() + 120000 ? value : null;
  }
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.hasOwn(changes, KEY)) return;
    revision++;
    apply(changes[KEY].newValue);
  });
  const initialRevision = revision;
  try {
    Promise.resolve(browser.storage.local.get({[KEY]: null})).then(saved => {
      if (initialRevision === revision) apply(saved[KEY]);
    }, () => {});
  } catch {}
  function capture(event) {
    if (!armed || !event.isTrusted || event.button !== 1) return;
    const recording = armed;
    armed = null; // Consume before sending; pointerdown + mousedown is one report.
    if (recording.expires <= Date.now()) return;
    try {
      const report = snapshot(event);
      try { if (globalThis.FNTOutcomeTrace?.start) report.outcome = globalThis.FNTOutcomeTrace.start(event, recording.token); } catch {}
      Promise.resolve(browser.runtime.sendMessage({type: "fnt-diagnostic", recordingToken: recording.token, report})).catch(() => {});
    } catch {}
  }
  window.addEventListener("pointerdown", capture, {capture: true, passive: true});
  window.addEventListener("mousedown", capture, {capture: true, passive: true});
})();
