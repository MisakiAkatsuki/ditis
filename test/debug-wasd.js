import puppeteer from 'puppeteer';

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });
    
    const page = await browser.newPage();
    page.on('console', msg => console.log('CONSOLE:', msg.text()));
    
    await page.goto('http://127.0.0.1:5500/prototype/index.html');
    await page.waitForSelector('table tbody tr td', { timeout: 10000 });
    
    // デバッグモード有効化
    await page.evaluate(() => {
        window.AppState.debugMode = true;
    });
    
    // シートクリア
    console.log('\n=== シートクリア ===');
    await page.click('#edit-menu-btn');
    await sleep(300);
    page.once('dialog', async dialog => {
        await dialog.accept();
    });
    await page.click('#clear-sheet-menu');
    await sleep(2000);
    
    // 選択状態確認
    const stateAfterClear = await page.evaluate(() => {
        return {
            selectedCells: window.AppState.selectedCells.length,
            selectionAnchor: window.AppState.selectionAnchor
        };
    });
    console.log('クリア後:', stateAfterClear);
    
    // セルA1をクリック
    console.log('\n=== セルA1クリック ===');
    await page.click('td[data-frame="1"][data-layer="1"]');
    await sleep(500);
    
    const stateAfterClick = await page.evaluate(() => {
        return {
            selectedCells: window.AppState.selectedCells.length,
            selectionAnchor: window.AppState.selectionAnchor,
            cells: window.AppState.selectedCells.map(s => `F${s.frame}L${s.layerId}`)
        };
    });
    console.log('クリック後:', stateAfterClick);
    
    // Shift+ArrowDown
    console.log('\n=== Shift+ArrowDown ===');
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.up('Shift');
    await sleep(500);
    
    const stateAfterShiftDown = await page.evaluate(() => {
        return {
            selectedCells: window.AppState.selectedCells.length,
            selectionAnchor: window.AppState.selectionAnchor,
            cells: window.AppState.selectedCells.slice(0, 10).map(s => `F${s.frame}L${s.layerId}`)
        };
    });
    console.log('Shift+ArrowDown後:', stateAfterShiftDown);
    
    // ブラウザを開いたまま30秒待つ
    console.log('\n30秒後にブラウザを閉じます...');
    await sleep(30000);
    
    await browser.close();
})();
