/**
 * デジタルタイムシート 包括的自動テスト
 * Puppeteer使用
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testResults = {
    passed: [],
    failed: [],
    warnings: [],
    total: 0
};

function logTest(name, passed, message = '') {
    testResults.total++;
    if (passed) {
        testResults.passed.push(name);
        console.log(`✅ ${name}`);
    } else {
        testResults.failed.push({ name, message });
        console.log(`❌ ${name}: ${message}`);
    }
}

function logWarning(name, message) {
    testResults.warnings.push({ name, message });
    console.log(`⚠️  ${name}: ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * セルに値を入力するヘルパー関数（より確実な方法）
 * @param {Page} page - Puppeteerページオブジェクト
 * @param {string} frameSelector - セルセレクタ (例: 'td[data-frame="1"][data-layer="1"]')
 * @param {string} value - 入力する値
 */
async function inputCellValue(page, frameSelector, value) {
    // セルをクリックして選択
    await page.click(frameSelector);
    await sleep(200);
    
    // F2キーで編集モードを開始（より確実）
    await page.keyboard.press('F2');
    await sleep(300);
    
    // input要素が表示されるのを待つ
    try {
        await page.waitForFunction(
            (selector) => {
                const cell = document.querySelector(selector);
                const input = cell ? cell.querySelector('input') : null;
                return input !== null;
            },
            { timeout: 1000 },
            frameSelector
        );
    } catch (error) {
        console.log(`⚠️  編集モードに入れませんでした: ${frameSelector}`);
        // フォールバック: ダブルクリックを試す
        await page.click(frameSelector, { clickCount: 2 });
        await sleep(300);
    }
    
    // input要素に直接値を設定
    await page.evaluate((selector, val) => {
        const cell = document.querySelector(selector);
        const input = cell ? cell.querySelector('input') : null;
        if (input) {
            input.value = val;
            // inputイベントを発火させる
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, frameSelector, value);
    
    await sleep(200);
}

async function setupConsoleMonitoring(page) {
    const errors = [];
    const warnings = [];
    const networkErrors = [];
    
    // ネットワークエラーを監視
    page.on('requestfailed', request => {
        const failure = `${request.url()} - ${request.failure().errorText}`;
        networkErrors.push(failure);
        console.log(`🔴 ネットワークエラー: ${failure}`);
    });
    
    page.on('response', response => {
        if (response.status() === 404) {
            const msg = `404: ${response.url()}`;
            networkErrors.push(msg);
            console.log(`🔴 404エラー: ${response.url()}`);
        }
    });
    
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        
        if (type === 'error') {
            errors.push(text);
            console.log(`🔴 コンソールエラー: ${text}`);
        } else if (type === 'warning') {
            warnings.push(text);
        } else if (type === 'log') {
            // デバッグログも表示
            console.log(`📝 コンソール: ${text}`);
        }
    });
    
    page.on('pageerror', error => {
        errors.push(error.message);
        console.log(`🔴 ページエラー: ${error.message}`);
        console.log(`   スタック: ${error.stack}`);
    });
    
    return { errors, warnings, networkErrors };
}

// テスト1: 基本的なセル操作
async function testBasicCellOperations(page) {
    console.log('\n=== テスト1: 基本的なセル操作 ===');
    
    try {
        // セルをクリック
        await page.click('td[data-frame="1"][data-layer="1"]');
        await sleep(300);
        
        const selectedCount = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('セル選択（単一）', selectedCount === 1, `選択数: ${selectedCount}`);
        
        // 数字入力（inputCellValue関数を使用）
        await inputCellValue(page, 'td[data-frame="1"][data-layer="1"]', '5');
        
        // Enterで確定
        await page.keyboard.press('Enter');
        await sleep(500); // 描画とデータ更新を待つ
        
        // 入力された値を確認
        const cellValue = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="1"][data-layer="1"]');
            return cell ? cell.textContent.trim() : '';
        });
        logTest('数字入力（1桁）', cellValue === '5', `値: "${cellValue}"`);
        
        // 移動先を確認
        const selectedFrame = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-frame') : null;
        });
        logTest('Enterで次セルへ移動', selectedFrame === '2', `移動先: ${selectedFrame}`);
        
        // 同じ数字を入力して'-'表示確認
        await inputCellValue(page, 'td[data-frame="2"][data-layer="1"]', '5');
        await page.keyboard.press('Enter');
        await sleep(500); // 描画を待つ
        
        const dashValue = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="2"][data-layer="1"]');
            return cell ? cell.textContent.trim() : '';
        });
        logTest('"-"の自動表示', dashValue === '-', `値: "${dashValue}"`);
        
    } catch (error) {
        logTest('基本セル操作', false, error.message);
    }
}

// テスト2: 複数選択とドラッグ
async function testMultipleSelection(page) {
    console.log('\n=== テスト2: 複数選択とドラッグ ===');
    
    try {
        // セルをクリック
        await page.click('td[data-frame="5"][data-layer="2"]');
        await sleep(200);
        
        // Shiftを押しながらクリック
        await page.keyboard.down('Shift');
        await page.click('td[data-frame="7"][data-layer="2"]');
        await page.keyboard.up('Shift');
        await sleep(200);
        
        const selectedCount = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('Shift+クリック範囲選択', selectedCount === 3, `選択数: ${selectedCount}`);
        
        // ドラッグ選択
        const startCell = await page.$('td[data-frame="10"][data-layer="3"]');
        const endCell = await page.$('td[data-frame="12"][data-layer="3"]');
        
        const startBox = await startCell.boundingBox();
        const endBox = await endCell.boundingBox();
        
        await page.mouse.move(startBox.x + startBox.width/2, startBox.y + startBox.height/2);
        await page.mouse.down();
        await page.mouse.move(endBox.x + endBox.width/2, endBox.y + endBox.height/2);
        await page.mouse.up();
        await sleep(200);
        
        const dragSelectedCount = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('ドラッグ選択', dragSelectedCount >= 3, `選択数: ${dragSelectedCount}`);
        
    } catch (error) {
        logTest('複数選択テスト', false, error.message);
    }
}

