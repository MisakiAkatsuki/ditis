// 最適化後の動作確認用テスト
import puppeteer from 'puppeteer';

(async () => {
    console.log('🔍 最適化後の動作確認テスト開始\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // コンソールログを監視
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[操作]') || text.includes('[編集]') || text.includes('[選択]')) {
            console.log('📝', text);
        }
    });
    
    // エラーを監視
    page.on('pageerror', error => {
        console.error('❌ ページエラー:', error.message);
    });
    
    try {
        console.log('1️⃣ ページを開く...');
        await page.goto('http://127.0.0.1:5500/prototype/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
        
        console.log('2️⃣ アプリケーションの初期化を待機...');
        await page.waitForSelector('#spreadsheet', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('3️⃣ 関数定義をチェック...');
        const functions = await page.evaluate(() => {
            return {
                scheduleRender: typeof scheduleRender !== 'undefined',
                renderSpreadsheet: typeof renderSpreadsheet !== 'undefined',
                setupCellEvents: typeof setupCellEvents !== 'undefined',
                selectCell: typeof selectCell !== 'undefined',
                handleCellMouseDown: typeof handleCellMouseDown !== 'undefined'
            };
        });
        
        console.log('   関数定義状況:');
        Object.entries(functions).forEach(([name, defined]) => {
            console.log(`   ${defined ? '✅' : '❌'} ${name}`);
        });
        
        console.log('\n4️⃣ セルクリックテスト...');
        await page.click('td[data-frame="1"][data-layer="1"]');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const selectedCount = await page.evaluate(() => AppState.selectedCells.length);
        console.log(`   選択数: ${selectedCount} ${selectedCount === 1 ? '✅' : '❌'}`);
        
        console.log('\n5️⃣ 数字入力テスト...');
        await page.keyboard.type('5');
        await page.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const cellValue = await page.evaluate(() => {
            const sheet = getCurrentSheet();
            return sheet.data[1] && sheet.data[1][1];
        });
        console.log(`   入力値: "${cellValue}" ${cellValue === '5' ? '✅' : '❌'}`);
        
        console.log('\n6️⃣ レンダリングバッチ処理テスト...');
        const renderCalls = await page.evaluate(() => {
            let callCount = 0;
            const originalRender = renderSpreadsheetImmediate;
            
            // レンダリング呼び出しをカウント
            window.renderSpreadsheetImmediate = function(...args) {
                callCount++;
                return originalRender.apply(this, args);
            };
            
            // 複数回renderSpreadsheet()を呼び出し
            renderSpreadsheet();
            renderSpreadsheet();
            renderSpreadsheet();
            
            return new Promise(resolve => {
                setTimeout(() => resolve(callCount), 100);
            });
        });
        console.log(`   レンダリング呼び出し回数: ${renderCalls} ${renderCalls === 1 ? '✅ バッチ処理動作中' : '❌ バッチ処理失敗'}`);
        
        console.log('\n7️⃣ イベントリスナー重複テスト...');
        const listenerCheck = await page.evaluate(() => {
            return {
                cellEvents: _eventsSetupFlags.cellEvents,
                rowHeaderEvents: _eventsSetupFlags.rowHeaderEvents,
                columnHeaderEvents: _eventsSetupFlags.columnHeaderEvents,
                fpsCornerEvent: _eventsSetupFlags.fpsCornerEvent
            };
        });
        
        console.log('   イベントフラグ状況:');
        Object.entries(listenerCheck).forEach(([name, setup]) => {
            console.log(`   ${setup ? '✅' : '❌'} ${name}: ${setup}`);
        });
        
        console.log('\n✅ 最適化後の動作確認完了');
        console.log('\n5秒後にブラウザを閉じます...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
    } catch (error) {
        console.error('❌ テスト中にエラー:', error.message);
    } finally {
        await browser.close();
    }
})();
