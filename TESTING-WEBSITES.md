# Manual Firefox checks

Run this trial **after the development preview is uploaded to GitHub and before a public build is submitted to Mozilla**. These are test targets, not promises that every control works. Use Firefox 147 or newer and record the Firefox and addon versions.

Keep the toolbar **ON (purple)**. Address inspection and background copies run automatically after the earlier methods fail; there are no separate feature switches. Old test-setting values, including saved false values, should not disable them. Compare a fresh profile with an existing test profile when possible.

| Website | Try separately |
| --- | --- |
| [Canva](https://www.canva.com/templates/) | Login: one middle-click should open a copied page with its login popup. The maintainer confirmed this control works in 2.0.1; retest it when changing copy behavior. |
| [Bluesky](https://bsky.app/) | Post, image, comment, and signed-out login/signup buttons |
| [Spotify](https://open.spotify.com/) | Album artwork, title, artist, login, and signup |
| [X](https://x.com/) | Posts, comments, images, and a story in Today's News when available |
| [Reddit](https://www.reddit.com/) | Feed card, opened-post image, and comments link |
| [Instagram](https://www.instagram.com/) | Profile grid and Your Activity → Likes |
| [Sharesies](https://app.sharesies.com/) | Investment navigation in search and personal investments |
| [YouTube](https://www.youtube.com/) | Video thumbnail, title, and channel link |
| [GitHub](https://github.com/) | Repository, issue, and pull-request links |
| [Pinterest](https://www.pinterest.com/) | Pin image, title, and filter navigation |

For each control:

1. Compare the normal result with the toolbar OFF (grey), then turn it ON and middle-click once.
2. Record the intended and actual destination, number of new tabs, whether the destination stays in the background, and any extra website popups. Check the original page's view and title as well as its address.
3. Direct destinations should open promptly. For an unresolved control, allow up to **15 seconds** for copying. No Shift key is required. Separately test switching tabs or viewing the copy during preparation, then clicking or typing inside it: viewing should allow preparation to continue; actual input should cancel automatic replay.
4. Repeat with newly loaded items after scrolling. Check ordinary left-clicks, text fields, two deliberate middle-clicks, and toggling OFF and ON again. Known destinations must keep their fast path.
5. Check container/private-window behavior where access is permitted. Temporary installations disappear at restart. No signed preview package exists yet; persistent installation and upgrade checks must wait for an appropriate signed test package.

The previously reported Questrade account-navigation control is an optional signed-in test for its owner. Never include private account URLs in a public report. A popup-only or editing control may have no destination; record that separately from a failed link opening.

[Report a website problem](https://github.com/Sergic25/ForceNewTab/issues/new/choose) with versions, the exact clicked item and both tabs' results. Use public or redacted URLs. Diagnostic recording is manual and local: choose **Record next middle-click** in Preferences only when needed, then review the report for identifying paths before sharing. There is no automatic telemetry or report upload.
