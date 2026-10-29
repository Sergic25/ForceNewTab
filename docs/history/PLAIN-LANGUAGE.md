> **Historical development record — not current usage or release guidance.**
> This document preserves earlier implementation notes, experiments and test results.
> Version numbers, shortcuts, icons and verification status below may describe older builds.
> See the [current README](../../README.md) for this development preview.

#4.0 in everyday terms

The add-on now looks for the same relationships on every website: actual links,
a card's labelled title, a unique timestamp/bookmark link, and the clicked image.
It no longer asks whether the website is Spotify, Bluesky or Reddit.

For a button whose address is hidden, the add-on watches before pressing it once.
On supported Firefox navigation events it can catch the destination, stop that
navigation and open the address in a background tab. It does not need a list of
login pages. The original button's code does run, so changes made before
navigation cannot always be prevented.

The previously working cases are kept as tests, including renamed/rehosted
copies.154 current simulated checks pass. This is a migration candidate requiring
Firefox 147+ and a focused Firefox retest, not a promise of universal behavior.
Your159 Developer Edition meets that minimum.3.0.3 remains available unchanged.

