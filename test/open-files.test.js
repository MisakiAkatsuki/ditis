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

function frontend(native, load = vi.fn().mockResolvedValue(undefined), ready) {
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
    window.loadFileFromPath = load;
    return { context, load, invoke, unload: () => events.get('pagehide')(), unlisten };
}

describe('native file requests across page initialization and navigation', () => {
    it('loads multiple files in order and only acknowledges completed loads', async () => {
        const native = nativeFiles([request(1), request(2)]);
        let complete;
        const first = new Promise(resolve => { complete = resolve; });
        const page = frontend(native, vi.fn().mockImplementationOnce(() => first).mockResolvedValue(undefined));
        await page.context.initializeFileOpenEvents();
        await settle();
        native.emit(); // Retransmission while the first file is loading.
        await settle();
        expect(page.load.mock.calls.map(([path]) => path)).toEqual(['カット 1.ditis']);
        expect(native.files).toHaveLength(2);
        complete();
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
        finishOld();
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
