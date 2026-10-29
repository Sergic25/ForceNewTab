# Historical test plan

This plan describes earlier development builds. Use the root TESTING-WEBSITES.md for current instructions.

# Firefox real-world test checklist

Prepared 25 October 2026. These are test targets, not compatibility certifications. Site layouts and account features change; use the closest matching control if a label has moved. “SPA” means an app-like website that changes the current view without loading a completely new page.

## How to score a test

Use a separate Firefox Developer Edition profile with only this extension enabled. Load the revised build, grant access to the sites being tested, and reload pages as its README directs. Record your Firefox version, extension version, site URL, sign-in state and exact clicked item.

1. With the extension OFF, try the middle-click once and note what the website normally does. Return to the starting view.
2. Turn it ON. Middle-click the item once. Watch the original tab's address, visible view, scroll position, open dialogs, selection and playback. Count the new tabs and check that the original remains selected.
3. Try the item's title, thumbnail, blank card area and author/profile link separately. They can be implemented differently despite looking like one card.
4. Repeat after scrolling to freshly loaded items. Then try two rapid clicks to the same destination, a slow held click, and pressing on one item but releasing on another.
5. Turn the extension OFF again and confirm ordinary behavior returns. Check a second tab and a browser restart to verify the saved global toggle and blue/grey icon state.

Version 4.1.4 prioritizes opening the intended destination. Record TWO results for each control:

- **Secondary source outcome:** did the original stay in its starting state? Source navigation or a changed view is allowed in the discovery mode; record it separately from whether the intended destination opened. Unexpected non-navigation actions still need investigation.
- **Primary opening result:** did exactly one background tab open the intended destination? Direct web links should do this. For an eligible JavaScript-only control, this build should attempt one activation after arming its watcher. Zero tabs means no destination was discovered; record it as an opening failure or unsupported control. Record it as unsupported; do not call it a successful open.

A modal (a panel displayed over the current page), Play/Pause, a Like button, or an expand/collapse button may have no destination page at all. Version 4.1.4 can trigger such an action while attempting to discover a destination; record the effect and absence of a destination separately. An image inside a real link should open that link; a clicked unlinked image can open its displayed image address.

Use existing navigation items, sample documents and a test board. For Sharesies, test investment-name navigation only, not Buy/Sell/order controls. For mail/chat, do not use Send, Delete or other action buttons as navigation tests. Opening a destination can itself mark content read or cause account updates that later appear in the source tab; note those separately from the source responding to the middle-click.

## First priority: reported problem sites

