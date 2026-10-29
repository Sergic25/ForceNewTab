# Historical verification

Earlier build results follow. Current results are in the root TEST-RESULTS.md.



# 4.2.5 passive tab switching and fallback priority

The user confirmed that 4.2.4 ordinary middle-click worked for the tested Questrade control after a wait and for the tested Bluesky login/signup controls. Selecting the copy too soon still cancelled preparation. This revision separates passive viewing from actual page input; the new behavior still needs a live Firefox retest.

Changes are confined to the copy modules and their tests, current help and build metadata. Selecting a tab or changing focus no longer invalidates preparation. Trusted pointer/typing input in the worker clears its prepared target synchronously and notifies the authenticated background operation. Tab-navigation keys and pure modifiers are excluded. Input before the first ready response is remembered, including while the document loads. A used nonce takes precedence over later negative replies, settings or URL changes, preventing source replay after possible activation. The background rechecks interaction after asynchronous cleanup lookup and retains an interacted copy. Other source/copy context, navigation, option and at-most-once checks remain.

Fallback order is tested with the actual resolver, app-data reader, source hook and core: ordinary known routes and a current React-owned stored address open directly without creating a copy or activating the source. An unresolved control alone reaches the optional copy. The original core's focus guard remains unchanged and suppresses source fallback after a tab switch if copying later fails; it does not stop a pending copy.

All 20 packaged suites pass with mocked browser/DOM objects. Focus-specific coverage includes 55 isolation-content checks, 70 isolation-background checks, 35 combined source/core checks and 27 shadow-flow checks. These counts overlap compatibility coverage elsewhere and are not a distinct end-to-end case total. Native Firefox tab restoration, live hydration and website behavior remain manual checks. The older standalone outcome-observer behavior test gap remains documented and was not retried.

Unchanged core/resolution modules and all four fist icons are byte-compared against 4.2.4 during packaging. No hostname rule, new permission or default-setting change is introduced. The copy preference remains saved and OFF for a fresh install.

## Historical verification

# 4.2.4 ordinary middle-click entry

The user confirmed4.2.3 succeeded on the reported Questrade New account button after about10seconds. The earlier cancelled result was caused by selecting the copy while preparation was still underway; statuscopy-used/activatedfalse matched that user confirmation. This verifies that specific live control under the Shift-based4.2.3 test, not all websites or the new ordinary-click entry.

This revision removes the Shift-required source gate only. The existing feature setting remains saved and defaultsOFF for fresh installations. Known destinations bypass isolation, while eligible unresolved controls now use the copy with ordinary middle-click whenenabled. Source/core, locator, worker protocol, context checks, timeouts, cancellation and at-most-once behavior are otherwise retained. No hostname rules or permissions were added.

All20 packaged suites pass. Isolation-content42checks cover ordinary,false/missingmodifier metadata, preferencechanges, knownroutebypass, exclusions andworkerinterop. Combined core/source28checks andopen-shadow21checks cover plainmiddlecopying, optionOFFlegacyfallback, knownplainfastpaths, no extra copy onduplicateauxclick, and one copied nativeactivation. Prior Shift/cancellation tests remain because Shift is still accepted but no longer required. UIchecks verify updatedwording andsavedstate. Existing originalcore/discovery/resolver/compatibility suites remain.

Automated checks use mocked DOM/browser objects;4.2.4 ordinarymiddle needs a real Firefox retest. The older standalone outcome-observer behavior gap remains documented and was not retried. The prior live Questrade result is recorded as user-confirmed, not as native automation performed here.

## Historical verification

# 4.2.3 SPA request-validation correction

The supplied 4.2.2 report confirms Shift, enabled settings, and successful source matching through two open shadow roots. It ended after a second middle press at1563ms, with no recorded core discovery or saved isolation result. It does not establish whether the copy hook was reached.

Independent source review found a concrete false rejection: the background required MessageSender.url to equal the current beforeURL exactly. Firefox's ConduitsParent.fillInAddress assigns the messenger URL at conduit opening, and ExtensionParent.getSender copies that stored URL. A same-document SPA route change can therefore leave sender metadata on an earlier path while location.href and the fresh tabs.get URL arecurrent. The old guard rejected this before status persistence.