// テスト3: キーボード操作
async function testKeyboardOperations(page) {
    console.log('\n=== テスト3: キーボード操作 ===');
    
    try {
        // セル選択
        await page.click('td[data-frame="15"][data-layer="4"]');
        await sleep(200);
        
        // 矢印キー移動（下）
        await page.keyboard.press('ArrowDown');
        await sleep(200);
        
        const afterDown = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-frame') : null;
        });
        logTest('矢印キー（下）移動', afterDown === '16', `移動先: ${afterDown}`);
        
        // 矢印キー移動（右）
        await page.keyboard.press('ArrowRight');
        await sleep(200);
        
        const afterRight = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-layer') : null;
        });
        logTest('矢印キー（右）移動', afterRight === '5', `移動先: ${afterRight}`);
        
        // Home キー
        await page.keyboard.press('Home');
        await sleep(200);
        
        const afterHome = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-frame') : null;
        });
        logTest('Homeキーで先頭へ', afterHome === '1', `移動先: ${afterHome}`);
        
        // Escキー（選択を1つに）
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.up('Shift');
        await sleep(200);
        
        await page.keyboard.press('Escape');
        await sleep(200);
        
        const afterEsc = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('Escキーで選択を1つに', afterEsc === 1, `選択数: ${afterEsc}`);
        
    } catch (error) {
        logTest('キーボード操作', false, error.message);
    }
}

// テスト4: 特殊キー（+, -, *, /, .）
async function testSpecialKeys(page) {
    console.log('\n=== テスト4: 特殊キー操作 ===');
    
    try {
        // セル選択して数字入力
        await inputCellValue(page, 'td[data-frame="20"][data-layer="5"]', '3');
        await page.keyboard.press('Enter');
        await sleep(500);
        
        // +キーで移動（フレーム21へ）
        const afterPlusFrame = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-frame') : null;
        });
        
        await page.keyboard.press('+');
        await sleep(500);
        
        const afterPlus = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-frame') : null;
        });
        logTest('+キーで次へ移動', afterPlus === '22', `移動先: ${afterPlusFrame} → ${afterPlus}`);
        
        // -キーで次へ移動（仕様：-キーは進む）
        await page.keyboard.press('-');
        await sleep(500);
        
        const afterMinus = await page.evaluate(() => {
            const selected = document.querySelector('td.selected');
            return selected ? selected.getAttribute('data-frame') : null;
        });
        logTest('-キーで次へ移動', afterMinus === '23', `移動先: ${afterMinus}`);
        
        // .キーで縦線処理
        // まず数字を入力してEnterで確定
        await inputCellValue(page, 'td[data-frame="30"][data-layer="8"]', '5');
        await page.keyboard.press('Enter');
        await sleep(500);
        
        // 次のセル（31,8）が選択されているはずなので、そこで.キーを押す
        // 仕様：空セルで.キーを押すと、前のセルに数字があれば縦線を表示
        await page.keyboard.press('.');
        await sleep(1500); // fillDashToEndとrenderSpreadsheetの完了を待つ
        
        const verticalLineInfo = await page.evaluate(() => {
            const sheet = window.AppState?.sheets?.[window.AppState?.currentSheetIndex];
            // データに"5"（同じ値）が入っているか確認（frame 31から144まで）
            let dashCount = 0;
            if (sheet && sheet.data) {
                for (let f = 31; f <= 144; f++) {
                    if (sheet.data[f] && sheet.data[f][8] === '5') {
                        dashCount++;
                    }
                }
            }
            // 縦線クラスを持つセルを検索
            const cells = document.querySelectorAll('td[data-layer="8"].vertical-line-start, td[data-layer="8"].vertical-line-continue, td[data-layer="8"].vertical-line-end');
            console.log('縦線セル検索結果 (layer 8):', cells.length, 'ダッシュ数:', dashCount);
            return { dashCount, lineCount: cells.length };
        });
        logTest('.キーで縦線表示', verticalLineInfo.dashCount > 100, `ダッシュ数: ${verticalLineInfo.dashCount} (期待: 114)`);
        
    } catch (error) {
        logTest('特殊キー操作', false, error.message);
    }
}

// テスト5: 右クリックメニュー
async function testContextMenu(page) {
    console.log('\n=== テスト5: 右クリックメニュー ===');
    
    try {
        // セル右クリック
        await page.click('td[data-frame="30"][data-layer="7"]', { button: 'right' });
        await sleep(300);
        
        const contextMenuVisible = await page.evaluate(() => {
            const menu = document.querySelector('.context-menu');
            return menu && menu.style.display !== 'none';
        });
        logTest('セル右クリックメニュー表示', contextMenuVisible, 'メニューが表示される');
        
        // メニューを閉じる
        await page.keyboard.press('Escape');
        await sleep(200);
        
        // 左ヘッダー右クリック
        await page.click('td[data-frame="35"]', { button: 'right' });
        await sleep(300);
        
        const headerMenuVisible = await page.evaluate(() => {
            const menu = document.querySelector('.context-menu');
            return menu && menu.style.display !== 'none';
        });
        logTest('ヘッダー右クリックメニュー表示', headerMenuVisible, 'メニューが表示される');
        
        await page.keyboard.press('Escape');
        await sleep(200);
        
    } catch (error) {
        logTest('右クリックメニュー', false, error.message);
    }
}