| Site | Exact area/control to try | Why it is in this list |
|---|---|---|
| [Instagram](https://www.instagram.com/) | Sign in; Your Activity → Likes. Middle-click a liked-post tile, its image and any visible post/profile link separately. Also compare a profile's post grid. | The supplied earlier review excerpt reports opening both the original and new tab here. This report was supplied by the user; it was not independently found in the current indexed AMO listing. |
| [Sharesies](https://app.sharesies.com/) | Compare an investment-name/result in the main investment search with a holding/investment row under the reported `/profile/personal/invest/` route. Use your normal region-specific Sharesies sign-in if redirected. | The indexed AMO review says main investment search worked but this personal investment page did nothing. Test both views, not just the homepage. |
| [Bluesky](https://bsky.app/) | In a feed/search, try the post's empty card area, timestamp, author/avatar and linked image separately. After each, check the source view and back-button history. | The indexed AMO review reports double-opening and back-button problems. Image lightboxes are a separate no-destination case. |

Source: [Force New Tab reviews on Mozilla Add-ons](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/). The live review page was unavailable to the research tool; the current search index returned the piecevcake review about Sharesies and Bluesky. The Instagram detail comes from the conversation's supplied review excerpt. No review author was contacted.

## From the earlier README: retest rather than assume compatibility

The old README called these sites “confirmed working,” but the supplied source/tests do not establish those claims for this build. Bluesky is already covered above.

| Site | Exact area/control to try | Useful distinction |
|---|---|---|
| [YouTube](https://www.youtube.com/) | Search results and recommendations: video title, thumbnail, channel name; then playlist entries. | A thumbnail/title link should navigate; Play/queue/menu controls are actions. [Official navigation help](https://support.google.com/youtube/answer/2398242). |
| [Reddit](https://www.reddit.com/) | Feed post title, blank card area, comments link, subreddit name and image preview. Try card and compact views if offered. | The card can contain several different destinations and non-navigation controls. |
| [X](https://x.com/) | Timeline/search: post background, timestamp, avatar and media. | A post URL and an image viewer are different cases. Sign-in and access requirements may limit testing. |
| [Spotify web player](https://open.spotify.com/) | Search: album/playlist artwork versus title text. Then Your Library entries and artist links. | Middle-click should not start playback in the source. A non-link part of an album card may be unsupported. [Official web-player help](https://support.spotify.com/us/article/web-player-help/). |
| [GitHub](https://github.com/) | Repository file names, issue/PR list titles and author links. Repeat after navigating within the repository. | Good direct-link comparison against app-like list navigation. Do not use merge/edit controls as navigation tests. |
| [Twitch](https://www.twitch.tv/) | Browse/category results: channel thumbnail, stream title, channel name and category tile. | Verify the original stream/playback does not change while a channel URL opens elsewhere. |

## Additional challenging interactive websites

These are proposed stress tests. They have not been tested with this extension, and this list does not assert which JavaScript framework each currently uses.

| Site | Exact area/control to try | What it challenges |
|---|---|---|
| [Pinterest](https://www.pinterest.com/) | Search/home feed Pin image and title; then a board tile and creator/profile link. | Large image cards with several nested actions. A Save button is an action, not a destination. [Official guide](https://help.pinterest.com/en/guide/all-about-pinterest). |
| [Discord web](https://discord.com/app) | An existing server's text-channel entry, search-result jump and a visible message link. | App-style navigation and scroll-to-message actions. A voice-channel entry is not a normal page link. [Official browser/server/channel overview](https://support.discord.com/hc/en-us/articles/360045138571-Beginner-s-Guide-to-Discord). |
| [Notion](https://www.notion.so/) | Sidebar page name, nested page link and database page/card in a sample workspace. | Similar-looking controls can open a full page or an overlaid preview. Expand arrows should not open tabs. [Official sidebar guide](https://www.notion.com/help/navigate-with-the-sidebar). |
| [Trello](https://trello.com/) | Board tile, card title/card body and a direct card link on a test board. | A card can have its own URL while normally appearing in a dialog. Zero tabs may reveal a hidden-address control. [Official card help](https://support.atlassian.com/trello/docs/adding-cards/). |
| [Gmail](https://mail.google.com/) | A test-message subject/row, a label in the sidebar and a normal web link inside a message. | Message rows and labels versus ordinary links. A new tab opening the message may mark it read through shared account state. |
| [Google Drive](https://drive.google.com/) | A sample folder row/tile, document-name row and a PDF/image preview item. | Folder navigation, document navigation and previews have different semantics. [Official file-opening guidance](https://support.google.com/drive/answer/2423485). |
| [Google Maps](https://maps.google.com/) | Search for a place; try a result's name/card, a map pin and the place panel's website link separately. | Canvas/map interactions versus explicit website addresses. A map pin can be a selection action rather than a page link. [Official search guide](https://support.google.com/maps/answer/3092445). |

For this diagnostic build, first record the reported button and wait 10 seconds for its outcome summary. Preserve the existing X, Spotify and Bluesky results while gathering evidence. Then test Instagram, Sharesies, Pinterest and Google Maps. Then work through the rest. A dozen carefully recorded controls is more useful than a blanket “works on this website.”

## Result sheet

Copy one row per control, not one row per whole website.

| Date / Firefox / extension | Site + exact starting URL | Item and clicked part | Signed in? | OFF behavior | ON tabs: 0/1/2+ | Correct destination? | Source unchanged? | Notes / screenshot |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Suggested result labels: **opens correctly**, **protected but unsupported**, **wrong destination**, **double-open**, **source changed**, **no site permission**, **browser-restricted page**.

Also test the toolbar ON/OFF state on two ordinary sites, persistence after restart, container/private-window behavior where permitted, and whether the changelog appears on an actual extension version update rather than every browser restart. Firefox internal pages and Mozilla's restricted Add-ons pages are outside normal content-script coverage; they should not be scored as website compatibility failures.

