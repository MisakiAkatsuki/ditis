import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

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
    function bridge(apps) {
        const ae = { doscript: vi.fn() };
        const Application = vi.fn(() => ae);
        const ctx = vm.createContext({
            $: { NSWorkspace: { sharedWorkspace: { runningApplications: { js: apps } } } },
            ObjC: { import: vi.fn(), unwrap: v => v }, Application,
        });
        vm.runInContext(source('src-tauri/src/ae-macos.js'), ctx);
        return { ctx, Application, ae };
    }
    const app = (version, executable = 'After Effects') => ({
        executableURL: { lastPathComponent: executable },
        bundleURL: { path: `/Applications/Adobe After Effects ${version}/Adobe After Effects ${version}.app` },
    });
    it('targets the running version and passes quotes/Unicode in paths as data', () => {
        const { ctx, Application, ae } = bridge([app(2025), app(2026, 'aerender')]);
        const path = '/Users/test/カット "1" \\ backslash\n\u2028\u2029.jsx';
        ctx.run([path]);
        expect(Application).toHaveBeenCalledWith(app(2025).bundleURL.path);
        const evalFile = vi.fn();
        expect(ae.doscript.mock.calls[0][0]).not.toMatch(/[\u2028\u2029]/);
        vm.runInNewContext(ae.doscript.mock.calls[0][0], { $: { evalFile } });
        expect(evalFile).toHaveBeenCalledExactlyOnceWith(path);
    });
    it('reports no running AE and refuses ambiguous destinations', () => {
        expect(() => bridge([]).ctx.run(['/tmp/a.jsx'])).toThrow('起動してください');
        const { ctx, Application } = bridge([app(2025), app(2026)]);
        expect(() => ctx.run(['/tmp/a.jsx'])).toThrow('複数');
        expect(Application).not.toHaveBeenCalled();
    });
});
