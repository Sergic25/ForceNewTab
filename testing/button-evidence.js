/* Explicit recording only: bounded button-owned hints, never an automatic route. */
(() => {
  "use strict";
  const own = Object.getOwnPropertyDescriptor, ownKeys = Reflect.ownKeys;
  const object = value => value !== null && typeof value === "object";
  const hostFields = ["href", "to", "url", "data-href", "data-url", "navigationURL", "navigationUrl"];
  function inspect(rawPath, base) {
    const report = {version: 1, scope: "button-owned-evidence-only", status: "button-required", eligible: false,
      automaticUse: false, owners: [], candidates: [], frameworks: [], accessorsSkipped: 0,
      descriptorsRead: 0, keysInspected: 0, limited: false, readErrors: false, reflectionMayRunProxyTraps: true};
    let descriptorBudget = 192, keyBudget = 256;
    function read(fn, fallback = null) { try { return fn(); } catch { report.readErrors = true; return fallback; } }
    function data(target, key) {
      if (!object(target)) return {present: false};
      if (descriptorBudget-- <= 0) { report.limited = true; return {present: false, blocked: true}; }
      report.descriptorsRead++;
      try {
        const descriptor = own(target, key);
        if (!descriptor) return {present: false};
        if (!Object.hasOwn(descriptor, "value")) { report.accessorsSkipped++; return {present: true, blocked: true}; }
        return {present: true, value: descriptor.value};
      } catch { report.readErrors = true; return {present: false, blocked: true}; }
    }
    function keys(target, cap = 96, includeSymbols = false) {
      if (!object(target)) return [];
      try {
        const names = ownKeys(target);
        const count = Math.min(cap, keyBudget, names.length);
        if (names.length > count) report.limited = true;
        keyBudget -= count; report.keysInspected += count;
        return names.slice(0, count).filter(name => includeSymbols || typeof name === "string");
      } catch { report.readErrors = true; return []; }
    }
    const attr = (node, name) => read(() => node.getAttribute(name));
    const tag = node => read(() => node.localName, "");
    const role = node => { const value = attr(node, "role"); return typeof value === "string" ? value.toLowerCase() : ""; };
    const action = node => ["button", "a", "input", "textarea", "select", "summary"].includes(tag(node)) ||
      ["button", "link", "menuitem", "checkbox", "switch", "radio", "textbox", "combobox", "listbox", "slider", "spinbutton"].includes(role(node));
    function route(value) {
      if (typeof value !== "string") return {status: "literal-address-required"};
      const raw = value.trim();
      if (!/^(?:https?:\/\/|\/(?!\/))/i.test(raw) || /[\\\u0000-\u001f\u007f]/.test(raw)) return {status: "relative-or-context-dependent"};
      try {
        const url = new URL(raw, base);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return {status: "unsafe-address-rejected"};
        let pathname = url.pathname;
        try { pathname = decodeURIComponent(pathname); } catch {}
        if (/[\[\]{}]/.test(pathname) || /(?:^|\/)(?::[^/]*|\*[^/]*)(?:\/|$)/.test(pathname)) return {status: "route-template-rejected"};
        const path = url.origin + url.pathname;
        return {status: "literal-address-evidence", address: {url: path.length <= 768 ? path : url.origin + "/[long-path-omitted]", hadQuery: !!url.search, hadFragment: !!url.hash}};
      } catch { return {status: "invalid-address"}; }
    }
    function structured(value) {
      if (!object(value)) return route(value);
      const names = keys(value, 12, true);
      if (names.some(name => typeof name !== "string" || !["pathname", "search", "hash"].includes(name))) return {status: "route-context-required"};
      const pathname = data(value, "pathname"), search = data(value, "search"), hash = data(value, "hash");
      if ([pathname, search, hash].some(entry => entry.blocked)) return {status: "accessor-or-incomplete"};
      if (typeof pathname.value !== "string") return {status: "literal-pathname-required"};
      for (const [entry, prefix] of [[search, "?"], [hash, "#"]]) {
        if (entry.value != null && (typeof entry.value !== "string" || (entry.value && !entry.value.startsWith(prefix)))) return {status: "route-context-required"};
      }
      if ((pathname.value.includes("?") && search.value != null) || (pathname.value.includes("#") && hash.value != null)) return {status: "conflicting-route-parts"};
      return route(pathname.value + (search.value || "") + (hash.value || ""));
    }
    function candidate(ownerIndex, source, field, entry, allowStructured = false) {
      if (!entry.present) return;
      if (report.candidates.length >= 12) { report.limited = true; return; }
      const result = entry.blocked ? {status: "accessor-or-incomplete"} : allowStructured ? structured(entry.value) : route(entry.value);
      report.candidates.push({ownerIndex, source, field, automaticUse: false,
        valueType: entry.blocked ? "unread" : entry.value === null ? "null" : typeof entry.value, ...result});
    }
    function props(value, ownerIndex, source) {
      if (!object(value)) return;
      for (const field of ["href", "to", "url", "link"]) candidate(ownerIndex, source, field, data(value, field), ["to", "link"].includes(field));
    }
    function addFramework(name) { if (!report.frameworks.includes(name)) report.frameworks.push(name); }
    function inspectOwner(node, ownerIndex) {
      const summary = {tag: String(tag(node)).slice(0, 40), kind: ownerIndex ? "custom-element-ancestor" : "clicked-button", privateData: "unavailable"};
      report.owners.push(summary);
      for (const field of ["href", "data-href", "data-url", "routerlink", "ng-reflect-router-link"]) {
        const value = attr(node, field);
        if (value !== null) candidate(ownerIndex, "dom-attribute", field, {present: true, value});
      }
      const page = read(() => node.wrappedJSObject);
      if (!object(page)) return;
      summary.privateData = "inspected";
      for (const field of hostFields) candidate(ownerIndex, "own-property", field, data(page, field));
      const names = keys(page);
      const react = names.filter(name => /^__reactProps\$/.test(name));
      if (react.length > 2) report.limited = true;
      if (react.length || names.some(name => /^__reactFiber\$/.test(name))) addFramework("react");
      for (const name of react.slice(0, 2)) {
        const record = data(page, name);
        if (!record.blocked) props(record.value, ownerIndex, "react-current-host-evidence");
      }
      const angular = data(page, "__ngContext__");
      if (angular.present) {
        addFramework("angular");
        summary.angularContext = {type: angular.blocked ? "unread" : angular.value === null ? "null" : Array.isArray(angular.value) ? "array" : typeof angular.value,
          traversed: false};
      }
      for (const field of ["__vnode", "__vueParentComponent"]) {
        const entry = data(page, field);
        if (!entry.present || entry.blocked) continue;
        addFramework("vue");
        props(data(entry.value, "props").value, ownerIndex, field === "__vnode" ? "vue-vnode-evidence" : "vue-component-evidence");
      }
    }
    try {
      const nodes = Array.isArray(rawPath) ? rawPath.filter(node => read(() => node && node.nodeType === 1, false)) : [];
      const index = nodes.findIndex(node => tag(node) === "button" || role(node) === "button");
      if (index < 0) return report;
      if (nodes.some(node => ["form", "input", "textarea", "select", "option", "label", "summary"].includes(tag(node)) ||
          read(() => node.isContentEditable, false) || read(() => node.hasAttribute("disabled"), false) || attr(node, "aria-disabled") === "true" ||
          ["textbox", "combobox", "listbox"].includes(role(node)) || (tag(node) === "button" && ["submit", "reset"].includes(String(attr(node, "type")).toLowerCase())))) {
        report.status = "action-form-or-editable-exclusion"; return report;
      }
      if (nodes.slice(0, index).some(action)) { report.status = "nested-action-exclusion"; return report; }
      if (report.readErrors) { report.status = "inspection-incomplete"; return report; }
      const owner = nodes[index];
      if (owner.isConnected === false || (typeof document !== "undefined" && owner.ownerDocument && owner.ownerDocument !== document)) {
        report.status = "disconnected-or-adopted-control"; return report;
      }
      report.eligible = true;
      inspectOwner(owner, 0);
      let customCount = 0;
      for (let step = 1; step <= 5 && index + step < nodes.length; step++) {
        const node = nodes[index + step];
        if (action(node) || tag(node) === "form" || !String(tag(node)).includes("-")) break;
        if (++customCount > 3) { report.limited = true; break; }
        inspectOwner(node, report.owners.length);
      }
      report.status = report.candidates.some(item => item.address) ? "button-address-evidence-found" : "no-button-address-evidence";
    } catch { report.readErrors = true; report.status = "inspection-incomplete"; }
    while (JSON.stringify(report).length > 5000 && report.candidates.length) { report.candidates.pop(); report.limited = true; }
    while (JSON.stringify(report).length > 5000 && report.owners.length > 1) { report.owners.pop(); report.limited = true; }
    return report;
  }
  globalThis.FNTButtonEvidence = Object.freeze({inspect});
})();
