# Reproduce the 2.0.2 public package

Requirements: Windows, macOS or Linux; Node.js 18 or newer. Install Node.js using the official installer or distribution instructions at https://nodejs.org/en/download, then verify `node --version`. No npm packages, network access, compiler, minifier or bundler are needed for the build.

1. Extract this source archive into an empty directory.
2. Open a terminal in that directory.
3. Run `node tools/build.cjs`.
4. The submitted public package is `dist/force-new-tab-2.0.2-ship-unsigned.xpi`. Its unpacked contents are in `dist/ship`.

The script copies runtime JavaScript verbatim, assembles the manifest and changelog HTML, and creates deterministic ZIP/XPI archives. It also produces a separate diagnostic testing build. Only the `ship` XPI is submitted for public distribution; diagnostic scripts and the report UI are excluded from it.

For automated validation, run `node testing/tests/run.cjs`. This rebuilds both packages and runs the shared regression suites, diagnostic checks and the parity audit. Tests simulate extension APIs; they do not establish universal website compatibility.

The source archive includes historical test fixtures and testing-only sources for reproducibility. These are not included in the public XPI. No credentials or remote services are required to build or run the automated suites.
