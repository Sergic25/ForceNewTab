> **Historical development record — not current usage or release guidance.**
> This document preserves earlier implementation notes, experiments and test results.
> Version numbers, shortcuts, icons and verification status below may describe older builds.
> See the [current README](../../README.md) for this development preview.

# Force New Tab 4.2.6 — purple ON / grey OFF toolbar icons

The approved punching-fist artwork is now used by the toolbar and add-on manager. Purple means ON; grey means OFF. Click once to toggle. The saved state, navigation behavior, fallback order, settings and permissions are unchanged from 4.2.5.

The included XPI is unsigned until Mozilla signs it. Loading manifest.json through about:debugging is temporary and does not survive a Firefox restart. A Mozilla-signed XPI can be installed normally for the week-long test.

**The background copy is a fallback.** Ordinary middle-click first tries the existing direct link, card, image and enabled app-data rules. Only an unresolved eligible control reaches the slower copy path. No Shift key is required. The saved **Use background copies for unresolved controls** setting is retained; new installations start with it OFF.

**Limits:** a copy reloads the page rather than freezing the original page's running program. It may lose temporary panels or unsaved state, fail to find the same control, or meet a website that refuses simulated clicks. Account changes can sync across tabs. No method here guarantees every website will work or that the source can never change.

## Try it

1. Extract the source ZIP to Desktop. In Firefox, open about:debugging → This Firefox → Load Temporary Add-on, then select this folder's manifest.json. Refresh the test page.
2. Keep **Use background copies for unresolved controls** ON in Preferences. Keep the app-data setting ON for the working direct X case.
3. Middle-click the unresolved control normally. Allow about 10 seconds, up to 15 seconds. You can switch tabs or view the copy while it prepares.
4. Avoid clicking or typing inside the copy until it finishes. That stops automatic replay so the addon does not press a control after you begin using the page. Source-page interaction, closing a tab, navigation or disabling the option can also cancel preparation.
5. Check the destination and source page. Retest known links/cards/images too: they should still open directly without waiting for a copy.

The user confirmed that the ordinary-middle-click copy path in 4.2.4 worked on the tested Questrade control after a wait and on the tested Bluesky login/signup controls. That build cancelled when the copy was selected too early. Version 4.2.5 permits passive tab switching while retaining cancellation for actual copied-page input. The new focus behavior still needs a live Firefox retest.

The order is: direct destination → optional copy for an unresolved control → existing source-page discovery if the copy is unavailable or definitely fails before activation. Source discovery comes last because pressing the original control may already change its page before a destination becomes visible. Once a copied click might have run, the addon never automatically repeats it on the source. A copy that you are using is retained.

This uses generic control matching across permitted sites. No website-specific URL rule or new permission was added. Matching, form/editing/visibility exclusions, one-time activation, source/copy context checks and time limits remain. A matching page is not proof that every website handler is ready; websites can also open further popups.

## Historical implementation notes through 4.2.3

Earlier notes below describe the old Shift-based test interface and cancellation behavior. Use the instructions above for this build.

# Force New Tab 4.2.3 — isolated-copy experiment

A separate, off-by-default experiment can run an unresolved control in a new inactive copy. **Ordinary middle-click is unchanged.** Even with the experiment enabled, known links/cards/images keep their existing direct path. Only Shift + middle-click on an eligible unresolved top-level control requests a copy.

This revision fixes Shift cancelling its own gesture or a preparing copy. Shift intent is retained when released before the mouse. Ordinary middle-click and known destinations keep their previous path. The new report includes the actual experiment/toolbar flags and safe input categories to distinguish an unavailable shortcut from a preparation failure. The previous report was consistent with an input cancellation, but did not prove which event caused it.

This revision adds matching through accessible **open shadow roots** (separate component trees within the page). The supplied 4.2.1 report showed the original fallback with Shift and both switches ON; it did not reveal the failed target check. Open-root exclusion was a verified implementation limitation, but has not yet been confirmed as Questrade's cause. The new **copyEligibility** report and persisted decline reason make remaining failures explicit.

A version 2 locator records a bounded chain of uniquely identifiable shadow hosts plus the control identity. It never guesses a position among duplicate hosts. Closed/inaccessible roots, stale hosts, ambiguity, excessive depth and full-path form/hidden/editing exclusions reject. The control label and host attribute values remain transient memory and are omitted from the saved audit/status.

