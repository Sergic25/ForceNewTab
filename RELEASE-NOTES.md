# Force New Tab 2.0.1

A major update to middle-click support for links, cards, images and JavaScript-driven buttons.

- Broader automatic destination finding across websites, with no site-specific address lists or feature switches.
- Difficult controls can open in a background copy after direct methods are exhausted. Copied pages wait for their matching button to settle before a single press. The maintainer has confirmed the tested Canva Login popup now works.
- Updated purple ON / grey OFF fist artwork, centered and enlarged with the trailing wrist lines removed.
- A clearer README and update page, with links to report non-working websites through [GitHub Issues](https://github.com/Sergic25/ForceNewTab/issues/new/choose) or [Firefox extension reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/).
- The public build has no click recorder. The diagnostic version remains available on the [testing branch](https://github.com/Sergic25/ForceNewTab/tree/testing), outside normal Releases.

## Installation

Requires **Firefox 147 or newer**. The attached XPI is **unsigned**: this GitHub release is not a Mozilla-approved update and does not automatically update installed add-ons. Mozilla submission and signing are still pending.

For a temporary test, extract the source ZIP and choose its `manifest.json` through **about:debugging → This Firefox → Load Temporary Add-on**. Temporary installation ends when Firefox restarts. For the currently Mozilla-distributed version, use [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/).

## Expectations

Known destinations open promptly; the copied-page fallback can take up to 15 seconds. A website can still refuse an automatic click, fail to reproduce a popup, or change the original page during the final fallback. Individual successful site tests do not guarantee every control works.

All 15 public automated suites pass. These simulate browser behavior; the Canva result is the maintainer's live feedback. See [verification details](https://github.com/Sergic25/ForceNewTab/blob/main/TEST-RESULTS.md).
