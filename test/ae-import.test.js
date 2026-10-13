import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Execute the actual ExtendScript template with mocked AE properties and socket.
function receiveFromAE(duration, layers) {
    const template = source('src-tauri/src/lib.rs').split('fn generate_get_timeremap_jsx(')[1]
        .split('format!(r#"')[1].split('"#, port, nonce)')[0];
    const jsx = template.replace('var DITIS_PORT = {};', 'var DITIS_PORT = 1234;')
        .replace('var DITIS_NONCE = "{}";', 'var DITIS_NONCE = "test";')
        .replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    class CompItem {}
    const comp = Object.assign(new CompItem(), {
        frameRate: 30, duration, name: '検証コンポ',
        selectedLayers: layers.map((layer, i) => ({
            name: `原画 "${i + 1}"`, index: i + 1, source: { duration: layer.duration },
            property: () => ({
                numKeys: layer.keys.length,
                keyTime: k => layer.keys[k - 1].time,
                keyValue: k => layer.keys[k - 1].value,
            }),
        })),
    });
    let payload;
    class Socket {
        open() { return true; }
        write(text) { payload = JSON.parse(text.slice('test:'.length)); }
        close() {}
    }
    vm.runInNewContext(jsx, { CompItem, Socket, app: { project: { activeItem: comp } } });
    expect(payload.error).toBeUndefined();
    return payload;
}

async function importData(data) {
    const state = { sheets: [] };
    const ctx = vm.createContext({
        window: {}, confirm: () => true, AppState: state,
        createNewSheet: name => { const sheet = { name }; state.sheets.push(sheet); return sheet; },
        getLayerName: i => String.fromCharCode(65 + i),
        renderTabs: vi.fn(), renderSpreadsheet: vi.fn(), updateWindowTitle: vi.fn(),
        updateStatusBar: vi.fn(), debugLog: vi.fn(),
    });
    vm.runInContext(source('js/export.js'), ctx);
    await ctx.importTimeremapData(data);
    return state.sheets[0];
}

describe('AE time-remap source duration', () => {
    it('preserves blanks from a short source in a 1,440-frame composition', async () => {
        const data = receiveFromAE(48, [{ duration: 2, keys: [
            { time: 0, value: 2 }, { time: 1 / 30, value: 0 },
            { time: 2 / 30, value: 59 / 30 }, { time: 4 / 30, value: 2 },
        ] }]);
        const sheet = await importData(data);
        expect(sheet.frames).toBe(1440);
        expect([1, 2, 3, 4, 5, 1440].map(f => sheet.data[f].L1))
            .toEqual(['', '1', '60', '-', '', '']);
    });

    it('keeps valid source cels beyond the destination composition duration', async () => {
        const sheet = await importData(receiveFromAE(1, [{ duration: 2, keys: [
            { time: 0, value: 59 / 30 }, { time: 2 / 30, value: 2 },
        ] }]));
        expect([1, 2, 3, 30].map(f => sheet.data[f].L1)).toEqual(['60', '-', '', '']);
    });

    it('uses each layer source independently', async () => {
        const sheet = await importData(receiveFromAE(48, [
            { duration: 2, keys: [{ time: 0, value: 2 }] },
            { duration: 4, keys: [{ time: 0, value: 2 }] },
        ]));
        expect(sheet.data[1].L1).toBe('');
        expect(sheet.data[1].L2).toBe('61');
        expect(sheet.layers.slice(0, 2).map(l => l.name)).toEqual(['原画 "1"', '原画 "2"']);
    });

    it.each([undefined, null, 0, -1])('accepts legacy payloads without usable source duration (%s)', async sourceDuration => {
        const sheet = await importData({ fps: 30, duration: 1, compName: '旧形式', layers: [{
            layerName: 'A', sourceDuration, keyframes: [{ time: 0, value: 0 }, { time: 1 / 30, value: 1 }],
        }] });
        expect(sheet.data[1].L1).toBe('1');
        expect(sheet.data[2].L1).toBe('');
    });
});
