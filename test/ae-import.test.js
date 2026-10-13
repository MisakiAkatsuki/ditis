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
            effectsActive: layer.effectsActive !== false,
            property: name => name === 'ADBE Time Remapping' ? {
                numKeys: layer.keys.length, keyTime: k => layer.keys[k - 1].time,
                keyValue: k => layer.keys[k - 1].value,
            } : name === 'ADBE Effect Parade' ? {
                numProperties: (layer.effects || []).length,
                property: index => {
                    const effect = layer.effects[index - 1];
                    const keys = effect.keys || [];
                    return { name: effect.name, matchName: effect.matchName || 'ADBE Venetian Blinds',
                        enabled: effect.enabled !== false,
                        property: () => ({ numKeys: keys.length, value: effect.value ?? keys[0]?.value ?? 0,
                            valueAtTime: () => effect.value ?? keys[0]?.value ?? 0,
                            keyTime: k => keys[k - 1].time, keyValue: k => keys[k - 1].value }) };
                },
            } : null,
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

// Run the actual generated apply callback, without the unrelated ScriptUI dialog.
function sendToAE(useTimeRemap, initialEffects = []) {
    const sheet = { name: '往復', frames: 6, fps: 30, layers: [{ id: 'L1', name: 'A' }],
        data: Object.fromEntries(['1', '1', '', '', '1', '2'].map((value, i) => [i + 1, { L1: value }])) };
    const ctx = vm.createContext({ getCurrentSheet: () => sheet, getCurrentLanguage: () => 'ja',
        AppState: { fps: 30 }, generateExtendScriptI18n: () => '  var i18n = {error:{},dialog:{}};\n' });
    vm.runInContext(source('js/export.js'), ctx);
    const jsx = ctx.generateJSXSingleComp();
    const property = keys => ({ keys,
        get numKeys() { return this.keys.length; },
        removeKey(k) { this.keys.splice(k - 1, 1); },
        setValuesAtTimes(times, values) {
            times.forEach((time, i) => {
                this.keys = this.keys.filter(k => k.time !== time);
                this.keys.push({ time, value: values[i] });
            });
            this.keys.sort((a, b) => a.time - b.time);
        },
        setInterpolationTypeAtKey(k, type) { this.keys[k - 1].interpolation = type; },
    });
    const remap = property([]);
    const effects = [];
    const addEffect = input => {
        const completion = property([...(input.keys || [])]);
        const effect = { ...input, matchName: 'ADBE Venetian Blinds', enabled: true,
            property: () => completion, completion,
            remove: () => effects.splice(effects.indexOf(effect), 1) };
        effects.push(effect); return effect;
    };
    initialEffects.forEach(addEffect);
    const parade = { get numProperties() { return effects.length; },
        property: key => typeof key === 'number' ? effects[key - 1]
            : effects.find(effect => effect.name === key || effect.matchName === key) || null,
        addProperty: () => addEffect({ name: 'Venetian Blinds' }) };
    class CompItem {}
    const layer = { name: 'A', index: 1, canSetTimeRemapEnabled: true,
        source: Object.assign(new CompItem(), { duration: 2 }),
        set timeRemapEnabled(value) {
            if (value) remap.keys = [{ time: 0, value: 0 }, { time: 2, value: 2 }];
        },
        property: name => name === 'ADBE Time Remapping' ? remap : parade };
    const app = { settings: { saveSetting() {} }, beginUndoGroup() {}, endUndoGroup() {} };
    const callback = jsx.slice(jsx.indexOf('  okBtn.onClick = function()'), jsx.indexOf('  cancelBtn.onClick'));
    const prelude = jsx.slice(jsx.indexOf('  var ADBE_TIME_REMAPPING'), jsx.indexOf('  var comp ='));
    const columns = jsx.slice(jsx.indexOf('  var columnData = ['), jsx.indexOf('  var tsWin ='));
    vm.runInNewContext(`${prelude}${columns}${callback}okBtn.onClick();`, {
        app, CompItem, fps: 30, sortedLayers: [layer], dropdowns: [{ selection: { index: 1 } }],
        comp: { numLayers: 1, layer: () => layer }, radioComp: { value: useTimeRemap },
        markerCheck: { value: false }, precompCheck: { value: false }, tsWin: { close() {} }, okBtn: {},
        KeyframeInterpolationType: { HOLD: 'hold' },
    });
    return { duration: 2, keys: remap.keys.map(({ time, value }) => ({ time, value })),
        effects: effects.map(effect => ({ name: effect.name, keys: effect.completion.keys.map(({ time, value }) => ({ time, value })) })) };
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

describe('DiTiS-owned Venetian Blinds blanks', () => {
    it.each([false, true])('round-trips generated blanks (time-remap method: %s) and retains unrelated effects', async method => {
        const legacy = { name: 'Venetian Blinds', keys: [{ time: 0, value: 100 }] };
        const artistic = { name: 'Transition', keys: [{ time: 0, value: 50 }] };
        const sent = sendToAE(method, [legacy, artistic,
            { name: 'DiTiS Empty Cells', keys: [{ time: 0, value: 100 }] }]);
        expect(sent.effects.filter(effect => effect.name !== 'DiTiS Empty Cells')).toEqual([legacy, artistic]);
        expect(sent.effects.filter(effect => effect.name === 'DiTiS Empty Cells')).toHaveLength(method ? 0 : 1);
        const sheet = await importData(receiveFromAE(6 / 30, [sent]));
        expect([1, 2, 3, 4, 5, 6].map(f => sheet.data[f].L1)).toEqual(['1', '-', '', '', '1', '2']);
    });

    it('restores blank transitions between time-remap keys and reopens the same cel', async () => {
        const data = receiveFromAE(1, [{ duration: 2, keys: [
            { time: 0, value: 0 }, { time: 5 / 30, value: 1 / 30 },
        ], effects: [{ name: 'DiTiS Empty Cells', keys: [
            { time: 0, value: 0 }, { time: 2 / 30, value: 100 }, { time: 4 / 30, value: 0 },
        ] }] }]);
        expect(data.layers[0].blankKeyframes).toEqual([
            { time: 0, value: 0 }, { time: 2 / 30, value: 100 }, { time: 4 / 30, value: 0 },
        ]);
        const sheet = await importData(data);
        expect([1, 2, 3, 4, 5, 6, 7].map(f => sheet.data[f].L1))
            .toEqual(['1', '-', '', '', '1', '2', '-']);
    });

    it('keeps source-duration blanks hidden even after the owned effect opens', async () => {
        const sheet = await importData(receiveFromAE(1, [{ duration: 2, keys: [
            { time: 0, value: 2 }, { time: 4 / 30, value: 0 },
        ], effects: [{ name: 'DiTiS Empty Cells', keys: [
            { time: 0, value: 100 }, { time: 2 / 30, value: 0 },
        ] }] }]));
        expect([1, 2, 3, 4, 5, 6].map(f => sheet.data[f].L1))
            .toEqual(['', '', '', '', '1', '-']);
    });

    it.each(['effect', 'layer', 'unowned', 'wrong effect'])('ignores a disabled or unrelated effect (%s)', async kind => {
        const effect = { name: 'DiTiS Empty Cells', value: 100 };
        if (kind === 'effect') effect.enabled = false;
        if (kind === 'unowned') effect.name = 'Venetian Blinds';
        if (kind === 'wrong effect') effect.matchName = 'ADBE Linear Wipe';
        const data = receiveFromAE(1, [{ duration: 2, keys: [{ time: 0, value: 0 }],
            effectsActive: kind !== 'layer', effects: [effect] }]);
        expect(data.layers[0].blankKeyframes).toEqual([]);
        const sheet = await importData(data);
        expect([1, 2, 30].map(f => sheet.data[f].L1)).toEqual(['1', '-', '-']);
    });

    it('reads a constant owned completion value with no effect keys', async () => {
        const sheet = await importData(receiveFromAE(1, [{ duration: 2, keys: [{ time: 0, value: 0 }],
            effects: [{ name: 'DiTiS Empty Cells', value: 100 }] }]));
        expect([1, 30].map(f => sheet.data[f].L1)).toEqual(['', '']);
    });
});
