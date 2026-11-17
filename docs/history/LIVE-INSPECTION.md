> **Historical development record — not current usage or release guidance.**
> This document describes earlier implementation notes, experiments and test results by control type.
> See the [current README](../../README.md) for current behavior.

# Live DOM inspection behind 3.0.2

Inspected October 25, 2026 in the supported in-app browser, logged out. This is observed page-structure evidence, not a Firefox extension integration test. Destination addresses and page-specific identifiers are omitted here.

## Feed image and reply card

The inspected image was an IMG within a native BUTTON with role=button. The button's aria-label matched the image's alt text, with no enclosing href.

Version 3.0/3.0.1 simulated a click when no DOM URL was known. A lightbox could open without an address change, leaving the navigation observer with no destination. The new helper read the displayed image address without activating the button. It did not manufacture a full-resolution media address.

A reply card was a DIV with role=link. It contained profile/avatar anchors and an author-associated timestamp link, while the container itself had no href. The early helper selected a unique owned post permalink in a recognized card and rejected ambiguous routes or nested actions. That historical experiment relied on implementation-specific identifiers; later versions replaced those assumptions with generic semantic ownership.

## Artwork associated with a title

The inspected artwork control was a DIV with role=button. Its aria-labelledby referred to a title ID and a subtitle ID. The parent card had role=listitem and referenced the same title.

The title ID resolved to a paragraph inside an anchor in the same card. A creator link had a separate destination. The helper followed the explicit accessible-title relationship; it did not choose the first nearby anchor. Separate playback/menu controls without that relationship retained existing fallback handling.

## Validation boundary

At that revision, 61 content/background checks, 23 discovery checks, 9 image-rule checks and 24 adapter checks passed: 117 simulated checks total. The new tests included complete content-event paths proving direct fnt-open without fnt-arm or source activation for the observed structures.

A Firefox retest remained required: reload the target pages and check actual middle-clicks, focus, tab counts and source address/view. Signed-in layouts, overlays and later layout changes could differ. No completed Firefox retest was claimed.

## 3.0.3 account-button inspection

On October 25, 2026, a public page header was inspected in the supported in-app browser. Login and signup were native BUTTON elements with stable test identifiers and no href. Ordinary clicks revealed separate authentication destinations. Locale-free routes were then opened independently and displayed the corresponding account pages.

No credentials were entered, forms submitted or accounts created. No session-generated flow tokens were copied into extension code.

The 3.0.3 experiment used known button identifiers and fixed authentication endpoints to avoid source activation. Enclosing anchors retained priority; disabled buttons and unrelated lookalike controls were excluded. These historical assumptions were later removed in favor of shared destination rules and runtime navigation discovery; see [migration notes](MIGRATION.md).
