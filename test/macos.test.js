import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('native menu undo/redo focus', () => {
    function app(activeElement) {
        const ctx = vm.createContext({
            CONSTANTS: { MAX_HISTORY: 500 }, window: {},
            document: { addEventListener: vi.fn(), activeElement, execCommand: vi.fn() },
            closeAllContextMenus: vi.fn(), undo: vi.fn(), redo: vi.fn(), console,
        });
        vm.runInContext(source('js/app.js'), ctx);
        return ctx;
    }
    it.each(['undo', 'redo'])('routes %s to focused text editing', async command => {
        const ctx = app({ tagName: 'INPUT' });
        await ctx.window.handleMenuEvent(command);
        expect(ctx.document.execCommand).toHaveBeenCalledWith(command);
        expect(ctx.undo).not.toHaveBeenCalled();
        expect(ctx.redo).not.toHaveBeenCalled();
    });
    it.each(['TEXTAREA', 'DIV'])('protects sheet history while editing a %s', async tagName => {
        const ctx = app({ tagName, isContentEditable: tagName === 'DIV' });
        await ctx.window.handleMenuEvent('undo');
        expect(ctx.document.execCommand).toHaveBeenCalledWith('undo');
        expect(ctx.undo).not.toHaveBeenCalled();
    });
    it.each(['undo', 'redo'])('keeps sheet %s behavior outside input fields', async command => {
        const ctx = app({ tagName: 'BODY' });
        await ctx.window.handleMenuEvent(command);
        expect(ctx[command]).toHaveBeenCalledOnce();
        expect(ctx.document.execCommand).not.toHaveBeenCalled();
    });
});

describe('macOS shortcuts (real keyboard handler)', () => {
    function keyboard() {
        const ctx = vm.createContext({
            document: { getElementById: () => null },
            window: { TauriAPI: { isRunningInTauri: () => true } },
            AppState: { selectedCells: [], editingCell: null },
            redo: vi.fn(), undo: vi.fn(), saveToFile: vi.fn(), saveAsFile: vi.fn(),
            copySelection: vi.fn(), cutSelection: vi.fn(), pasteSelection: vi.fn(),
            loadFromFileTauri: vi.fn(), createNewSheetWithPrompt: vi.fn(), closeFile: vi.fn(),
            closeAllSheets: vi.fn(), sendToAfterEffects: vi.fn(), getTimeremapFromAE: vi.fn(),
            exportJSX: vi.fn(), printCurrentSheet: vi.fn(), editCurrentSheetSettings: vi.fn(),
        });
        vm.runInContext(source('js/keyboard.js'), ctx);
        return ctx;
    }

    it.each([
        ['n', false, 'createNewSheetWithPrompt'], ['s', false, 'saveToFile'],
        ['S', true, 'saveAsFile'], ['o', false, 'loadFromFileTauri'],
        ['w', false, 'closeFile'], ['W', true, 'closeAllSheets'],
        ['c', false, 'copySelection'], ['x', false, 'cutSelection'], ['v', false, 'pasteSelection'],
        ['z', false, 'undo'], ['Z', true, 'redo'], ['z', true, 'redo'],
        ['e', false, 'sendToAfterEffects'], ['i', false, 'getTimeremapFromAE'],
        ['E', true, 'exportJSX'], ['p', false, 'printCurrentSheet'], [',', false, 'editCurrentSheetSettings'],
    ])('Command + %s calls %s', (key, shiftKey, action) => {
        const ctx = keyboard();
        const e = { key, code: `Key${key.toUpperCase()}`, metaKey: true, ctrlKey: false, shiftKey, preventDefault: vi.fn() };
        ctx.handleKeyboard(e);
        expect(ctx[action]).toHaveBeenCalledOnce();
        expect(e.preventDefault).toHaveBeenCalled();
        if (action === 'redo') expect(ctx.undo).not.toHaveBeenCalled();
    });

    it('preserves Ctrl+Y on Windows/Linux and ignores composing keys', () => {
        const ctx = keyboard();
        const e = { key: 'y', code: 'KeyY', ctrlKey: true, preventDefault: vi.fn() };
        ctx.handleKeyboard(e);
        expect(ctx.redo).toHaveBeenCalledOnce();
        ctx.handleKeyboard({ ...e, key: 's', isComposing: true });
        expect(ctx.saveToFile).not.toHaveBeenCalled();
    });
});

