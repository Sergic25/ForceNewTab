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

Use existing navigation items, sample documents and a test board. For investment pages, test investment-name navigation only, not Buy/Sell/order controls. For mail/chat, do not use Send, Delete or other action buttons as navigation tests. Opening a destination can itself mark content read or cause account updates that later appear in the source tab; note those separately from the source responding to the middle-click.

## Reported controls to revisit

These reports concern individual controls and remain test targets, not compatibility certifications.

| Control or layout | Exact area to try | Reported distinction |
| --- | --- | --- |
| Liked-item grid | Tile, image and visible post/profile link separately | A supplied review excerpt reported changes in both the source and new tab. |
| Investment navigation | Search result versus a holding or investment row in an existing account | A review reported working search navigation but no result from a personal investment view. |
| Feed and comment cards | Empty card area, timestamp, author/avatar and linked image separately | A review reported double-opening and source history changes; image lightboxes are a separate case. |

Source: [extension reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/) and review excerpts supplied during development. The live review page was unavailable to the research tool; some reports came from its search index. No review author was contacted.

## General navigation and layout coverage

Earlier compatibility claims did not establish complete coverage. Check concrete controls across multiple unrelated layouts.

| Structure | Try separately | Useful distinction |
| --- | --- | --- |
| Video recommendations | Title, thumbnail, channel name and playlist entry | Navigation versus playback, queue and menu actions |
| Post and story cards | Title, background, timestamp, comments and image | Multiple destinations within one container |
| Media libraries | Artwork, title, creator and saved-library entries | Associated title navigation versus source playback |
| File and issue lists | Row title, row whitespace and author link | Direct links versus app-style list navigation |
| Image boards | Image, title, collection tile and creator link | Navigation versus Save or other nested actions |
| Chat navigation | Existing text-channel entry, search-result jump and message link | Addressable destinations versus scrolling or voice actions |
| Document workspaces | Sidebar page, nested page and database card | Full navigation versus overlaid previews or expansion |
| Task boards | Board tile, card title, card body and direct card link | Dialog presentation with or without a separate destination |
| Mail views | Sample message subject/row, label and ordinary link | Navigation and shared read-state changes |
| File storage | Sample folder, document row and image/PDF preview | Folder navigation versus viewer controls |
| Map interfaces | Result name/card, map marker and explicit page link | Destination URLs versus selection on a canvas |

For this historical diagnostic build, first record the reported control and wait 10 seconds for its outcome summary. Retest the previously working story, artwork and feed controls, then the unresolved grids, account rows and navigation panels. Record each control's result separately.

## Result sheet

Copy one row per control, not one row per whole website.

| Date / Firefox / extension | Site + exact starting URL | Item and clicked part | Signed in? | OFF behavior | ON tabs: 0/1/2+ | Correct destination? | Source unchanged? | Notes / screenshot |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Suggested result labels: **opens correctly**, **protected but unsupported**, **wrong destination**, **double-open**, **source changed**, **no site permission**, **browser-restricted page**.

Also test the toolbar ON/OFF state on two ordinary sites, persistence after restart, container/private-window behavior where permitted, and whether the changelog appears on an actual extension version update rather than every browser restart. Firefox internal pages and Mozilla's restricted Add-ons pages are outside normal content-script coverage; they should not be scored as website compatibility failures.

