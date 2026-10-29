# Force New Tab 2.0.1 — diagnostic testing branch

Verified on October 28, 2026. All20 packaged suites pass using node tests/run.cjs. These simulate DOM/browser APIs; no native Firefox integration claim is made.

## Changes from the2.0.0 GitHub candidate

The copied worker now issues a preparation token for the actual matched button and descriptor. Replacing the button, changing the descriptor/request, losing the match or returning to a loading document invalidates that token. The background requires the same document and preparation token for at least1500ms before sending one execute message with both tokens. The existing15second deadline stays fixed even when a page repeatedly replaces the control. Direct link/card/image/app-data resolution is unchanged.

Activation reasons now distinguish a dispatched click, a thrown invocation and a previously consumed operation. Saved activated/uncertain summaries explicitly set effectConfirmed:false. The Preferences label says a click was attempted and directs the user to check the actual result. No second click or source-page replay is authorized after possible copied activation.

The requested artwork revision removes the three trailing wrist lines and centers/enlarges the remaining fist, tab and white impact marks. Separate purple ON/grey OFF assets retain their existing filenames and size mappings. All26 packaged icon files match the independently exported dimensions and SHA256 records in the companion force-new-tab-icons-no-lines pack. Icon fingerprint expectations were deliberately updated; historical navigation fingerprints remain.

## Coverage

61 worker-content checks include stable/replaced/loading targets, incorrect/missing preparation tokens and stale-token cancellation.91 background checks include the1.5second settling interval, token changes, a delayed mock handler, malformed replies, the fixed15second deadline, distinct activation errors and no repeat activation. Existing35 open-shadow-flow,42 gesture-flow,52 integration, direct-opening and global-toolbar checks pass. Counts overlap and are not an end-to-end total.

The original content.js,resolver.js,component-link.js,app-data.js,discovery.js,background.js and isolation-target.js remain byte-identical to the2.0.0 GitHub candidate. Permissions and license are unchanged. The trial adds no website-specific runtime rules.

## Canva evidence and remaining verification

The user reported that middle-clicking Login at Canva templates opens a plain copy. Left-clicking Login inside that copy opens an in-page popup. The2.0.0 report records an attempted copied activation but does not prove its visible effect. A normal keyboard login activation also opened the dialog container in a separate public inspection. None of this establishes whether early initialization or synthetic-input behavior caused the Firefox failure.

The maintainer subsequently confirmed that Canva Login works with the current correction. This is feedback for the tested control, not independent automated Firefox evidence or a claim that every Canva control works. Keep Canva, the previously working Bluesky login/signup and Questrade control, and direct destinations in future regression checks. Allow up to15seconds without clicking or typing in the copy. Signed installation/upgrade checks, Mozilla validation and the final browser trial remain pending. This diagnostic build is preserved on GitHub's testing branch, outside normal Releases. It has not been submitted to Mozilla.
