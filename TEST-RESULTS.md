# Force New Tab 2.0.0 — verification status

Verified on October 28, 2026. App-data and background-copy methods run automatically under the existing toolbar ON/OFF control. Stored legacy feature flags are ignored. The final Firefox trial and Mozilla release checks are still pending.

## Current result

**All 20 packaged suites pass** using node tests/run.cjs. These are simulated DOM/browser tests, not native Firefox integration tests, and do not establish universal compatibility.

The two remaining flow suites expected old optional switches to disable automatic methods. Their fixtures now distinguish fresh settings from saved legacy false values. Both must behave automatically. The existing compatibility cases remain, with added checks for toolbar OFF, OFF then ON during a pending copy, direct destinations taking priority, and rejecting stale fallback or repeat activation.

Passing coverage includes 42 app-data checks, 91 app-data compatibility/integration checks, 56 copy-content checks, 83 copy-background checks, 52 copy integration checks, 42 combined gesture checks, 35 shadow-tree flow checks, 57 diagnostic checks, 29 outcome-background checks and 18 report-UI checks. Counts overlap and must not be added into an end-to-end total. All remaining core/resolver/component/locator/migration suites pass; the legacy suite reproduces four known faults in the original source.

The final test correction changes tests and documentation only. The original core, resolver, component-link, discovery, toolbar background and target-matching modules remain byte-identical to the verified 4.2.6 icon candidate. The feature-gating modules and reporting UI were intentionally changed for automatic handling. There are no new permissions, website-specific rules or changes to the approved icon files.

A definitive toolbar-settings read failure declines copying and permits bounded source discovery only after fresh source validation. Pending reads, known toolbar OFF, changed context and uncertain/complete copied activation do not gain that fallback.

The icons retain their verified dimensions/hashes and toolbar-state checks. No live Firefox verification was performed for this automatic-handling candidate. The maintainer's final normal-browser trial, signed installation and upgrade checks, and Mozilla validation remain release work. The test package is unsigned.

Earlier verification records are preserved in docs/history/TEST-RESULTS.md and describe earlier builds.