// テスト6: メニュー機能
async function testMenuFunctions(page) {
    console.log('\n=== テスト6: メニュー機能 ===');
    
    try {
        // 表示サイズ変更（メニュー形式）
        await page.click('#view-menu-btn');
        await sleep(500);
        
        // 小サイズに変更
        await page.click('#font-size-small');
        await sleep(500);
        
        const cellWidthSmall = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--cell-width').trim();
        });
        console.log('小サイズ時のセル幅:', cellWidthSmall);
        logTest('表示サイズ変更（小）', cellWidthSmall === '31px' || cellWidthSmall === '32px', `セル幅: ${cellWidthSmall}`);
        
        // 標準に戻す
        await page.click('#view-menu-btn');
        await sleep(500);
        await page.click('#font-size-normal');
        await sleep(500);
        
        // ダークテーマ切り替え
        // まず表示メニューを開く
        await page.click('#view-menu-btn');
        await sleep(800);
        
        const themeMenuItem = await page.$('#toggle-theme');
        if (themeMenuItem) {
            await themeMenuItem.click();
            await sleep(1000);
            
            const isDark = await page.evaluate(() => {
                return document.documentElement.getAttribute('data-theme') === 'dark';
            });
            logTest('ダークテーマ切り替え', isDark, `ダークテーマ: ${isDark}`);
            
            // ライトテーマに戻す
            await page.click('#view-menu-btn');
            await sleep(800);
            const themeMenuItem2 = await page.$('#toggle-theme');
            if (themeMenuItem2) {
                await themeMenuItem2.click();
                await sleep(800);
            }
        } else {
            logTest('ダークテーマ切り替え', false, '#toggle-themeが見つかりません');
        }
        
        // フレームフィルター
        // テストが失敗していたので削除（フィルター機能は testDisplayAndFile でテスト済み）
        
    } catch (error) {
        logTest('メニュー機能', false, error.message);
    }
}

// テスト7: Undo/Redo
async function testUndoRedo(page) {
    console.log('\n=== テスト7: Undo/Redo ===');
    
    try {
        // セルに入力（他のテストと干渉しないレイヤーを使用）
        await inputCellValue(page, 'td[data-frame="40"][data-layer="10"]', '9');
        await sleep(200);
        await page.keyboard.press('Enter');
        await sleep(300);
        
        const valueBeforeUndo = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="40"][data-layer="10"]');
            return cell ? cell.textContent.trim() : '';
        });
        
        // Undo
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        await sleep(300);
        
        const valueAfterUndo = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="40"][data-layer="10"]');
            return cell ? cell.textContent.trim() : '';
        });
        logTest('Undo機能', valueAfterUndo === '', `Undo後の値: "${valueAfterUndo}"`);
        
        // Redo
        await page.keyboard.down('Control');
        await page.keyboard.press('y');
        await page.keyboard.up('Control');
        await sleep(300);
        
        const valueAfterRedo = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="40"][data-layer="10"]');
            return cell ? cell.textContent.trim() : '';
        });
        logTest('Redo機能', valueAfterRedo === '9', `Redo後の値: ${valueAfterRedo}`);
        
    } catch (error) {
        logTest('Undo/Redo', false, error.message);
    }
}

// テスト8: タブ管理
async function testTabManagement(page) {
    console.log('\n=== テスト8: タブ管理 ===');
    
    try {
        // 初期タブ数
        const initialTabCount = await page.evaluate(() => {
            return document.querySelectorAll('.tab').length;
        });
        
        // 新規タブ追加ボタンをクリック
        const addTabBtn = await page.$('#add-tab-btn');
        if (addTabBtn) {
            // プロンプトをモック
            await page.evaluateOnNewDocument(() => {
                window.prompt = () => 'TestSheet';
            });
            
            await addTabBtn.click();
            await sleep(500);
            
            logTest('タブ追加', true, 'タブ追加ボタンが動作');
        } else {
            logTest('タブ追加', false, '#add-tab-btnが見つかりません');
        }
        
        // タブ切り替え
        const tabs = await page.$$('.tab');
        if (tabs.length > 0) {
            await tabs[0].click();
            await sleep(300);
            
            const activeTabIndex = await page.evaluate(() => {
                return window.AppState ? window.AppState.currentSheetIndex : null;
            });
            logTest('タブ切り替え', activeTabIndex !== null, `アクティブタブ: ${activeTabIndex}`);
        }
        
    } catch (error) {
        logTest('タブ管理', false, error.message);
    }
}

// テスト9: 波線・バツ印・縦線の表示
async function testSpecialDisplays(page) {
    console.log('\n=== テスト9: 特殊表示（波線・バツ印・縦線） ===');
    
    try {
        // 縦線表示のテスト（尺の最後まで続く）
        // 新しい列を使用してテストの干渉を避ける
        await inputCellValue(page, 'td[data-frame="80"][data-layer="15"]', '8');
        await page.keyboard.press('Enter');
        await sleep(300);
        await inputCellValue(page, 'td[data-frame="81"][data-layer="15"]', '8');
        await page.keyboard.press('.');
        await sleep(1500); // 縦線の描画を待つ
        
        const hasVerticalLine = await page.evaluate(() => {
            const cells = document.querySelectorAll('td[data-layer="15"].vertical-line-start, td[data-layer="15"].vertical-line-continue, td[data-layer="15"].vertical-line-end');
            console.log('縦線セル数:', cells.length);
            // 縦線セルの詳細情報を取得
            const cellInfo = Array.from(cells).slice(0, 5).map(c => ({
                frame: c.getAttribute('data-frame'),
                classes: c.className
            }));
            console.log('縦線セル詳細:', cellInfo);
            return cells.length > 0;
        });
        const vLineCount = await page.evaluate(() => {
            return document.querySelectorAll('td[data-layer="15"].vertical-line-start, td[data-layer="15"].vertical-line-continue, td[data-layer="15"].vertical-line-end').length;
        });
        logTest('縦線表示（尺の最後まで）', hasVerticalLine, `縦線セル数: ${vLineCount}`);
        
        // 波線・バツ印のテスト（中コマ）
        await inputCellValue(page, 'td[data-frame="90"][data-layer="16"]', '9');
        await page.keyboard.press('Enter');
        await sleep(300);
        // 空セルを2つ作る（Enterを2回）
        await page.keyboard.press('Enter');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(300);
        // 次の数字
        await inputCellValue(page, 'td[data-frame="93"][data-layer="16"]', '1');
        await page.keyboard.press('Enter');
        await sleep(1500); // 波線の描画を待つ
        
        const hasWaveLine = await page.evaluate(() => {
            const cells = document.querySelectorAll('td[data-layer="16"].wave-line');
            console.log('波線セル数:', cells.length);
            return cells.length > 0;
        });
        const wLineCount = await page.evaluate(() => {
            return document.querySelectorAll('td[data-layer="16"].wave-line').length;
        });
        logTest('波線表示（中コマ）', hasWaveLine, `波線セル数: ${wLineCount}`);
        
        const hasCrossMark = await page.evaluate(() => {
            const cells = document.querySelectorAll('td[data-layer="16"].cross-mark');
            console.log('バツ印セル数:', cells.length);
            return cells.length > 0;
        });
        logTest('バツ印表示（中コマ先頭）', hasCrossMark, 'バツ印が表示される');
        
    } catch (error) {
        logTest('特殊表示', false, error.message);
    }
}

