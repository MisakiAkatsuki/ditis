# macOS validation

This PR adds macOS menu accelerators, Finder file opening, and AE scripting via
JavaScript for Automation. It does not publish a release.

## Automated checks

- `npm ci && npm run test:run`: existing tests plus real keyboard-handler,
  file-listener ordering and AE bridge regression tests.
- `node tools/basic-smoke.mjs`: Chromium exercises the actual app UI: input,
  range selection, Command-click, copy/paste/cut/delete, Undo/Redo, save/load
  in DiTiS/STS/TDTS/XDTS formats,
  new sheets, tabs, closing, print layout and help. Native IPC and file dialogs
  are mocked. Set `CHROME_PATH` if Chrome is installed in a different location.
- PR CI compiles the Tauri application for Apple Silicon and Intel without
  bundling, signing, creating tags or uploading releases.
- Windows CI runs the same basic-operation expectations through `tauri-driver`
  in the compiled app's WebView2, using Control instead of Command. File-dialog
  selection, confirmation and printing are bypassed, but file save/load uses
  the real Rust backend and a temporary Unicode path on disk. AE is not
  installed on the CI runner, so Windows AE integration requires a manual check.
  The job then builds the PR's base commit and runs those same expectations to
  compare existing Windows behavior with this PR.
  Windows UI checks run at medium integrity, following Tauri's E2E workflow,
  because current WebView2 ignores driver arguments in elevated CI processes.
  To exercise Control shortcuts in the Chromium harness as well, run
  `SMOKE_MODIFIER=Control node tools/basic-smoke.mjs` (bash).

## Mac hardware checklist

These checks must be performed on macOS; Chromium and compilation cannot verify
WKWebView, Finder, native menus, printing or Apple Events permissions.

1. Install Node.js 22+, Rust and the Xcode command line tools. Run `npm ci`,
   `npm run sync`, then `npm run tauri:dev`.
2. Verify the menu bar has separate DiTiS, File, Edit, Sheet, View and Help
   menus. Change language and confirm the structure and shortcuts persist.
   Check About, Hide (`Cmd+H`) and Quit (`Cmd+Q`).
3. Create a sheet (`Cmd+N`), enter numbers, extend a range with Shift-click,
   toggle cells with Command-click, and navigate with arrows and Enter.
4. Copy, paste, cut and delete cells. Undo with `Cmd+Z` and redo with
   `Cmd+Shift+Z`. Check input fields in dialogs also accept typing and paste.
5. Save and Save As (`Cmd+S`, `Cmd+Shift+S`), using a path with spaces and
   Japanese characters. Close and reopen it and compare the cells, FPS, duration
   and layer names. Also test STS, XDTS and TDTS with representative files.
6. Create and switch tabs, close one sheet, and close all sheets. Check help,
   themes, settings, resizing/scrolling and the native print dialog (`Cmd+P`).
7. For Finder associations, build a local app with
   `npm run tauri:build -- --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'`.
   Open `.ditis`, `.sts`, `.tdts` and `.xdts` files with it, both with the app
   stopped and already running. Open multiple files at once. Verify no file is
   lost or loaded twice. This local build does not publish anything.
8. Start one AE version and select a composition. Allow DiTiS to control AE
   when macOS prompts for Automation access. Enable AE's “Allow Scripts To
   Write Files And Access Network”. Send a small sheet with `Cmd+E`, inspect
   the layer time remap keys, then import selected layers with `Cmd+I` and
   compare frame values. Repeat with a large sheet and Unicode/spaces in paths.
9. Check AE error handling: AE stopped, two AE versions running, Automation
   permission denied, no composition/layers selected. No new AE instance should
   be launched. The Windows multi-instance setting has no effect on macOS.

## Mac hardware results (2026-10-13)

Tested on Apple Silicon, macOS 26.7 (25G229), After Effects 2026, with the
application changes from PR #4 at `95cce4b` plus the AE fixes in this branch.
The subsequent PR updates through `f61003a` only change CI, smoke tests and this
document; the native application sources are unchanged.

- The debug `.app` builds and launches. On this machine, the installed CLT
  linker rejects the default macOS 27 SDK, so the build uses
  `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`.
- Native Command+O loads a `.ditis` file from a path containing Japanese text
  and spaces. Number entry, Command+Z, Command+Shift+Z, Command+C and Command+V
  work in WKWebView. Native Save As writes data matching the imported fixture.
- Finder opens STS, TDTS and XDTS into the already-running app, adding one tab
  per file. These checks do not cover cold launch or simultaneous files.
- The original `DoScriptFile` bridge stalls and eventually returns Apple Event
  error `-1712` on this AE version. Running `$.evalFile(quotedPath)` through
  `DoScript` opens the AE apply dialog and completes both send and receive.
  Paths remain data: quotation marks, backslashes, Unicode and line separators
  are escaped before being embedded in the ExtendScript expression.
- Native Command+E/Command+I round trips pass at 24 fps and 30 fps using two
  precomposition layers with repeated cel numbers, empty cells and Japanese
  layer names. The empty-cell option is **Time Remap (compositions only)**.
  After expanding hold dashes and padding trailing blanks, all 48 + 60 cells,
  frame counts, frame rates and the two layer names match. AE's time-remap
  property samples independently match all 108 expected values within 1e-6 s.
- With AE fully stopped, both send and receive show the detailed start-AE
  warning without launching AE. Sending with no active composition shows AE's
  own notification; dismissing it lets the application continue.
- The full Vitest suite passes: 355 passed, 7 existing skipped. Error regression
  tests execute the actual send/receive functions and verify that actionable
  backend details reach the dialog instead of becoming “AE not found”.

Remaining hardware checks include cold/batch Finder opening, the other UI
checklist items, large AE sheets, denied Automation permission, multiple running
AE versions and Intel hardware. The above results are not a claim that every
checklist item or every AE version has passed.

The existing **Blinds** empty-cell mode applies successfully, but the importer
reads time-remap values without reading the Blinds effect. Empty cells therefore
do not round trip in that mode. This is separate from the macOS bridge fix.

Follow-up: when sending immediately during AE shutdown, AE was detected before
it exited and the Apple Event relaunched it once. The fully-stopped case above
passes. Reproduce the shutdown race and avoid launching a replacement process
after selecting the original running instance.

## Limits

- macOS AE integration requires exactly one running AE application. The bridge
  selects its bundle dynamically and does not require Accessibility permissions.
- Hardware results and remaining cases are listed above; CI compilation alone
  does not verify AE automation or native behavior.
- Signing/notarization and distribution are outside this PR.
