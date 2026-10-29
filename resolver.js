/* Domain-independent destination inspection. No page handler is invoked here. */
(() => {
  "use strict";
  function safeURL(raw, base) {
    if (typeof raw !== "string" || !raw.trim() || raw.trim() === "#") return null;
    try {
      const url = new URL(raw, base);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function tokens(value) { return (value || "").trim().split(/\s+/).filter(Boolean); }
  function role(node) { return (node.getAttribute("role") || "").toLowerCase(); }
  function disabled(node) {
    return node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true";
  }
  function editing(node) {
    return node.isContentEditable || ["input", "textarea", "select", "option"].includes(node.localName) ||
      ["textbox", "combobox", "listbox"].includes(role(node));
  }
  function action(node) {
    return ["button", "input", "textarea", "select", "summary"].includes(node.localName) ||
      ["button", "menuitem", "checkbox", "switch", "radio", "textbox", "combobox", "listbox", "slider", "spinbutton"].includes(role(node));
  }
  function component(node) {
    return ["article", "li"].includes(node.localName) || ["link", "listitem", "article"].includes(role(node));
  }
  function ownedBy(node, owner) {
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (parent === owner) return true;
      if (component(parent) || action(parent)) return false;
    }
    return false;
  }
  const ambiguous = Symbol("ambiguous destination");
  function unique(routes) { return routes.size === 1 ? routes.values().next().value : routes.size > 1 ? ambiguous : null; }

  function labelledDestination(elements, base, ownerIndex) {
    if (ownerIndex < 0) return null;
    const owner = elements[ownerIndex];
    const ids = tokens(owner.getAttribute("aria-labelledby"));
    if (!ids.length || disabled(owner) || editing(owner) || typeof owner.contains !== "function") return null;
    const controls = elements.slice(0, ownerIndex).filter(action);
    if (controls.some(node => disabled(node) || editing(node) ||
        (node.localName === "button" && ["submit", "reset"].includes(node.getAttribute("type"))) ||
        !tokens(node.getAttribute("aria-labelledby")).some(id => ids.includes(id)))) return null;
    const root = owner.getRootNode?.() || owner.ownerDocument;
    if (!root || typeof root.getElementById !== "function") return null;
    const routes = new Set();
    for (const id of ids) {
      const label = root.getElementById(id);
      if (!label || !owner.contains(label) || typeof label.closest !== "function") continue;
      const link = label.closest("a[href]");
      if (!link || !owner.contains(link) || !ownedBy(link, owner)) continue;
      const url = safeURL(link.getAttribute("href"), base);
      if (url) routes.add(url);
    }
    return unique(routes);
  }

  function dateLike(value) {
    if (typeof value !== "string") return false;
    // Accessible dates are localized prose; require a year and clock instead
    // of attempting to parse words such as an English "at".
    return /\b(?:19|20|21)\d{2}\b/.test(value) &&
      /(?:^|\D)(?:[01]?\d|2[0-3]):[0-5]\d(?:\D|$)/.test(value);
  }
  function permalink(link) {
    if (tokens(link.getAttribute("rel")).some(value => value.toLowerCase() === "bookmark")) return true;
    const machineDate = link.getAttribute("datetime");
    if (machineDate && Number.isFinite(Date.parse(machineDate))) return true;
    if (typeof link.querySelectorAll === "function") {
      for (const time of link.querySelectorAll("time")) {
        const date = time.getAttribute("datetime");
        if (date && Number.isFinite(Date.parse(date))) return true;
      }
    }
    return dateLike(link.getAttribute("aria-label")) || dateLike(link.getAttribute("title"));
  }
  function componentDestination(elements, base, ownerIndex) {
    if (ownerIndex < 0) return null;
    const owner = elements[ownerIndex];
    if (disabled(owner) || editing(owner) || elements.slice(0, ownerIndex).some(node => action(node) || editing(node) || disabled(node)) ||
        typeof owner.querySelectorAll !== "function") return null;
    const routes = new Set();
    const marked = new Set();
    for (const link of owner.querySelectorAll("a[href]")) {
      if (!ownedBy(link, owner)) continue;
      const url = safeURL(link.getAttribute("href"), base);
      if (!url) continue;
      routes.add(url);
      if (permalink(link)) marked.add(url);
    }
    if (marked.size) return unique(marked);
    // Only an explicit link-like container can identify itself by a single
    // owned address. A broad article/list item with a lone author link cannot.
    return role(owner) === "link" ? unique(routes) : null;
  }

  function mediaDestination(elements, base) {
    if (elements.some(node => disabled(node) || editing(node))) return null;
    let image = elements[0]?.localName === "img" ? elements[0] : null;
    if (!image) {
      const control = elements.find(node => node.localName === "button" || role(node) === "button");
      if (!control || typeof control.querySelectorAll !== "function") return null;
      const images = Array.from(control.querySelectorAll("img"));
      if (images.length !== 1 || !control.getAttribute("aria-label") ||
          control.getAttribute("aria-label") !== images[0].getAttribute("alt")) return null;
      image = images[0];
    }
    if (image.getAttribute("aria-hidden") === "true" || role(image) === "presentation") return null;
    return safeURL(image.currentSrc || image.getAttribute("src"), base);
  }

  function resolve(path, base, _page = base) {
    const elements = path.filter(node => node && node.nodeType === 1);
    const enclosing = elements.find(node => ["a", "area"].includes(node.localName) && node.hasAttribute("href"));
    if (enclosing) {
      const url = safeURL(enclosing.getAttribute("href"), base);
      if (url) return url;
    }
    // Explicit nearest metadata wins, including an empty/unsafe value ending
    // this resolution attempt instead of guessing from an unrelated ancestor.
    for (const node of elements) {
      for (const attr of ["data-href", "data-url"]) {
        if (node.hasAttribute(attr)) return safeURL(node.getAttribute(attr), base);
      }
    }
    const ownerIndex = elements.findIndex(component);
    const labelled = labelledDestination(elements, base, ownerIndex);
    if (labelled === ambiguous) return null;
    if (labelled) return labelled;
    const linked = componentDestination(elements, base, ownerIndex);
    if (linked === ambiguous) return null;
    return linked || mediaDestination(elements, base);
  }
  globalThis.FNT = Object.freeze({safeURL, resolve});
})();


