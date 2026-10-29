/* Bounded in-memory control identity, including uniquely matched open shadow hosts. */
(() => {
  "use strict";
  const own = Object.getOwnPropertyDescriptor;
  const fields = ["id", "name", "data-testid", "data-test", "data-cy"];
  const query = 'button,[role="button"],[role="link"]';
  const maxCandidates = 2000, maxAggregate = 8000, maxShadowDepth = 8;
  const forbiddenTags = new Set(["form", "input", "textarea", "select", "option", "label", "summary"]);
  const forbiddenRoles = new Set(["textbox", "combobox", "listbox", "checkbox", "radio", "switch", "slider", "spinbutton", "menuitem"]);
  const tagPattern = /^[a-z][a-z0-9-]{0,63}$/;
  const badChars = /[\u0000-\u001f\u007f]/;
  function data(value, key) {
    if (value === null || typeof value !== "object") return {ok: false};
    const desc = own(value, key);
    return desc && Object.hasOwn(desc, "value") ? {ok: true, value: desc.value} : {ok: false};
  }
  function recordShape(value, allowed) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && Object.getPrototypeOf(proto) !== null) return false;
    const names = Reflect.ownKeys(value);
    return names.length <= allowed.length && names.every(key => typeof key === "string" && allowed.includes(key) && data(value, key).ok);
  }
  function normal(raw) {
    if (typeof raw !== "string") return null;
    const value = raw.replace(/\s+/g, " ").trim();
    return value.length <= 160 && !badChars.test(value) ? value : null;
  }
  function attribute(node, name) {
    const value = node.getAttribute(name);
    if (value !== null && typeof value !== "string") throw new TypeError("Invalid DOM attribute");
    return value;
  }
  const roleOf = node => (attribute(node, "role") || "").trim().toLowerCase();
  const isTarget = node => node && node.nodeType === 1 && (node.localName === "button" || ["button", "link"].includes(roleOf(node)));
  const failure = (reason, extra = {}) => ({...extra, ok: false, reason});
  function roots(target, doc) {
    if (typeof target.getRootNode !== "function") return failure("root-unavailable", {rootType: "unsupported", shadowDepth: 0});
    let root = target.getRootNode(), depth = 0;
    const chain = [], seen = new WeakSet();
    while (root !== doc) {
      if (!root || typeof root !== "object" || root.nodeType !== 11 || !root.host) return failure("root-unavailable", {rootType: "unsupported", shadowDepth: depth});
      if (seen.has(root)) return failure("root-cycle", {rootType: "unsupported", shadowDepth: depth});
      seen.add(root);
      if (++depth > maxShadowDepth) return failure("shadow-depth-limit", {rootType: "open-shadow", shadowDepth: depth});
      const host = root.host;
      if (root.mode !== "open") return failure("closed-shadow-root", {rootType: "closed-shadow", shadowDepth: depth});
      if (host.shadowRoot !== root) return failure("inaccessible-shadow-root", {rootType: "unsupported", shadowDepth: depth});
      if (host.ownerDocument !== doc || host.isConnected !== true || typeof host.getRootNode !== "function") return failure("adopted-control", {rootType: "open-shadow", shadowDepth: depth});
      chain.push({root, host});
      root = host.getRootNode();
    }
    return {ok: true, chain: chain.reverse(), rootType: depth ? "open-shadow" : "document", shadowDepth: depth};
  }
  function eligibility(target, doc) {
    if (!doc || doc.nodeType !== 9) return failure("document-unavailable");
    if (!isTarget(target)) return failure("not-control");
    if (target.isConnected !== true) return failure("disconnected-control");
    if (target.ownerDocument !== doc) return failure("adopted-control");
    if (doc.defaultView && doc.defaultView.top !== doc.defaultView) return failure("subframe");
    const context = roots(target, doc);
    if (!context.ok) return context;
    let node = target, depth = 0;
    const seen = new WeakSet();
    while (node) {
      if (++depth > 256) return failure("ancestor-limit", context);
      if (seen.has(node)) return failure("ancestor-cycle", context);
      seen.add(node);
      const role = roleOf(node);
      if (forbiddenTags.has(node.localName) || forbiddenRoles.has(role) || node.isContentEditable || node.hasAttribute("form")) return failure("form-or-editable", context);
      if (node.hasAttribute("disabled") || attribute(node, "aria-disabled") === "true") return failure("disabled-control", context);
      if (node.hasAttribute("hidden") || node.hasAttribute("inert") || (attribute(node, "aria-hidden") || "").trim().toLowerCase() === "true") return failure("hidden-control", context);
      if (node.localName === "button") {
        const type = (attribute(node, "type") || "").trim().toLowerCase();
        if (["submit", "reset"].includes(type) || (type && type !== "button")) return failure("submit-or-reset", context);
        if (node.form != null) return failure("form-or-editable", context);
      }
      if (node !== target && (node.localName === "button" || ["button", "link"].includes(role))) return failure("nested-control", context);
      if (node.parentElement) node = node.parentElement;
      else {
        const root = typeof node.getRootNode === "function" ? node.getRootNode() : doc;
        node = root === doc ? null : root?.host || null;
      }
    }
    return context;
  }
  function identity(node) {
    const tag = node.localName;
    if (!tagPattern.test(tag)) return failure("invalid-tag");
    const attrs = {};
    for (const field of fields) {
      const value = attribute(node, field);
      if (value === null || !value.trim()) continue;
      if (value.length > 160 || badChars.test(value)) return failure("identity-too-long");
      attrs[field] = value;
    }
    const customAncestors = [];
    let parent = node.parentElement;
    while (parent && customAncestors.length < 3 && parent.localName.includes("-")) {
      if (!tagPattern.test(parent.localName)) return failure("invalid-tag");
      customAncestors.push(parent.localName);
      parent = parent.parentElement;
    }
    return {ok: true, value: {tag, attrs, customAncestors}};
  }
  function fingerprint(target, doc) {
    const context = eligibility(target, doc);
    if (!context.ok) return context;
    const id = identity(target);
    if (!id.ok) return failure(id.reason, context);
    const role = roleOf(target), type = (attribute(target, "type") || "").trim().toLowerCase();
    let label = null;
    const aria = attribute(target, "aria-label");
    if (aria !== null && normal(aria) === null) return failure("label-too-long", context);
    if (aria !== null && normal(aria)) label = {kind: "aria-label", value: normal(aria)};
    else {
      const text = normal(target.textContent);
      if (text === null) return failure("label-too-long", context);
      if (text) label = {kind: "text", value: text};
    }
    if (!label && !Object.keys(id.value.attrs).length) return failure("missing-label-or-identity", context);
    const descriptor = {version: context.shadowDepth ? 2 : 1, tag: id.value.tag, role, type, label, attrs: id.value.attrs, customAncestors: id.value.customAncestors};
    if (context.shadowDepth) {
      descriptor.shadowHosts = [];
      for (const entry of context.chain) {
        const host = identity(entry.host);
        if (!host.ok) return failure(host.reason, context);
        descriptor.shadowHosts.push(host.value);
      }
    }
    return {ok: true, descriptor, rootType: context.rootType, shadowDepth: context.shadowDepth};
  }
  function attrsValid(attrs) {
    if (!recordShape(attrs, fields)) return false;
    return Reflect.ownKeys(attrs).every(field => {
      const raw = data(attrs, field).value;
      return typeof raw === "string" && !!raw.trim() && raw.length <= 160 && !badChars.test(raw);
    });
  }
  function ancestorsValid(value) {
    if (!Array.isArray(value) || value.length > 3 || Reflect.ownKeys(value).some(key => key !== "length" && !/^(?:0|1|2)$/.test(String(key)))) return false;
    for (let i = 0; i < value.length; i++) {
      const entry = data(value, String(i));
      if (!entry.ok || typeof entry.value !== "string" || !tagPattern.test(entry.value) || !entry.value.includes("-")) return false;
    }
    return true;
  }
  function canonicalIdentity(value) {
    const attrs = {};
    for (const field of fields) if (data(value.attrs, field).ok) attrs[field] = data(value.attrs, field).value;
    const customAncestors = [];
    for (let i = 0; i < value.customAncestors.length; i++) customAncestors.push(data(value.customAncestors, String(i)).value);
    return {tag: value.tag, attrs, customAncestors};
  }
  function hostValid(value) {
    return recordShape(value, ["tag", "attrs", "customAncestors"]) && Reflect.ownKeys(value).length === 3 &&
      typeof data(value, "tag").value === "string" && tagPattern.test(data(value, "tag").value) &&
      attrsValid(data(value, "attrs").value) && ancestorsValid(data(value, "customAncestors").value);
  }
  function validDescriptor(value) {
    try {
      const version = data(value, "version").value;
      const allowed = ["version", "tag", "role", "type", "label", "attrs", "customAncestors", ...(version === 2 ? ["shadowHosts"] : [])];
      if (![1, 2].includes(version) || !recordShape(value, allowed) || Reflect.ownKeys(value).length !== allowed.length) return false;
      const get = key => data(value, key).value;
      const tag = get("tag"), role = get("role"), type = get("type"), label = get("label"), attrs = get("attrs"), ancestors = get("customAncestors");
      if (typeof tag !== "string" || !tagPattern.test(tag) || typeof role !== "string" || !["", "button", "link"].includes(role) ||
          (tag !== "button" && !["button", "link"].includes(role)) || typeof type !== "string" || type.length > 32 || badChars.test(type) ||
          (tag === "button" && !["", "button"].includes(type)) || !attrsValid(attrs) || !ancestorsValid(ancestors)) return false;
      if (label !== null) {
        if (!recordShape(label, ["kind", "value"]) || Reflect.ownKeys(label).length !== 2) return false;
        const kind = data(label, "kind").value, text = data(label, "value").value;
        if (!["aria-label", "text"].includes(kind) || !text || normal(text) !== text) return false;
      } else if (!Reflect.ownKeys(attrs).length) return false;
      const canonical = {version, ...canonicalIdentity({tag, attrs, customAncestors: ancestors}), role, type,
        label: label === null ? null : {kind: data(label, "kind").value, value: data(label, "value").value}};
      if (version === 2) {
        const hosts = get("shadowHosts");
        if (!Array.isArray(hosts) || !hosts.length || hosts.length > maxShadowDepth ||
            Reflect.ownKeys(hosts).some(key => key !== "length" && !/^[0-7]$/.test(String(key)))) return false;
        canonical.shadowHosts = [];
        for (let i = 0; i < hosts.length; i++) {
          const entry = data(hosts, String(i));
          if (!entry.ok || !hostValid(entry.value)) return false;
          canonical.shadowHosts.push(canonicalIdentity(entry.value));
        }
      }
      return JSON.stringify(canonical).length <= (version === 1 ? 2500 : 4000);
    } catch { return false; }
  }
  function sameIdentity(left, right) {
    return left.tag === right.tag && fields.every(field => left.attrs[field] === right.attrs[field]) &&
      left.customAncestors.length === right.customAncestors.length && left.customAncestors.every((tag, i) => tag === right.customAncestors[i]);
  }
  function same(left, right) {
    return left.version === right.version && (left.version === 1 || (left.shadowHosts.length === right.shadowHosts.length && left.shadowHosts.every((host, i) => sameIdentity(host, right.shadowHosts[i])))) &&
      sameIdentity(left, right) && left.role === right.role && left.type === right.type &&
      (left.label === null ? right.label === null : right.label !== null && left.label.kind === right.label.kind && left.label.value === right.label.value);
  }
  function scan(scope, selector, budget) {
    const nodes = scope.querySelectorAll(selector);
    if (!Number.isInteger(nodes.length) || nodes.length > maxCandidates) return failure("candidate-limit");
    budget.scanned += nodes.length;
    if (budget.scanned > maxAggregate) return failure("aggregate-candidate-limit");
    return {ok: true, nodes};
  }
  function find(descriptor, doc) {
    if (!validDescriptor(descriptor)) return failure("invalid-descriptor", {target: null});
    const budget = {scanned: 0, hostCandidates: 0};
    const done = (ok, target, reason) => ({ok, target, reason, candidateCount: budget.scanned, hostCandidates: budget.hostCandidates});
    try {
      if (!doc || doc.nodeType !== 9 || typeof doc.querySelectorAll !== "function") return done(false, null, "document-unavailable");
      let scope = doc;
      if (descriptor.version === 2) for (const expected of descriptor.shadowHosts) {
        const candidates = scan(scope, expected.tag, budget);
        if (!candidates.ok) return done(false, null, candidates.reason);
        let host = null;
        for (const node of candidates.nodes) {
          budget.hostCandidates++;
          if (node.ownerDocument !== doc || node.isConnected !== true || typeof node.getRootNode !== "function" || node.getRootNode() !== scope) continue;
          const id = identity(node);
          if (!id.ok || !sameIdentity(id.value, expected)) continue;
          if (host) return done(false, null, "ambiguous-shadow-host");
          host = node;
        }
        if (!host) return done(false, null, "shadow-host-not-found");
        const root = host.shadowRoot;
        if (!root || root.nodeType !== 11 || root.mode !== "open" || root.host !== host) return done(false, null, "inaccessible-shadow-root");
        scope = root;
      }
      const candidates = scan(scope, query, budget);
      if (!candidates.ok) return done(false, null, candidates.reason);
      let match = null;
      for (const node of candidates.nodes) {
        if (typeof node.getRootNode !== "function" || node.getRootNode() !== scope) continue;
        const candidate = fingerprint(node, doc);
        if (!candidate.ok || !same(candidate.descriptor, descriptor)) continue;
        if (typeof node.getClientRects === "function") {
          const rects = node.getClientRects();
          if (!rects || !Number.isInteger(rects.length) || rects.length <= 0) continue;
        }
        if (match) return done(false, null, "ambiguous-control");
        match = node;
      }
      return done(!!match, match, match ? "unique-control" : "control-not-found");
    } catch { return done(false, null, "read-error"); }
  }
  function evaluate(target, doc) {
    try {
      const result = fingerprint(target, doc);
      if (!result.ok) return result;
      if (!validDescriptor(result.descriptor)) return failure("invalid-descriptor", result);
      const found = find(result.descriptor, doc);
      if (!found.ok || found.target !== target) return failure(found.ok ? "target-changed" : found.reason,
        {rootType: result.rootType, shadowDepth: result.shadowDepth, candidateCount: found.candidateCount, hostCandidates: found.hostCandidates, readErrors: found.reason === "read-error"});
      return {ok: true, descriptor: result.descriptor, rootType: result.rootType, shadowDepth: result.shadowDepth,
        candidateCount: found.candidateCount, hostCandidates: found.hostCandidates};
    } catch { return failure("read-error", {readErrors: true}); }
  }
  function describe(target, doc) { const result = evaluate(target, doc); return result.ok ? result.descriptor : null; }
  function audit(target, doc) {
    const result = evaluate(target, doc);
    return {version: 1, eligible: result.ok === true, reason: result.ok ? "eligible" : result.reason,
      rootType: ["document", "open-shadow", "closed-shadow", "unsupported"].includes(result.rootType) ? result.rootType : "unknown",
      shadowDepth: Number.isInteger(result.shadowDepth) ? Math.min(result.shadowDepth, 9) : 0,
      candidateCount: Number.isInteger(result.candidateCount) ? Math.min(result.candidateCount, maxAggregate + maxCandidates) : 0,
      hostCandidates: Number.isInteger(result.hostCandidates) ? Math.min(result.hostCandidates, maxAggregate) : 0,
      readErrors: result.readErrors === true};
  }
  globalThis.FNTIsolationTarget = Object.freeze({describe, validDescriptor, find, audit});
})();
