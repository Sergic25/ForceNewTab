> **Historical development record — not current usage or release guidance.**
> This document preserves earlier implementation notes, experiments and test results.
> Version numbers, shortcuts, icons and verification status below may describe older builds.
> See the [current README](../../README.md) for this development preview.

# Live DOM inspection behind 3.0.2

Inspected 2026-10-25 in the supported in-app browser, logged out. This is live
page-structure evidence, not a Firefox extension integration test.

## Supplied Bluesky post

https://bsky.app/profile/womensartbluesky.bsky.social/post/3myogvioii225

The cat/stained-glass image is an IMG within a native BUTTON role=button.
The button aria-label matches the image alt text. There is no enclosing href.
Its actual displayed image address is:

https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:u2zs2typsklaohqmfyxiunvy/bafkreify7n3wp4lfmfjvjku3gmfbuy24ztpswt5olbv5gjjzu5zt7clsye

Version 3.0/3.0.1 simulates a click when no DOM URL is known. A lightbox can open
without an address change, so the navigation observer has nothing to open. The
new helper reads this existing image address without activating the button.
It does not guess a full-resolution CDN URL.

Reply-card example: DIV role=link data-testid=postThreadItem-by-bnerlich.bsky.social.
It contains profile/avatar anchors and an own-author timestamp link:
 /profile/bnerlich.bsky.social/post/3myoopycfkc2q

The container itself has no href. The new helper uses a unique own-author post
permalink inside that exact recognized card. The public author's profile feed
was also inspected and uses DIV role=link data-testid=feedItem-by-<author>.
Ambiguous own-author routes and nested action buttons are not guessed.

## Spotify public album card

https://open.spotify.com/

Observed artwork control for HIT ME HARD AND SOFT:
DIV role=button aria-labelledby referencing
card-title-spotify:album:7aJuG4TFXa2hmE4z1yxc3n-2 plus a subtitle ID.

Its parent is DIV data-encore-id=card role=listitem, aria-labelledby referencing
that same title ID. The ID resolves to P inside an A with
href=/album/7aJuG4TFXa2hmE4z1yxc3n, inside the same card.
The artist link has a separate route and is not chosen.

The new helper follows this explicit accessible-title relationship; it does not
pick the first nearby anchor. Separate Play/menu controls without that title
relationship retain existing fallback handling.

## Validation boundary

61 existing content/background checks, 23 discovery checks, 9 Reddit checks
and 24 added site-adapter checks pass: 117 simulated checks total.
The new tests include complete content-event paths proving direct fnt-open,
without fnt-arm or native source activation for the observed structures.

Still required: load3.0.2 in Firefox, refresh target pages and test actual middle
clicks, focus/new-tab counts and source URL/view. Signed-in layouts, overlays and
future site changes can differ. No claim of a completed Firefox retest is made.


##3.0.3 Spotify account-button inspection

On2026-10-25 the public Spotify header was inspected in the supported in-app
browser. Both controls are native BUTTON elements with stable attributes:
data-testid=login-button and data-testid=signup-button. Neither exposes an href.

An ordinary click on Log in navigated to:
https://accounts.spotify.com/en-GB/login?continue=https%3A%2F%2Fopen.spotify.com%2F

An ordinary click on Sign up navigated to:
https://www.spotify.com/ca-en/signup?forward_url=https%3A%2F%2Fopen.spotify.com%2F

Canonical no-locale routes were then opened independently and rendered the same
Welcome back and Sign up to start listening pages, respectively:
https://accounts.spotify.com/login?continue=https%3A%2F%2Fopen.spotify.com%2F
https://www.spotify.com/signup?forward_url=https%3A%2F%2Fopen.spotify.com%2F

No credentials were entered, no forms submitted, no account created and no
session-generated flow tokens copied into extension code. The server selects
locale and starts its own fresh account flow in the destination tab.

Version3.0.3 adds only a native-button-ID helper for those two actions on HTTPS
open.spotify.com and calls it before the unchanged artwork-card helper. The
current source address is encoded as continue/forward_url. Actual enclosing
anchors retain existing priority. This avoids the source click used by discovery.
Disabled buttons and unrelated lookalike controls retain existing behavior.
