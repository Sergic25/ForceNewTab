> **Historical development record — not current usage or release guidance.**
> This document preserves earlier implementation notes, experiments and test results.
> Version numbers, shortcuts, icons and verification status below may describe older builds.
> See the [current README](../../README.md) for this development preview.

# Current 4.2.0 prototype status

The separate Shift + middle-click experiment is now implemented. See README.md for actual scope, guards and limitations. Ordinary middle-click and known destination rules are retained. The inverted-tab-swap variant below remains unimplemented. This document's earlier design is historical and does not override the implemented README contract.

# Duplicate-and-activate: feasibility and experiment design

Prepared October 25, 2026. The priority is opening the intended destination in a
new tab. Keeping the source page unchanged is desirable but secondary.

**Status: the duplicate-worker and inverted-runtime approaches described here
are NOT implemented in the 3.0 prototype.** This is a design and feasibility
record, not a compatibility promise.

## The idea in everyday language

Making a background copy of the page and pressing the button there is a useful
idea. Firefox lets an extension duplicate a tab. That copy can be the final
destination tab: if pressing the control changes the copied app to the intended
view, we do not need to extract an address and open a third tab.

The limitation is that Firefox does not provide an exact photocopy of a running
app. It reconstructs a page from saved browser state. The address, history and
some form/scroll/session data can be restored, but a website's running code,
temporary memory and current interactive screen are not guaranteed to match.

For example, an infinite feed may load a different set of posts in the copy.
A panel held only in application memory may be closed. The copied page may not
contain the button that was clicked. A button may also refuse a simulated press.
These are reasons to test this approach, not reasons to claim it is impossible
or already reliable.

## What Firefox actually provides

- [tabs.duplicate](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/duplicate)
  accepts active:false to make the duplicate inactive.
