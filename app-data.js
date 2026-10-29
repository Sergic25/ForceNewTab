/* Framework navigation evidence. No site routes or private handlers are invoked. */
(() => {
  "use strict";
  const original = globalThis.FNT;
  const own = Object.getOwnPropertyDescriptor;
  const keysOf = Reflect.ownKeys;
  const object = value => value !== null && typeof value === "object";
  const blocked = /(?:password|secret|token|cookie|authorization|credential|session|csrf)/i;
  const excludedKeys = new Set(["children", "ref", "key", "_owner", "owner", "return", "alternate", "stateNode", "parent", "root", "store", "stores", "router", "appContext", "provides", "ctx", "setupState", "renderCache", "constructor", "prototype", "__proto__", "toJSON"]);
  const navigationKeys = new Set(["href", "to", "url", "path", "pathname"]);
  const actionRoles = new Set(["button", "menuitem", "checkbox", "switch", "radio", "textbox", "combobox", "listbox", "slider", "spinbutton"]);
  function redact(raw, base) {
    if (typeof raw !== "string") return null;
    try {
      const url = new URL(raw, base);
      if (!["http:", "https:"].includes(url.protocol)) return {protocol: url.protocol.slice(0, 24)};
      const path = url.origin + url.pathname;
      return {url: path.length <= 768 ? path : url.origin + "/[long-path-omitted]", hadQuery: !!url.search, hadFragment: !!url.hash};
    } catch { return null; }
  }
  function probe(rawPath, base, checkExisting, includeEvidence) {
    const report = {version: 1, modeEnabled: true, status: "unavailable", eligible: false, frameworks: [], sources: [], candidates: [],
      candidateCount: 0, identifierFields: 0, accessorsSkipped: 0, partial: false, readErrors: false, reflectionMayRunProxyTraps: true};
    const ctx = {report, errors: 0, objects: 0, keyBudget: 256, strongInvalid: false, strongRoutes: new Set(), hostComplete: false, hostError: false, hostPartial: false, componentRoute: null};
    const hostRecords = [];
    function error() { ctx.errors++; report.readErrors = report.partial = true; }
    function data(target, key) {
      if (!object(target)) return {present: false};
      try {
        const descriptor = own(target, key);
        if (!descriptor) return {present: false};
        if (!Object.hasOwn(descriptor, "value")) { report.accessorsSkipped++; return {present: true, accessor: true}; }
        return {present: true, value: descriptor.value};
      } catch { error(); return {present: false, failed: true}; }
    }
    function ownKeys(target, maximum = 128) {
      if (!object(target)) return [];
      try {
        const values = keysOf(target);
        if (values.length > maximum) report.partial = true;
        return values.slice(0, maximum).filter(key => typeof key === "string");
      } catch { error(); return []; }
    }
    function route(value, field) {
      let raw = value;
      if (object(value) && field === "to") {
        const names = ownKeys(value, 16);
        if (names.some(name => !["pathname", "search", "hash"].includes(name))) return {reason: "route-context-required"};
        const pathname = data(value, "pathname"), search = data(value, "search"), hash = data(value, "hash");
        if (pathname.accessor || search.accessor || hash.accessor) return {reason: "accessor-skipped"};
        if (typeof pathname.value !== "string" || !pathname.value.startsWith("/") || pathname.value.startsWith("//")) return {reason: "root-path-required"};
        for (const [entry, prefix] of [[search, "?"], [hash, "#"]]) {
          if (entry.present && (typeof entry.value !== "string" || (entry.value && !entry.value.startsWith(prefix)))) return {reason: "nonliteral-route-part"};
        }
        raw = pathname.value + (search.value || "") + (hash.value || "");
      }
      if (typeof raw !== "string") return {reason: "literal-address-required"};
      raw = raw.trim();
      if (!/^(?:https?:\/\/|\/(?!\/))/i.test(raw)) return {reason: "root-or-web-address-required"};
      try {
        const url = new URL(raw, base);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return {reason: "unsupported-or-credentialed-address"};
        let pathname = url.pathname;
        try { pathname = decodeURIComponent(pathname); } catch {}
        if (/[\[\]{}]/.test(pathname) || /(?:^|\/)(?::[^/]*|\*[^/]*)(?:\/|$)/.test(pathname)) return {reason: "route-template-rejected"};
        return {url: url.href};
      } catch { return {reason: "invalid-address"}; }
    }
    function addCandidate(source, field, value, automatic) {
      const result = route(value, field);
      report.candidateCount++;
      if (automatic) {
        if (result.url) ctx.strongRoutes.add(result.url);
        else ctx.strongInvalid = true;
      }
      if (report.candidates.length < 16) report.candidates.push({source, field, automatic, valueType: value === null ? "null" : typeof value, status: result.url ? (automatic ? "exact-host-candidate" : "evidence-only") : result.reason,
        address: result.url ? redact(result.url, base) : typeof value === "string" && /^(?:https?:\/\/|\/(?!\/))/i.test(value.trim()) ? redact(value, base) :
          typeof value === "string" && /^[a-z][a-z0-9+.-]*:/i.test(value.trim()) ? {unsupportedScheme: true} : null});
      else report.partial = true;
    }
    function evidence(props, kind) {
      if (!object(props)) return;
      const summary = {kind, keys: [], handlerFields: 0, identifierFields: 0};
      if (report.sources.length < 20) report.sources.push(summary); else { report.partial = true; return; }
      const seen = new WeakSet(), queue = [{value: props, path: "props", depth: 0}];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const item = queue[cursor];
        if (seen.has(item.value)) continue;
        seen.add(item.value);
        if (++ctx.objects > 32) { report.partial = true; break; }
        const names = ownKeys(item.value, 32);
        for (const key of names) {
          if (--ctx.keyBudget < 0) { report.partial = true; break; }
          if (blocked.test(key) || excludedKeys.has(key) || key.startsWith("__")) continue;
          if (!/^[A-Za-z_$][\w$]{0,39}$/.test(key) && !(Array.isArray(item.value) && /^\d{1,2}$/.test(key))) continue;
          if (!item.depth && summary.keys.length < 16) summary.keys.push(key);
          if (/^(?:id|uuid|.*(?:Id|_id))$/.test(key)) { summary.identifierFields++; report.identifierFields++; continue; }
          if (/^on[A-Z]/.test(key)) { summary.handlerFields++; continue; }
          const entry = data(item.value, key);
          if (entry.accessor || entry.failed) continue;
          const propertyPath = item.path + "." + key;
          if (navigationKeys.has(key)) addCandidate(kind, propertyPath, entry.value, false);
          if (object(entry.value) && item.depth < 2 && queue.length < 32) queue.push({value: entry.value, path: propertyPath, depth: item.depth + 1});
          else if (object(entry.value)) { report.partial = true; if (item.depth >= 2) report.depthLimited = true; }
        }
      }
    }
    function hostProps(props, kind) {
      if (!object(props)) { ctx.strongInvalid = true; return; }
      for (const name of ["href", "to"]) {
        const entry = data(props, name);
        if (entry.accessor || entry.failed) { ctx.strongInvalid = true; continue; }
        if (entry.present && entry.value !== null && entry.value !== undefined) addCandidate(kind, name, entry.value, true);
      }
      hostRecords.push({props, kind});
    }
    function done() {
      if (ctx.errors) report.readErrors = report.partial = true;
      let destination = null;
      report.hostInspectionComplete = ctx.hostComplete && !ctx.hostError && !ctx.hostPartial;
      report.evidenceComplete = !report.partial && !report.readErrors;
      if (ctx.strongRoutes.size > 1) report.status = "conflicting-exact-host-addresses";
      else if (ctx.hostError || ctx.hostPartial) report.status = "exact-host-inspection-incomplete";
      else if (ctx.strongInvalid) report.status = "exact-host-address-rejected";
      else if (ctx.strongRoutes.size === 1) { destination = ctx.strongRoutes.values().next().value; report.status = "exact-host-address-found"; }
      else if (ctx.componentRoute) { destination = ctx.componentRoute; report.status = "owned-component-link-found"; }
      else if (report.candidateCount) report.status = "evidence-only";
      else if (report.frameworks.length) report.status = "no-explicit-address-found";
      if (!report.evidenceComplete && !ctx.strongRoutes.size && !ctx.strongInvalid && !ctx.componentRoute) report.status = "inspection-incomplete";
      report.uniqueExactHostAddresses = ctx.strongRoutes.size;
      while (JSON.stringify(report).length > 9000 && report.candidates.length) { report.candidates.pop(); report.sizeLimited = true; }
      while (JSON.stringify(report).length > 9000 && report.sources.length) { report.sources.pop(); report.sizeLimited = true; }
      return {destination, report};
    }
    try {
      if (typeof original?.resolve !== "function") { report.status = "resolver-unavailable"; return {destination: null, report}; }
      if (checkExisting && original.resolve(rawPath, base, base)) { report.status = "dom-resolved"; return {destination: null, report}; }
      const nodes = Array.isArray(rawPath) ? rawPath.filter(node => node && node.nodeType === 1) : [];
      const role = node => (node.getAttribute("role") || "").toLowerCase();
      const component = node => ["article", "li"].includes(node.localName) || ["link", "listitem", "article"].includes(role(node));
      const index = nodes.findIndex(component);
      if (index < 0 || role(nodes[index]) !== "link") { report.status = "explicit-link-owner-required"; return {destination: null, report}; }
      if (nodes.some(node => ["href", "data-href", "data-url"].some(name => node.hasAttribute(name)))) { report.status = "dom-metadata-present"; return {destination: null, report}; }
      const owner = nodes[index];
      if (owner.isConnected === false || (typeof document !== "undefined" && owner.ownerDocument && owner.ownerDocument !== document)) {
        report.status = "disconnected-or-adopted-control"; return {destination: null, report};
      }
      if (nodes.some(node => ["form", "input", "textarea", "select", "option", "label", "summary"].includes(node.localName) ||
          node.isContentEditable || node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true" ||
          ["textbox", "combobox", "listbox"].includes(role(node)) || (node.localName === "button" && ["submit", "reset"].includes(node.getAttribute("type")))) ||
          nodes.slice(0,index+1).some(node => node.localName === "button" || actionRoles.has(role(node)))) {
        report.status = "action-form-or-editable-exclusion"; return {destination: null, report};
      }
      if (owner.querySelectorAll("a[href]").length !== 0) { report.status = "ordinary-anchor-present"; return {destination: null, report}; }
      report.eligible = true;
      const pageOwner = owner.wrappedJSObject;
      if (!object(pageOwner)) { report.status = "page-object-unavailable"; return {destination: null, report}; }
      const names = ownKeys(pageOwner);
      const hostKeys = names.filter(name => /^__reactProps\$/.test(name));
      if (hostKeys.length > 4) report.partial = true;
      if (hostKeys.length || names.some(name => /^__reactFiber\$/.test(name))) report.frameworks.push("react");
      for (const name of hostKeys.slice(0, 4)) {
        const entry = data(pageOwner, name);
        if (entry.accessor || entry.failed) ctx.strongInvalid = true;
        else hostProps(entry.value, "react-current-host");
      }
      ctx.hostComplete = true;
      ctx.hostError = report.readErrors;
      ctx.hostPartial = report.partial;
      if (!ctx.hostError && !ctx.hostPartial && !ctx.strongInvalid && !ctx.strongRoutes.size &&
          globalThis.FNTComponentLink?.find && hostRecords.length) {
        const fiberNames = names.filter(name => /^__reactFiber\$/.test(name));
        const fibers = [];
        let fiberReadFailed = fiberNames.length > 2;
        for (const name of fiberNames.slice(0, 2)) {
          const entry = data(pageOwner, name);
          if (entry.accessor || entry.failed) fiberReadFailed = true;
          else if (object(entry.value)) fibers.push(entry.value);
        }
        if (fiberReadFailed) report.componentLink = {status: "fiber-access-incomplete"};
        else {
          const result = globalThis.FNTComponentLink.find({owner, pageOwner,
            hostProps: hostRecords.map(record => record.props), fibers, base});
          report.componentLink = result.report;
          ctx.componentRoute = result.destination || null;
        }
      }
      if (!includeEvidence) return done();
      for (const record of hostRecords) evidence(record.props, record.kind);
      const fiberKeys = names.filter(name => /^__reactFiber\$/.test(name));
      if (fiberKeys.length > 2) report.partial = true;
      for (const name of fiberKeys.slice(0, 2)) {
        let fiber = data(pageOwner, name).value;
        const seen = new WeakSet();
        let count = 0;
        while (object(fiber) && count++ < 12) {
          if (seen.has(fiber)) { report.partial = true; break; }
          seen.add(fiber);
          const state = data(fiber, "stateNode").value;
          if (object(state) && state !== pageOwner && state !== owner) {
            const nodeType = data(state, "nodeType");
            // DOM nodeType may be inherited; a distinct host fiber is also a boundary.
            const fiberTag = data(fiber, "tag").value;
            if (nodeType.value === 1 || [5, 26, 27].includes(fiberTag)) break;
          }
          evidence(data(fiber, "memoizedProps").value, "react-fiber-evidence-" + (count - 1));
          fiber = data(fiber, "return").value;
        }
        if (object(fiber) && count > 12) report.partial = true;
      }
      for (const name of ["__vnode", "__vueParentComponent"]) {
        if (!names.includes(name)) continue;
        if (!report.frameworks.includes("vue")) report.frameworks.push("vue");
        const value = data(pageOwner, name).value;
        if (name === "__vnode") evidence(data(value, "props").value, "vue-vnode-evidence");
        else {
          evidence(data(value, "props").value, "vue-component-evidence");
          const vnode = data(value, "vnode").value;
          evidence(data(vnode, "props").value, "vue-component-vnode-evidence");
        }
      }
      return done();
    } catch { if (!ctx.hostComplete) ctx.hostError = true; error(); report.status = "inspection-incomplete"; return done(); }
  }
  function inspect(path, base) { return probe(path, base, true, true); }
  globalThis.FNTAppData = Object.freeze({inspect});
  if (original?.resolve) {
    const resolve = (...args) => {
      const ordinary = original.resolve(...args);
      if (ordinary) return ordinary;
      try { return probe(args[0], args[1], false, false).destination || ordinary; } catch { return ordinary; }
    };
    globalThis.FNT = Object.freeze({...original, resolve});
  }
})();
