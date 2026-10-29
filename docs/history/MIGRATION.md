> **Historical development record — not current usage or release guidance.**
> This document preserves earlier implementation notes, experiments and test results.
> Version numbers, shortcuts, icons and verification status below may describe older builds.
> See the [current README](../../README.md) for this development preview.

#4.0 migration record

## Removed production assumptions

All website hostname, custom test-ID, ID-prefix and route-name matches were
removed from destination inspection. Fixed login/signup endpoints were removed.
The generalized code neither invents another site's authentication endpoint nor
keeps the previous provider mappings in a cache.

## Preserved positive outcomes

- Displayed post images and their matched image-button overlays open directly.
- Recognized semantic post/comment cards expose their owned timestamp/bookmark.
- Artwork associated with a card title opens the title's link, not its image.
- Play/Like/menu controls are not treated as their enclosing card destination.
- Hidden account/navigation controls can reveal their runtime destination through
  the native Navigation API without committing source navigation.
- Core gesture ownership, background/container handling, saved toggle, icons and
  changelog remain covered.

These cases are tested under original fixture addresses and unrelated addresses,
with custom test identifiers removed and accessible IDs renamed.

## Intentional contract changes

The old3.x tests asserted that foreign image hosts and other websites must be
rejected. That assertion is incompatible with the requested generalization.
Those scripts remain byte-identical in tests/archive-3.x.

Other superseded assertions relied on provider-specific author extraction, route
spelling or fixed account endpoints. They have been replaced by semantic component
ownership/ambiguity tests and integrated runtime-navigation capture tests.

The old raw-image-unknown core fixture was changed to a plain unknown button;
raw images are now recognized generically. All other core assertions remain.

## Counts and scope

-61 core regressions
-23 existing discovery checks
-33 generic resolver checks
-32 integrated real-module checks with simulated DOM/browser objects
-5 migration/source audits
=154 current checks, plus4 legacy fault reproductions.

The current default runner includes all six suites. No archived provider-contract
suite is counted as a pass. Audit fingerprints are self-contained so extracted
Desktop copies do not need another version folder.

## Compatibility and limits

Minimum Firefox increased from140 to147 for the generic Navigation API.
Installed Developer Edition 159 meets it. The native DOM/Xray implementation is
source-supported, but actual Firefox extension event delivery was not verified
by these simulations.

The account fallback now executes a handler to discover its URL, rather than
using a known mapping. Native cancellation prevents supported URL transitions,
not arbitrary pre-navigation UI/network effects. Source preservation is best
effort and opening the destination remains the primary goal.

The3.0.3 baseline remains intact; no Desktop files were overwritten.