This revision fixes an app-like website compatibility error in background validation. Firefox message metadata can retain the document's initial address after a history-based route change. The extension now checks that metadata's origin, while keeping the separate fresh source-tab address/context checks exact. No ordinary navigation or matching rule changes. Authenticated rejected requests now save a reason and background build/version; a boolean notes whether sender metadata matched the current path without storing either URL. The report also records copy-request receipt without consuming the actual handler response.

The supplied 4.2.2 report confirms successful matching across two open roots. It does not establish why no request result appeared. This revision corrects a demonstrated false-rejection case and adds enough receipt/rejection information to distinguish it from an interrupted gesture or mixed files.

## Try it

1. Extract the ZIP to Desktop; load this folder's manifest.json and refresh Questrade.
2. In the addon's Preferences enable **Shift + middle-click copy experiment**. Keep the existing app-data setting ON for the working X case.
3. Hold Shift while middle-clicking New account once. Keep the original tab selected and wait up to 15 seconds, plus a brief cleanup if preparation fails.
4. Check the new tab's destination, the original view/title/address, and ordinary middle-click on the previously working X/Spotify/Bluesky controls.
5. Preferences shows the last copy status; a copied diagnostic report includes that safe status. Turning this experiment off restores the existing path.

This remains a test build. A successful automated fixture is not a confirmed Questrade/Firefox result.

## What is isolated

The existing resolver, React app-data reader, background opening/discovery, toggle and fist icons are retained. content.js gains one guarded hook after the existing press/release/auxclick route checks; with the experiment off or Shift absent, it returns immediately to the prior fallback. A known destination never reaches the hook. No hostname, provider route or new permission is added.

The source control is not activated on a successful copy path. The extension creates one inactive duplicate, waits for the copied document, and requires two readiness replies from the same worker document at least 250ms apart. A unique fingerprint uses the control's exact tag/role/type, normalized label and stable attributes plus nearby custom element names. Labels stay in transient extension messages and are not stored in reports or last-result status. Forms, editing/submission controls, nested actions, closed/inaccessible shadow roots, subframes, missing/ambiguous controls and oversized scans do not enter this experiment. Those exclusions retain existing handling.

If preparation definitively fails before activation, an unused copy is cleaned up and the existing source fallback may run, provided the source gesture, URL, control and settings remain unchanged. Source input/navigation, disabling the addon, or using/closing the copy cancels preparation. A click is dispatched at most once. An acknowledgement lost during navigation is uncertain: keep the copy and never replay the source. The copy remains the destination tab. No third extension-created destination is needed.

## Limits

Firefox duplicates browser session state; it does not clone a live JavaScript program. A copied page may lose temporary panels, load a different feed, or reject a simulated click. A matching, complete document is not proof that every framework handler has finished hydration. After activation the copy is retained for inspection, even when no URL change can be confirmed. Opening the page or pressing a control can update a shared account/session and those updates may appear in other tabs. Website-created popups can add tabs or take focus; this prototype does not close an activated worker or its popup, which could break an authentication flow.

Regular/Developer Firefox installation, container/private-window restore and real event delivery still require manual testing. The unsigned XPI is a test package and still requires Mozilla signing before normal distribution.

Primary API reference: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/duplicate

## Retained diagnostic notes from 4.1.4


This is a diagnostic build. It preserves the working 4.1.3 routing modules and blue/grey fist icons byte for byte. It does not yet fix Questrade's partly changed source view or add site-specific routes. No permissions changed.

1. Extract the ZIP to Desktop and load this folder's manifest.json as a temporary add-on. Refresh the page being tested.
2. Keep the app-data option in its existing state (ON for the working X test).
3. Open the add-on Preferences, choose **Record next middle-click**, then middle-click the troublesome button once.
4. Wait about **10 seconds** without clicking or typing on the source page, return to Preferences, and copy the updated report.

The report adds buttonEvidence and outcome. Button evidence reads only explicit address fields on the button and at most three contiguous custom-element ancestors. It can inspect current React/Vue properties as evidence, and reports the Angular context's type without traversing its contents. It never changes automatic destination selection. Missing evidence does not prove no internal address exists.

The outcome contains synthetic-click counts, redacted navigation addresses/cancellation flags, and booleans for changed source title/address. Raw title text is not stored. Related background messages, browser navigation and tab events are correlations, not proof of causality or a successful open. The final summary is best effort if the document unloads or Firefox suspends it. Clear/Record prevents old summaries from replacing a newer report.

