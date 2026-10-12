// JavaScript for Automation, executed by /usr/bin/osascript (not the webview).
ObjC.import('AppKit');

function run(argv) {
    const running = $.NSWorkspace.sharedWorkspace.runningApplications.js;
    const candidates = running.filter(app =>
        app.executableURL && ObjC.unwrap(app.executableURL.lastPathComponent) === 'After Effects'
    );
    if (candidates.length === 0) {
        throw new Error('After Effectsを起動してください。');
    }
    // DiTiS is normally frontmost when invoked; with several AE versions open,
    // require the user to leave only the intended version running.
    if (candidates.length > 1) {
        throw new Error('複数のAfter Effectsが起動しています。送信先以外のAEを終了してください。');
    }
    const ae = Application(ObjC.unwrap(candidates[0].bundleURL.path));
    ae.doscriptfile(argv[0]);
}
