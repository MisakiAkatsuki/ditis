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

## Limits

- macOS AE integration requires exactly one running AE application. The bridge
  selects its bundle dynamically and does not require Accessibility permissions.
- AE automation and Mac hardware checks remain pending until run on a Mac with AE.
- Signing/notarization and distribution are outside this PR.
