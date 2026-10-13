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
- PR CI compiles Apple Silicon and Intel in one macOS job; the Windows job
  runs unit tests and native UI comparisons. Stale runs are cancelled, and
  documentation-only changes do not trigger CI. No bundles, signing, tags or
  releases are created. The Chromium harness above is also available locally.
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
document. The native text-field Undo/Redo update at `73dce24` is also merged,
rebuilt and checked separately below; it does not change the AE bridge.

- The debug `.app` builds and launches. On this machine, the installed CLT
  linker rejects the default macOS 27 SDK, so the build uses
  `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`.
- Native Command+O loads a `.ditis` file from a path containing Japanese text
  and spaces. Number entry, Command+Z, Command+Shift+Z, Command+C and Command+V
  work in WKWebView. Native Save As writes data matching the imported fixture.
- Finder opens STS, TDTS and XDTS into the already-running app, adding one tab
  per file. After rebuilding with `73dce24`, opening DiTiS, STS, TDTS and XDTS
  together from Finder while the app is stopped adds exactly four file tabs
  beside the default sheet, with no missing or duplicated file.
- The rebuilt app's new-sheet name field changes from `Sheet6` to `UndoCheck`,
  back to `Sheet6` with Command+Z and to `UndoCheck` with Command+Shift+Z.
  Command-click adds and removes a cell while retaining the initial selection;
  clicking a tab switches to that sheet and its file path.
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
- The full Vitest suite passes: 361 passed, 7 existing skipped. Error regression
  tests execute the actual send/receive functions and verify that actionable
  backend details reach the dialog instead of becoming “AE not found”.

Remaining hardware checks include denied Automation permission, multiple running
AE versions and Intel hardware. The above results are not a claim that every
checklist item or every AE version has passed.

The existing **Blinds** empty-cell mode applies successfully, but the importer
reads time-remap values without reading the Blinds effect. Empty cells therefore
do not round trip in that mode. This is separate from the macOS bridge fix.

### AE shutdown race follow-up (2026-10-13)

