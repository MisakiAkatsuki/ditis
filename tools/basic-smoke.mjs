// Exercise the real UI. Native file dialogs/IPC are stubbed; disk, Finder,
// native menus, Apple Events and WebKit still require the macOS checklist.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import puppeteer from 'puppeteer';
import { runBasicOperations } from './smoke-scenario.mjs';

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
                case 'plugin:dialog|confirm': return true;
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
    await runBasicOperations(page, 'Meta');
    assert.deepEqual(errors, [], 'no browser JavaScript errors');
} finally {
    if (browser) await browser.close();
    server.close();
}
