import { describe, it, expect, vi } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

// Independently authored examples and structural constraints from CELSYS's
// XDTS specifications (2018-11-29 v5 / 2022-12-06 v5,v10); see FORMATS.md.
const integer = { type: 'integer', minimum: 0 };
const array = items => ({ type: 'array', items });
const object = (properties, required) => ({ type: 'object', properties, required });
const instruction = object({ id: { enum: [0] }, values: { ...array({ type: 'string' }), minItems: 1 } }, ['id', 'values']);
const fieldId = { enum: [0, 3, 5] };
const schema = object({
    version: { enum: [5, 10] },
    header: object({ cut: { type: 'string', pattern: '\\d{1,4}' }, scene: { type: 'string', pattern: '\\d{1,4}' } }, ['cut', 'scene']),
    timeTables: { ...array(object({
        duration: { type: 'integer', minimum: 1 }, name: { type: 'string' },
        timeTableHeaders: array(object({ fieldId, names: array({ type: 'string' }) }, ['fieldId', 'names'])),
        fields: array(object({ fieldId, tracks: array(object({
            trackNo: integer, frames: array(object({ frame: integer, data: array(instruction) }, ['frame', 'data'])),
        }, ['trackNo', 'frames'])) }, ['fieldId', 'tracks'])),
    }, ['duration', 'name', 'timeTableHeaders'])), minItems: 1 },
}, ['version', 'timeTables']);
const validate = new Ajv({ strict: false }).compile(schema);
function app() {
    const ctx = vm.createContext({ AppState: { sheets: [] }, ErrorLevel: { INFO: 'info' },
        saveHistory: vi.fn(), renderTabs: vi.fn(), renderSpreadsheet: vi.fn(), updateWindowTitle: vi.fn(),
        showErrorToast: vi.fn(), debugLog: vi.fn(), window: { TauriAPI: { saveFile: vi.fn() } } });
    vm.runInContext(readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8'), ctx);
    vm.runInContext(readFileSync(process.env.PARSERS_SOURCE || new URL('../js/parsers.js', import.meta.url), 'utf8'), ctx);
    return ctx;
}
const entry = (frame, value, extra = {}) => ({ frame, data: [{ id: 0, values: [value], ...extra }] });
function table(fieldId = 0) {
    return { name: '互換カット', duration: 12,
        timeTableHeaders: [{ fieldId, names: ['A', '空列', 'C'] }, { fieldId: 5, names: ['Camera'] }],
        fields: [{ fieldId: 5, tracks: [{ trackNo: 0, frames: [{ frame: 0, data: [{ id: 0, values: ['PAN', '12', '34', '100', '0', '0', '0'] }] }] }] },
            { fieldId, tracks: [{ trackNo: 2, frames: [entry(4, 'SYMBOL_NULL_CELL'), entry(0, fieldId === 4 ? '1' : 'a0001'), entry(2, 'SYMBOL_HYPHEN'),
                entry(6, fieldId === 4 ? '2' : 'SYMBOL_TICK_1'), entry(8, fieldId === 4 ? '2' : 'SYMBOL_TICK_2'), entry(10, fieldId === 4 ? '3' : 'a0002', { memo: { text: '注意' }, fontColorId: 2 })] }] }] };
}
function load(ctx, format, root, bom = '') {
    const signature = format === 'TDTS' ? 'toeiDigitalTimeSheet' : 'exchangeDigitalTimeSheet';
    ctx[`parse${format === 'TDTS' ? 'Tdts' : 'Xdts'}File`](`${bom}${signature} Save Data\r\n${JSON.stringify(root)}`, `test.${format.toLowerCase()}`);
    return ctx.AppState.sheets.at(-1);
}
const val = (sheet, frame, layer = 'L3') => sheet.data[frame]?.[layer] || '';

describe('official XDTS and legacy TDTS import', () => {
    it.each([5, 10, 11])('reads XDTS v%s, sparse/out-of-order tracks and frames', version => {
        const ctx = app(); const t = table();
        if (version === 5) t.fields[0].tracks[0].frames[0].data[0].values = ['PAN'];
        const sheet = load(ctx, 'XDTS', { version, timeTables: [t] }, '\uFEFF');
        expect(sheet.layers.slice(0, 3).map(l => l.name)).toEqual(['A', '空列', 'C']);
        expect(sheet.fps).toBe(24);
        expect([1, 2, 3, 4].map(f => val(sheet, f))).toEqual(['a0001', 'a0001', 'a0001', 'a0001']);
        expect([5, 6, 7, 9, 11, 12].map(f => val(sheet, f))).toEqual(['×', '×', '○', '●', 'a0002', 'a0002']);
        expect(val(sheet, 1, 'L1')).toBe('');
    });
    it.each([5, 7, 10, 11])('reads TDTS v%s flat/wrapped structures', version => {
        const ctx = app(); const document = { header: { cut: '12' }, timeTables: [table(4)] };
        const root = version === 5 ? { ...document, version } : { version, timeSheets: [document] };
        const sheet = load(ctx, 'TDTS', root);
        expect(val(sheet, 12)).toBe('3');
        expect(sheet.timesheetSource.fieldId).toBe(4);
        const exported = ctx.generateTdtsData(sheet);
        expect(exported.version).toBe(version);
        const doc = version === 5 ? exported : exported.timeSheets[0];
        expect(doc.header.cut).toBe('12');
        expect(doc.timeTables[0].fields.find(f => f.fieldId === 5)).toEqual(table(4).fields[0]);
    });
    it('uses latest TDTS revision and preserves other revisions on save', () => {
        const ctx = app(); const old = table(4), latest = table(4); latest.name = '最新';
        latest.fields[1].tracks[0].frames = [entry(0, '9')];
        const sheet = load(ctx, 'TDTS', { version: 7, timeSheets: [{ timeTables: [old, latest] }] });
        expect(ctx.AppState.sheets).toHaveLength(1); expect(sheet.name).toBe('最新'); expect(val(sheet, 12)).toBe('9');
        expect(ctx.generateTdtsData(sheet).timeSheets[0].timeTables[0]).toEqual(old);
    });
    it('falls back to ACTION when CELL is absent or contains only empty instructions', () => {
        const ctx = app(); const t = table(); t.fields.unshift({ fieldId: 4, tracks: [{ trackNo: 0, frames: [entry(0, 'SYMBOL_NULL_CELL')] }] });
        const sheet = load(ctx, 'TDTS', { version: 5, timeTables: [t] });
        expect(sheet.timesheetSource.fieldId).toBe(0); expect(val(sheet, 1)).toBe('a0001');
    });
    it('selects id=0 instead of assuming first instruction is cell data', () => {
        const ctx = app(); const t = table(); t.fields[1].tracks[0].frames = [{ frame: 0, data: [{ id: 9, values: ['memo'] }, { id: 0, values: ['10'] }] }];
        expect(val(load(ctx, 'XDTS', { version: 5, timeTables: [t] }), 12)).toBe('10');
    });
    it('imports each XDTS timeline and each wrapped TDTS document', () => {
        for (const format of ['TDTS', 'XDTS']) {
            const ctx = app(); const root = format === 'TDTS' ? { version: 7, timeSheets: [{ timeTables: [table()] }, { timeTables: [table()] }] } : { version: 5, timeTables: [table(), table()] };
            load(ctx, format, root); expect(ctx.AppState.sheets).toHaveLength(2);
        }
    });
    it.each(['header', 'duration', 'track', 'values'])('rejects invalid %s without partially importing tabs', invalid => {
        const ctx = app(); const bad = table();
        if (invalid === 'duration') bad.duration = 0;
        if (invalid === 'track') bad.fields[1].tracks[0].trackNo = -1;
        if (invalid === 'values') bad.fields[1].tracks[0].frames[0].data[0].values = [42];
        const content = `${invalid === 'header' ? 'wrong' : 'exchangeDigitalTimeSheet Save Data'}\n${JSON.stringify({ version: 5, timeTables: [table(), bad] })}`;
        expect(() => ctx.parseXdtsFile(content, 'bad.xdts')).toThrow(); expect(ctx.AppState.sheets).toHaveLength(0);
    });
    it.each(['TDTS', 'XDTS'])('names unnamed %s columns after Z as AA and AB', format => {
        const ctx = app(); const t = table();
        t.fields[1].tracks = [{ trackNo: 27, frames: [entry(0, '1')] }];
        const sheet = load(ctx, format, { version: 5, timeTables: [t] });
        expect(sheet.layers.slice(25, 28).map(l => l.name)).toEqual(['Z', 'AA', 'AB']);
        expect(val(sheet, 1, 'L28')).toBe('1');
    });
    it('crops out-of-order negative TDTS dummy frames without replacing frame zero', () => {
        const ctx = app(); const t = table();
        t.fields[1].tracks[0].frames = [entry(0, '1'), entry(-1, '99'), entry(12, '98')];
        const sheet = load(ctx, 'TDTS', { version: 5, timeTables: [t] });
        expect([1, 12].map(f => val(sheet, f))).toEqual(['1', '1']);
    });
    it('rejects negative XDTS frames without partially importing tabs', () => {
        const ctx = app(); const t = table(); t.fields[1].tracks[0].frames.push(entry(-1, '99'));
        expect(() => load(ctx, 'XDTS', { version: 5, timeTables: [table(), t] })).toThrow('負数');
        expect(ctx.AppState.sheets).toHaveLength(0);
    });
});

function editingApp() {
    const ctx = app();
    Object.assign(ctx.AppState, { history: [], historyIndex: -1, fps: 24, specialDisplayCache: new Map() });
    Object.assign(ctx, { structuredClone, CONSTANTS: { MAX_HISTORY: 100 },
        document: { getElementById: () => null, querySelector: () => null },
        validateFrame: (frame, max) => Number.isInteger(frame) && frame >= 1 && frame <= max,
        getCurrentSheet: () => ctx.AppState.sheets[ctx.AppState.currentSheetIndex],
        showInsertFramesDialog: vi.fn(async () => 3),
        showInsertFramesAtPositionDialog: vi.fn(async () => ({ position: 4, count: 3 })),
        showShiftFramesDialog: vi.fn(), showConfirmDialog: vi.fn(async () => true),
        selectA1: vi.fn(), clearSelection: vi.fn(), updateStatusBar: vi.fn(),
        renderSpreadsheetImmediate: vi.fn(), saveToLocalStorage: vi.fn(), calculateSpecialDisplayCache: vi.fn() });
    for (const file of ['frameOps', 'history', 'fileOperations']) {
        vm.runInContext(readFileSync(new URL(`../js/${file}.js`, import.meta.url), 'utf8'), ctx);
    }
    ctx.showConfirmDialog = vi.fn(async () => true);
    return ctx;
}
function annotationFrames(ctx, sheet, format) {
    const root = ctx[format === 'TDTS' ? 'generateTdtsData' : 'generateXdtsData'](sheet);
    const document = root.timeSheets?.[0] || root;
    const table = document.timeTables.at(-1);
    return table.fields.find(f => f.fieldId === sheet.timesheetSource.fieldId).tracks
        .flatMap(t => t.frames.filter(f => f.data.some(d => d.memo?.text === '注意')).map(f => f.frame));
}
describe('retained format annotations follow real row editing operations', () => {
    it.each(['TDTS', 'XDTS'])('keeps %s annotations aligned through insertion, deletion, Undo/Redo and .ditis', async format => {
        const ctx = editingApp(); const previous = { ...table(), name: '前回の改訂' };
        const root = format === 'TDTS' ? { version: 7, timeSheets: [{ timeTables: [previous, table()] }] }
            : { version: 10, timeTables: [table()] };
        const sheet = load(ctx, format, root);
        const sourceBefore = JSON.stringify(sheet.timesheetSource);
        ctx.AppState.selectedCells = [{ frame: 4, layerId: 'L3' }];
        await ctx.insertFramesAtSelection();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([13]);
        expect(val(ctx.getCurrentSheet(), 14)).toBe('a0002');
        const source = ctx.getCurrentSheet().timesheetSource;
        const activeTable = source.document.timeTables[source.tableIndex];
        expect(activeTable.fields.find(f => f.fieldId === 5)).toEqual(table().fields[0]);
        expect(activeTable.fields.find(f => f.fieldId === 0).tracks[0].frames.find(f => f.frame === 13).data[0])
            .toEqual({ id: 0, values: ['a0002'], memo: { text: '注意' }, fontColorId: 2 });
        if (format === 'TDTS') expect(source.document.timeTables[0]).toEqual(previous);
        ctx.undo();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([10]);
        expect(JSON.stringify(ctx.getCurrentSheet().timesheetSource)).toBe(sourceBefore);
        ctx.redo();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([13]);
        const stored = JSON.parse(ctx.buildDitisJson(ctx.getCurrentSheet())).sheets[0];
        ctx.loadSheetData(stored);
        expect(annotationFrames(ctx, stored, format)).toEqual([13]);
        ctx.AppState.selectedCells = [{ frame: 5, layerId: 'L3' }, { frame: 6, layerId: 'L3' }];
        await ctx.deleteSelectedFrames();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([11]);
        ctx.undo(); expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([13]);
        ctx.redo(); expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([11]);
        ctx.AppState.selectedCells = [{ frame: 12, layerId: 'L3' }];
        await ctx.deleteSelectedFrames();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), format)).toEqual([]);
    });
    it.each(['insertFramesStart', 'insertFramesMiddle'])('moves annotations with %s', async operation => {
        const ctx = editingApp(); load(ctx, 'XDTS', { version: 10, timeTables: [table()] });
        await ctx[operation]();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), 'XDTS')).toEqual([13]);
    });
    it.each([[-3, [7]], [1, [11]], [3, []]])('moves or drops annotations with a %s-row shift', async (amount, expected) => {
        const ctx = editingApp(); load(ctx, 'XDTS', { version: 10, timeTables: [table()] });
        ctx.AppState.selectedCells = [{ frame: 4, layerId: 'L3' }];
        ctx.showShiftFramesDialog.mockResolvedValue(amount);
        await ctx.shiftDataDownFromFrame();
        expect(annotationFrames(ctx, ctx.getCurrentSheet(), 'XDTS')).toEqual(expected);
    });
});
describe('timesheet export interoperability', () => {
    const sheet = () => ({ name: '保存確認', frames: 8, fps: 24, layers: [{ id: 'L1', name: 'A' }, { id: 'L2', name: 'B' }],
        data: { 1: { L1: '1' }, 2: { L1: '1' }, 4: { L1: '×' }, 5: { L1: '○' }, 6: { L1: '●' }, 7: { L1: 'a0002' }, 8: { L1: '-' } } });
    it('exports official v5 cell schema and explicit blank transitions', () => {
        const ctx = app(); const data = ctx.generateXdtsData(sheet());
        expect(validate(data), JSON.stringify(validate.errors)).toBe(true); expect(data.version).toBe(5);
        const track = data.timeTables[0].fields[0].tracks[0];
        expect(track.frames.map(f => [f.frame, f.data[0].values[0]])).toEqual([[0, '1'], [2, 'SYMBOL_NULL_CELL'], [4, 'SYMBOL_TICK_1'], [5, 'SYMBOL_TICK_2'], [6, 'a0002'], [7, 'SYMBOL_HYPHEN']]);
        const result = load(ctx, 'XDTS', data);
        expect(val(result, 3, 'L1')).toBe('×'); expect(val(result, 8, 'L1')).toBe('a0002');
    });
    it('retains camera, names, metadata and annotations after cell edits', () => {
        const ctx = app(); const original = { version: 10, header: { cut: '12', scene: '3' }, free: [{ memo: 'メモ' }], timeTables: [table()] };
        const sheet = load(ctx, 'XDTS', original); sheet.data[11].L3 = 'b0032'; sheet.data[12].L3 = 'b0032';
        const data = ctx.generateXdtsData(sheet);
        expect(validate(data), JSON.stringify(validate.errors)).toBe(true); expect(data.version).toBe(10);
        expect(data.header).toEqual(original.header); expect(data.free).toEqual(original.free);
        expect(data.timeTables[0].fields.find(f => f.fieldId === 5)).toEqual(original.timeTables[0].fields[0]);
        const instruction = data.timeTables[0].fields.find(f => f.fieldId === 0).tracks.find(t => t.trackNo === 2).frames.find(f => f.frame === 10).data[0];
        expect(instruction).toEqual({ id: 0, values: ['b0032'], memo: { text: '注意' }, fontColorId: 2 });
    });
    it('preserves annotations after moving columns and a .ditis save/load', () => {
        const ctx = app(); vm.runInContext(readFileSync(new URL('../js/fileOperations.js', import.meta.url), 'utf8'), ctx);
        const sheet = load(ctx, 'XDTS', { version: 10, timeTables: [table()] });
        sheet.layers = [sheet.layers[2], ...sheet.layers.filter(l => l.id !== 'L3')];
        const stored = JSON.parse(ctx.buildDitisJson(sheet)).sheets[0];
        ctx.loadSheetData(stored);
        const data = ctx.generateXdtsData(stored);
        const instruction = data.timeTables[0].fields.find(f => f.fieldId === 0).tracks[0].frames.find(f => f.frame === 10).data[0];
        expect(instruction.memo).toEqual({ text: '注意' }); expect(instruction.values).toEqual(['a0002']);
        expect(data.timeTables[0].timeTableHeaders.find(h => h.fieldId === 0).names[0]).toBe('C');
        expect(sheet.timesheetSource.layerTrackNos.L3).toBe(2); // normalization must not mutate source
    });
    it('upgrades legacy DiTiS XDTS v11 to a published XDTS version', () => {
        const ctx = app(); const sheet = load(ctx, 'XDTS', { version: 11, timeTables: [table()] });
        const data = ctx.generateXdtsData(sheet); expect(data.version).toBe(10); expect(validate(data)).toBe(true);
    });
    it.each(['generateTdtsData', 'generateXdtsData'])('refuses silent FPS loss in %s', generate => {
        const ctx = app(); expect(() => ctx[generate]({ ...sheet(), fps: 30 })).toThrow('24fps');
    });
    it('refuses invalid CELLS instead of writing names or ticks into numeric TDTS CELL field', () => {
        const ctx = app(); const sheet = load(ctx, 'TDTS', { version: 5, timeTables: [table(4)] });
        sheet.data[1].L3 = '○';
        expect(() => ctx.generateTdtsData(sheet)).toThrow('CELL');
        expect(() => ctx.generateXdtsData(sheet)).not.toThrow();
    });
    it('writes the correct signature through the real save functions', async () => {
        const ctx = app(); await ctx.saveTdtsFileInternal('test.tdts', sheet()); await ctx.saveXdtsFileInternal('test.xdts', sheet());
        const calls = ctx.window.TauriAPI.saveFile.mock.calls;
        expect(calls[0][1].split('\n')[0]).toBe('toeiDigitalTimeSheet Save Data');
        expect(calls[1][1].split('\n')[0]).toBe('exchangeDigitalTimeSheet Save Data');
    });
});
