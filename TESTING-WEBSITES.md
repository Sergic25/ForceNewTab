# Manual Firefox checks

Use **Firefox 147 or newer** and note the browser and extension versions. This list contains test targets, not a promise that every control works. Further ordinary browsing is useful even after a GitHub release; Mozilla signing, installation and upgrade checks are separate.

Keep the toolbar **ON (purple)**. All opening methods run automatically. There are no feature checkboxes or click recorder in the public extension. Compare a fresh profile with an existing test profile when possible.

## Controls and layouts

Use pages you already visit. Test each part separately, since a card can contain several destinations and actions.

| Structure | Try separately |
| --- | --- |
| Standard links | Link text, an image inside a link, and nested text or icons |
| Cards with headings and thumbnails | Heading, thumbnail, blank metadata area, author link, and neighboring card whitespace |
| Feed and comment cards | Card background, timestamp, comments link, avatar, and image preview |
| Media libraries | Artwork, title, creator link, and playlist entry; check whether source playback continues |
| Grids and search results | Image tile, title, card padding, and items loaded after scrolling |
| Lists and sidebars | Row title, row whitespace, nested page link, and separate expand/menu controls |
| Signed-in navigation | Existing account or document navigation, including navigation after the page changes its view |
| Login and other dialogs | Controls with a separate destination versus controls that only open a popup |
| Action and editing controls | Ordinary left-click behavior for menus, playback, text fields, and form controls |

## For each control

1. Compare the ordinary result with the toolbar OFF (grey), then turn it ON and middle-click once.
2. Note the intended and actual destination, number of new tabs, whether the destination stays in the background, and any extra popups. Check the original page's appearance and title as well as its address.
3. Direct destinations should open promptly. For a background copy, allow up to **15 seconds**. No Shift key is required. Separately try switching tabs while it prepares, then clicking or typing inside the copy: viewing should allow preparation to continue; actual input should cancel the automatic press.
4. Repeat with newly loaded items after scrolling. Check ordinary left-clicks, text fields, two deliberate middle-clicks, and toggling OFF and ON again. Known destinations should keep opening promptly.
5. Where access is permitted, check Firefox containers and private windows. Temporary installations end at restart. Persistent installation and upgrade checks need an appropriate Mozilla-signed package.

Use an existing account for signed-in navigation checks. Do not create an account solely for this checklist or include private account addresses in a public report. Test navigation with harmless sample content; do not use purchase, order, send or delete actions as navigation checks. Note popup-only behavior separately from a failed link opening.

## Share a result

[Open a GitHub website report](https://github.com/Sergic25/ForceNewTab/issues/new/choose) or describe the problem in [Firefox reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/). Include versions, the exact item clicked, what you expected and what happened in both tabs. Use public links or describe private pages without account details.

For deeper investigation, the separate [testing branch](https://github.com/Sergic25/ForceNewTab/tree/testing) retains manual diagnostic recording. It is not part of the public release downloads. Load that branch temporarily only when investigating a problem, and review any recorded report before sharing it: address paths can contain private identifiers. No report is uploaded automatically.
