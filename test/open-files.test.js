import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const source = readFileSync(new URL('../js/fileOperations.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const request = (id, path = `カット ${id}.ditis`) => ({ id, path });

function nativeFiles(files = []) {
    return {
        generation: 0, files: [...files], listener: null,
        delivery() { return { generation: this.generation, files: [...this.files] }; },
        emit() { this.listener?.({ payload: this.delivery() }); },
        navigate() { this.generation++; this.listener = null; },
        acknowledge(generation, id) {
            if (generation !== this.generation) return false;
            this.files = this.files.filter(file => file.id !== id);
            return true;
        },
    };
}

function frontend(native, load = vi.fn().mockResolvedValue(true), ready) {
    const events = new Map();
    const unlisten = vi.fn(() => { native.listener = null; });
    const invoke = vi.fn(async (command, args) => {
        if (command === 'frontend_ready') return ready ? ready() : native.delivery();
        if (command === 'acknowledge_open_file') return native.acknowledge(args.generation, args.id);
        throw new Error(`Unexpected native command: ${command}`);
    });
    const window = {
        __TAURI__: { event: { listen: vi.fn(async (_name, callback) => {
            native.listener = callback;
            return unlisten;
        }) } },
        __TAURI_INTERNALS__: { invoke },
        addEventListener: (name, callback) => events.set(name, callback),
        loadFileFromPath: load,
    };
    const context = vm.createContext({ window, console: { error: vi.fn() } });
    vm.runInContext(source, context);
    if (load) window.loadFileFromPath = load;
    return { context, load, invoke, unload: () => events.get('pagehide')(), unlisten };
}

function actualFrontend(native, files) {
    const page = frontend(native, null);
    const loadFile = vi.fn(async path => {
        const content = files.get(path);
        if (content instanceof Error) throw content;
        return content;
    });
    Object.assign(page.context, {
        AppState: { sheets: [], recentFiles: [], fps: 24 },
        ErrorLevel: { ERROR: 'error', INFO: 'info' },
        debugLog: vi.fn(), showErrorToast: vi.fn(), saveHistory: vi.fn(),
        renderTabs: vi.fn(), renderSpreadsheet: vi.fn(), selectA1: vi.fn(),
        updateWindowTitle: vi.fn(), updateStatusBar: vi.fn(), updateDurationDisplay: vi.fn(),
        saveToLocalStorage: vi.fn(), TextDecoder,
    });
    page.context.window.TauriAPI = {
        isRunningInTauri: () => true,
        loadFile,
        loadBinaryFile: loadFile,
    };
    for (const module of ['utils', 'parsers']) {
        vm.runInContext(readFileSync(new URL(`../js/${module}.js`, import.meta.url), 'utf8'), page.context);
    }
    return { ...page, loadFile, state: page.context.AppState };
}

const ditis = name => JSON.stringify({ sheets: [{ name, frames: 1, fps: 24, layers: ['A'], data: [['1']] }] });
const acknowledgments = page => page.invoke.mock.calls
    .filter(([command]) => command === 'acknowledge_open_file').map(([, args]) => args.id);

describe('native file requests across page initialization and navigation', () => {
    it('loads multiple files in order and only acknowledges completed loads', async () => {
        const native = nativeFiles([request(1), request(2)]);
        let complete;
        const first = new Promise(resolve => { complete = resolve; });
        const page = frontend(native, vi.fn().mockImplementationOnce(() => first).mockResolvedValue(true));
        await page.context.initializeFileOpenEvents();
        await settle();
        native.emit(); // Retransmission while the first file is loading.
        await settle();
        expect(page.load.mock.calls.map(([path]) => path)).toEqual(['カット 1.ditis']);
        expect(native.files).toHaveLength(2);
        complete(true);
        await settle();
        expect(page.load.mock.calls.map(([path]) => path)).toEqual(['カット 1.ditis', 'カット 2.ditis']);
        expect(native.files).toEqual([]);
    });

    it('replays a file emitted into a page with no listener after reload', async () => {
        const native = nativeFiles();
        const oldPage = frontend(native);
        await oldPage.context.initializeFileOpenEvents();
        oldPage.unload();
        native.files.push(request(3));
        native.emit(); // No active listener; the native request remains pending.
        native.navigate();
        native.navigate(); // Navigation and page-load hooks can both reset readiness.
        const newPage = frontend(native);
        await newPage.context.initializeFileOpenEvents();
        await settle();
        expect(oldPage.load).not.toHaveBeenCalled();
        expect(newPage.load).toHaveBeenCalledExactlyOnceWith('カット 3.ditis');
        expect(native.files).toEqual([]);
    });

    it('does not acknowledge an interrupted old-page load and replays it in the new page', async () => {
        const native = nativeFiles([request(4)]);
        let finishOld;
        const oldPage = frontend(native, vi.fn(() => new Promise(resolve => { finishOld = resolve; })));
        await oldPage.context.initializeFileOpenEvents();
        await settle();
        oldPage.unload();
        native.navigate();
        finishOld(true);
        await settle();
        expect(oldPage.invoke.mock.calls.filter(([command]) => command === 'acknowledge_open_file')).toEqual([]);
        expect(native.files).toHaveLength(1);
        const newPage = frontend(native);
        await newPage.context.initializeFileOpenEvents();
        await settle();
        expect(newPage.load).toHaveBeenCalledExactlyOnceWith('カット 4.ditis');
        expect(native.files).toEqual([]);
    });

    it('deduplicates events received before the readiness response and ignores stale generations', async () => {
        const native = nativeFiles([request(5)]);
        const page = frontend(native, undefined, () => {
            native.emit();
            return native.delivery();
        });
        await page.context.initializeFileOpenEvents();
        await settle();
        native.listener({ payload: { generation: -1, files: [request(6)] } });
        await settle();
        expect(page.load).toHaveBeenCalledExactlyOnceWith('カット 5.ditis');
        expect(native.files).toEqual([]);
    });

    it('retains a file when loading rejects instead of falsely acknowledging it', async () => {
        const native = nativeFiles([request(7)]);
        const page = frontend(native, vi.fn().mockRejectedValue(new Error('read interrupted')));
        await page.context.initializeFileOpenEvents();
        await settle();
        expect(native.files).toHaveLength(1);
        expect(page.invoke.mock.calls.filter(([command]) => command === 'acknowledge_open_file')).toEqual([]);
    });

    it('does not consume a readiness response delivered after the page unloads', async () => {
        const native = nativeFiles([request(8)]);
        let ready;
        const page = frontend(native, undefined, () => new Promise(resolve => { ready = resolve; }));
        const initialized = page.context.initializeFileOpenEvents();
        await settle();
        page.unload();
        native.navigate();
        ready(native.delivery());
        await initialized;
        await settle();
        expect(page.load).not.toHaveBeenCalled();
        expect(native.files).toHaveLength(1);
    });
});

describe('native requests using the real file loader', () => {
    it('retains a read failure, opens the next file, and retries after the file is repaired', async () => {
        const failed = request(9), valid = request(10);
        const native = nativeFiles([failed, valid]);
        const files = new Map([[failed.path, new Error('temporary read failure')], [valid.path, ditis('next')]]);
        const page = actualFrontend(native, files);
        await page.context.initializeFileOpenEvents();
        await settle();
        expect(page.loadFile.mock.calls.map(([path]) => path)).toEqual([failed.path, valid.path]);
        expect(page.state.sheets.map(sheet => sheet.name)).toEqual(['next']);
        expect(acknowledgments(page)).toEqual([valid.id]);
        expect(native.files).toEqual([failed]);

        files.set(failed.path, ditis('repaired'));
        native.emit();
        await settle();
        expect(page.loadFile.mock.calls.map(([path]) => path)).toEqual([failed.path, valid.path, failed.path]);
        expect(page.state.sheets.map(sheet => sheet.name)).toEqual(['next', 'repaired']);
        expect(acknowledgments(page)).toEqual([valid.id, failed.id]);
        expect(native.files).toEqual([]);
    });

    it('replays an actual failed load after page reload', async () => {
        const file = request(11);
        const native = nativeFiles([file]);
        const files = new Map([[file.path, new Error('file unavailable')]]);
        const oldPage = actualFrontend(native, files);
        await oldPage.context.initializeFileOpenEvents();
        await settle();
        expect(acknowledgments(oldPage)).toEqual([]);
        oldPage.unload();
        native.navigate();
        files.set(file.path, ditis('available after reload'));
        const newPage = actualFrontend(native, files);
        await newPage.context.initializeFileOpenEvents();
        await settle();
        expect(newPage.state.sheets.map(sheet => sheet.name)).toEqual(['available after reload']);
        expect(acknowledgments(newPage)).toEqual([file.id]);
        expect(native.files).toEqual([]);
    });

    it.each([
        ['invalid JSON', '{not JSON}'],
        ['null document', 'null'],
        ['invalid sheets', JSON.stringify({ sheets: {} })],
        ['empty sheets', JSON.stringify({ sheets: [] })],
    ])('keeps %s pending until a valid file is delivered', async (_name, content) => {
        const file = request(12);
        const native = nativeFiles([file]);
        const files = new Map([[file.path, content]]);
        const page = actualFrontend(native, files);
        await page.context.initializeFileOpenEvents();
        await settle();
        expect(page.state.sheets).toEqual([]);
        expect(acknowledgments(page)).toEqual([]);
        expect(native.files).toEqual([file]);
        expect(page.context.showErrorToast).toHaveBeenCalledWith(expect.any(String), 'error', 5000);

        files.set(file.path, ditis('repaired'));
        native.emit();
        await settle();
        expect(page.state.sheets.map(sheet => sheet.name)).toEqual(['repaired']);
        expect(acknowledgments(page)).toEqual([file.id]);
        expect(native.files).toEqual([]);
    });

    it('keeps existing tabs unchanged when a later JSON sheet is invalid and retries without duplicate tabs', async () => {
        const file = request(14);
        const first = JSON.parse(ditis('first')).sheets[0];
        const second = JSON.parse(ditis('second')).sheets[0];
        const native = nativeFiles([file]);
        const files = new Map([[file.path, JSON.stringify({ sheets: [first, null] })]]);
        const page = actualFrontend(native, files);
        const existing = { name: 'existing' };
        page.state.sheets.push(existing);
        await page.context.initializeFileOpenEvents();
        await settle();
        expect(page.state.sheets).toEqual([existing]);
        expect(acknowledgments(page)).toEqual([]);
        expect(native.files).toEqual([file]);

        files.set(file.path, JSON.stringify({ sheets: [first, second] }));
        native.emit();
        await settle();
        expect(page.state.sheets.map(sheet => sheet.name)).toEqual(['existing', 'first', 'second']);
        expect(acknowledgments(page)).toEqual([file.id]);
        expect(native.files).toEqual([]);
    });

    it.each(['sts', 'tdts', 'xdts'])('keeps a real %s parser failure pending and acknowledges a repaired file', async extension => {
        const file = request(13, `カット 13.${extension}`);
        const native = nativeFiles([file]);
        const files = new Map([[file.path, extension === 'sts' ? new Uint8Array([0]) : 'invalid signature\n{}']]);
        const page = actualFrontend(native, files);
        await page.context.initializeFileOpenEvents();
        await settle();
        expect(page.state.sheets).toEqual([]);
        expect(acknowledgments(page)).toEqual([]);
        expect(native.files).toEqual([file]);
        expect(page.context.showErrorToast).toHaveBeenCalledWith(expect.stringContaining('読み込みに失敗'), 'error', 5000);

        const signature = extension === 'tdts' ? 'toeiDigitalTimeSheet' : 'exchangeDigitalTimeSheet';
        const repaired = extension === 'sts'
            ? new Uint8Array([0x11, ...new TextEncoder().encode('ShiraheiTimeSheet'), 1, 1, 0, 0, 0, 1, 0, 1, 65])
            : `${signature} Save Data\n${JSON.stringify({ version: 5, timeTables: [{
                name: 'repaired', duration: 1, timeTableHeaders: [{ fieldId: 0, names: ['A'] }],
                fields: [{ fieldId: 0, tracks: [{ trackNo: 0, frames: [{ frame: 0, data: [{ id: 0, values: ['1'] }] }] }] }],
            }] })}`;
        files.set(file.path, repaired);
        native.emit();
        await settle();
        expect(page.state.sheets).toHaveLength(1);
        expect(page.state.sheets[0].data[1].L1).toBe('1');
        expect(acknowledgments(page)).toEqual([file.id]);
        expect(native.files).toEqual([]);
    });
});
