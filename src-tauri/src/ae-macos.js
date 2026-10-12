// JavaScript for Automation, executed by /usr/bin/osascript (not the webview).
ObjC.import('AppKit');

function fourCC(code) {
    return code.split('').reduce((value, char) => value * 256 + char.charCodeAt(0), 0);
}

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
    // DoScriptFile can time out on recent AE versions. Evaluate the file via
    // DoScript instead; keep the path a quoted string rather than executable code.
    const scriptPath = JSON.stringify(argv[0]).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    // A path/bundle target can relaunch AE if it exits after detection. Address
    // only the selected running process, so shutdown becomes a send error.
    const descriptor = $.NSAppleEventDescriptor;
    const target = descriptor.descriptorWithProcessIdentifier(candidates[0].processIdentifier);
    // AE's scripting dictionary defines DoScript as misc/dosc; -1 generates
    // the return ID and 0 means this event does not belong to a transaction.
    const event = descriptor.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID(
        fourCC('misc'), fourCC('dosc'), target, -1, 0
    );
    event.setParamDescriptorForKeyword(
        descriptor.descriptorWithString('$.evalFile(' + scriptPath + ');'), fourCC('----')
    );
    // Do not read an NSError out-pointer through JXA: on macOS 26 it can
    // reference an already-released object and crash osascript on send failure.
    const reply = event.sendEventWithOptionsTimeoutError(
        $.NSAppleEventSendDefaultOptions | $.NSAppleEventSendCanSwitchLayer, 120, null
    );
    // Objective-C nil is a truthy wrapper in JXA, so test it explicitly.
    if (!reply || reply.isNil()) {
        throw new Error('After Effectsへの通信に失敗しました。AEが終了・応答待ちでないか、macOSのオートメーション許可を確認してください。');
    }
    const errorNumber = reply.paramDescriptorForKeyword(fourCC('errn'));
    if (errorNumber && !errorNumber.isNil() && errorNumber.int32Value !== 0) {
        const message = reply.paramDescriptorForKeyword(fourCC('errs'));
        throw new Error((message && !message.isNil() ? ObjC.unwrap(message.stringValue) : 'After Effectsスクリプトの実行に失敗しました。') +
            ' (' + errorNumber.int32Value + ')');
    }
}
