# Force New Tab

A Firefox extension that forces middle-click on any element to open in a new tab — including JavaScript-driven buttons, cards, and links that normally ignore middle click.

## The Problem

Modern websites are built as Single Page Applications (SPAs) using frameworks like React, Vue, and Angular. Navigation on these sites is handled entirely by JavaScript rather than standard `<a href>` links. As a result, middle-clicking elements like cards, buttons, and tiles either does nothing or navigates the current tab instead of opening a new one.

Force New Tab solves this transparently, without breaking normal browser behaviour.

---

## How It Works

When you middle-click an element, the extension works through a chain of fallbacks in order, stopping as soon as it finds a URL to open:

1. **Real links are ignored** — if the clicked element is a genuine `<a href>` link, the extension does nothing and lets the browser handle it natively as it normally would.

2. **`data-*` attribute scan** — checks the clicked element and its ancestors for common URL attributes like `data-href`, `data-url`, `data-link`, `data-navigate` etc.

3. **Child anchor search** — searches inside the card container for any `<a href>` link. Useful for sites like Spotify where the image and text are separate elements inside the same card, but only the text has a real link.

4. **Page world hooks** — intercepts standard JavaScript navigation methods:
   - `window.open`
   - `history.pushState`
   - `history.replaceState`
   - `location.href`
   - `location.assign`
   - `location.replace`

5. **Click replay** — if nothing is captured after 500ms, the extension re-fires `mousedown`, `mouseup`, and `click` events on the element to trigger its JavaScript handler, then intercepts the resulting navigation.

6. **URL polling** — as a last resort, monitors `window.location.href` for changes after the click replay fires. If the URL changes, the new URL is opened in a new tab and the current tab is snapped back to its original URL.

---

## Compatibility

The extension is designed to work on as many sites as possible. Tested on:

| Site | Status | Method used |
|------|--------|-------------|
| YouTube | ✅ Works | Page world hooks |
| Reddit | ✅ Works | Page world hooks |
| Twitter / X | ✅ Works | Page world hooks |
| Spotify | ✅ Works | Child anchor search |
| GitHub | ✅ Works | Real links / page world hooks |
| Twitch | ✅ Works | Page world hooks |
| Pinterest (cards) | ✅ Works | Child anchor search |
| Pinterest (filter buttons) | ⚠️ Partial | URL polling — current tab also navigates, use back button to restore |

### Known Limitations

- **Strict CSP sites** — some sites (like Pinterest) block page-world script injection via Content Security Policy. The extension degrades gracefully, falling back to DOM-based methods that don't require page-world access.
- **Modal/dialog triggers** — buttons that open dialogs rather than navigating to a new page have no URL to open. The extension correctly does nothing in these cases.
- **Internal framework routers** — some sites use heavily customised internal routers (like Spotify's) that bypass all standard navigation methods. The child anchor search and click replay fallbacks handle most of these cases.

---

## Installation

### From Firefox Add-ons (AMO)
*(Link will be added once the extension is approved)*

### Manual Installation (for testing)
1. Download or clone this repository
2. Open Firefox and go to `about:debugging`
3. Click **This Firefox**
4. Click **Load Temporary Add-on**
5. Select the `manifest.json` file from the repository

---

## Permissions

The extension requests the following permissions:

- **`tabs`** — required to open URLs in new background tabs

No data is collected, stored, or transmitted. The extension has no network access and makes no external requests. All processing happens locally in your browser.

---

## How It Differs From Similar Extensions

Most "force new tab" extensions use an aggressive crash strategy — they intentionally throw JavaScript errors to kill the site's script execution after intercepting a navigation call. While effective, this approach can break page functionality as a side effect.

Force New Tab uses a cleaner architecture:

- A **CustomEvent bridge** between the content script world and the page world, rather than crashing scripts
- **`mousedown`** as the trigger event rather than `auxclick`, giving more control before the browser acts
- **`browser.runtime.sendMessage`** to open tabs via the background script, which is more reliable than calling `window.open` directly
- Fallbacks are applied in order from least to most invasive, so the cleanest solution is always tried first

---

## Version History

### v1.3.0
- Added URL polling fallback for sites that bypass all JavaScript hooks
- Added child anchor search for Spotify-style card components
- Added `history.replaceState` interception

### v1.2.0
- Added `location.href`, `location.assign`, and `location.replace` interception
- Added click replay fallback

### v1.1.0
- Initial public release
- `window.open`, `history.pushState` interception
- Real link passthrough
- `data-*` attribute fallback

---

## License

MIT