The revised background retains own extension/frame0/tab/window authentication. HTTP(S) sender URL and optionalsenderorigin mustmatch the requested origin, including scheme andport. The separate fresh source URL muststillmatch beforeURL exactly, includingquery/hash, before duplication andactivation; container/incognito/window checks remain. No senderpath/query/hash is usedascurrent-route proof.

All20 packaged suites pass in simulated DOM/browser environments. Background57checks include47 retained and10new cases for historical same-origin sender routes, exactlive-address checks, conflictingorigin metadata, crossprotocol/port andopaqueorigin rejection, fixedsafe rejectionreasons andbuild/version metadata. Recording adds two copy-request observer checks, one mixed-version snapshot check and one rejected-status UI check. The underlying core, source gesture, locator, discovery, appdata andicons arebyte-identical to4.2.2.

The new request observer returnsundefined so it cannot consume the actual response. It records request categories only, without copying target labels or source URLs. Authenticated rejectionstatus savesfixedreason/build/version andmatchboolean; foreignsender failures donotwrite status. The previous outcome-observer standalone behavioral test gap remains and was not retried.

The exact Questradecause andsuccessful nativeFirefoxcopy remain unverified. No gesture-release, blur or ordinary-navigation behavior was changed in this revision.

Primary Firefox source checkedOctober25,2026:
- https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/extensions/ConduitsParent.sys.mjs (fillInAddress andrecvConduitOpened)
- https://raw.githubusercontent.com/mozilla-firefox/firefox/main/toolkit/components/extensions/ExtensionParent.sys.mjs (getSender)

## Historical verification

# 4.2.2 open-component copy matching and decline reporting

The 4.2.1 report established a held Shift modifier, module availability, enabled toolbar/experiment and top-level frame. Original source discovery armed at79ms, captured a destination at104ms and a related tab appeared at169ms. Thus the legacy path still ran. No copy result was included; this favors source preflight rejection but does not prove exactly which check failed. Open shadow-root exclusion was a concrete unsupported structure in the old locator, not a confirmed Questrade diagnosis.

The copy locator now supports bounded accessible open shadow roots via a version2 descriptor. Version1 light-DOM descriptors are preserved. Each host is uniquely matched in its recorded parent scope using generic tag/stable attributes/custom ancestry; the final control must match uniquely in the selected root. Host chain and control are rechecked, forms/editing/hidden/disabled boundaries are honored across hosts, and closed/inaccessible or ambiguous roots reject. Limits remain2000 candidates perquery,8000 aggregate,8 shadowlevels and4000 descriptorcharacters. No website host, fixed route or site-specific component name is present in loaded runtime code.

All20 packaged suites pass in mocked browser/DOM environments. Locator50 checks include32 retained plus18 shadow/audit cases. New combined shadow flow18 checks load real locator,resolver,source andcore with distinct document/shadow queries, then prepare/execute in a separate copied-page VM. They verify source isolation, one copied activation, unrelated-root identity, changed/ambiguous hosts, closed roots and outer form/inert guards. Content38 andbackground47 checks cover authenticated label-free decline status,exception containment andnonce-failure status. Diagnostic58/UI19 checks cover audit privacy and display. Existing normal,Shift andcompatibility replays remain intact.

Core content.js,resolver,React app-data reader,discovery andnormalbackground modules are byte-identical to4.2.1, as are the fist icons. New lookup andstatus handling are confined to the optional copy path and explicit recording. Source preflight decline still uses the previously documented original fallback; the new status identifies that event.

The new request cap7000 accommodates a descriptor plus bounded original URL andmetadata. Decline reasons arefixedenumerated identifiers; no labels, hostattribute values, source URLs, nonces, form data or error text are saved in status/audit. Background context validation andsingleactivation semantics remain.

No native Firefox/Questrade success is claimed. The old standalone outcome-observer behavior test gap remains documented and was not retried here. Official DOM reference: https://developer.mozilla.org/en-US/docs/Web/API/Element/shadowRoot and https://developer.mozilla.org/en-US/docs/Web/API/Node/getRootNode .

## Historical verification

# 4.2.1 Shift gesture correction

The supplied 4.2.0 report ended its content observation as new-input after 6ms. It contained neither source-discovery events nor a last-isolation status. The report did not identify the ending event, actual modifier flags or source mode; it therefore does not prove a specific cause. Static review did establish that all three input handlers treated Shift as a cancellation key, and that copy selection depended only on the modifier remaining set at auxclick.

