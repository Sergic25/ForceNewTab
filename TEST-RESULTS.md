# Force New Tab 2.0.1 — public release verification

Prepared on October 28, 2026. All **15 public suites pass** using `node tests/run.cjs`. These use simulated DOM/browser APIs; they do not claim independent end-to-end Firefox coverage.

## Public and testing builds

The public manifest loads only the nine navigation modules. The six diagnostic-only modules and their five specific test suites are absent from the public source and runtime package. The separate [testing branch](https://github.com/Sergic25/ForceNewTab/tree/testing) retains the recorder and its original 20 passing suites, outside normal Releases.

All nine navigation modules are byte-identical between the public source and the diagnostic build. Removing recording does not alter the direct-opening, copied-page, final discovery or toolbar paths. No additional permissions or website-specific routing rules were introduced.

## Checks completed

- The public migration audit has six checks, including the explicit manifest layout, approved icon fingerprints, historical navigation/test preservation and absence of recorder modules.
- The 36 shadow-flow checks include loading the actual public manifest's complete content-script list. They verify copying still works without diagnostic globals or recording messages.
- Existing tests cover direct links/cards/images, app-owned destinations, eligible copied controls, early tab switching, input cancellation, toolbar OFF, stored legacy settings, context validation, once-only activation and the final discovery fallback.
- The copied-button tests cover the same actual button remaining stable for at least 1.5 seconds, replacement invalidating preparation, and the fixed 15-second overall deadline. A possible activation is never automatically retried on the source page.
- Existing background tests retain once-per-version update-page opening and duplicate-update/restart checks.
- Purple ON and grey OFF artwork is supplied at the declared sizes. All 26 packaged icon files match the approved no-lines export. No icon paths or toolbar mappings changed when the recorder was removed.

## Real-world feedback

The maintainer confirmed that the Canva Login control now opens its popup in the copied tab. Earlier feedback reported success for tested Bluesky controls, Spotify artwork/navigation, X news cards and the Questrade account-navigation control. These are specific reported results, not guarantees for every control on those sites. Signed-in Sharesies and Instagram Likes remain unverified.

## Distribution status and remaining work

This is a public GitHub source/unsigned-package release. The diagnostic build is retained on its testing branch, not tagged as a normal Release. Mozilla submission, signing, persistent-install checks and final signed-upgrade verification are separate work and have not been completed. The extension cannot guarantee that every website supplies a destination, accepts the simulated click, recreates its state in a copy, or leaves the original page unchanged.