Reporting remains explicit, bounded and local. It does not copy form values, cookies, handler code, full framework state or URL queries/fragments/credentials. Address paths can contain account/content identifiers; review a report before sharing it. Own-property reflection may run website Proxy traps, so an explicit inspection cannot promise no website code will run.

The supplied 4.1.3 report and user observation confirmed the tested X story opens directly with source preservation. Broader live Firefox coverage, install/update checks, Mozilla validation and signing remain outstanding.

## Retained 4.1.3 implementation notes


The 4.1.2 report passed current-tree and ownership verification through 226
levels, then rejected the link's extra anchorless field. This build accepts that
one option only as a literal boolean (or unset). It does not contribute to URL
construction. Other unknown fields and unsupported URL context still reject.
Its public semantics were not independently established; this remains an opt-in
compatibility experiment, not a claim that arbitrary metadata is safe to ignore.

The supplied 4.1.1 report identified the blocker: current-tree verification
stopped at its 128-node upward search limit, before ownership or URL parsing.
This build supports up to 1024 upward nodes and 8192 parent-membership checks.
The separate component scope, ownership and conflict checks remain unchanged.
This is a bounded budget increase, not a website-specific rule or skipped proof.
Reports include the configured limits, deepest path and per-candidate proof results.

The supplied 4.1.0 report established that the clicked card already holds its
story address in component navigation data named link.pathname. This build adds
a generic rule for that structure. The reported X story was subsequently user-confirmed working in Firefox. There are no new
website-specific routes or permissions. The four original navigation modules,
toolbar toggle and blue/grey fist icons remain unchanged from 4.0.2.

## Try it in Firefox

1. Extract the ZIP and load manifest.json through about:debugging > This Firefox
   > Load Temporary Add-on. Refresh the test page after loading this build.
2. Open Force New Tab's Preferences in Add-ons Manager.
3. Enable **Try addresses stored in app data (experimental)** to test automatic
   use of a qualifying address. This option starts off.
4. Choose **Record next middle-click**, return to the troublesome page and
   middle-click the item once.
5. Return to Preferences, review the report, choose **Copy report** and paste it
   into our chat. If copying is blocked, press Ctrl+C when the report is selected.

Open Preferences through Firefox. Opening changelog.html directly from the
extracted folder displays this page but cannot access the extension controls.

## What the experiment accepts

Existing successful link, card and image destinations are used first. For an
unresolved eligible link-like control, the optional reader looks for one explicit
navigation address on that control's own current app properties. It does not
invent a destination from a story ID, title or named route. Missing, conflicting,
unsafe and unsupported private data keep the existing navigation-first fallback.

A component's explicit link configuration can now be selected after current-tree,
rendered ownership and full-address checks. Other parent-component and nested
addresses remain evidence only. The reader does not simply choose any pathname
found in surrounding data. A profile or artwork URL in surrounding
app data is not enough to identify the clicked destination. The source page may
still change when the fallback needs to activate its original control.

The reader does not deliberately call click handlers, getters or router
functions. Some unusual page objects can run website code when inspected, so
this experimental option cannot promise zero regressions. Turn it off to restore
the existing destination-selection behavior.


## Verified component links

The added rule reads an explicit link object rather than inventing a destination
from a headline or story ID. It verifies the current React tree, the clicked DOM
node and its current properties, and that a component renders only that node as
its root. An extra sibling root, portal, stale branch, uncertain ownership or a
bounded scan that cannot finish keeps the existing fallback. Matching component
links must agree on the complete address. Unsupported query objects, named routes,
route parameters, getters and conflicting addresses are not guessed.

An unset host href (null/undefined) is treated as absent; invalid nonempty values
still block the supplemental route. Existing ordinary links/images and the
successful direct host-property path retain precedence. The optional setting
still starts off. No site hostname, title matcher or fixed destination was added.

## Local report and limits

Recording stays off until requested and expires after one click or two minutes.
A recording may inspect bounded React/Vue navigation properties even while
using those properties for direct opening is off. The report includes limited
property names and redacted navigation candidates, not titles, story-ID values,
form values, cookies, handler code or full app data. Address queries, fragments
and credentials are removed. URL paths and page relationship IDs can still
identify content; review before sharing. Nothing uploads automatically.

**Clear report / stop** cancels recording and removes the saved report. A report
stays in local extension storage until cleared or replaced. Framework internals
are not a stable public API: production builds may hide them, and a destination
may exist only inside a function's private state. Ordinary DOM reports and the
existing fallback remain available when app data cannot supply a safe address.