- [SessionStore.duplicateTab](https://firefox-source-docs.mozilla.org/browser/components/sessionstore/docs/api.html)
  duplicates a tab including session history.
- [Firefox session-state collection](https://firefox-source-docs.mozilla.org/toolkit/components/sessionstore/collection.html)
  describes collected history, session storage, form data and scroll state.
  This serialized state is not a snapshot of the JavaScript heap and closures.
- [Current Firefox tabs implementation](https://searchfox.org/firefox-main/source/browser/components/extensions/parent/ext-tabs.js)
  resolves tabs.duplicate at SSTabRestoring, explicitly before SSTabRestored.
  A resolved duplicate promise is therefore not proof that a SPA has rebuilt
  its screen or finished attaching its button handlers.
- [scripting.executeScript](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript)
  can run a worker script with scripting permission and target host access.
  Injected functions are serialized; their bound parameters/context are lost.
- [Event.isTrusted](https://developer.mozilla.org/en-US/docs/Web/API/Event/isTrusted)
  remains false for dispatched events and HTMLElement.click-generated clicks.
  Ordinary script injection does not manufacture genuine physical input.

“SPA” means an app-like website that changes its view without necessarily loading
a different document. Its address is not a complete record of everything visible
or everything stored in its temporary memory.

## Proposed duplicate-worker phase model

Each operation needs a unique owner: gesture ID, source tab/document/frame,
recorded starting address, one worker tab and one activation status. Multiple
gestures must not share one global pending flag or a URL/time filter.

| Phase | Work | Allowed transition |
|---|---|---|
| Captured | Suppress the middle gesture where possible; inspect explicit addresses first. Record the clicked control before any page activation. | A known address opens directly. Unknown control moves to preparation. |
| Preparing | Create one inactive duplicate and record its ID. | Duplicate failure can fall back to the source before activation. |
| Reconstructing | Wait for the copied app and identify the corresponding frame/control. | A verified target moves to armed. A timeout or mismatch is a pre-activation failure. |
| Armed | Attach navigation/new-window observation before any activation; revalidate target and mode. | Cancel safely, or activate once. |
| Activated | Send one simulated activation to the verified worker target. | Observe result. Do not automatically activate the source as well. |
| Result | Keep the worker as the user's destination tab if the intended view has opened. | Clean up operation state without opening a redundant third tab. |
| Failed before activation | No page control was pressed. Report/clean up the worker. | One source activation may be attempted under the navigation-first policy. |
| Uncertain after activation | No reliable destination/result was observed, but application code may have acted. | Report uncertainty or leave the worker available; do not blindly replay in source. |

A blank duplicate that never recreated the intended control is not a successful
open. A changed worker URL is evidence of navigation, not proof it was the right
destination. A verified SPA result can count as success even if no new address
appears, because the worker itself is already the new tab.

### Finding the corresponding control

DOM nodes and frame IDs cannot be carried from the original document to another.
A later experiment needs a serializable target description and validation:
stable attributes where available, link/route data, role, normalized label and
surrounding context. A positional path alone is weak evidence on changing feeds.

The implementation must handle or explicitly exclude nested frames, open/closed
shadow roots, duplicated labels, virtualized lists and delayed rendering.
Restoring scroll position does not guarantee that a virtualized item has been
recreated. If confidence is insufficient, fail before activation rather than
press a different control.

### Readiness and timeout

Document load completion is necessary on some pages and insufficient on others.
Use a bounded readiness condition tied to the intended control and app screen.
Fixed delays such as 500 ms are not evidence of readiness. Background rendering
and network delays must be covered by real Firefox tests.

### Activation and observation

Observation belongs in the background before activation so that it can survive
a full document change. Useful notifications include:

- [onHistoryStateUpdated](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onHistoryStateUpdated)
  for History API address changes.
- [onReferenceFragmentUpdated](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onReferenceFragmentUpdated)
  for hash routing.
- [onCommitted](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onCommitted)
  for a committed full-document navigation.
- [onCreatedNavigationTarget](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onCreatedNavigationTarget)
  if the control/browser already opened another tab or window.
- [tabs.onUpdated](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onUpdated)
  as supplementary URL/status observation.

These are notifications, not a transaction. A short observation window can still
contain an unrelated timer-driven navigation. Multiple notifications may describe
one navigation; redirect chains can contain several addresses. The operation
needs a single completion decision, not one new tab per notification.

If a control opens another tab, the experiment must decide which tab is the final
result and how to avoid leaving both the worker and destination. It must never
close an unrelated user tab. Tabs owned by the operation must be tracked explicitly.

## Why source fallback must distinguish “not activated” from “no URL”

The copied control may send a request or open a delayed dialog without changing
the address. Running the same control again in the source can repeat that action.
It is not generally possible to prove that a simulated click was ignored merely
because no address changed.

A reasonable default is source fallback after pre-activation failure only.
After activation, report uncertainty and retain an inspectable result rather
than guessing that a second activation is harmless. Site-specific knowledge can
allow a stronger rule for known navigation-only controls.

The user's authorization to prioritize destination opening permits source
navigation. It does not make duplicate actions equivalent to a single action
or prove that every button has a meaningful destination.

## Inverted variant: keep the actual runtime as the background destination

A different design keeps the original running app, including its temporary
memory, and puts a restored copy in front of the user:

1. Capture the gesture and its original target.
2. Duplicate the source as a foreground stand-in for the old view.
3. Leave the actual original app in a background tab.
4. Activate the original target in that original runtime.
5. Keep that runtime as the background result.

This avoids trying to reconstruct the target's live state in the worker. It
still has several tradeoffs:

- The foreground stand-in is reconstructed and may not match the old screen.
- The result is the ORIGINAL tab ID; the newly created tab is the source-view
  stand-in. This does not literally satisfy “the result must be in a newly
  created tab” if tab identity is part of the requirement.
- Focus, tab ordering, browser history, opener relationships and user expectations
  can be disturbed.
- Simulated activation is still untrusted. Preserving the runtime does not
  manufacture a trusted left-click.
- Normal WebExtension APIs do not expose an exact live-document/JavaScript-heap
  swap that could hide those identity tradeoffs.

This variant is NOT implemented in 3.0. It would need a clearly defined user
experience and an explicit decision about whether a newly visible background
result is acceptable when its underlying tab identity is the old one. A privileged
Firefox experiment could investigate deeper document/input handling; that is a
different project, not an existing extension capability.

## Why “pause the source briefly” is not a complete answer

Early capture listeners can prevent later listeners from receiving a particular
middle-click. If the extension already knows the destination, that is enough:
block the event and open the destination separately.

If the destination exists only inside the blocked handler, preventing that
handler also prevents it from computing the destination. The choices become
recovering the route another way, running that handler in a recreated copy, or
allowing source execution and observing the result.

[window.stop](https://developer.mozilla.org/en-US/docs/Web/API/Window/stop) stops
resource loading, like the browser's Stop button. It does not pause all JavaScript
and cannot act as a safe suspend/resume transaction. A website also has timers,
focus/hover behavior and earlier listeners outside one captured event.

## Isolation is limited even with a duplicate

A duplicate is a separate document but normally shares the login/container and
server account. A request from the duplicate can update shared account state
that later appears in the original. Loading the duplicate can itself cause
requests before the control is activated. A different cookie container would
change the login context and may make the control unusable.

Therefore this proposal can isolate visible UI/navigation better in many cases;
it is not a server-side sandbox or guarantee of no original-account effects.

## Requirements before calling a later experiment credible

- An actual Firefox Developer Edition implementation, not only mocked tests.
- Explicit source/worker/gesture ownership and serialized state transitions.
- Bounded readiness and verified target matching before activation.
- No automatic second activation merely because no URL was observed.
- Tests for real anchors, SPA cards, JavaScript-only controls, delayed routes,
  forms, overlays, virtualized feeds, cross-origin frames and shadow roots.
- Trusted-input-dependent controls recorded as unsupported rather than claimed
  fixed by injecting into MAIN world.
- Correct accounting when the page opens its own tab, navigates through redirects
  or changes a subframe rather than the top-level document.
- Cleanup tests for disabled mode, tab closure, extension reload and late events.
- Two independent scores: intended destination successfully shown in a new tab,
  and original-page disturbance. Opening success is the first priority.
- Honest reporting when a worker is merely a copy of the starting page or the
  intended result cannot be verified.

