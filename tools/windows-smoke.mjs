// Drive the compiled Windows application through tauri-driver/WebView2.
// File/confirmation dialogs and print are bypassed; Rust file IPC is real.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runBasicOperations } from './smoke-scenario.mjs';

const directory = await mkdtemp(join(tmpdir(), 'ditis-smoke-'));
const filePath = join(directory, 'カット 01.ditis');
const driver = spawn('tauri-driver', [], { stdio: 'inherit' });
let session;
const base = 'http://127.0.0.1:4444';
async function request(method, path, data) {
    const response = await fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json' },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(path === '/session' ? 90000 : 30000),
    });
    const body = await response.json();
    if (!response.ok || body.value?.error) throw new Error(JSON.stringify(body));
    return body.value;
}
async function until(predicate, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        if (await predicate()) return;
        await delay(100);
    }
    throw new Error('Windows smoke check timed out');
}
const command = (path, data, method = 'POST') => request(method, `/session/${session}${path}`, data);
async function screenshot() {
    if (!session) return;
    const png = await command('/screenshot', undefined, 'GET');
    await writeFile(process.env.SMOKE_SCREENSHOT_PATH || 'windows-smoke.png', Buffer.from(png, 'base64'));
}
const keys = { Meta: '\uE03D', Control: '\uE009', Shift: '\uE008', Enter: '\uE007', Delete: '\uE017', Escape: '\uE00C', F1: '\uE031' };
async function actions(items) {
    await command('/actions', { actions: [{ type: 'key', id: 'keyboard', actions: items }] });
}
const page = {
    evaluate: (fn, ...args) => command('/execute/async', {
        script: `const done = arguments[arguments.length - 1]; Promise.resolve((${fn.toString()}).apply(null, Array.from(arguments).slice(0, -1))).then(v => done({ok: true, value: v}), e => done({ok: false, message: String(e)}));`,
        args,
    }).then(result => { if (!result.ok) throw new Error(result.message); return result.value; }),
    waitForFunction: (fn, options = {}, ...args) => until(async () => Boolean(await page.evaluate(fn, ...args)), options.timeout || 15000),
    click: async selector => {
        const element = await command('/element', { using: 'css selector', value: selector });
        await command(`/element/${element['element-6066-11e4-a52e-4f735466cecf']}/click`, {});
    },
    keyboard: {
        down: key => actions([{ type: 'keyDown', value: keys[key] || key }]),
        up: key => actions([{ type: 'keyUp', value: keys[key] || key }]),
        press: key => actions([{ type: 'keyDown', value: keys[key] || key }, { type: 'keyUp', value: keys[key] || key }]),
        type: text => actions([...text].flatMap(value => [{ type: 'keyDown', value }, { type: 'keyUp', value }])),
    },
};

try {
    driver.on('error', e => { console.error(e); });
    await until(async () => {
        try { await request('GET', '/status'); return true; } catch { return false; }
    });
    const value = await request('POST', '/session', {
        capabilities: { alwaysMatch: { 'tauri:options': { application: resolve(process.env.DITIS_BINARY || 'src-tauri/target/debug/ditis.exe') } } },
    });
    session = value.sessionId;
    await command('/timeouts', { script: 15000 });
    await page.waitForFunction(() => typeof AppState !== 'undefined' && document.querySelector('td.selected[data-frame][data-layer]'));
    await page.evaluate(path => {
        // Keep backend IPC intact while avoiding OS modal dialogs in CI.
        window.TauriAPI.saveFileDialog = async () => path;
        window.TauriAPI.openFileDialog = async () => path;
        window.showConfirmDialog = async () => true;
        window.print = () => { window.smokePrinted = true; };
        window.smokeErrors = [];
        window.addEventListener('error', e => window.smokeErrors.push(e.message));
        window.addEventListener('unhandledrejection', e => window.smokeErrors.push(String(e.reason)));
        // Diagnose intermittent lost digits without changing input timing or
        // retrying assertions. This only observes the synthetic CI fixture.
        window.smokeInputTrace = [];
        const started = performance.now();
        const record = (kind, event) => {
            const editing = AppState.editingCell;
            const active = document.activeElement;
            window.smokeInputTrace.push({
                ms: Math.round(performance.now() - started), kind,
                key: event?.key, target: event?.target?.tagName,
                active: active?.tagName, activeValue: active?.value,
                editing: Boolean(editing), connected: editing?.cell?.isConnected,
                editorValue: editing?.cell?.querySelector('input')?.value,
                savedValue: getCurrentSheet().data[1]?.L1,
            });
            if (window.smokeInputTrace.length > 120) window.smokeInputTrace.shift();
        };
        for (const event of ['keydown', 'keyup', 'beforeinput', 'input', 'focusin', 'focusout']) {
            document.addEventListener(event, e => {
                record(event, e);
                queueMicrotask(() => record(`${event}:after`, e));
            }, true);
        }
        const render = renderSpreadsheetImmediate;
        renderSpreadsheetImmediate = function (...args) {
            record('render:before');
            const result = render.apply(this, args);
            record('render:after');
            return result;
        };
    }, filePath);
    await runBasicOperations(page, 'Control');
    const saved = JSON.parse(await readFile(filePath, 'utf8'));
    assert.equal(saved.sheets[0].data[0][0], '12');
    assert.deepEqual(await page.evaluate(() => window.smokeErrors), []);
    await page.evaluate(() => switchSheet(0));
    await screenshot();
    console.log('PASS: Windows WebView2 and Rust disk IPC agree with shared basic-operation expectations');
} catch (error) {
    if (session) {
        try {
            console.error('INPUT_TRACE ' + JSON.stringify(await page.evaluate(() => window.smokeInputTrace || [])));
        } catch (traceError) { console.error('Input trace unavailable:', String(traceError)); }
    }
    await screenshot().catch(console.error);
    // Preserve diagnostics as a GitHub check annotation, even if logs cannot
    // be downloaded outside the runner.
    console.error(`::error::${String(error.stack || error).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
    throw error;
} finally {
    if (session) await command('', undefined, 'DELETE').catch(console.error);
    driver.kill();
    await rm(directory, { recursive: true, force: true });
}