This revision scopes Shift preservation to the enabled experiment and unresolved held gesture or pending copy. It latches Shift intent at press/compatible mouse-down or trusted Shift key-down. Releasing Shift before the mouse no longer loses the isolation request. Ordinary typing, Escape, other modifiers, new pointer input, blur and source navigation retain cancellation. OFF mode, ordinary middle-click and known routes keep the prior paths. No website-specific rule, permission or destination is added.

All 19 packaged suites pass. Added coverage uses the actual core, resolver and isolation source together, with ordered multiple listeners and stopImmediatePropagation. Its 24 combined checks cover Shift before/during press, early modifier release, repeated modifier events during preparation, one copy request, no source activation, definite fallback, and retained cancellation for other input. Isolation-content has 33 checks; diagnostic snapshots have 56; background reporting has 27. Existing compatibility replays and original archived fixtures remain intact.

The record adds boolean modifier and mode flags plus a bounded ending-input category. Typed characters, form values and raw key strings are not stored. The older standalone outcome-observer behavior test execution remained blocked by automatic approval review and was not retried; the small observer modifier filter has syntax/static review and background schema tests, while actual native event timing remains unverified.

These are mocked DOM/browser tests, not a native Firefox/Questrade success. The black-source problem is still only addressed by the optional copy strategy, whose live operation needs the next test.

## Historical verification

# 4.2.0 isolated-copy experiment verification

This build adds a separate, off-by-default Shift + middle-click experiment. A known resolved destination bypasses it; ordinary middle-click uses the existing fallback. No website hostnames, guessed account URLs, route templates, new permissions or icon changes are added. No real Questrade result is claimed yet.

All 18 packaged suites pass in simulated DOM/browser environments. Retained baseline suites still run. New coverage includes 32 locator cases, 28 source/worker cases, 41 background-operation cases and 19 new hook integrations plus 32 unchanged compatibility replays. Preferences adds two UI checks and one authenticated control-message check. Hidden/inert and non-rendered matching targets are excluded; layout checks run only after identity matching.

SHA-256 comparisons preserve resolver.js, component-link.js, app-data.js, discovery.js, background.js and all four fist icons byte for byte from 4.1.4. content.js differs only by the explicit guarded hook at the existing unknown-control branch. Removing that one marked hook reproduces the prior file byte for byte. Tests assert exact manifest wiring and permissions; archived original tests remain unchanged.

The new tests cover default OFF/plain-middle bypass, known destinations never reaching isolation, same-control source/copy fingerprints, ambiguity and form exclusions, stale input/URL/node/context cancellation, inactive duplication, document readiness/identity, source/container/private-window metadata, lost replies and late duplicate handling, bounded timeouts and cleanup, at-most-once activation, and no source replay after possible copied activation. They use mocks; actual native restoration, hydration, timing, copied authentication state and popup behavior are unverified.

A background copy is one new tab created by the extension. The website can create a further popup; the prototype keeps the activated copy because it may be an authentication opener. A duplicate is reconstructed browser session state, not a live JavaScript heap. Matching UI is not proof that every handler is ready. Shared account state can still affect other tabs. A definitive preparation failure can retain the previous source fallback; uncertain activation never authorizes that fallback.

The additional behavioral test run for the older 4.1.4 outcome-trace observer remained blocked by automatic approval review. It was not retried as part of this feature. The new isolation path has separate executable tests and status reporting; this does not retroactively close that older verification gap.

Official APIs checked October 25, 2026:
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/duplicate
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/sendMessage
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onUpdated

## Historical verification

# 4.1.4 button and outcome diagnostics

The 4.1.3 X report resolved the owned story address before activation, and the user confirmed successful opening/source preservation for that control. Questrade's report showed an unresolved button. The user subsequently confirmed a correct new tab plus a changed title/partly black source view with unchanged source URL. Exact source-rendering failure and navigation channel are still unproven.

This build gathers button-owned address evidence and up to nine seconds of passive outcome observation. It does not change destination-selection or source-activation rules. SHA-256 comparisons preserve resolver.js, component-link.js, app-data.js, content.js, discovery.js, background.js and all fist icons exactly from 4.1.3. No new permission or website-specific rule is added.

