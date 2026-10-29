/* Optional diagnostic evidence. This module never selects or opens a destination. */
(() => {
  "use strict";
  function inspect(rawPath, base) {
    let errors = 0, markerLimited = false;
    const read = (fn, fallback = null) => { try { return fn(); } catch { errors++; return fallback; } };
    const attr = (node, name) => read(() => node.getAttribute(name));
    const tag = node => read(() => node.localName, "");
    const role = node => { const value = attr(node, "role"); return typeof value === "string" ? value.toLowerCase() : ""; };
    const tokens = value => typeof value === "string" ? value.slice(0, 2048).trim().split(/\s+/).filter(Boolean) : [];
    const component = node => ["article", "li"].includes(tag(node)) || ["link", "listitem", "article"].includes(role(node));
    const action = node => ["button", "input", "textarea", "select", "summary"].includes(tag(node)) ||
      ["button", "menuitem", "checkbox", "switch", "radio", "textbox", "combobox", "listbox", "slider", "spinbutton"].includes(role(node));
    const disabled = node => read(() => node.hasAttribute("disabled"), false) || attr(node, "aria-disabled") === "true";
    const editable = node => !!read(() => node.isContentEditable, false) || ["input", "textarea", "select", "option"].includes(tag(node)) ||
      ["textbox", "combobox", "listbox"].includes(role(node));
    function safeURL(raw) {
      if (typeof raw !== "string" || !raw.trim() || raw.trim() === "#") return null;
      try {
        const url = new URL(raw, base);
        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
      } catch { return null; }
    }
    function redacted(raw) {
      if (typeof raw !== "string" || !raw.trim()) return null;
      try {
        const url = new URL(raw, base);
        if (!["http:", "https:"].includes(url.protocol)) return null;
        const address = url.origin + url.pathname;
        return {url: address.length <= 768 ? address : url.origin + "/[long-path-omitted]", hadQuery: !!url.search, hadFragment: !!url.hash};
      } catch { return null; }
    }
    function describe(node) {
      const result = {tag: String(tag(node)).slice(0, 40), role: role(node).slice(0, 64), disabled: !!disabled(node), editable: editable(node)};
      const type = attr(node, "type");
      if (typeof type === "string") result.type = type.slice(0, 32);
      for (const name of ["href", "data-href", "data-url"]) {
        const value = attr(node, name);
        if (value !== null) result[name] = redacted(value);
      }
      return result;
    }
    function owned(link, owner) {
      let parent = read(() => link.parentElement), depth = 0;
      while (parent && depth++ < 100) {
        if (parent === owner) return {owned: true, limited: false};
        if (component(parent) || action(parent)) return {owned: false, limited: false};
        parent = read(() => parent.parentElement);
      }
      return {owned: false, limited: !!parent};
    }
    function marked(link) {
      if (tokens(attr(link, "rel")).some(value => value.toLowerCase() === "bookmark")) return true;
      const date = attr(link, "datetime");
      if (date && Number.isFinite(Date.parse(date))) return true;
      const times = read(() => link.querySelectorAll("time"), []);
      const timeTotal = read(() => times.length, 0);
      if (timeTotal > 20) markerLimited = true;
      const count = Math.min(timeTotal, 20);
      for (let index = 0; index < count; index++) {
        const childDate = attr(read(() => times[index]), "datetime");
        if (childDate && Number.isFinite(Date.parse(childDate))) return true;
      }
      const dateLike = value => typeof value === "string" && /\b(?:19|20|21)\d{2}\b/.test(value) &&
        /(?:^|\D)(?:[01]?\d|2[0-3]):[0-5]\d(?:\D|$)/.test(value);
      return dateLike(attr(link, "aria-label")) || dateLike(attr(link, "title"));
    }
    const elements = Array.isArray(rawPath) ? rawPath.filter(node => read(() => node && node.nodeType === 1, false)) : [];
    const index = elements.findIndex(component);
    const result = {scope: "nearest-semantic-component", componentPathIndex: index, component: null, labelTargets: [],
      exclusions: {disabled: false, editable: false, nestedAction: false, submitOrReset: false},
      anchorScan: {total: null, inspected: 0, limited: false, validOwned: 0, uniqueOwnedRoutes: 0, markedOwned: 0, uniqueMarkedRoutes: 0, excludedNested: 0, unusable: 0, samples: []},
      evidence: "no-semantic-component", readErrors: false};
    if (index >= 0) {
      const owner = elements[index];
      result.component = describe(owner);
      const before = elements.slice(0, index);
      result.exclusions.disabled = disabled(owner) || before.some(disabled);
      result.exclusions.editable = editable(owner) || before.some(editable);
      result.exclusions.nestedAction = before.some(action);
      result.exclusions.submitOrReset = before.some(node => tag(node) === "button" && ["submit", "reset"].includes(attr(node, "type")));
      const links = read(() => owner.querySelectorAll("a[href]"));
      const total = links === null ? null : read(() => links.length);
      const scan = result.anchorScan, routes = new Set(), markedRoutes = new Set();
      if (Number.isInteger(total) && total >= 0) {
        scan.total = total;
        scan.limited = total > 200;
        for (let n = 0; n < Math.min(total, 200); n++) {
          const link = read(() => links[n]);
          if (!link) continue;
          scan.inspected++;
          const ownership = owned(link, owner);
          scan.limited ||= ownership.limited;
          const raw = attr(link, "href"), url = safeURL(raw);
          const isMarked = !!url && marked(link);
          scan.limited ||= markerLimited;
          if (!ownership.owned) scan.excludedNested++;
          else if (!url) scan.unusable++;
          else { scan.validOwned++; routes.add(url); if (isMarked) {scan.markedOwned++; markedRoutes.add(url);} }
          if (scan.samples.length < 6) scan.samples.push({url: redacted(raw), usable: !!url, owned: ownership.owned, marked: isMarked});
        }
        scan.uniqueOwnedRoutes = routes.size;
        scan.uniqueMarkedRoutes = markedRoutes.size;
      } else scan.limited = true;
      const ids = tokens(attr(owner, "aria-labelledby"));
      const root = read(() => owner.getRootNode?.() || owner.ownerDocument);
      for (const id of ids.slice(0, 4)) {
        const item = {id: id.slice(0, 128), found: false, insideOwner: false, node: null, closestAnchor: null,
          anchorsInside: {total: null, limited: false, samples: []}};
        const label = read(() => root?.getElementById(id));
        if (label) {
          item.found = true;
          item.insideOwner = !!read(() => owner.contains(label), false);
          item.node = describe(label);
          const link = read(() => label.closest("a[href]"));
          if (link) item.closestAnchor = {url: redacted(attr(link, "href")), usable: !!safeURL(attr(link, "href")),
            insideOwner: !!read(() => owner.contains(link), false), owned: owned(link, owner).owned};
          const children = read(() => label.querySelectorAll("a[href]"));
          const length = children === null ? null : read(() => children.length);
          if (Number.isInteger(length) && length >= 0) {
            item.anchorsInside.total = length;
            item.anchorsInside.limited = length > 2;
            for (let n = 0; n < Math.min(length, 2); n++) {
              const child = read(() => children[n]);
              if (child) item.anchorsInside.samples.push({url: redacted(attr(child, "href")), usable: !!safeURL(attr(child, "href")), owned: owned(child, owner).owned});
            }
          } else item.anchorsInside.limited = true;
        }
        result.labelTargets.push(item);
      }
      if (ids.length > 4) result.labelTargetsLimited = true;
      result.evidence = scan.limited || errors ? "inspection-incomplete" :
        !scan.validOwned ? "no-usable-owned-anchors" :
        scan.uniqueOwnedRoutes > 1 ? "multiple-owned-destinations" : "one-owned-destination";
      // Evidence describes the scan; it does not override resolver precedence or select a URL.
    }
    result.readErrors = errors > 0;
    if (result.readErrors && index >= 0) result.evidence = "inspection-incomplete";
    while (JSON.stringify(result).length > 8000 && result.anchorScan.samples.length) { result.anchorScan.samples.pop(); result.sizeLimited = true; }
    while (JSON.stringify(result).length > 8000 && result.labelTargets.length) { result.labelTargets.pop(); result.sizeLimited = true; }
    return result;
  }
  globalThis.FNTInspection = Object.freeze({inspect});
})();
