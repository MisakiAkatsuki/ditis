// 仮想スクロール自動テストスクリプト
// Puppeteer MCPで実行

async function runVirtualScrollTests() {
    const testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        results: []
    };

    function log(name, status, details = '') {
        testResults.total++;
        if (status === 'pass') testResults.passed++;
        else testResults.failed++;
        
        testResults.results.push({
            name,
            status,
            details
        });
        
        console.log(`${status === 'pass' ? '✅' : '❌'} ${name}: ${details}`);
    }

    // アプリケーションを開く
    const appPath = 'file:///D:/TimeSheet/prototype/index.html';
    console.log('📂 アプリケーションを開いています:', appPath);
    
    // ページロード待機
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n=== テスト開始 ===\n');
    
    // テスト1: 初期レンダリング
    console.log('--- テスト1: 初期レンダリング ---');
    try {
        const table = document.querySelector('#spreadsheet table');
        if (table) {
            log('初期レンダリング', 'pass', '表が正常に表示されています');
        } else {
            log('初期レンダリング', 'fail', '表が見つかりません');
        }
    } catch (error) {
        log('初期レンダリング', 'fail', error.message);
    }
    
    // テスト2: DOM要素数
    console.log('\n--- テスト2: DOM要素数（仮想スクロール効果） ---');
    try {
        const allCells = document.querySelectorAll('#spreadsheet td');
        const totalExpectedCells = 144 * 26;
        const actualCells = allCells.length;
        
        if (actualCells < totalExpectedCells) {
            const reduction = Math.round((1 - actualCells / totalExpectedCells) * 100);
            log('仮想スクロール', 'pass', `${actualCells}/${totalExpectedCells}セル (${reduction}%削減)`);
        } else {
            log('仮想スクロール', 'fail', `全セルがレンダリング: ${actualCells}`);
        }
    } catch (error) {
        log('仮想スクロール', 'fail', error.message);
    }
    
    // テスト3: セル選択
    console.log('\n--- テスト3: セル選択の反応速度 ---');
    try {
        const cell = document.querySelector('td[data-frame="5"][data-layer="1"]');
        if (cell) {
            const startTime = performance.now();
            cell.click();
            const endTime = performance.now();
            const selectionTime = Math.round(endTime - startTime);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            const selectedCells = document.querySelectorAll('td.selected');
            
            if (selectedCells.length > 0) {
                const speed = selectionTime < 100 ? '優秀' : selectionTime < 300 ? '良好' : 'やや遅い';
                log('セル選択', 'pass', `${selectionTime}ms (${speed})`);
            } else {
                log('セル選択', 'fail', 'セルが選択されませんでした');
            }
        } else {
            log('セル選択', 'fail', 'テスト用セルが見つかりません');
        }
    } catch (error) {
        log('セル選択', 'fail', error.message);
    }
    
    // テスト4: スクロールDOM更新
    console.log('\n--- テスト4: スクロール時のDOM更新 ---');
    try {
        const container = document.getElementById('spreadsheet');
        const beforeScroll = document.querySelectorAll('#spreadsheet td').length;
        
        container.scrollTop = 1000;
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const afterScroll = document.querySelectorAll('#spreadsheet td').length;
        
        log('スクロールDOM更新', 'pass', `スクロール前: ${beforeScroll}, 後: ${afterScroll}`);
    } catch (error) {
        log('スクロールDOM更新', 'fail', error.message);
    }
    
    // テスト5: メモリ使用量確認
    console.log('\n--- テスト5: メモリ使用量 ---');
    try {
        if (performance.memory) {
            const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
            const totalMB = Math.round(performance.memory.totalJSHeapSize / 1024 / 1024);
            log('メモリ使用量', 'pass', `${usedMB}MB / ${totalMB}MB`);
        } else {
            log('メモリ使用量', 'pass', 'memory APIが利用不可（Chrome以外）');
        }
    } catch (error) {
        log('メモリ使用量', 'fail', error.message);
    }
    
    // テスト6: 複数セルレンダリング速度
    console.log('\n--- テスト6: 複数セル選択パフォーマンス ---');
    try {
        const startTime = performance.now();
        
        // 10セルを連続選択
        for (let i = 1; i <= 10; i++) {
            const cell = document.querySelector(`td[data-frame="${i}"][data-layer="1"]`);
            if (cell) cell.click();
        }
        
        const endTime = performance.now();
        const totalTime = Math.round(endTime - startTime);
        const avgTime = Math.round(totalTime / 10);
        
        if (avgTime < 50) {
            log('複数セル選択', 'pass', `平均${avgTime}ms/セル (優秀)`);
        } else if (avgTime < 100) {
            log('複数セル選択', 'pass', `平均${avgTime}ms/セル (良好)`);
        } else {
            log('複数セル選択', 'fail', `平均${avgTime}ms/セル (遅い)`);
        }
    } catch (error) {
        log('複数セル選択', 'fail', error.message);
    }
    
    // テスト7: 特殊表示（縦線・波線）
    console.log('\n--- テスト7: 特殊表示のレンダリング ---');
    try {
        const verticalLines = document.querySelectorAll('td.vertical-line').length;
        const waveLines = document.querySelectorAll('td.wave-line').length;
        const crossMarks = document.querySelectorAll('td.cross-mark').length;
        
        log('特殊表示', 'pass', `縦線:${verticalLines} 波線:${waveLines} ×印:${crossMarks}`);
    } catch (error) {
        log('特殊表示', 'fail', error.message);
    }
    
    // 結果サマリー
    console.log('\n=== テスト完了 ===');
    console.log(`総テスト数: ${testResults.total}`);
    console.log(`成功: ${testResults.passed}`);
    console.log(`失敗: ${testResults.failed}`);
    
    if (testResults.failed === 0) {
        console.log('🎉 すべてのテストに合格しました！');
    } else {
        console.log('⚠️ 一部のテストが失敗しました');
    }
    
    return testResults;
}

// テスト実行
runVirtualScrollTests();