Packaged tests retain the 417 executed current checks (352 distinct plus 65 compatibility replays), add four diagnostic-wiring checks, one UI-status check, 29 button-evidence checks and 25 background-outcome checks: 476 executed current checks, plus four separate legacy fault reproductions, across 14 packaged suites. See the final runner output for pass/fail.

The new background checks verify sender/token/frame ownership, Record/Clear races, queued observation before initial storage resolves, core-message response preservation, bounded correlated events, redaction, terminal updates and expiry. Button checks cover wrapped objects, strict form/editing exclusions, ancestor bounds, getters, credentials, context-dependent routes and Angular type-only reporting.

Additional behavior checks for the new outcome-trace.js content observer could not run: automatic approval review rejected the shell execution as requiring approval, and sandbox approval is disabled in this session. No retry or alternate execution of those checks was performed. The observer's source received manual review and an earlier syntax check, but packaged suites do not establish its actual native NavigateEvent ordering or final-summary delivery. This is an explicit verification gap, not a claim of full test coverage.

All executed tests simulate DOM/browser/page objects. 4.1.4 still needs the user's live Firefox report. Background events are correlation evidence only. Source unload, browser suspension or a rapid new user input may shorten or prevent the final observation. An absence of captured evidence does not prove no internal destination exists.

## Historical verification

# 4.1.3 typed anchorless compatibility

All twelve suites pass: 352 distinct current checks and 65 unchanged compatibility
replays (417 current checks executed), plus 4 separate legacy fault reproductions.
Counts: 154 retained baseline; 49 diagnostics; 15 Preferences UI; 19 DOM inspection;
42 app-data; 48 component-link; 25 distinct app-data integration cases. The original
33 resolver and 32 real-module integration cases are replayed with app data ON.

The actual 4.1.2 report passed the current-tree proof at depth 226, found one
current branch and verified the first owned component. It then returned
route-context-required for link keys anchorless and pathname. Limits and ownership
were no longer the blocker. The report did not include the flag's type or value.

This patch permits only an own literal boolean anchorless property, treating
null/undefined as absent. It contributes no URL data. The pathname and supported
search/hash/query-string fields continue to provide the entire address. Invalid
flag types, getters, unrelated unknown fields, named/parameterized routes, query
objects, incomplete or conflicting addresses still reject. Flag types are included
in redacted diagnostic summaries; raw metadata values are not copied.

No primary public source was found establishing X's exact anchorless semantics.
The flag's apparent display purpose is an inference, not a verified contract.
The implementation is therefore a narrow opt-in compatibility experiment, not a
claim that arbitrary boolean metadata can safely be ignored. Native Firefox
verification must check both the actual destination and source-page behavior.

New unit cases cover true/false/null/undefined, full URL part preservation,
invalid values and coercion, getter noninvocation, unrelated boolean rejection,
missing pathname, unsupported queries and URL conflicts. Real-module fixtures
reconstruct the reported depth 226, five agreeing owned link objects and unset
host href. With a literal flag they open one background tab without activating
the source. Invalid metadata keeps one original discovery activation.

All currentness, parent/child membership, current host identity, root.current,
rendered ownership, traversal budgets and full-path form/editing/disabled guards
are unchanged. The four baseline navigation modules and fist icons are byte-
identical to the previous build. Permissions are unchanged. No site hostname,
story ID conversion, title lookup or fixed destination was added. The experiment
still defaults OFF and existing successful destinations bypass it.

Tests simulate Firefox page objects and browser events; no real signed-in X
success is claimed. The next report should have diagnosticVersion 4.1.3 and can
show whether the observed option is boolean or needs further investigation.

## Historical 4.1.2 verification

All twelve suites pass: 342 distinct current checks and 65 compatibility replays
(407 current checks executed), plus 4 separate legacy fault reproductions.
Counts: 154 retained baseline; 49 diagnostics; 15 Preferences UI; 19 DOM inspection;
42 app-data; 41 component-link; 22 distinct app-data integration cases. The 33
original resolver and 32 original real-module integration cases are replayed
unchanged with the app-data option ON.

The real 4.1.1 report identified status current-path-limit, hostCandidates 2,
currentCandidates 0, membershipChecks 142, ownershipChecks 0 and limited true.
That places the failure in the 128-node upward current-tree proof, before rendered
ownership or URL parsing. The stored link.pathname destination was still present
in the evidence. The report does not establish that all other checks will pass.