At PR #5 `67dcae4`, a bundle-path target could relaunch AE after the detected
instance exited. The follow-up bridge addresses `misc/dosc` (AE's DoScript)
directly to the detected process identifier with `NSAppleEventDescriptor`.
It never falls back to launching or looking up an application by bundle path.

- On the same Mac/AE environment, a temporary 10-second wait after creating the
  PID descriptor allowed AE to be quit before sending. Cmd+I returned a
  communication-error alert, AE stayed stopped, and DiTiS remained usable.
  The wait is removed from the committed source and the final build.
- An initial implementation read an NSError out-pointer through JXA. On send
  failure this crashed osascript in `JSOCRefPrototypeCreate` / `objc_retain`.
  The final bridge passes null for that optional pointer and explicitly checks
  the Objective-C nil reply. Transport failure gives an actionable, general
  error; the underlying NSError/OSStatus code is not available. Script errors
  returned in AE's reply retain their message and code. JXA's `-2700` wrapper
  must not be mistaken for the underlying transport error.
- The final rebuilt app again sent, applied, imported and saved the 30fps
  fixture. All 60 cells across the two fixture layers, FPS and frame count
  matched after hold expansion and blank padding. The importer also creates
  its usual 24 additional empty columns; this comparison does not require an
  identical total column count.
- Vitest: 363 passed, 7 existing skipped. Tests cover PID addressing, escaped
  paths, nil replies without launch/retry, and AE script error replies.

The earlier 24fps/108-property-sample results above belong to the prior bridge;
only the 30fps round trip was repeated for the final PID bridge. Automation
denial and multiple running AE versions still require hardware validation.
PR #4 advanced to `140cf13` with CI/documentation-only changes; its CI passed.
PR #5 `67dcae4` passed frontend and both Mac architecture jobs, but its Windows
smoke run 38302962055 failed at `tools/smoke-scenario.mjs:33` (expected `12`,
got `1`). This failure remains open and is not evidence of a Mac regression.

API references: Apple's [PID descriptor](https://developer.apple.com/documentation/foundation/nsappleeventdescriptor/init(processidentifier:)?language=objc)
and [event send](https://developer.apple.com/documentation/foundation/nsappleeventdescriptor/sendevent(options:timeout:)?language=objc).
Objective-C nil handling follows Apple's [JXA WWDC session](https://devstreaming-cdn.apple.com/videos/wwdc/2014/306xxjtg7uz13v0/306/306_javascript_for_automation.pdf).

### Native printing (2026-10-13)

At `04215b0`, Command+P showed the generic asynchronous-error toast instead of
the macOS print dialog. Web Inspector reported `webview.print not allowed` and
named the missing `core:webview:allow-print` permission. Adding that permission
to the existing main-window capability fixes the native command.

After rebuilding and restarting, Command+P opened the macOS print dialog with
one preview page containing the Japanese sheet title, two columns and all
30 frame rows. Cancel returned to the sheet. No printer was configured, so
physical paper output was not tested. The existing Chromium
smoke test mocks printing and could not detect this native permission failure.

At `d22b741`, the same native dialog also saved an A4 portrait PDF containing
the Japanese title, two columns and all 30 rows. Independent PDFium rendering
showed no missing text or clipping. Switching to English rebuilt the native
File/Edit/Sheet/View/Help menus; Command+O and Command+N worked, as did
Command+Z/Shift+Z in the new-sheet name field. Japanese was restored afterward.
The new-sheet dialog's Japanese body is an existing localization limitation.
CI run 38305320488 passed frontend, both Mac builds and Windows including the
existing-baseline comparison. That success does not establish the cause of
PR #5's earlier intermittent Windows input failure.

### Source-duration import follow-up (2026-10-13)

The large-sheet exercise exposed an incorrect boundary in the shared importer:
it compares time-remap values against the destination composition's duration,
although the exporter represents a blank with the source's duration. A 2-second
source in a 48-second comp therefore imports a blank as cel 61. Conversely, a
valid cel 60 from that source becomes blank in a 1-second destination comp.

The receive JSX now includes each layer's source duration, and the importer
uses that boundary independently for each layer. Legacy payloads without a
usable source duration retain the previous fallback. This change does not read
Blinds effect values or alter the separate Blinds-mode limitation.

- Executing the production JSX template and importer with mocked AE properties
  reproduced all three boundary failures before the fix. The regression suite
  covers longer/shorter destination comps, different layer source lengths,
  hold expansion, trailing blanks and legacy payloads.
- Full Vitest: 370 passed, 7 existing skipped. Apple Silicon debug app builds.
- On AE 2026, the 8-layer, 1,440-frame fixture sent and applied successfully
  using `d22b741`. Native receive/save with that same old process produced
  exactly 680 mismatches: every blank became cel 61.
- After verifying the old process had stopped and launching the rebuilt
  `7031b80` app (production code unchanged at `18f4b48`), native receive/save
  matched all 11,520 cells, including the 680 blanks. FPS and frame count also
  matched. Comparison maps unique layer names because AE returned H through A,
  expands hold marks and pads trailing blanks. The importer's 18 extra empty
  columns were checked separately; identical column order/count is not claimed.
- Independent AE property sampling matched all 11,520 expected values within
  1e-6 seconds (maximum error 5.564e-8 seconds), with 805 keys per layer. This
  validates the earlier `d22b741` send/apply; the fixed build was tested for
  receive/save against those same AE values.
- A separate 1-second, 30fps comp with 2-second and 4-second source layers
  imported valid cels 60 and 120 plus 20 blank cells correctly: all 60 cells
  matched after native receive/save. These keys were prepared directly in AE,
  so this is a receive-boundary test rather than another send round trip.
- CI run 38309169219 at `18f4b48` passed frontend, both Mac architecture builds
  and Windows including the PR-base comparison (`d22b741`, not main).
  Diagnostic logging does not change input timing or expected values.
  A later failure trace is analyzed below.

An additional recovery observation remains open: receiving while a validation
helper's AE error dialog was open timed out. After the AE dialog was dismissed,
a later receive/save succeeded, but a timeout alert remained visible and did
not disappear after OK/Return/Escape. A process sample showed the main thread
waiting in the normal AppKit event loop, not an established deadlock. Normal
Command+Q and restart recovered, and another receive/save then succeeded.
The helper error itself came from removing all time-remap keys before adding
replacements; retaining keys until replacements exist fixed the helper.
An isolated probe with an AE alert produced the expected concurrent-script
warning and a roughly 30-second timeout. Closing the AE and DiTiS alerts
allowed another receive confirmation without restarting. The persistent alert
was not reproduced; an automation-tool connection error also occurred during
dismissal, so the application versus tool cause remains unresolved.

### Cell editor lost during redraw (2026-10-13)

CI run [38325492279](https://github.com/MisakiAkatsuki/ditis/actions/runs/38325492279)
at `5a30bd4` passed frontend, both Mac builds and the PR-version Windows smoke.
Its Windows comparison against PR base `d22b741` failed with expected `12`,
actual `1`. The workflow uses `github.event.pull_request.base.sha`; earlier
references to a main baseline were incorrect for this stacked PR.

The failed Windows trace captured a redraw at 138ms while the input held `1`.
At 164ms the input had lost focus, editing was false and `1` had been saved;
the `2` key arrived at BODY at 320ms and started another edit. Replacing the
table during editing removes its focused input and can trigger an early blur
commit. This explains the observed trace, without asserting that every earlier
intermittent failure had the same cause.

The renderer now defers table replacement while a cell editor is active,
preserves a requested full redraw, and flushes after commit or Escape.
Programmatic sheet switching commits to the original sheet before switching.
Smoke input timing, waits and expected values are unchanged.

- Five regression cases load the actual HTML and JavaScript in JSDOM: immediate
  and scheduled redraw between digits, Escape, real blur, and sheet switching.
  All five fail without the fix and pass with it. JSDOM simulates default text
  insertion; native behavior is verified separately.
- Full Vitest: 375 passed, 7 existing skipped. Apple Silicon debug app build
  succeeded with updater artifacts disabled for local validation.
- After stopping the previous app and launching the rebuilt app, native Mac
  typing across a scroll retained the input. The Japanese IME first produced
  a full-width second digit; converting with F10 and committing saved ASCII
  `12`. Escape retained the prior value, Undo/Redo restored values, a new sheet
  was empty, and switching back retained `12`. The saved `.ditis` file also
  contained `12`. Screenshots and the fixture were kept in the validation task.
- Windows validation of this fix is pending the follow-up PR's CI. A successful
  intermittent smoke run alone is not proof that every race has been removed.

## Limits

- macOS AE integration requires exactly one running AE application. The bridge
  selects its process dynamically and does not require Accessibility permissions.
- Hardware results and remaining cases are listed above; CI compilation alone
  does not verify AE automation or native behavior.
- Signing/notarization and distribution are outside this PR.