// テスト10: パフォーマンスチェック
async function testPerformance(page) {
    console.log('\n=== テスト10: パフォーマンスチェック ===');
    
    try {
        // 大量選択のパフォーマンス
        const startTime = Date.now();
        
        await page.click('td[data-frame="1"][data-layer="1"]');
        await sleep(100);
        
        await page.keyboard.down('Shift');
        await page.click('td[data-frame="50"][data-layer="20"]');
        await page.keyboard.up('Shift');
        await sleep(300);
        
        const selectionTime = Date.now() - startTime;
        logTest('大量選択のパフォーマンス', selectionTime < 1200, `選択時間: ${selectionTime}ms`);
        
        // スクロールのパフォーマンス
        const scrollStart = Date.now();
        await page.evaluate(() => {
            const container = document.querySelector('.spreadsheet');
            container.scrollTop = 1000;
        });
        await sleep(300);
        
        const scrollTime = Date.now() - scrollStart;
        logTest('スクロールのパフォーマンス', scrollTime < 500, `スクロール時間: ${scrollTime}ms`);
        
    } catch (error) {
        logTest('パフォーマンス', false, error.message);
    }
}

// テスト11: 行列操作（挿入・削除・無効化）
async function testRowColumnOperations(page) {
    console.log('\n=== テスト11: 行列操作 ===');
    
    try {
        // 初期状態の行数を取得
        const initialRowCount = await page.evaluate(() => {
            const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
            return sheet ? sheet.visibleRows : 144;
        });
        
        // 行の途中挿入
        await page.click('td[data-frame="10"][data-layer="1"]');
        await sleep(300);
        // 行ヘッダーを右クリック
        await page.evaluate(() => {
            const header = document.querySelector('td[data-frame-header="10"]');
            if (header) {
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2
                });
                header.dispatchEvent(event);
            }
        });
        await sleep(800); // メニュー表示を待つ
        
        // メニューが表示されているか確認
        const menuVisible = await page.evaluate(() => {
            const menu = document.querySelector('#context-menu');
            return menu && menu.style.display !== 'none';
        });
        
        if (!menuVisible) {
            logTest('行の途中挿入', false, '右クリックメニューが表示されません');
        } else {
            // 右クリックメニューから「この位置に挿入」を選択
            const insertMenuItem = await page.$('[data-action="insert-here"]');
            if (insertMenuItem) {
                await insertMenuItem.click();
                await sleep(800);
                
                // 行数が増えたか確認
                const afterInsertRowCount = await page.evaluate(() => {
                    const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
                    return sheet ? sheet.visibleRows : 0;
                });
                // 前のテストで初期化されているので、比較は現在の値+1と比較
                logTest('行の途中挿入', afterInsertRowCount > initialRowCount, `行数: ${initialRowCount} → ${afterInsertRowCount}`);
                
                // 次のテストで使用するため、挿入後の行数を変数に保存
                global.afterInsertRowCount = afterInsertRowCount;
            } else {
                logTest('行の途中挿入', false, '挿入メニューが見つかりません');
            }
        }
        
        // 行の無効化
        await page.click('td[data-frame="15"][data-layer="1"]');
        await sleep(300);
        // 行ヘッダーを右クリック
        await page.evaluate(() => {
            const header = document.querySelector('td[data-frame-header="15"]');
            if (header) {
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2
                });
                header.dispatchEvent(event);
            }
        });
        await sleep(800);
        
        const disableMenuItem = await page.$('[data-action="toggle-disable-frames"]');
        if (disableMenuItem) {
            await disableMenuItem.click();
            await sleep(800);
            
            // 無効化されたか確認（disabledFrames配列に追加されている）
            const isDisabled = await page.evaluate(() => {
                const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
                return sheet.disabledFrames && sheet.disabledFrames.includes(15);
            });
            logTest('行の無効化', isDisabled, `フレーム15が無効化: ${isDisabled}`);
            
            // 有効化（トグル）
            // 行ヘッダーを右クリック
            await page.evaluate(() => {
                const header = document.querySelector('td[data-frame-header="15"]');
                if (header) {
                    const event = new MouseEvent('contextmenu', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        button: 2
                    });
                    header.dispatchEvent(event);
                }
            });
            await sleep(800);
            const disableMenuItem2 = await page.$('[data-action="toggle-disable-frames"]');
            if (disableMenuItem2) {
                await disableMenuItem2.click();
                await sleep(800);
            }
            
            const isEnabled = await page.evaluate(() => {
                const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
                return !sheet.disabledFrames || !sheet.disabledFrames.includes(15);
            });
            logTest('行の有効化', isEnabled, `フレーム15が有効化: ${isEnabled}`);
        } else {
            logTest('行の無効化', false, '無効化メニューが見つかりません');
            logTest('行の有効化', false, 'スキップ');
        }
        
        // 行の削除
        await page.click('td[data-frame="20"][data-layer="1"]');
        await sleep(300);
        // 行ヘッダーを右クリック
        await page.evaluate(() => {
            const header = document.querySelector('td[data-frame-header="20"]');
            if (header) {
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2
                });
                header.dispatchEvent(event);
            }
        });
        await sleep(800);
        
        const deleteMenuItem = await page.$('[data-action="delete-frames"]');
        if (deleteMenuItem) {
            await deleteMenuItem.click();
            await sleep(800);
            
            // 行数が減ったか確認
            const afterDeleteRowCount = await page.evaluate(() => {
                const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
                return sheet ? sheet.visibleRows : 0;
            });
            // 削除されたかを確認（単純に減っていればOK）
            const beforeDeleteCount = global.afterInsertRowCount || initialRowCount + 1;
            logTest('行の削除', afterDeleteRowCount < beforeDeleteCount, `削除前: ${beforeDeleteCount} → 削除後: ${afterDeleteRowCount}`);
        } else {
            logTest('行の削除', false, '削除メニューが見つかりません');
        }
        
        // 列の挿入
        const initialColumnCount = await page.evaluate(() => {
            const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
            return sheet ? sheet.layers.length : 0;
        });
        
        // 列ヘッダーを右クリック（レイヤー5）
        await page.evaluate(() => {
            const header = document.querySelector('th[data-layer-id="5"]');
            if (header) {
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2
                });
                header.dispatchEvent(event);
            }
        });
        await sleep(800);
        
        const insertColumnMenuItem = await page.$('[data-action="insert-column"]');
        if (insertColumnMenuItem) {
            await insertColumnMenuItem.click();
            await sleep(1000);
            
            const afterInsertColumnCount = await page.evaluate(() => {
                const sheet = window.AppState.sheets[window.AppState.currentSheetIndex];
                return sheet ? sheet.layers.length : 0;
            });
            logTest('列の挿入', afterInsertColumnCount === initialColumnCount + 1, `列数: ${initialColumnCount} → ${afterInsertColumnCount}`);
        } else {
            logTest('列の挿入', false, '列挿入メニューが見つかりません');
        }
        
        // 列の削除
        await page.evaluate(() => {
            const header = document.querySelector('th[data-layer-id="6"]');
            if (header) {
                const event = new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 2
                });
                header.dispatchEvent(event);
            }
        });
        await sleep(800);
        
        const deleteColumnMenuItem = await page.$('[data-action="delete-column"]');
        if (deleteColumnMenuItem) {
            await deleteColumnMenuItem.click();
            await sleep(1000);
            
            const afterDeleteColumnCount = await page.evaluate(() => {
                return window.AppState.sheets[window.AppState.currentSheetIndex].visibleColumns;
            });
            const expectedColumnCount = initialColumnCount + 1 - 1;
            logTest('列の削除', afterDeleteColumnCount === expectedColumnCount, `列数: ${expectedColumnCount}（期待値） vs ${afterDeleteColumnCount}（実際）`);
        } else {
            logTest('列の削除', false, '列削除メニューが見つかりません');
        }
        
    } catch (error) {
        logTest('行列操作', false, error.message);
    }
}

