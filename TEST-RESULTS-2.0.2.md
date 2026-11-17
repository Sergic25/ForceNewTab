# Force New Tab 2.0.2 — local test build

Prepared November 13, 2026. Not published to GitHub or Mozilla.

## Change

Blank metadata beneath a card's heading can resolve directly when its heading link and thumbnail link identify the same exact destination. This fixes a reproduced missing destination in a recommendation-card layout. The rule uses standard DOM relationships and exact destination agreement.

Scanning is bounded and rejects ambiguous destinations, page landmarks, nested action controls, editing/form contexts, disabled/hidden/inert ancestors, and unrelated neighboring cards. Existing direct-link, accessible-label, permalink and image rules keep their precedence.

## Automated verification

- All 15 existing public suites pass with `node tests/run.cjs`.
- 16 new resolver regressions bring that suite to 49 checks. They cover title/thumbnail agreement, metadata whitespace, actions, authors, neighboring cards, unsafe addresses, query differences and scan limits.
- Two new gesture integration checks bring that suite to 34 checks: direct opening without original-page activation, and cancellation when the destination changes mid-gesture.
- Existing integration replays now include those new checks. No prior checks were removed.
- The migration audit still verifies the original icons, approved runtime modules and absence of recording tools.
- Mozilla addons-linter 10.15.0 reports zero errors, warnings or notices for the 38-file unsigned package. Runtime entries were verified byte-for-byte against this source.

## Real browser checks

A temporary signed-out Edge 157 browser loaded all six content scripts in manifest order, with Firefox extension messaging/storage replaced by test stubs.

Three captured recommendation cards reproduced the failure with the old resolver (no destination). With the new code, trusted middle-clicks below their titles each produced exactly one correct direct-open request, zero source click-handler activations and no source address change.

Three recommendations on a fresh live video page also produced one correct direct-open request each from below-title whitespace, with no source address change. These checks cover one live layout and verify DOM resolution and real mouse-event handling; they do not verify Firefox content-script isolation or real tab creation. Firefox confirmation remains pending.

## Firefox retest

1. Open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on** and select `dist/testing/manifest.json`. Confirm **Force New Tab — Testing**, version **2.0.2**.
2. Reload the page containing the card you want to test.
3. Middle-click the blank area beside its thumbnail, below its heading.
4. Confirm one background tab opens the correct destination and the original page remains unchanged.
5. Check the thumbnail and title still open correctly, and ordinary left-clicks on channel/menu controls still work.

The unsigned package cannot replace a permanently installed Mozilla-signed update in standard Firefox. This local build requires temporary loading.

## November 14: diagnostics restored and paired builds

The six diagnostic modules and their five existing suites were restored from the prior local testing source, without restoring older routing code. Version fields now use the installed manifest. The shared navigation code retains the card-whitespace fix and receives only these housekeeping changes:

- Removed the unloaded `page-world.js` comment-only stub.
- Removed the unused `gesture` parameter declaration from `tryStart`. Callers and Shift-related cancellation logic remain unchanged.
- The copy status's `build` value now comes from the validated manifest version, matching `manifestVersion`, or reports `unknown` if unavailable. Tests exercise a different future version and invalid values.

The app-data inspection helper, evidence walking and isolation state summary are retained because the restored recorder uses them. Diagnostics are opt-in and do not cancel mouse events or activate controls. Explicit page-object inspection can encounter Proxy traps, so recording is not a guarantee of side-effect-free page inspection.

No changes were made to popup guards, autoscroll handling, button selection, fallback ordering, the global toolbar switch, permanent navigation listeners or the 7.5/8-second discovery and 15-second copy-preparation deadlines.

Validation:

- All 15 public suites pass.
- Restored diagnostic suites pass: 57 recorder checks, 18 report UI checks, 19 DOM inspection checks, 29 button evidence checks and 29 background observation checks.
- The package parity audit verifies identical navigation JavaScript across testing and shipping, unchanged permissions, diagnostic files/UI excluded from shipping, and preserved discovery deadlines.
- Mozilla addons-linter 10.15.0 reports zero errors, warnings or notices for both the 44-file testing XPI and 38-file shipping candidate.
- Edge 157 real DOM/trusted-middle-click smoke checks pass for card whitespace, an ordinary link and an unresolved control, each with recording off and on. Opening requests, activation counts and original-page addresses match in each pair. Reports record the core requests and redact query data. Extension APIs are mocked; these are not native Firefox integration tests.
- The rendered testing Preferences page supports record/clear, and fits desktop and narrow mobile viewports. Copy behavior is covered by the restored UI suite, including the manual selection fallback.

Reproduce automated checks with `node testing/tests/run.cjs`. The optional browser check is `node testing/tests/browser-smoke.cjs`; it requires Playwright and Edge, with `FNT_PLAYWRIGHT_MODULE` optionally pointing to an existing Playwright installation. Screenshots are generated under `dist` and are excluded from the extension packages. Both packages and the source archive are produced by `node tools/build.cjs`, with SHA-256 checksums in `dist/SHA256SUMS.txt`.


## November 16: release acceptance

The maintainer reported no issues while using testing version 2.0.2 and approved the clean release. The public XPI was submitted to Mozilla with release notes, reviewer notes and reproducible sources; Mozilla validation reported no errors or warnings and confirmed Version Submitted. Publication was pending at submission. This feedback supplements the earlier automated checks without claiming exhaustive browser or website coverage.

The shipping changelog now uses public-release wording. Navigation JavaScript remains identical to the tested version, and the testing-only recorder scripts and UI are excluded from the public package.
