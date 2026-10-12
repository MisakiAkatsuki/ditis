import assert from 'node:assert/strict';

// Same observable expectations for Command (Mac) and Control (Windows).
export async function runBasicOperations(page, modifier) {
    await page.evaluate(() => { AppState.numericKeyMode = 'number-input'; AppState.showNewSheetDialog = false; });
    const cell = (frame, layer = 'L1') => `td[data-frame="${frame}"][data-layer="${layer}"]`;
    const value = (frame, layer = 'L1') => page.evaluate((f, l) => getCurrentSheet().data[f]?.[l] || '', frame, layer);
    const waitValue = (frame, expected) => page.waitForFunction((f, v) => (getCurrentSheet().data[f]?.L1 || '') === v, {}, frame, expected);
    async function shortcut(key, shift = false, keyModifier = modifier) {
        await page.keyboard.down(keyModifier);
        if (shift) await page.keyboard.down('Shift');
        await page.keyboard.press(key);
        if (shift) await page.keyboard.up('Shift');
        await page.keyboard.up(keyModifier);
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
    await page.keyboard.down(modifier);
    await page.click(cell(3, 'L2'));
    await page.keyboard.up(modifier);
    assert.equal(await page.evaluate(() => AppState.selectedCells.length), 2);
    console.log('PASS: range selection and modifier-click multiple selection');
    await page.click(cell(1));
    await shortcut('c');
    await page.click(cell(4));
    await shortcut('v');
    await waitValue(4, '12');
    assert.equal(await value(4), '12');
    await shortcut('z');
    await waitValue(4, '');
    assert.equal(await value(4), '');
    await shortcut(modifier === 'Meta' ? 'z' : 'y', modifier === 'Meta');
    await waitValue(4, '12');
    assert.equal(await value(4), '12');
    await shortcut('x');
    await waitValue(4, '');
    assert.equal(await value(4), '');
    await page.click(cell(5));
    await shortcut('v');
    await waitValue(5, '12');
    assert.equal(await value(5), '12');
    await page.keyboard.press('Delete');
    await waitValue(5, '');
    assert.equal(await value(5), '');
    console.log('PASS: copy/paste, cut, delete, Undo and Redo');
    await shortcut('s');
    await page.waitForFunction(() => getCurrentSheet().filePath);
    const saved = await page.evaluate(async () => JSON.parse(await window.TauriAPI.loadFile(getCurrentSheet().filePath)));
    assert.ok(saved);
    await enter(1, '99');
    assert.equal(await value(1), '99');
    await shortcut('o');
    await page.waitForFunction(() => getCurrentSheet().data[1]?.L1 === '12');
    console.log('PASS: save/load round trip through Tauri API wrappers');
    const count = await page.evaluate(() => AppState.sheets.length);
    const reopenedTab = await page.evaluate(() => AppState.currentSheetIndex);
    await shortcut('n');
    await page.waitForFunction(n => AppState.sheets.length === n + 1, {}, count);
    assert.equal(await page.evaluate(() => AppState.sheets.length), count + 1);
    await page.click(`.sheet-tab:nth-child(${reopenedTab + 1})`);
    assert.equal(await value(1), '12');
    await shortcut('w');
    await page.waitForFunction(n => AppState.sheets.length === n, {}, count);
    assert.equal(await page.evaluate(() => AppState.sheets.length), count);
    console.log('PASS: new sheet, tab switching and closing');
    await shortcut('p');
    await page.waitForFunction(() => window.smokePrinted);
    assert.ok(await page.evaluate(() => window.smokePrinted && document.querySelector('#print-container table')));
    await page.keyboard.press('F1');
    await page.waitForFunction(() => document.getElementById('help-dialog').style.display === 'flex');
    await page.keyboard.press('Escape');
    console.log('PASS: print layout and help');
}
