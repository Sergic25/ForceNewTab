# Force New Tab

**Middle-click more of the web.** Force New Tab helps links, images, cards and JavaScript-driven buttons open their destination in a new background tab—even when a website normally ignores middle-click or treats it like a left-click.

**Version 2.0.1 · Firefox 147 or newer.** This GitHub release contains the public extension source and unsigned package. Publishing on GitHub does not update Firefox installations: the Mozilla submission and signed update are separate steps. The [Firefox Add-ons listing](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/) provides the version currently available through Mozilla.

**A website still not working?** [Open a GitHub issue](https://github.com/Sergic25/ForceNewTab/issues/new/choose) or describe it in the [extension's Firefox reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/). Include the exact item you middle-clicked and what happened.

## Using the extension

Middle-click the item you want to open. No keyboard shortcut or website configuration is needed. All opening methods work automatically.

Click the fist in Firefox's toolbar to switch the whole extension:

- **Purple: ON.** Force New Tab handles supported middle-clicks.
- **Grey: OFF.** Firefox and the website handle them normally.

Your choice is remembered. Pin the fist through Firefox's Extensions menu if needed. Reload pages after installing or replacing the extension. Ordinary left-clicks work normally.

The What's New page opens once per version. Reopen it through the extension's Preferences in Add-ons Manager.

## How it finds the destination

Many websites make cards or buttons clickable without ordinary links. Force New Tab tries these approaches in order:

1. **Read an available destination.** It looks for the clicked link, a clear relationship between a card and its title link, or the displayed image address. These destinations open promptly, without pressing the original control.
2. **Look for an address belonging to the control.** Some websites store the destination in the information behind that particular button or card. A clear match can also open directly.
3. **Try the control in a background copy.** When no destination is available, an eligible control can use a new copy of the page. The extension finds the matching control there, waits for it to settle, then presses it once. This can open a login dialog inside the copied page even when there is no separate login address.
4. **Learn from the original page as a last resort.** If copying is unavailable or definitely fails before a click is attempted, the extension may activate the original control and watch for its destination. That can change the original page too.

The same rules apply across permitted websites. There are no Spotify, Bluesky or Canva address lists to maintain. Opening the intended destination is the priority; keeping the original page unchanged is the next goal.

## When a new tab takes longer

A background copy may need **up to 15 seconds** to load and prepare. Direct links and other known destinations do not wait for this process.

You can switch tabs or look at the copy while it prepares. Clicking or typing inside the copy stops the automatic press, so it does not interfere with your own input. Interacting with the original page, navigating, closing a tab or turning the extension OFF can also cancel preparation. Once a click might have reached the copy, the extension will not automatically repeat it on the original page.

## What cannot be guaranteed

No extension can turn every website control into a normal link. A button may open only a temporary panel, require information that was not recreated in the copy, or refuse a simulated click. Forms and editing controls may be left alone. Some popup controls can work in a new copy; others may leave a copy with no popup.

A copied tab reloads the page; it is not an exact snapshot of the running website. Unsaved work, temporary menus and a changing feed may differ. If the final fallback runs on the original page, the website can change its appearance or send a request before the destination is captured. Websites may also open their own extra windows or synchronize changes across tabs.

Firefox's protected pages and pages where the extension has no access are unsupported. Image destinations may be the displayed preview rather than a full-resolution original.

## What changed in 2.0.1

This release overhauls destination finding, adds automatic background-copy handling for difficult controls, and improves how copies wait for a button to settle. It also introduces the larger, centered purple and grey fist artwork and clearer website-reporting links.

During development, the maintainer reported successful results for tested Bluesky controls, Spotify artwork/navigation, X news cards, Questrade account navigation and **Canva's Login popup**. These results concern particular controls, not entire sites. Automated checks use simulated browser behavior; see [test results](TEST-RESULTS.md) and the [manual test list](TESTING-WEBSITES.md).

## Installation and testing

For the Mozilla-distributed version, use [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/). An unsigned GitHub package is not a permanent install in standard Firefox.

To load this source temporarily:

1. Download and extract the source ZIP.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**.
3. Select `manifest.json` from the extracted folder, then reload the pages you want to test.

Temporary installations end when Firefox restarts.

The public release has no click recorder or separate feature switches. A separate [testing branch](https://github.com/Sergic25/ForceNewTab/tree/testing) retains the manual diagnostic tools for investigating difficult websites. It is outside the stable Releases downloads and can be loaded temporarily in the same way.

## Reporting and privacy

Use [GitHub Issues](https://github.com/Sergic25/ForceNewTab/issues/new/choose) or [Firefox reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/). Give the website, exact clicked item, browser and extension versions, expected result, and what happened in both tabs. Say whether signing in is required. Share public links or a description of private pages; omit account details and credentials.

There is no telemetry or automatic report upload. Settings and copy-operation status stay in your browser. Websites and copied tabs still make their normal network requests. Website access lets the extension inspect controls; storage saves local state; navigation access helps detect destinations; cookie permission preserves Firefox container context.

## Development and license

Run `node tests/run.cjs` for the public build's automated checks. Historical development notes are kept in [docs/history](docs/history/DEVELOPMENT-NOTES.md). Force New Tab is released under the [MIT license](LICENSE).