This patch raises only the upward proof depth to 1024 and aggregate parent/child
membership budget to 8192. Current host identity, every tree-membership edge,
root.current, unique current branch, same-control rendered ownership, component
scope, structured URL parsing and conflict checks remain enforced. Component scope
is still 24; local/aggregate ownership traversal remains 128/512. A stale branch's
errors or limits continue to reject ambiguous proof rather than being ignored.

The report now includes configured limits, the maximum inspected path depth and
per-candidate proof depth/result. These are counters/booleans only, without page
text, identifier values or new private data. The existing report size cap applies.

New fixtures put 300/900 non-navigation ancestors above the nearest outside DOM
host, preserving the actual narrow navigation scope. They verify direct single
background opening without activating the source, current/stale selection, and
wrong-root rejection. An 1100-level tree stops at 1024 and retains one fallback
activation. Wide sibling scans remain bounded by the 8192 membership budget.
Other ownership, query, action, form and existing positive/negative cases pass.

No hostname, site route, title matcher or ID-derived URL was added. The four
baseline navigation modules, four fist icons and permissions remain unchanged.
The optional app-data setting still defaults OFF. Already resolved destinations
bypass private reads. Reflection-count bounds cannot guarantee execution time for
hostile Proxy traps; the earlier experimental limitations remain applicable.

This corrects the bounded traversal failure shown by the supplied report. It is
not a claim of live Firefox success. All automated tests simulate DOM/browser
and Firefox object wrappers. A fresh actual-card test with diagnosticVersion
4.1.2 is required to determine whether another guard needs investigation.

## Historical 4.1.1 verification

All twelve suites pass: 336 distinct current checks plus 65 unchanged compatibility
replays (401 executed current checks). Four legacy fault reproductions pass
separately. Counts: 154 retained baseline checks; 49 diagnostics; 15 Preferences UI;
19 DOM inspection; 42 app-data; 38 component-link; 19 distinct app-data integration
cases. The integration adapter additionally replays all 33 original generic
resolver and 32 original real-module integration checks with the option ON.

The supplied 4.1.0 report established a pre-click stored destination in repeated
props.link.pathname fields on the clicked card's React component chain. The host
href existed but was not a literal address. The earlier reader intentionally
reported parent addresses as evidence only, so it retained source activation.
The visible view/title update while the source URL remains unchanged is consistent
with that activation updating app state while the Navigation API cancels the
address commit. This static report does not establish exact render timing or the
cause of Firefox's persistent loading indicator.

The new generic rule reads an explicit component link configuration. It verifies
an exact host fiber and current host props, every parent/child membership edge up
to HostRoot, and root.current. It checks the alternate branch when necessary and
rejects ambiguous currentness. Within the nearest DOM-host boundary, a component
must render only the clicked control as its root. Extra element/text roots,
portals, incomplete traversal and stale or inconsistent graphs fall back.

All accepted owned link configurations must agree on the full HTTP(S) destination.
The parser reads the whole structured link, preserving literal search/hash and
supported query strings. Query objects, named/parameterized routes, unknown fields,
getters, conflicting/embedded route parts and unsafe/template addresses are
rejected instead of shortened or guessed. Non-URL history state is not copied,
matching the existing address-only new-tab behavior. Host href/to null or undefined
is absent; other invalid values retain rejection precedence.

New module tests cover the supplied shape with unset host href, unrelated hosts
and route paths, current/stale alternates, root changes during reflection, broken
membership, mismatched current props, sibling/portal/text roots, conflicts,
query/hash preservation, unsupported queries, getters/Proxy failures, cycles,
traversal budgets and redaction. Real-module tests open one background tab without
activating the source control in the positive fixture. They also cover recycled
controls between press/release and full-path form exclusions. Disconnected or
adopted controls are now explicitly rejected before private-data access.

The four baseline navigation modules and four fist icons remain byte-identical to
4.1.0/4.0.0. The optional app-data setting still starts off. Existing successful
DOM/image results and direct host-property routes retain precedence. No hostname,
headline, fixed destination or story-ID route construction was added. Permissions
are unchanged. Reflection may still invoke Proxy traps; no absolute arbitrary-page
no-execution/no-regression guarantee is claimed.

