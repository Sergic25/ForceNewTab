# Force New Tab — testing version

This branch keeps the **2.0.1 diagnostic build** for investigating website problems. It is separate from the public extension and is not published as a normal GitHub Release. For everyday use, see the [public version](https://github.com/Sergic25/ForceNewTab) and its installation instructions.

The testing build includes **Record next middle-click** in the extension's Preferences. Recording is manual and local. It does not change the navigation methods. The current copied-button correction was confirmed by the maintainer to work for Canva's Login button; that report is about the tested control, not every Canva page.

## Load the testing version

1. Download this branch from GitHub using **Code → Download ZIP**, then extract it.
2. Open Firefox 147 or newer and go to **about:debugging → This Firefox → Load Temporary Add-on**.
3. Select this folder's **manifest.json**, then reload the website you want to test. Temporary loading ends when Firefox restarts.
4. Open the addon's Preferences, choose **Record next middle-click**, then middle-click the affected control. Wait about 15 seconds and return to Preferences to inspect the report.
5. Review it before sharing on [GitHub Issues](https://github.com/Sergic25/ForceNewTab/issues/new/choose). Website address paths can reveal private content or account details even though query strings and typed form values are excluded. Nothing is uploaded automatically.

This build uses the same extension ID as the public version. Use a separate Firefox test profile if you want to keep the two installations separate. The purple/grey toolbar toggle remains the only switch for navigation behavior.

## How it works

Force New Tab tries to open middle-click destinations in background tabs using the same rules across permitted websites.

1. Actual links, clear card/title relationships and displayed images are checked first.
2. For an unresolved control, a clearly owned address stored by the website can provide a direct destination without pressing the original control.
3. Otherwise, an eligible control can use a background copy: the page reloads in a new tab, the addon finds the matching control and presses it once there.
4. If copying is unavailable or definitely fails before activation, discovery on the original page may reveal the destination. Once a copied click might have run, it is never automatically repeated on the original.

These methods run **automatically while the toolbar is ON**. There are no separate feature switches; settings left by older test builds do not disable them. Click the fist to toggle everything: **purple = ON**, **grey = OFF**. The toolbar state is saved.

## Testing behavior

Requires **Firefox 147 or newer**.

1. Download and extract the **testing** branch, or clone that branch.
2. Open **about:debugging** → **This Firefox** → **Load Temporary Add-on**, then select **manifest.json** in the extension folder.
3. Reload the test page and keep the toolbar purple.

Temporary installation ends when Firefox restarts. No Mozilla-signed package of this preview has been produced.

Use ordinary middle-click; Shift is unnecessary. Direct destinations should open promptly. A background copy can take **up to 15 seconds**. It now waits at least 1.5 seconds with the same matched button before attempting one click; a replaced button restarts that wait. This gives the copied page more time to initialize but cannot prove its button is ready. Switching tabs or viewing the copy is fine. Clicking or typing inside it stops automatic replay. Input on the original page, navigation, closing a tab or disabling the addon can also cancel preparation.

## Limits and privacy

Opening the destination is the priority; keeping the original untouched cannot always be guaranteed. Original-page discovery may run website code that changes the interface or sends requests before navigation is stopped. Inspecting unusual website objects can also run website code. Copies cannot clone a running program, so temporary panels, unsaved state or the same feed item may be missing. Some controls have no destination or reject simulated clicks. Websites can open extra popups, take focus or synchronize account changes across tabs. Firefox-protected pages and sites without granted access are unsupported.

There is **no telemetry or automatic report upload**. Settings and manually requested diagnostic reports stay in Firefox's local extension storage. Websites and copies still make ordinary network requests.

Permissions: **cookies** preserves Firefox container context; **storage** saves settings and local reports; **webNavigation** observes navigation for discovery and diagnostics. Website access allows control inspection and middle-click handling.

## Testing and reporting

After GitHub upload, complete the [manual trial](TESTING-WEBSITES.md) before public submission to Mozilla. Compare OFF and ON, check both tabs, and report versions, clicked item, expected destination and actual result. Use public or redacted URLs; omit private account addresses and credentials.

Diagnostic recording is manual: choose **Record next middle-click** in Preferences only when needed. Review identifying address paths before sharing a report through [GitHub Issues](https://github.com/Sergic25/ForceNewTab/issues/new/choose).

Run **node tests/run.cjs** for 20 simulated DOM/browser suites. All 20 pass, including fresh settings, old saved settings, toolbar OFF, direct-opening priority and copy cancellation. See [verification status](TEST-RESULTS.md). These do not establish live Firefox success or universal compatibility. Earlier notes remain in [docs/history](docs/history/DEVELOPMENT-NOTES.md).