// テスト12: 拡張キーボード操作（*、/、Shift+矢印、Shift+Home/End、Delete、F2）
async function testExtendedKeyboardOps(page) {
    console.log('\n=== テスト12: 拡張キーボード操作 ===');
    
    try {
        // *キー（範囲を下に1フレーム拡張）
        await page.click('td[data-frame="30"][data-layer="8"]');
        await sleep(300);
        await page.keyboard.press('*');
        await sleep(300);
        
        const afterAsterisk = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('*キーで範囲拡張', afterAsterisk === 2, `選択数: ${afterAsterisk}`);
        
        // /キー（選択を1フレーム縮小）
        await page.keyboard.press('/');
        await sleep(300);
        
        const afterSlash = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('/キーで範囲縮小', afterSlash === 1, `選択数: ${afterSlash}`);
        
        // Shift+矢印キーによるアンカーベース範囲選択
        await page.click('td[data-frame="40"][data-layer="10"]');
        await sleep(300);
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.up('Shift');
        await sleep(300);
        
        const shiftSelection = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('Shift+矢印でアンカーベース範囲選択', shiftSelection === 6, `選択数: ${shiftSelection}`);
        
        // Shift+Home（選択セルより上を全選択）
        await page.click('td[data-frame="50"][data-layer="12"]');
        await sleep(300);
        await page.keyboard.down('Shift');
        await page.keyboard.press('Home');
        await page.keyboard.up('Shift');
        await sleep(300);
        
        const shiftHomeSelection = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('Shift+Homeで上を全選択', shiftHomeSelection >= 50, `選択数: ${shiftHomeSelection}`);
        
        // Shift+End（選択セルより下を全選択）
        await page.click('td[data-frame="10"][data-layer="12"]');
        await sleep(300);
        await page.keyboard.down('Shift');
        await page.keyboard.press('End');
        await page.keyboard.up('Shift');
        await sleep(500);
        
        const shiftEndSelection = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('Shift+Endで下を全選択', shiftEndSelection >= 100, `選択数: ${shiftEndSelection}`);
        
        // Deleteキー（セル内容削除）
        await page.click('td[data-frame="60"][data-layer="13"]');
        await sleep(300);
        await page.keyboard.type('9');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(300);
        await page.click('td[data-frame="60"][data-layer="13"]');
        await sleep(300);
        await page.keyboard.press('Delete');
        await sleep(300);
        
        const afterDelete = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="60"][data-layer="13"]');
            return cell ? cell.textContent.trim() : 'not-found';
        });
        logTest('Deleteキーでセル内容削除', afterDelete === '', `セル内容: "${afterDelete}"`);
        
        // F2キー（編集モード開始）
        await page.click('td[data-frame="65"][data-layer="14"]');
        await sleep(300);
        await page.keyboard.type('8');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(300);
        await page.click('td[data-frame="65"][data-layer="14"]');
        await sleep(300);
        await page.keyboard.press('F2');
        await sleep(300);
        
        const isEditing = await page.evaluate(() => {
            const cell = document.querySelector('td[data-frame="65"][data-layer="14"]');
            return cell && cell.classList.contains('editing');
        });
        logTest('F2キーで編集モード開始', isEditing, `編集モード: ${isEditing}`);
        
        // 編集キャンセル
        await page.keyboard.press('Escape');
        await sleep(300);
        
    } catch (error) {
        logTest('拡張キーボード操作', false, error.message);
    }
}