This is a tested implementation of a route pattern observed in the real report,
not a verified native Firefox result. All automated tests simulate DOM/browser
and Firefox object wrappers. The actual X card requires a fresh Firefox retest
with diagnosticVersion 4.1.1. No browser policy was bypassed for verification.

Current-tree verification follows independent bounded membership checks informed
by React's documented source rather than calling any React/page functions:
https://raw.githubusercontent.com/facebook/react/main/packages/react-reconciler/src/ReactFiberTreeReflection.js
https://raw.githubusercontent.com/facebook/react/main/packages/react-reconciler/src/ReactWorkTags.js

## Historical 4.1.0 verification

All eleven suites pass. The count is 285 distinct current checks plus 65
compatibility replays (350 executed checks), with 4 legacy fault reproductions
reported separately. Breakdown: 154 retained core/discovery/resolver/integration/
migration checks; 49 diagnostic checks; 15 Preferences UI checks; 19 DOM inspection
checks; 40 app-data checks; 8 new real-module integration cases. The 33 original
resolver and 32 original integration cases are also replayed unchanged with the
app-data option ON. The replay adapter asserts exact harness insertion points
and does not rewrite the source test files.

The four baseline navigation files (resolver.js, content.js, discovery.js,
background.js) and all four fist icon files are byte-identical to 4.0.2/4.0.0.
A separate app-data.js module wraps the isolated resolver only. Its option starts
off; an existing resolved destination bypasses all private-object access. No
website host checks, fixed provider routes, title-to-address maps or ID-to-route
construction were added. Permissions remain unchanged.

Automatic inspection is restricted to an unresolved explicit role=link owner
with zero ordinary anchors and no explicit href/data-href/data-url on its event
path. Full-path forms, editing/disabled states and submit/reset buttons remain
excluded; nested actions cannot become parent-card destinations. It accepts one
literal rooted/web href/to on the exact element's current React host props.
Unsupported, conflicting, accessor-based, templated or incomplete host routes
retain the original fallback. Press/release/auxclick use the existing repeated
resolution checks, including virtualized controls whose destination changes.
Automatic routing does not traverse fiber, Vue or nested data.

An explicitly requested recording can inspect bounded nearby framework data as
evidence. React fiber ancestors stop before the next DOM host; stale alternates
and ancestor addresses never supply an automatic route. Vue data is evidence
only. Recorded navigation candidates are redacted; ID values, titles, cookie or
form contents and function source are not copied. Incomplete/depth-limited reads
are explicit. Some framework production builds use inaccessible WeakMaps or omit
DOM attachments; absent markers are reported as unavailable, not proof that the
page has no internal destination.

Own-property descriptors intentionally skip getters and the code never calls
click handlers/router methods. Reflection on Proxy objects can nevertheless run
page traps. The option is experimental and off by default; there is no absolute
no-execution/no-regression promise for arbitrary private page objects.

No live signed-in X or native Firefox/Xray success is claimed. The available
browser tool rejected the local-file preview under its URL policy; no alternate
browser or protocol was used to bypass it. Tests simulate Firefox page objects
and browser APIs. The remaining verification is a report from the actual X card.
A successful synthetic fixture is not presented as a verified fix for X.

Primary implementation references (reviewed October 25, 2026):
- Mozilla page-object access and its trust boundary:
  https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts
- React current DOM props/fiber attachments and optional WeakMaps:
  https://raw.githubusercontent.com/facebook/react/main/packages/react-dom-bindings/src/client/ReactDOMComponentTree.js
- Vue's conditional DOM vnode/component attachments:
  https://raw.githubusercontent.com/vuejs/core/main/packages/runtime-core/src/renderer.ts

## Historical 4.0.2 verification

228 current checks pass: 154 retained navigation/resolver/migration checks,
45 diagnostic checks, 10 report UI checks and 19 detailed inspection checks.
Four legacy fault reproductions pass separately. Run all nine suites with
node tests/run.cjs. All tests simulate DOM/browser APIs; no native Firefox
integration success is claimed.

Navigation modules (resolver.js, content.js, discovery.js, background.js),
the background report receiver, the report UI and all four fist icons remain
byte-identical to 4.0.1. The four navigation modules also match 4.0.0 exactly.
No permission change or website-specific routing rule was added.

