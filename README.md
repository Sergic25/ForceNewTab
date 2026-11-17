# Force New Tab

**Middle-click more of the web.** Force New Tab helps links, images, cards and JavaScript-driven buttons open their destination in a new background tab—even when a website normally ignores middle-click or treats it like a left-click.

**Version 2.0.2 · Firefox 147 or newer.** This release improves direct destination detection for card whitespace using matching heading and thumbnail links, with minor behavior-preserving cleanup. [Download 2.0.2](https://github.com/Sergic25/ForceNewTab/releases/tag/v2.0.2). The clean package was submitted to Mozilla on November 16, 2026; publication was pending at submission. The GitHub XPI is unsigned.

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

The same rules apply across permitted websites, using the links, relationships and navigation behavior exposed by each page. Opening the intended destination is the priority; keeping the original page unchanged is the next goal.

## When a new tab takes longer

A background copy may need **up to 15 seconds** to load and prepare. Direct links and other known destinations do not wait for this process.

You can switch tabs or look at the copy while it prepares. Clicking or typing inside the copy stops the automatic press, so it does not interfere with your own input. Interacting with the original page, navigating, closing a tab or turning the extension OFF can also cancel preparation. Once a click might have reached the copy, the extension will not automatically repeat it on the original page.

## What cannot be guaranteed

No extension can turn every website control into a normal link. A button may open only a temporary panel, require information that was not recreated in the copy, or refuse a simulated click. Forms and editing controls may be left alone. Some popup controls can work in a new copy; others may leave a copy with no popup.

A copied tab reloads the page; it is not an exact snapshot of the running website. Unsaved work, temporary menus and a changing feed may differ. If the final fallback runs on the original page, the website can change its appearance or send a request before the destination is captured. Websites may also open their own extra windows or synchronize changes across tabs.

Firefox's protected pages and pages where the extension has no access are unsupported. Image destinations may be the displayed preview rather than a full-resolution original.

## What changed in 2.0.2

Whitespace within a card can now use matching heading and thumbnail destinations without activating the original card. The rule checks exact URLs and excludes nested action controls, unrelated cards and ambiguous layouts. See [validation and Firefox retest steps](TEST-RESULTS-2.0.2.md).

## What changed in 2.0.1

This release overhauls destination finding, adds automatic background-copy handling for difficult controls, and improves how copies wait for a button to settle. It also introduces the larger, centered purple and grey fist artwork and clearer website-reporting links.

During development, the maintainer reported successful results for tested feed controls, artwork links, story cards, account navigation and a login dialog. These observations cover individual controls; behavior can vary with the page and its current state. Automated checks use simulated browser behavior; see [test results](TEST-RESULTS.md) and the [manual test list](TESTING-WEBSITES.md).

## Installation and testing

For the Mozilla-distributed version, use [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/). An unsigned GitHub package is not a permanent install in standard Firefox.

To load the public build temporarily:

1. In this source folder, run `node tools/build.cjs` (Node.js 18 or newer). This creates the public and diagnostic packages under `dist`.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on**.
3. Select `dist/ship/manifest.json`, then reload the pages you want to use. For optional click diagnostics, select `dist/testing/manifest.json` instead; its name includes **Testing**.

Temporary installations end when Firefox restarts.

The public build has no click recorder or separate feature switches. Testing-only tools live under `testing/`; the build adds them only to `dist/testing`. Open the testing add-on's Preferences, choose **Record next middle-click**, reproduce the problem, then return to review and copy the report. Recording is off until requested. Both variants use the same extension ID; use one at a time.

## Reporting and privacy

Use [GitHub Issues](https://github.com/Sergic25/ForceNewTab/issues/new/choose) or [Firefox reviews](https://addons.mozilla.org/en-US/firefox/addon/force-new-tab/reviews/). Give the website, exact clicked item, browser and extension versions, expected result, and what happened in both tabs. Say whether signing in is required. Share public links or a description of private pages; omit account details and credentials.

There is no telemetry or automatic report upload. Settings, copy-operation status and any manually recorded testing report stay in your browser. Reports omit typed form values, page titles, URL queries and fragments; address paths and relationship IDs may still identify private content. Review before sharing. Websites and copied tabs still make their normal network requests. Website access lets the extension inspect controls; storage saves local state; cookie permission preserves Firefox container context without reading cookie values.

## Development and license

Run `node testing/tests/run.cjs` to build both variants and run the public regressions, restored diagnostic checks and package parity audit. `node tests/run.cjs` runs only the public suites. The build copies runtime JavaScript verbatim, without minification or bundling, and assembles separate manifests and Preferences pages. `dist/ship` excludes the diagnostic files; its unsigned XPI matches the public 2.0.2 submission. Source ZIP and SHA-256 checksums are generated alongside both packages. See [build verification](TEST-RESULTS-2.0.2.md). Historical development notes are kept in [docs/history](docs/history/DEVELOPMENT-NOTES.md). Force New Tab is released under the [MIT license](LICENSE).


