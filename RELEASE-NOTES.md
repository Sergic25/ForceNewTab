# Force New Tab 2.0.2

Improved middle-click support for blank areas within cards.

- Matching heading and thumbnail links can identify a card's destination from its surrounding whitespace.
- Clear matches open directly without activating the original card; nested action controls, unrelated cards and ambiguous destinations are excluded from the new rule.
- Minor code cleanup removes an unloaded stub and an unused function parameter, and reads status build versions from the manifest.
- The public extension excludes testing-only click recording tools and their interface. Existing fallback behavior, toolbar scope and timeouts are unchanged.

The maintainer reported no issues during testing. All 15 public regression suites and five diagnostic suites pass. Package parity checks verify identical navigation code across testing and public builds. Mozilla validation reported no errors or warnings.

## Downloads and installation

Requires **Firefox 147 or newer**. The GitHub XPI is **unsigned**. For normal installation, use the [Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/). Version 2.0.2 was submitted to Mozilla on November 16, 2026; publication was pending at submission.

Release downloads contain the exact public XPI and reproducible source archive submitted to Mozilla, plus SHA-256 checksums. The source archive includes developer tests and diagnostic sources; these are excluded from the public XPI. Documentation in that frozen archive may describe its earlier testing status.

To build from source, run `node tools/build.cjs` and load `dist/ship/manifest.json` temporarily through **about:debugging → This Firefox → Load Temporary Add-on**. Use `dist/testing/manifest.json` only when diagnostic tools are needed. Temporary installations end when Firefox restarts.

Some controls can still change the original page during the final fallback, and copied tabs share website account state. Automated tests and individual successful tests do not guarantee every control works.

[Browse or report issues](https://github.com/Sergic25/ForceNewTab/issues) · [Project documentation](https://github.com/Sergic25/ForceNewTab)