The prior report identified a role=link owner but no known destination. Its
60-node descendant sample was incomplete. The actual navigation resolver already
queries the full nearest semantic component for owned anchor links, so increasing
that reporting sample is not a routing fix. An unresolved result can also arise
from ambiguity, exclusions or unusable metadata. The prior report did not say
which condition applied.

The new optional inspection provides total anchor counts, up to 200 inspected
anchors, bounded redacted samples, ownership/ambiguity counts, generic exclusion
flags and the target of up to four aria-labelledby references. It explicitly
marks partial scans and read errors. These are evidence summaries, not a new
route selector. It does not inspect private framework objects, page text,
handler code or form values. Reports remain local unless the user copies them.

The diagnostic resolution now receives the complete browser event path, matching
the actual core call. Only the displayed ancestor preview is capped at 20 nodes.
This corrects a reporting discrepancy for unusually deep controls without
changing click behavior. Reports identify diagnosticVersion 4.0.2.

New cases cover decorative cards exceeding 60 nodes with zero anchors, an anchor
beyond the old sample, ambiguous destinations, owned/nested links, label-contained
and label-enclosing anchors, exclusions, URL redaction, read exceptions, the 200
anchor/20 timestamp limits and the 8000-character inspection-output limit.
The complete report remains within its existing 22000-character receiver limit.

No X source-page-change fix is claimed. The next report is needed to establish
whether a safe DOM-based generic destination rule is available for this control.
Existing generic navigation fallback can still execute page rendering code.

## Historical 4.0.1 verification

206 current checks pass: 154 retained navigation/resolver/migration checks,
42 new diagnostic checks and 10 report UI checks. Four legacy fault reproductions
pass separately. Run all eight suites with node tests/run.cjs.

This release adds observation and local reporting only. SHA-256 checks confirm
resolver.js, content.js, discovery.js, background.js and all four fist icons
are byte-identical to 4.0.0. Existing permissions and options-page wiring remain;
three additional scripts provide the report feature. The manifest version is 4.0.1.

Recorder checks cover default-off and two-minute expiry, trusted middle-click
only, pointer/mouse one-shot capture, passive listeners without click mutation,
redaction of credentials/queries/fragments, private field nonreads, bounded
ancestor/descendant inspection, throwing getters, stale storage reads, serialized
frame acceptance and Record/Clear commands, sender validation, report-size limits,
and failed storage/messaging. UI checks cover preview, copy fallback and expiry.

The report stays in browser.storage.local until cleared/replaced. It contains
URL paths and limited element relationship IDs, which may identify content.
No automatic upload, telemetry, full page text, form values or handler code.

No X navigation fix is claimed. The supplied inner story HTML exposes no route;
the optional report is intended to inspect the complete clicked ancestor path.
User reported that the 4.0.0 Bluesky and Spotify behavior was working. This does
not substitute for a live Firefox retest of the diagnostic build. Automated tests
use mocked browser and DOM APIs; no native Firefox integration result is claimed.

Messaging implementation follows Mozilla's documented sender metadata and
conditional Promise responses:
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/MessageSender
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage

## Historical 4.0.0 verification

3.0.3 is retained unchanged.4.0.0 is the generic migration candidate.

Current passing suites:61core +23discovery +33genericresolver +32integrated
real-module simulations +5migration audits =154 current checks.
The four original-v1.3 fault reproductions pass separately.

Preserved positive cases include original/rehosted/renamed post images, image
overlays, comment/post cards, artwork-to-title links and unknown account controls.
There are no loaded-runtime provider domains, custom IDs or fixed destinations.

Not claimed: all135 old assertions remain unchanged. Provider-host exclusions,
route/test-ID recognition, raw images forced into discovery and fixed auth lookup
were the old policy and were intentionally superseded. Their files remain exact
archived copies for review.

Not claimed: native Firefox integration passed. The native test-browser attempt
could not reach its localhost fixture. The Navigation API mechanism is grounded
in current Mozilla/spec documentation and simulated integrated tests; it still
requires a focused Firefox retest.

Minimum Firefox is147, up from140. Installed Developer Edition159 meets it.
Known control handlers may execute before native navigation cancellation, so
arbitrary earlier UI/network effects cannot be excluded. Source URL cancellation
is best effort. Opening the intended destination remains the first priority.

