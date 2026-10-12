import assert from 'node:assert/strict';

// Synthetic specification examples; identical expectations on Chromium and WebView2.
export async function runFormatOperations(page) {
    const results = await page.evaluate(() => {
        const entry = (frame, value) => ({ frame, data: [{ id: 0, values: [value] }] });
        const table = fieldId => ({ name: '旧版互換テスト', duration: 24,
            timeTableHeaders: [{ fieldId, names: ['A', '空列', 'C'] }],
            fields: [{ fieldId, tracks: [{ trackNo: 2, frames: [entry(0, 'a0001'), entry(3, 'SYMBOL_HYPHEN'),
                entry(6, 'SYMBOL_NULL_CELL'), entry(9, 'SYMBOL_TICK_1'), entry(12, 'SYMBOL_TICK_2'), entry(15, 'a0002')] }] }] });
        const result = [];
        for (const version of [5, 10, 11]) {
            parseXdtsFile(`exchangeDigitalTimeSheet Save Data\n${JSON.stringify({ version, timeTables: [table(0)] })}`, 'old.xdts');
            const sheet = getCurrentSheet();
            result.push({ format: 'XDTS', version, names: sheet.layers.slice(0, 3).map(l => l.name),
                values: [1, 6, 7, 10, 13, 16, 24].map(f => sheet.data[f]?.L3 || ''), exported: generateXdtsData(sheet).version });
        }
        for (const version of [5, 7, 10, 11]) {
            const document = { timeTables: [table(0)] };
            const root = version === 5 ? { ...document, version } : { version, timeSheets: [document] };
            parseTdtsFile(`toeiDigitalTimeSheet Save Data\n${JSON.stringify(root)}`, 'old.tdts');
            const sheet = getCurrentSheet();
            result.push({ format: 'TDTS', version, names: sheet.layers.slice(0, 3).map(l => l.name),
                values: [1, 6, 7, 10, 13, 16, 24].map(f => sheet.data[f]?.L3 || ''), exported: generateTdtsData(sheet).version });
        }
        renderSpreadsheet(true);
        return result;
    });
    for (const result of results) {
        assert.deepEqual(result.names, ['A', '空列', 'C']);
        assert.deepEqual(result.values, ['a0001', 'a0001', '×', '○', '●', 'a0002', 'a0002']);
        assert.equal(result.exported, result.format === 'TDTS' ? result.version : result.version === 10 ? 10 : 5);
        console.log(`PASS: ${result.format} v${result.version}: cel names, track numbers, symbols and final hold`);
    }
    await page.waitForFunction(() => document.querySelector('td[data-frame="1"][data-layer="L3"]')?.textContent === 'a0001');
}