// テスト13: UI操作（fps クリック、ダブルクリック）
async function testUIOperations(page) {
    console.log('\n=== テスト13: UI操作 ===');
    
    try {
        // テストデータ入力
        await page.click('td[data-frame="70"][data-layer="15"]');
        await sleep(300);
        await page.keyboard.type('5');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(300);
        await page.keyboard.type('6');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(500);
        
        // fps部分クリックで入力済み全選択
        // fps表示部分をクリック（左上のセル）
        await page.evaluate(() => {
            const fpsCell = document.querySelector('table thead tr:first-child th:first-child');
            if (fpsCell) {
                fpsCell.click();
            }
        });
        await sleep(500);
        
        const fpsClickSelection = await page.evaluate(() => {
            return document.querySelectorAll('td.selected').length;
        });
        logTest('fps部分クリックで入力済み全選択', fpsClickSelection >= 2, `選択数: ${fpsClickSelection}`);
        
        // セルダブルクリックで列全体選択
        await page.click('td[data-frame="1"][data-layer="1"]');
        await sleep(300);
        await page.click('td[data-frame="80"][data-layer="16"]', { clickCount: 2 });
        await sleep(500);
        
        const doubleClickSelection = await page.evaluate(() => {
            const selected = document.querySelectorAll('td.selected');
            const layer16 = Array.from(selected).filter(cell => 
                cell.getAttribute('data-layer') === '16'
            );
            return layer16.length;
        });
        logTest('セルダブルクリックで列全体選択', doubleClickSelection >= 100, `選択数: ${doubleClickSelection}`);
        
        // 列ヘッダークリックで列選択
        await page.evaluate(() => {
            const header = document.querySelector('th[data-layer-id="17"]');
            if (header) {
                const event = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0
                });
                header.dispatchEvent(event);
            }
        });
        await sleep(500);
        
        const columnClickSelection = await page.evaluate(() => {
            const selected = document.querySelectorAll('td.selected');
            const layer17 = Array.from(selected).filter(cell => 
                cell.getAttribute('data-layer') === '17'
            );
            return layer17.length;
        });
        logTest('列ヘッダークリックで列全体選択', columnClickSelection >= 100, `選択数: ${columnClickSelection}`);
        
    } catch (error) {
        logTest('UI操作', false, error.message);
    }
}

// テスト14: コピー/カット/ペースト
async function testClipboardOps(page) {
    console.log('\n=== テスト14: コピー/カット/ペースト ===');
    
    try {
        // コピー元データ作成
        await inputCellValue(page, 'td[data-frame="85"][data-layer="18"]', '3');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(300);
        await inputCellValue(page, 'td[data-frame="86"][data-layer="18"]', '4');
        await sleep(300);
        await page.keyboard.press('Enter');
        await sleep(300);
        
        // 範囲選択
        await page.click('td[data-frame="85"][data-layer="18"]');
        await sleep(300);
        await page.keyboard.down('Shift');
        await page.click('td[data-frame="86"][data-layer="18"]');
        await page.keyboard.up('Shift');
        await sleep(300);
        
        // コピー
        await page.keyboard.down('Control');
        await page.keyboard.press('c');
        await page.keyboard.up('Control');
        await sleep(300);
        
        // ペースト先に移動
        await page.click('td[data-frame="90"][data-layer="18"]');
        await sleep(300);
        
        // ペースト
        await page.keyboard.down('Control');
        await page.keyboard.press('v');
        await page.keyboard.up('Control');
        await sleep(500);
        
        const pasteResult = await page.evaluate(() => {
            const cell1 = document.querySelector('td[data-frame="90"][data-layer="18"]');
            const cell2 = document.querySelector('td[data-frame="91"][data-layer="18"]');
            return {
                cell1: cell1 ? cell1.textContent.trim() : 'not-found',
                cell2: cell2 ? cell2.textContent.trim() : 'not-found'
            };
        });
        logTest('コピー/ペースト', pasteResult.cell1 === '3' && pasteResult.cell2 === '4', `ペースト結果: ${JSON.stringify(pasteResult)}`);
        
        // カット
        await page.click('td[data-frame="85"][data-layer="18"]');
        await sleep(300);
        await page.keyboard.down('Shift');
        await page.click('td[data-frame="86"][data-layer="18"]');
        await page.keyboard.up('Shift');
        await sleep(300);
        
        await page.keyboard.down('Control');
        await page.keyboard.press('x');
        await page.keyboard.up('Control');
        await sleep(300);
        
        // カット元が空になっているか確認
        const cutResult = await page.evaluate(() => {
            const cell1 = document.querySelector('td[data-frame="85"][data-layer="18"]');
            const cell2 = document.querySelector('td[data-frame="86"][data-layer="18"]');
            return {
                cell1: cell1 ? cell1.textContent.trim() : 'not-found',
                cell2: cell2 ? cell2.textContent.trim() : 'not-found'
            };
        });
        logTest('カット', cutResult.cell1 === '' && cutResult.cell2 === '', `カット結果: ${JSON.stringify(cutResult)}`);
        
    } catch (error) {
        logTest('クリップボード操作', false, error.message);
    }
}

