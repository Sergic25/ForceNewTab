# Load the latest testing version

Version 2.0.2 testing instructions. The clean public package was submitted to Mozilla on November 16, 2026. GitHub packages are unsigned.

1. Open `about:debugging` in Firefox, then **This Firefox → Load Temporary Add-on**.
2. Choose **dist/testing/manifest.json** in this folder. The name is **Force New Tab — Testing**.
3. Reload the pages you want to test.

This includes the card-whitespace fix, the restored optional click recorder and minor code cleanup. Middle-click handling, popup eligibility, fallback order, toolbar scope and navigation timeouts remain as in the previous testing build. No keyboard or mouse remapping has been added.

## Record a problem

Open **about:addons → Force New Tab — Testing → Preferences**. The Preferences page contains **Record a problem**. Choose **Record next middle-click**, return to the page and middle-click the problem area once. Wait about 10 seconds; if a background copy is still preparing, let it finish. Return to Preferences, review the report and choose **Copy report**. **Clear report** removes the recorded report and stops pending recording.

Recording is off by default and expires after two minutes if unused. The copy status is the most recent copy operation across tabs, not necessarily proof of the recorded click's result. Reports stay local and are not automatically uploaded. Address paths and page relationship IDs can still identify private content; review before sharing.

Version 2.0.2 was already used by the preceding local test. The What's New page may therefore not open automatically again: use Preferences explicitly.

## Testing and shipping from the same source

- `dist/testing/` and `dist/force-new-tab-2.0.2-testing-unsigned.xpi`: diagnostic testing build.
- `dist/ship/` and `dist/force-new-tab-2.0.2-ship-unsigned.xpi`: clean shipping candidate, with identical navigation JavaScript and no recorder files or UI.
- `dist/force-new-tab-2.0.2-source.zip`: shared source, diagnostic sources, build script and tests.
- `dist/SHA256SUMS.txt`: package checksums.

Run `node testing/tests/run.cjs` to rebuild and check both variants. Edit the shared root sources and `testing/` sources, not generated files in `dist/`. The build uses only Node.js built-in modules, with no dependency installation. The two variants have the same extension ID and should be used one at a time. The root manifest is the shipping source; select `dist/testing/manifest.json` for diagnostics.

The clean shipping package was submitted to Mozilla; publication was pending at submission. Temporary installation ends when Firefox restarts. Firefox 147 or newer is required. The maintainer reported no issues during testing. Automated checks are not a guarantee against all regressions.
