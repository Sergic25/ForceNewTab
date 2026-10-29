> **Historical development record — not current usage or release guidance.**
> This document preserves earlier implementation notes, experiments and test results.
> Version numbers, shortcuts, icons and verification status below may describe older builds.
> See the [current README](../../README.md) for this development preview.

#4.0.0 review notes

This build implements the requested domain-independent rules. See MIGRATION.md
for exact removed assumptions, retained outcomes, archived contracts and counts.
See README.md for installation and limits. Source3.0.3 remains the baseline.

The generic resolver is read-only DOM inspection. The Navigation API listener is
native, isolated-world code with an acknowledged attempt, expiry, HTTP(S)
validation and form/download/traversal exclusions. No page prototype is replaced.
Captured destinations share the existing discovery ownership/coalescing path.
The toggle, icons, storage and tab/container behavior remain covered.

Relevant primary references:
- https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/147
- https://html.spec.whatwg.org/dev/nav-history-apis.html
- https://html.spec.whatwg.org/multipage/nav-history-apis.html#shared-history-push/replace-state-steps
- https://raw.githubusercontent.com/mozilla-firefox/firefox/main/dom/navigation/Navigation.cpp
- https://firefox-source-docs.mozilla.org/dom/scriptSecurity/xray_vision.html

ISOLATED-world native Navigation event delivery is supported by the WebIDL,
Firefox implementation and Xray model. It was not confirmed by a native Firefox
integration run in this environment. Do not interpret this as a universal
compatibility or no-source-effects guarantee.

