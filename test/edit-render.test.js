import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const windows = [];
afterEach(() => { for (const w of windows.splice(0)) w.close(); });

async function app() {
    const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    windows.push(w);
    await new Promise(resolve => w.addEventListener('load', resolve));
    w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.console = { ...console, log() {}, warn() {} };
    const frames = [];
    w.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
    for (const [, path] of html.matchAll(/<script src="([^"]+)"/g)) {
        vm.runInContext(readFileSync(new URL(path, root), 'utf8'), dom.getInternalVMContext());
    }
    w.createNewSheet('Render during editing');
    const sheet = w.getCurrentSheet();
    sheet.frames = 3;
    sheet.visibleRows = 3;
    sheet.layers = [{ id: 'L1', name: 'A' }];
    sheet.data = { 1: { L1: '' }, 2: { L1: '' }, 3: { L1: '' } };
    w.AppState.autoScrollToSelection = false;
    w.AppState.numericKeyMode = 'number-input';
    function tick() { for (const cb of frames.splice(0)) cb(); }
    tick();
    w.renderSpreadsheetImmediate(true);
    w.selectA1();
    w.document.addEventListener('keydown', w.handleKeyboard);
    function key(key) {
        const target = w.document.activeElement;
        const e = new w.KeyboardEvent('keydown', {
            key, code: /^[0-9]$/.test(key) ? 'Digit' + key : key, bubbles: true, cancelable: true,
        });
        target.dispatchEvent(e);
        // JSDOM does not perform the browser's default text insertion.
        if (!e.defaultPrevented && key.length === 1 && target.tagName === 'INPUT') {
            target.setRangeText(key, target.selectionStart, target.selectionEnd, 'end');
            target.dispatchEvent(new w.Event('input', { bubbles: true }));
        }
    }
    return { w, sheet, key, tick };
}

describe('real cell editor across spreadsheet rendering', () => {
    it.each(['immediate', 'scheduled'])('keeps both digits and focus across a %s render', async mode => {
        const { w, sheet, key, tick } = await app();
        key('1');
        const input = w.document.activeElement;
        if (mode === 'immediate') w.renderSpreadsheetImmediate(true);
        else { w.scheduleRender(true); tick(); }
        expect(input.isConnected).toBe(true);
        expect(w.document.activeElement).toBe(input);
        expect(w.AppState.editingCell).not.toBeNull();
        expect(sheet.data[1]?.L1 || '').toBe('');
        key('2');
        key('Enter');
        expect(sheet.data[1].L1).toBe('12');
        expect(w.AppState.editingCell).toBeNull();
        expect(w.AppState.selectedCells[0].frame).toBe(2);
    });

    it('flushes a deferred full render on Escape without saving the edit', async () => {
        const { w, sheet, key } = await app();
        sheet.data[1].L1 = '7';
        w.renderSpreadsheetImmediate(true);
        w.startEditing(w.getCellElement(1, 'L1'));
        w.document.activeElement.value = '99';
        sheet.layers[0].name = 'Updated header';
        w.renderSpreadsheetImmediate(true);
        key('Escape');
        expect(sheet.data[1].L1).toBe('7');
        expect(w.AppState.editingCell).toBeNull();
        expect(w.document.querySelector('th[data-layer-id="L1"]').title).toBe('Updated header');
        expect(w.getCellElement(1, 'L1').querySelector('input')).toBeNull();
    });

    it('still commits on a real focus change after a deferred render', async () => {
        const { w, sheet, key } = await app();
        key('1');
        w.renderSpreadsheetImmediate(true);
        key('2');
        const button = w.document.querySelector('button');
        button.focus();
        expect(sheet.data[1].L1).toBe('12');
        expect(w.AppState.editingCell).toBeNull();
    });

    it('commits to the original sheet before a programmatic tab switch', async () => {
        const { w, sheet, key, tick } = await app();
        const other = w.createNewSheet('Other');
        key('1');
        w.renderSpreadsheetImmediate(true);
        key('2');
        w.switchSheet(1);
        tick();
        expect(sheet.data[1].L1).toBe('12');
        expect(other.data[1].L1).toBe('');
        expect(w.AppState.editingCell).toBeNull();
        expect(w.getCurrentSheet()).toBe(other);
        expect(w.getCellElement(1, 'L1').querySelector('input')).toBeNull();
    });
});