describe('Finder open-file listener', () => {
    it('listens before readiness and opens multiple files in sequence without duplicate events', async () => {
        let listener;
        let finishFirst;
        const first = new Promise(resolve => { finishFirst = resolve; });
        const loadFileFromPath = vi.fn().mockImplementationOnce(() => first).mockResolvedValue(undefined);
        const invoke = vi.fn(async command => {
            expect(command).toBe('frontend_ready');
            expect(listener).toBeTypeOf('function');
            listener({ payload: '/Users/test/カット 1.ditis' });
            listener({ payload: '/Users/test/カット 1.ditis' });
            listener({ payload: '/Users/test/カット 2.ditis' });
        });
        const window = {
            __TAURI__: { event: { listen: vi.fn(async (_, cb) => { listener = cb; }) } },
            __TAURI_INTERNALS__: { invoke },
        };
        const ctx = vm.createContext({ window, console });
        vm.runInContext(source('js/fileOperations.js'), ctx);
        window.loadFileFromPath = loadFileFromPath;
        await ctx.initializeFileOpenEvents();
        expect(loadFileFromPath).toHaveBeenCalledTimes(1);
        finishFirst();
        await new Promise(resolve => setImmediate(resolve));
        expect(loadFileFromPath.mock.calls.map(([p]) => p)).toEqual([
            '/Users/test/カット 1.ditis', '/Users/test/カット 2.ditis',
        ]);
    });
});

describe('After Effects JXA bridge', () => {
    function bridge(apps, { scriptError, noReply = false } = {}) {
        // Match JXA's truthy Objective-C nil wrapper, not JavaScript null.
        const nil = { isNil: () => true };
        const native = value => ({ ...value, isNil: () => false });
        const reply = native({ paramDescriptorForKeyword: vi.fn(key => {
            if (key === 0x6572726e && scriptError) return native({ int32Value: scriptError.code }); // errn
            if (key === 0x65727273 && scriptError) return native({ stringValue: scriptError.message }); // errs
            return nil;
        }) });
        const event = {
            setParamDescriptorForKeyword: vi.fn(),
            sendEventWithOptionsTimeoutError: vi.fn(() => noReply ? nil : reply),
        };
        const descriptor = {
            descriptorWithProcessIdentifier: vi.fn(pid => ({ pid })),
            descriptorWithString: vi.fn(text => ({ text })),
            appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID: vi.fn(() => event),
        };
        const Application = vi.fn(() => { throw new Error('App lookup can relaunch AE'); });
        const ctx = vm.createContext({
            $: {
                NSWorkspace: { sharedWorkspace: { runningApplications: { js: apps } } },
                NSAppleEventDescriptor: descriptor,
                NSAppleEventSendDefaultOptions: 35, NSAppleEventSendCanSwitchLayer: 512,
            },
            ObjC: { import: vi.fn(), unwrap: v => v }, Application,
        });
        vm.runInContext(source('src-tauri/src/ae-macos.js'), ctx);
        return { ctx, Application, descriptor, event };
    }
    const app = (version, executable = 'After Effects') => ({
        executableURL: { lastPathComponent: executable },
        bundleURL: { path: `/Applications/Adobe After Effects ${version}/Adobe After Effects ${version}.app` },
        processIdentifier: version + 1000,
    });
    it('targets the running version and passes quotes/Unicode in paths as data', () => {
        const { ctx, Application, descriptor, event } = bridge([app(2025), app(2026, 'aerender')]);
        const path = '/Users/test/カット "1" \\ backslash\n\u2028\u2029.jsx';
        ctx.run([path]);
        expect(Application).not.toHaveBeenCalled();
        expect(descriptor.descriptorWithProcessIdentifier).toHaveBeenCalledExactlyOnceWith(3025);
        expect(descriptor.appleEventWithEventClassEventIDTargetDescriptorReturnIDTransactionID)
            .toHaveBeenCalledExactlyOnceWith(0x6d697363, 0x646f7363, { pid: 3025 }, -1, 0); // misc/dosc
        expect(event.setParamDescriptorForKeyword.mock.calls[0][1]).toBe(0x2d2d2d2d); // direct parameter
        const script = event.setParamDescriptorForKeyword.mock.calls[0][0].text;
        const evalFile = vi.fn();
        expect(script).not.toMatch(/[\u2028\u2029]/);
        vm.runInNewContext(script, { $: { evalFile } });
        expect(evalFile).toHaveBeenCalledExactlyOnceWith(path);
        expect(event.sendEventWithOptionsTimeoutError).toHaveBeenCalledExactlyOnceWith(547, 120, null);
    });
    it('reports no running AE and refuses ambiguous destinations', () => {
        expect(() => bridge([]).ctx.run(['/tmp/a.jsx'])).toThrow('起動してください');
        const { ctx, Application } = bridge([app(2025), app(2026)]);
        expect(() => ctx.run(['/tmp/a.jsx'])).toThrow('複数');
        expect(Application).not.toHaveBeenCalled();
    });
    it('surfaces AE script errors from the reply', () => {
        const { ctx } = bridge([app(2026)], { scriptError: { code: -2700, message: 'Script failed' } });
        expect(() => ctx.run(['/tmp/a.jsx'])).toThrow('Script failed (-2700)');
    });
    it('reports a failed send without retrying or launching a replacement process', () => {
        const { ctx, Application, event } = bridge([app(2026)], { noReply: true });
        expect(() => ctx.run(['/tmp/a.jsx'])).toThrow('AEが終了・応答待ちでないか、macOSのオートメーション許可');
        expect(event.sendEventWithOptionsTimeoutError).toHaveBeenCalledOnce();
        expect(Application).not.toHaveBeenCalled();
    });
});
