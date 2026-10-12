// Exercise the real UI. Native file dialogs/IPC are stubbed; disk, Finder,
// native menus, Apple Events and WebKit still require the macOS checklist.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (path.includes('..')) { res.writeHead(403).end(); return; }
        res.setHeader('Content-Type', types[extname(path === '/' ? 'index.html' : path)] || 'application/octet-stream');
        res.end(await readFile(join(root, path === '/' ? 'index.html' : path)));
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || (process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/chromium'),
        headless: true,
        args: process.env.CI ? [] : ['--no-sandbox'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => {
        window.smokeFiles = {};
        window.smokeOpenEvents = {};
        window.__TAURI__ = { event: { listen: async (name, cb) => { window.smokeOpenEvents[name] = cb; } } };
        window.__TAURI_INTERNALS__ = { invoke: async (command, args = {}) => {
            switch (command) {
                case 'plugin:dialog|save': return '/Users/test/カット 01.ditis';
                case 'plugin:dialog|open': return '/Users/test/カット 01.ditis';
                case 'save_file': window.smokeFiles[args.path] = args.contents; return;
                case 'load_file': return window.smokeFiles[args.path];
                case 'check_for_updates': return null;
                case 'get_current_version': return '26.324.0';
                default: return;
            }
        } };
        window.print = () => { window.smokePrinted = true; };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => document.querySelector('td.selected[data-frame][data-layer]') && window.smokeOpenEvents['open-file']);
    // Let the initial render/selection timer finish before exercising the UI.
    await page.waitForFunction(() => typeof handleKeyboard === 'function');
    await page.evaluate(() => { AppState.numericKeyMode = 'number-input'; AppState.showNewSheetDialog = false; });
    const cell = (frame, layer = 'L1') => `td[data-frame="${frame}"][data-layer="${layer}"]`;
    const value = (frame, layer = 'L1') => page.evaluate((f, l) => getCurrentSheet().data[f]?.[l] || '', frame, layer);
    async function shortcut(key, shift = false, modifier = 'Meta') {
        await page.keyboard.down(modifier);
        if (shift) await page.keyboard.down('Shift');
        await page.keyboard.press(key);
        if (shift) await page.keyboard.up('Shift');
        await page.keyboard.up(modifier);
    }
    async function enter(frame, text, layer = 'L1') {
        await page.click(cell(frame, layer));
        await page.keyboard.type(text);
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => !AppState.editingCell && !AppState.justFinishedEditing);
    }
    await enter(1, '12');
    assert.equal(await value(1), '12');
    console.log('PASS: cell input and Enter navigation');
    await page.click(cell(1));
    await page.keyboard.down('Shift');
    await page.click(cell(3));
    await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => AppState.selectedCells.length), 3);
    await page.click(cell(1));
    await page.keyboard.down('Meta');
    await page.click(cell(3, 'L2'));
    await page.keyboard.up('Meta');
    assert.equal(await page.evaluate(() => AppState.selectedCells.length), 2);
    console.log('PASS: range selection and Command-click multiple selection');
    await page.click(cell(1));
    await shortcut('c');
    await page.click(cell(4));
    await shortcut('v');
    assert.equal(await value(4), '12');
    await shortcut('z');
    assert.equal(await value(4), '');
    await shortcut('z', true);
    assert.equal(await value(4), '12');
    await shortcut('x');
    assert.equal(await value(4), '');
    await page.click(cell(5));
    await shortcut('v');
    assert.equal(await value(5), '12');
    await page.keyboard.press('Delete');
    assert.equal(await value(5), '');
    console.log('PASS: copy/paste, cut, delete, Command-Z and Command-Shift-Z');
    await shortcut('s');
    await page.waitForFunction(() => Object.keys(window.smokeFiles).length === 1);
    const saved = await page.evaluate(() => JSON.parse(window.smokeFiles['/Users/test/カット 01.ditis']));
    assert.ok(saved);
    await enter(1, '99');
    assert.equal(await value(1), '99');
    await shortcut('o');
    await page.waitForFunction(() => getCurrentSheet().data[1]?.L1 === '12');
    console.log('PASS: save/load round trip through Tauri API wrappers (mock IPC)');
    const count = await page.evaluate(() => AppState.sheets.length);
    const reopenedTab = await page.evaluate(() => AppState.currentSheetIndex);
    await shortcut('n');
    assert.equal(await page.evaluate(() => AppState.sheets.length), count + 1);
    await page.click(`.sheet-tab:nth-child(${reopenedTab + 1})`);
    assert.equal(await value(1), '12');
    await shortcut('w');
    assert.equal(await page.evaluate(() => AppState.sheets.length), count);
    console.log('PASS: new sheet, tab switching and closing');
    await shortcut('p');
    assert.ok(await page.evaluate(() => window.smokePrinted && document.querySelector('#print-container table')));
    await page.keyboard.press('F1');
    await page.waitForFunction(() => document.getElementById('help-dialog').style.display === 'flex');
    await page.keyboard.press('Escape');
    console.log('PASS: print layout and help');
    assert.deepEqual(errors, [], 'no browser JavaScript errors');
} finally {
    if (browser) await browser.close();
    server.close();
}
