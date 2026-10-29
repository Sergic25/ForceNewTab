/* Optional structured navigation on a proven current component owned by one DOM control. */
(() => {
  "use strict";
  const own = Object.getOwnPropertyDescriptor, ownKeys = Reflect.ownKeys;
  const isObject = value => value !== null && typeof value === "object";
  const hostTags = new Set([5, 26, 27]);
  const CURRENT_PATH_LIMIT = 1024, MEMBERSHIP_LIMIT = 8192;
  function find({owner, pageOwner, hostProps, fibers, base}) {
    const report = {status: "current-fiber-unverified", currentFiberVerified: false, hostCandidates: 0, currentCandidates: 0,
      membershipChecks: 0, ownershipChecks: 0, ownedComponents: 0, candidateCount: 0, uniqueAddresses: 0,
      candidates: [], accessorsSkipped: 0, readErrors: false, limited: false,
      currentPathLimit: CURRENT_PATH_LIMIT, membershipLimit: MEMBERSHIP_LIMIT, maxPathDepth: 0, currentProofAttempts: []};
    const ctx = {failure: null, memberships: 0, ownerships: 0, lastPathDepth: 0};
    const fail = reason => { if (!ctx.failure) ctx.failure = reason; };
    function data(target, key) {
      if (!isObject(target)) return {present: false};
      try {
        const desc = own(target, key);
        if (!desc) return {present: false};
        if (!Object.hasOwn(desc, "value")) { report.accessorsSkipped++; fail("accessor-skipped"); return {present: true, blocked: true}; }
        return {present: true, value: desc.value};
      } catch { report.readErrors = true; fail("reflection-error"); return {present: false, blocked: true}; }
    }
    function limit(reason) { report.limited = true; fail(reason); }
    function member(parent, child) {
      let cursor = data(parent, "child").value;
      const seen = new WeakSet();
      while (isObject(cursor)) {
        if (++ctx.memberships > MEMBERSHIP_LIMIT) { limit("membership-limit"); return false; }
        if (seen.has(cursor)) { fail("fiber-cycle"); return false; }
        seen.add(cursor);
        if (cursor === child) return true;
        cursor = data(cursor, "sibling").value;
      }
      return false;
    }
    function currentPath(start) {
      const path = [], seen = new WeakSet();
      let node = start;
      ctx.lastPathDepth = 0;
      for (let depth = 0; depth < CURRENT_PATH_LIMIT && isObject(node); depth++) {
        ctx.lastPathDepth = depth + 1;
        report.maxPathDepth = Math.max(report.maxPathDepth, ctx.lastPathDepth);
        if (seen.has(node)) { fail("fiber-cycle"); return null; }
        seen.add(node); path.push(node);
        const parent = data(node, "return").value;
        if (parent == null) {
          if (data(node, "tag").value !== 3) return null;
          const root = data(node, "stateNode").value;
          return data(root, "current").value === node ? path : null;
        }
        if (!isObject(parent) || !member(parent, node)) return null;
        node = parent;
      }
      if (isObject(node)) limit("current-path-limit");
      return null;
    }
    const sameOwner = node => node === owner || node === pageOwner;
    function soleOwnerRoot(component) {
      const first = data(component, "child").value;
      if (!isObject(first)) return false;
      const stack = [first], seen = new WeakSet();
      let roots = 0, local = 0;
      while (stack.length) {
        if (++local > 128 || ++ctx.ownerships > 512) { limit("ownership-limit"); return false; }
        const node = stack.pop();
        if (seen.has(node)) { fail("fiber-cycle"); return false; }
        seen.add(node);
        const tag = data(node, "tag").value;
        if (!Number.isInteger(tag)) return false;
        if (hostTags.has(tag)) {
          if (!sameOwner(data(node, "stateNode").value) || ++roots > 1) return false;
        } else {
          if ([3, 4, 6].includes(tag)) return false;
          const child = data(node, "child").value;
          if (child != null && !isObject(child)) { fail("invalid-fiber-shape"); return false; }
          if (isObject(child)) stack.push(child);
        }
        const sibling = data(node, "sibling").value;
        if (sibling != null && !isObject(sibling)) { fail("invalid-fiber-shape"); return false; }
        if (isObject(sibling)) stack.push(sibling);
      }
      return roots === 1 && !ctx.failure;
    }
    function redact(url) {
      const parsed = new URL(url);
      const address = parsed.origin + parsed.pathname;
      return {url: address.length <= 768 ? address : parsed.origin + "/[long-path-omitted]", hadQuery: !!parsed.search, hadFragment: !!parsed.hash};
    }
    function literal(raw) {
      if (typeof raw !== "string") return {reason: "literal-address-required"};
      raw = raw.trim();
      if (!/^(?:https?:\/\/|\/(?!\/))/i.test(raw) || /[\\\u0000-\u001f\u007f]/.test(raw)) return {reason: "root-or-web-address-required"};
      try {
        const url = new URL(raw, base);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return {reason: "unsupported-address"};
        let pathname = url.pathname;
        try { pathname = decodeURIComponent(pathname); } catch {}
        if (/[\[\]{}]/.test(pathname) || /(?:^|\/)(?::[^/]*|\*[^/]*)(?:\/|$)/.test(pathname)) return {reason: "route-template-rejected"};
        return {url: url.href};
      } catch { return {reason: "invalid-address"}; }
    }
    function structured(value) {
      if (typeof value === "string") return literal(value);
      if (!isObject(value)) return {reason: "structured-link-required"};
      let keys;
      try { keys = ownKeys(value); } catch { report.readErrors = true; fail("reflection-error"); return {reason: "reflection-error"}; }
      if (keys.length > 16) { limit("route-key-limit"); return {reason: "route-key-limit"}; }
      const allowed = new Set(["pathname", "search", "hash", "query", "state", "replace", "anchorless"]);
      const schema = keys.filter(key => typeof key === "string" && /^[A-Za-z_$][\w$]{0,31}$/.test(key) && !/(?:secret|token|password|cookie|credential|session)/i.test(key));
      if (keys.some(key => typeof key !== "string" || !allowed.has(key))) return {reason: "route-context-required", keys: schema};
      const pathname = data(value, "pathname"), search = data(value, "search"), hash = data(value, "hash"), query = data(value, "query"), anchorless = data(value, "anchorless");
      if (ctx.failure) return {reason: ctx.failure, keys: schema};
      const types = {};
      for (const [name, entry] of [["pathname", pathname], ["search", search], ["hash", hash], ["query", query], ["anchorless", anchorless]]) {
        if (entry.present) types[name] = entry.value === null ? "null" : typeof entry.value;
      }
      const invalid = reason => ({reason, keys: schema, types});
      // Typed compatibility for an observed option. It contributes no URL data.
      if (anchorless.value != null && typeof anchorless.value !== "boolean") return invalid("invalid-anchorless-metadata");
      if (typeof pathname.value !== "string") return invalid("literal-pathname-required");
      const searchValue = search.value == null ? "" : search.value;
      const queryValue = query.value == null ? "" : query.value;
      const hashValue = hash.value == null ? "" : hash.value;
      if (typeof searchValue !== "string" || typeof queryValue !== "string" || typeof hashValue !== "string") return invalid("route-context-required");
      if ((searchValue && !searchValue.startsWith("?")) || (queryValue && !queryValue.startsWith("?")) || (hashValue && !hashValue.startsWith("#"))) return invalid("invalid-route-part");
      if (search.value != null && query.value != null && searchValue !== queryValue) return invalid("conflicting-query-parts");
      const result = literal(pathname.value);
      if (!result.url) return {...result, keys: schema, types};
      const url = new URL(result.url);
      if ((url.search && (search.value != null || query.value != null)) || (url.hash && hash.value != null)) return invalid("conflicting-embedded-route-parts");
      if (searchValue || queryValue) url.search = searchValue || queryValue;
      if (hashValue) url.hash = hashValue;
      return {url: url.href, keys: schema, types};
    }
    function finish(destination = null, status = null) {
      if (ctx.failure) { destination = null; status = ctx.failure; }
      if (status) report.status = status;
      report.membershipChecks = ctx.memberships;
      report.ownershipChecks = ctx.ownerships;
      while (JSON.stringify(report).length > 5000 && report.candidates.length) { report.candidates.pop(); report.sizeLimited = true; }
      return {destination, report};
    }
    try {
      if (!Array.isArray(hostProps) || !Array.isArray(fibers) || !isObject(owner) || !isObject(pageOwner)) return finish(null, "invalid-probe-shape");
      if (hostProps.length > 4 || fibers.length > 2) { limit("host-record-limit"); return finish(); }
      const candidates = [], candidateSet = new WeakSet();
      for (const fiber of fibers) {
        if (!isObject(fiber)) continue;
        if (!candidateSet.has(fiber)) { candidates.push(fiber); candidateSet.add(fiber); }
        const alternate = data(fiber, "alternate").value;
        if (alternate === fiber) fail("fiber-cycle");
        if (isObject(alternate) && !candidateSet.has(alternate)) { candidates.push(alternate); candidateSet.add(alternate); }
      }
      report.hostCandidates = candidates.length;
      const current = [];
      for (const fiber of candidates) {
        if (!hostTags.has(data(fiber, "tag").value) || !sameOwner(data(fiber, "stateNode").value) || !hostProps.includes(data(fiber, "memoizedProps").value)) continue;
        const path = currentPath(fiber);
        report.currentProofAttempts.push({depth: ctx.lastPathDepth, verified: !!path,
          status: path ? "current-root-verified" : ctx.failure || "current-root-unverified"});
        if (path) current.push({fiber, path});
      }
      report.currentCandidates = current.length;
      if (ctx.failure) return finish();
      if (current.length !== 1) return finish(null, current.length ? "ambiguous-current-fiber" : "current-fiber-unverified");
      report.currentFiberVerified = true;
      const selected = current[0], urls = new Set();
      let scoped = 0, boundary = false;
      for (const component of selected.path.slice(1)) {
        const tag = data(component, "tag").value;
        if (hostTags.has(tag) || [3, 4].includes(tag)) { boundary = true; break; }
        if (++scoped > 24) { limit("component-scope-limit"); return finish(); }
        const props = data(component, "memoizedProps").value;
        const link = data(props, "link");
        if (!link.present || link.value == null) continue;
        report.candidateCount++;
        if (!soleOwnerRoot(component)) return finish(null, "component-ownership-unverified");
        report.ownedComponents++;
        const route = structured(link.value);
        if (report.candidates.length < 8) report.candidates.push({layer: scoped, status: route.url ? "verified-owned-link" : route.reason,
          ...(route.keys ? {keys: route.keys} : {}), ...(route.types ? {types: route.types} : {}), address: route.url ? redact(route.url) : null});
        if (!route.url) return finish(null, route.reason);
        urls.add(route.url);
      }
      if (!boundary) return finish(null, "component-boundary-unverified");
      report.uniqueAddresses = urls.size;
      if (ctx.failure) return finish();
      if (urls.size !== 1) return finish(null, urls.size ? "conflicting-owned-link-addresses" : "no-owned-link-address");
      const root = selected.path[selected.path.length - 1];
      if (data(data(root, "stateNode").value, "current").value !== root) return finish(null, "current-root-changed");
      return finish(urls.values().next().value, "owned-component-address-found");
    } catch { report.readErrors = true; fail("reflection-error"); return finish(); }
  }
  globalThis.FNTComponentLink = Object.freeze({find});
})();