## Existing 4.0.0 behavior
The same destination rules now apply across permitted websites. Loaded runtime
code contains no Spotify, Bluesky or Reddit hostname checks, custom provider test
identifiers, route patterns or fixed account-page destinations.

**Requires Firefox 147 or newer.** Firefox Developer Edition 159 was found on this
computer. Version 3.0.3 remains untouched as the working baseline.

## Rules

1. Open an actual enclosing HTTP(S) link.
2. Use the nearest explicit data-href/data-url.
3. Follow an accessible title association within the same semantic card.
4. Use a unique owned bookmark/timestamp permalink in a link-like card.
5. Open the actual clicked image, or the one image explicitly labelled by its
   image button. Navigation evidence takes priority over artwork URLs.
6. With the optional app-data experiment on, an eligible unresolved navigation
   control can use one explicit destination from its own current properties or
   a verified current component link configuration.
7. For an unresolved eligible control, arm the background observer then activate
   it once. A native Navigation API event can reveal and cancel its destination;
   the background opens that address once. Browser navigation observation remains
   the fallback when native cancellation is unavailable.

There is no first-nearby-link guessing. Ambiguous card destinations do not become
raw artwork URLs. Nested Play/Like/menu controls do not become parent-card links.
Images on other websites/CDNs now qualify deliberately; this is expanded behavior.

## Keeping working behavior

The positive image, post/comment, artwork and account-button cases remain test
fixtures. Renamed copies on unrelated domains prove those patterns are generic.
Known buttons with hidden destinations no longer depend on a fixed account URL:
their actual destination is learned during the owned activation.

A generic account fallback does execute the original control's handler once.
Cancellation can stop navigation before the address changes; it cannot undo UI,
network or other work the handler already performed. This differs from a shortcut
that already knew the destination. No absolute no-regression guarantee is claimed.

The saved blue/grey fist toggle, existing icons, container/window handling,
once-per-version local changelog and background-tab creation remain.

## Navigation capture

Firefox 147+ provides the native Navigation EventTarget. The isolated content
script listens at document_start; no page-world bridge or prototype patches are
installed. While an acknowledged attempt is active, it can prevent a trusted,
cancelable, changed HTTP(S) navigation and report its destination with the owned
attempt ID. Cross-origin canIntercept:false does not prohibit preventDefault.

Form submissions, downloads, traversal and untrusted events are not canceled by
this hook. It expires after7.5seconds, shorter than the background8second session.
Synchronous repeated navigation reports share one result, and the existing60ms
settling interval lets an already-created native target win.

If the API is disabled/absent or a navigation is not cancelable, observation can
still discover it; the source may then navigate. Native targets can take focus
or appear late. Unrelated activity can be misattributed within a bounded attempt.
A source handler may change its UI before a navigation event occurs.

Ordinary typing and left/right clicks remain unchanged. Existing automatic
activation exclusions for forms/editable/disabled controls remain; this version
does not introduce full middle-click passthrough on those fields.

## Install/test

Extract the source ZIP, open about:debugging > This Firefox > Load Temporary
Add-on, select manifest.json, grant site access and refresh test pages.
Temporary installation expires on restart. The XPI is unsigned; it is not an
AMO release. Pin the fist from Firefox's Extensions menu if hidden.

Run the current self-contained suite:

    node tests/run.cjs

352 distinct current checks and 65 compatibility replays pass. Four legacy fault
reproductions pass separately. See TEST-RESULTS.md for verification limits.
Additional checks cover the optional report and app-data tools; the four navigation modules
and four icon files are fingerprinted against 4.0.0 and remain byte-identical.
The old provider-specific contracts are preserved under tests/archive-3.x and
are not claimed as current passing tests. Read MIGRATION.md for exact changes.

Native Firefox/Xray integration was not completed here. The available browser
connection cannot inspect the signed-in Firefox panel and rejected the local-file
preview under its URL policy. Test the previously working
controls in Firefox. Keep 4.0.2 available for comparison. With the experiment
off, the existing destination-selection behavior is retained.

No telemetry. Host permissions allow page access; webNavigation observes armed
attempts; cookies permission preserves cookieStoreId without reading cookies;
storage remembers ON/OFF, the experiment setting, the last changelog version and
the optional local report.
No new permissions added.
MIT license and original fist assets retained.


