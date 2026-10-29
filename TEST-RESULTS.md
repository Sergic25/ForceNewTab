# Automatic-handling draft — verification status

This draft uses the approved version number 2.0.0. Its app-data and background-copy methods now run automatically under the existing toolbar ON/OFF control. Stored legacy feature flags are ignored. Release preparation and the final browser trial are still pending.

## Current result

18 of the 20 packaged suites pass. The complete runner still exits unsuccessfully: two flow suites retain expectations for the removed opt-in switch. They have not been bypassed or counted as passing:

- tests/shift-isolation-flow.cjs stops at its legacy experiment-OFF case.
- tests/shadow-isolation-flow.cjs stops at its legacy experiment-OFF case.

These test contracts must be updated and the full runner must pass before this draft is considered ready to merge. Later cases in those suites were not reached during this run; there is no blanket regression-free claim.

Passing targeted coverage includes 42 app-data checks, 91 app-data compatibility/integration checks, 56 copy-content checks, 83 copy-background checks, 51 copy integration checks, 57 diagnostic checks, 29 outcome-background checks and 18 report-UI checks. Counts overlap compatibility coverage and must not be added into an end-to-end total. The remaining core/resolver/component/locator/migration suites pass.

The original core, resolver, component-link, discovery, toolbar background and target-matching modules remain byte-identical to the verified 4.2.6 icon candidate. The feature-gating modules and reporting UI are intentionally changed. There are no new permissions, website-specific rules or changes to the approved icon files.

The icons retain their verified dimensions/hashes and toolbar-state checks. No live Firefox verification was performed for this automatic-handling draft. After GitHub review, the maintainer intends a final normal-browser trial before Mozilla public submission. Signed installation and upgrade checks, Mozilla validation remain release work.

Earlier verification records are preserved in docs/history/TEST-RESULTS.md and describe earlier builds.

A definitive toolbar-settings read failure now declines copying and permits bounded source discovery only after fresh source validation. Pending reads, known toolbar OFF, changed context and uncertain/complete copied activation do not gain that fallback.
