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
    // DoScriptFile can time out on recent AE versions. Evaluate the file via
    // DoScript instead; keep the path a quoted string rather than executable code.
    const scriptPath = JSON.stringify(argv[0]).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    ae.doscript('$.evalFile(' + scriptPath + ');');
}