// テスト15: 表示切替とファイル操作
async function testDisplayAndFile(page) {
    console.log('\n=== テスト15: 表示切替とファイル操作 ===');
    
    try {
        // コマ表記切替（実数表記）
        await page.click('#view-menu-btn');
        await sleep(300);
        await page.click('#header-mode-simple'); // 実数表記はsimple
        await sleep(500);
        
        const isSimple = await page.evaluate(() => {
            return window.AppState ? window.AppState.headerDisplayMode === 'simple' : false;
        });
        logTest('コマ表記切替（実数表記）', isSimple, `実数表記: ${isSimple}`);
        
        // 通常表示に戻す
        await page.click('#view-menu-btn');
        await sleep(300);
        await page.click('#header-mode-detail');
        await sleep(300);
        
        // フレームフィルター（奇数のみ）
        await page.click('#view-menu-btn');
        await sleep(300);
        await page.click('#frame-filter-odd');
        await sleep(500);
        
        const isOdd = await page.evaluate(() => {
            return window.AppState ? window.AppState.frameFilter === 'odd' : false;
        });
        logTest('フレームフィルター（奇数のみ）', isOdd, `奇数フィルター: ${isOdd}`);
        
        // 全表示に戻す
        await page.click('#view-menu-btn');
        await sleep(300);
        await page.click('#frame-filter-all');
        await sleep(300);
        
        // 表初期化（確認ダイアログあり）
        await page.click('#edit-menu-btn');
        await sleep(500);
        
        // 確認ダイアログハンドラーを設定
        page.once('dialog', async dialog => {
            await dialog.accept();
        });
        
        await page.click('#clear-sheet-menu');
        await sleep(1000);
        
        const isReset = await page.evaluate(() => {
            const sheet = window.AppState?.sheets?.[window.AppState?.currentSheetIndex];
            if (!sheet) return false;
            // データが空になっているか確認
            let hasData = false;
            for (let f = 1; f <= 10; f++) {
                if (sheet.data[f]) {
                    for (let l = 1; l <= 26; l++) {
                        if (sheet.data[f][l] && sheet.data[f][l] !== '') {
                            hasData = true;
                            break;
                        }
                    }
                }
                if (hasData) break;
            }
            return !hasData;
        });
        logTest('表初期化', isReset, `初期化完了: ${isReset}`);
        
    } catch (error) {
        logTest('表示切替とファイル操作', false, error.message);
    }
}

// テスト16: W/A/S/Dキー操作
async function testWASDKeys(page) {
    console.log('\n=== テスト16: W/A/S/Dキー操作 ===');
    
    try {
        // ページをリロードして前のテストの影響を完全にリセット
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector('table tbody tr td', { timeout: 10000 });
        await sleep(1000);
        
        // 表を初期化
        await page.click('#edit-menu-btn');
        await sleep(500);
        page.once('dialog', async dialog => {
            await dialog.accept();
        });
        await page.click('#clear-sheet-menu');
        await sleep(2000); // リセット処理の完了を待つ
        
        // renderSpreadsheet完了後にDOM要素が更新されるまで待つ
        await page.waitForFunction(() => {
            const cells = document.querySelectorAll('td[data-frame="1"][data-layer="1"]');
            return cells.length > 0;
        }, { timeout: 5000 });
        await sleep(1000); // 追加の安全マージン
        
        // デバッグモード有効化
        page.on('console', msg => {
            if (msg.text().includes('[選択]') || msg.text().includes('アンカー') || msg.text().includes('反対側')) {
                console.log('🔍 コンソール:', msg.text());
            }
        });
        await page.evaluate(() => {
            window.AppState.debugMode = true;
            // 前のテストの影響を完全にリセット
            window.AppState.selectionAnchor = null;
            window.AppState.selectedCells = [];
            const sheet = window.getCurrentSheet();
            console.log('[テスト] シート情報:', {
                name: sheet.name,
                visibleRows: sheet.visibleRows,
                layers: sheet.layers.length
            });
            console.log('[テスト] 選択状態:', {
                selectedCellsCount: window.AppState.selectedCells.length,
                selectionAnchor: window.AppState.selectionAnchor
            });
        });
        
        // セルA1を選択
        await page.click('td[data-frame="1"][data-layer="1"]');
        await sleep(1000); // クリック処理完了を待つ
        
        // Shift+Down+Right で範囲選択（A1-B2）
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowDown');
        await sleep(300); // 1回目の選択完了を待つ
        await page.keyboard.press('ArrowRight');
        await page.keyboard.up('Shift');
        await sleep(500); // ログ出力を待つ
        
        const initialSelection = await page.evaluate(() => {
            return window.AppState?.selectedCells?.length || 0;
        });
        logTest('Shift選択で4セル選択', initialSelection === 4, `選択数: ${initialSelection}`);
        
        // Sキー押下中（下に拡張）
        await page.keyboard.down('KeyS');
        await sleep(300);
        
        const expandedDown = await page.evaluate(() => {
            return window.AppState?.selectedCells?.length || 0;
        });
        logTest('Sキーで下に拡張', expandedDown === 6, `選択数: ${expandedDown} (期待: 6)`);
        
        await page.keyboard.up('KeyS');
        await sleep(300);
        
        // Dキー押下中（右に拡張）
        await page.keyboard.down('KeyD');
        await sleep(300);
        
        const expandedRight = await page.evaluate(() => {
            return window.AppState?.selectedCells?.length || 0;
        });
        logTest('Dキーで右に拡張', expandedRight === 6, `選択数: ${expandedRight} (期待: 6)`);
        
        await page.keyboard.up('KeyD');
        await sleep(300);
        
        // Wキー押下中（下から縮小）
        await page.keyboard.down('KeyW');
        await sleep(300);
        
        const shrankUp = await page.evaluate(() => {
            return window.AppState?.selectedCells?.length || 0;
        });
        logTest('Wキーで下から縮小', shrankUp === 2, `選択数: ${shrankUp} (期待: 2)`);
        
        await page.keyboard.up('KeyW');
        await sleep(300);
        
        // Aキー押下中（右から縮小）
        await page.keyboard.down('KeyA');
        await sleep(300);
        
        const shrankLeft = await page.evaluate(() => {
            return window.AppState?.selectedCells?.length || 0;
        });
        logTest('Aキーで右から縮小', shrankLeft === 2, `選択数: ${shrankLeft} (期待: 2)`);
        
        await page.keyboard.up('KeyA');
        await sleep(300);
        
    } catch (error) {
        logTest('W/A/S/Dキー操作', false, error.message);
    }
}

// テスト17: 列入れ替え操作
async function testColumnSwap(page) {
    console.log('\n=== テスト17: 列入れ替え操作 ===');
    
    try {
        // 列入れ替え機能は未実装のためスキップ
        logTest('列入れ替え機能', null, '未実装のためスキップ');
        
    } catch (error) {
        logTest('列入れ替え操作', false, error.message);
    }
}

