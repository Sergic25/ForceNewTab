# Manual Firefox checks

Use **Firefox 147 or newer** and note the browser and extension versions. This list contains test targets, not a promise that every control works. Further ordinary browsing is useful even after a GitHub release; Mozilla signing, installation and upgrade checks are separate.

Keep the toolbar **ON (purple)**. All opening methods run automatically. There are no feature checkboxes or click recorder in the public extension. Compare a fresh profile with an existing test profile when possible.

## Websites and controls

| Website | Try separately |
| --- | --- |
| [Canva](https://www.canva.com/templates/) | Login: the maintainer confirmed that middle-click now opens a copy with the login popup. Also try template thumbnails and titles. |
| [Bluesky](https://bsky.app/) | Post, image, comment, and signed-out login/signup buttons |
| [Spotify](https://open.spotify.com/) | Album artwork, title, artist, login, and signup |
| [X](https://x.com/) | Posts, comments, images, and a story in Today's News when available |
| [Reddit](https://www.reddit.com/) | Feed card, opened-post image, and comments link |
| [Instagram](https://www.instagram.com/) | Profile grid and Your Activity → Likes |
| [Sharesies](https://app.sharesies.com/) | Investment navigation in search and personal investments; this reviewer-reported area has not been verified by the maintainer |
| [YouTube](https://www.youtube.com/) | Video thumbnail, title, and channel link |
| [GitHub](https://github.com/) | Repository, issue, and pull-request links |
| [Pinterest](https://www.pinterest.com/) | Pin image, title, and filter navigation |
| [Airbnb](https://www.airbnb.com/) | Listing photos, titles, and card space |
| [SoundCloud](https://soundcloud.com/discover) | Artwork, track/playlist titles, and artist links; check whether source playback continues |
| [GitLab](https://gitlab.com/gitlab-org/gitlab/-/work_items) | Issue titles, rows, and author links |
| [TradingView](https://www.tradingview.com/ideas/) | Idea cards, thumbnails, and author links |

## For each control

1. Compare the ordinary result with the toolbar OFF (grey), then turn it ON and middle-click once.
2. Note the intended and actual destination, number of new tabs, whether the destination stays in the background, and any extra popups. Check the original page's appearance and title as well as its address.
3. Direct destinations should open promptly. For a background copy, allow up to **15 seconds**. No Shift key is required. Separately try switching tabs while it prepares, then clicking or typing inside the copy: viewing should allow preparation to continue; actual input should cancel the automatic press.
4. Repeat with newly loaded items after scrolling. Check ordinary left-clicks, text fields, two deliberate middle-clicks, and toggling OFF and ON again. Known destinations should keep opening promptly.
5. Where access is permitted, check Firefox containers and private windows. Temporary installations end at restart. Persistent installation and upgrade checks need an appropriate Mozilla-signed package.

The previously reported Questrade account-navigation control is a signed-in test for its owner. Do not create an account solely for this checklist or include private account addresses in a public report. Note popup-only behavior separately from a failed link opening.

## Share a result

[Open a GitHub website report](https://github.com/Sergic25/ForceNewTab/issues/new/choose) or describe the problem in [Firefox reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/). Include versions, the exact item clicked, what you expected and what happened in both tabs. Use public links or describe private pages without account details.

For deeper investigation, the separate [testing branch](https://github.com/Sergic25/ForceNewTab/tree/testing) retains manual diagnostic recording. It is not part of the public release downloads. Load that branch temporarily only when investigating a problem, and review any recorded report before sharing it: address paths can contain private identifiers. No report is uploaded automatically.