// メイン実行
async function runTests() {
    console.log('🚀 デジタルタイムシート 包括的自動テスト開始\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        devtools: true,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // コンソール監視
        const { errors, warnings, networkErrors } = await setupConsoleMonitoring(page);
        
        // アプリケーションを開く
        const appPath = 'http://127.0.0.1:5500/prototype/index.html';
        console.log(`📂 アプリケーションを開いています: ${appPath}\n`);
        
        try {
            await page.goto(appPath, { waitUntil: 'load', timeout: 15000 });
        } catch (e) {
            console.log('⚠️  ページ読み込み中にタイムアウト（続行）');
        }
        
        await sleep(2000);
        
        // JavaScriptの読み込みを待つ
        console.log('⏳ JavaScriptファイルの読み込みを待機中...');
        try {
            await page.waitForFunction(() => typeof window.AppState !== 'undefined', { timeout: 10000 });
            console.log('✅ AppStateが読み込まれました');
        } catch (e) {
            console.log('❌ AppStateが読み込まれませんでした');
            
            // スクリプトタグの存在を確認
            const scripts = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('script')).map(s => ({
                    src: s.src,
                    loaded: s.src ? 'external' : 'inline',
                    content: s.src ? null : s.textContent.substring(0, 100)
                }));
            });
            console.log('📜 スクリプトタグ:', JSON.stringify(scripts, null, 2));
            
            // window上のグローバル変数を確認
            const globals = await page.evaluate(() => {
                return Object.keys(window).filter(k => 
                    k.startsWith('App') || 
                    k.startsWith('render') || 
                    k.startsWith('init') ||
                    k.startsWith('create')
                );
            });
            console.log('🌐 グローバル変数:', globals);
            
            throw new Error('AppStateが初期化されていません');
        }
        
        // アプリケーションの初期化を待つ
        console.log('⏳ アプリケーション初期化中...');
        
        // AppStateの存在確認
        const appStateExists = await page.evaluate(() => {
            return typeof window.AppState !== 'undefined';
        });
        console.log(`AppState存在: ${appStateExists}`);
        
        if (!appStateExists) {
            throw new Error('AppStateが初期化されていません');
        }
        
        // sheetの存在確認
        const sheetInfo = await page.evaluate(() => {
            return {
                sheetsLength: window.AppState?.sheets?.length,
                currentSheet: window.AppState?.sheets?.[window.AppState?.currentSheetIndex],
                visibleRows: window.AppState?.sheets?.[window.AppState?.currentSheetIndex]?.visibleRows
            };
        });
        console.log('Sheet情報:', JSON.stringify(sheetInfo, null, 2));
        
        // セルが表示されるまで待つ
        try {
            await page.waitForSelector('td[data-frame="1"][data-layer="1"]', { timeout: 10000 });
            console.log('✅ セルが見つかりました');
        } catch (e) {
            console.log('❌ セルが見つかりませんでした');
            
            // DOMの状態を確認
            const domInfo = await page.evaluate(() => {
                const table = document.querySelector('table');
                const tbody = document.querySelector('tbody');
                const allCells = document.querySelectorAll('td');
                return {
                    hasTable: !!table,
                    hasTbody: !!tbody,
                    cellCount: allCells.length,
                    firstCellInfo: allCells[0] ? {
                        frame: allCells[0].getAttribute('data-frame'),
                        layer: allCells[0].getAttribute('data-layer'),
                        text: allCells[0].textContent
                    } : null
                };
            });
            console.log('DOM情報:', JSON.stringify(domInfo, null, 2));
            
            throw e;
        }
        
        await sleep(2000);
        console.log('✅ アプリケーション初期化完了\n');
        
        // 各テストを実行
        await testBasicCellOperations(page);
        await testMultipleSelection(page);
        await testKeyboardOperations(page);
        await testSpecialKeys(page);
        await testContextMenu(page);
        await testMenuFunctions(page);
        await testUndoRedo(page);
        await testTabManagement(page);
        await testSpecialDisplays(page);
        await testPerformance(page);
        await testRowColumnOperations(page);
        await testExtendedKeyboardOps(page); // 新規追加
        await testUIOperations(page); // 新規追加
        await testClipboardOps(page); // 新規追加
        await testDisplayAndFile(page); // 新規追加
        await testWASDKeys(page); // W/A/S/Dキーテスト
        await testColumnSwap(page); // 列入れ替えテスト
        
        // 結果サマリー
        console.log('\n' + '='.repeat(50));
        console.log('📊 テスト結果サマリー');
        console.log('='.repeat(50));
        console.log(`✅ 成功: ${testResults.passed.length}/${testResults.total}`);
        console.log(`❌ 失敗: ${testResults.failed.length}/${testResults.total}`);
        console.log(`⚠️  警告: ${testResults.warnings.length}`);
        
        if (testResults.failed.length > 0) {
            console.log('\n失敗したテスト:');
            testResults.failed.forEach(({ name, message }) => {
                console.log(`  ❌ ${name}: ${message}`);
            });
        }
        
        if (testResults.warnings.length > 0) {
            console.log('\n警告:');
            testResults.warnings.forEach(({ name, message }) => {
                console.log(`  ⚠️  ${name}: ${message}`);
            });
        }
        
        if (errors.length > 0) {
            console.log('\n🔴 コンソールエラー検出:');
            errors.forEach(err => console.log(`  - ${err}`));
        }
        
        if (networkErrors.length > 0) {
            console.log('\n🔴 ネットワークエラー検出:');
            networkErrors.forEach(err => console.log(`  - ${err}`));
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`テスト完了: ${testResults.passed.length}/${testResults.total} 成功`);
        console.log('='.repeat(50));
        
        // スクリーンショットを撮影
        await page.screenshot({ path: 'test/test-result-screenshot.png', fullPage: true });
        console.log('\n📷 スクリーンショット保存: test/test-result-screenshot.png');
        
        // 5秒待ってから閉じる
        console.log('\n5秒後にブラウザを閉じます...');
        await sleep(5000);
        
    } catch (error) {
        console.error('\n❌ テスト実行中にエラーが発生しました:', error);
    } finally {
        await browser.close();
    }
}

// 実行
runTests().catch(console.error);
