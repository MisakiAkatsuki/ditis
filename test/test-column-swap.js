/**
 * 列入れ替えテスト（デバッグ用）
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testColumnSwap() {
    const browser = await puppeteer.launch({ 
        headless: false,
        devtools: true
    });
    
    try {
        const page = await browser.newPage();
        
        // コンソールログを監視
        page.on('console', msg => {
            console.log('ブラウザコンソール:', msg.text());
        });
        
        // アプリケーションを開く
        const appPath = 'file://' + path.resolve(__dirname, '../prototype/index.html').replace(/\\/g, '/');
        await page.goto(appPath);
        await sleep(2000);
        
        console.log('=== 列入れ替えテスト ===');
        
        // 表を初期化
        await page.click('#edit-menu-btn');
        await sleep(500);
        await page.click('#clear-sheet-menu');
        await sleep(1000);
        
        // A列に「1」、B列に「2」を入力
        console.log('A1に「1」を入力');
        await page.click('td[data-frame="1"][data-layer="1"]');
        await sleep(100);
        await page.keyboard.type('1');
        await page.keyboard.press('Enter');
        await sleep(500);
        
        console.log('B1に「2」を入力');
        await page.click('td[data-frame="1"][data-layer="2"]');
        await sleep(100);
        await page.keyboard.type('2');
        await page.keyboard.press('Enter');
        await sleep(1000);
        
        // B列のヘッダーを右クリック
        console.log('B列ヘッダーを右クリック');
        await page.click('th[data-layer-id="2"]', { button: 'right' });
        await sleep(2000); // メニュー表示を十分に待つ
        
        // メニューの内容を確認
        const menuInfo = await page.evaluate(() => {
            const menu = document.querySelector('.context-menu');
            if (!menu) {
                return { exists: false, message: 'メニューが見つかりません' };
            }
            
            const items = Array.from(menu.querySelectorAll('li'));
            const itemTexts = items.map(item => item.textContent.trim());
            
            return {
                exists: true,
                itemCount: items.length,
                items: itemTexts,
                hasSwapLeft: itemTexts.some(text => text.includes('左の列と入れ替え')),
                menuHTML: menu.innerHTML
            };
        });
        
        console.log('メニュー情報:', JSON.stringify(menuInfo, null, 2));
        
        if (menuInfo.hasSwapLeft) {
            console.log('「左の列と入れ替え」が見つかりました！クリックします。');
            await page.evaluate(() => {
                const menu = document.querySelector('.context-menu');
                const items = Array.from(menu.querySelectorAll('li'));
                const swapItem = items.find(item => item.textContent.includes('左の列と入れ替え'));
                if (swapItem) {
                    console.log('クリック:', swapItem.textContent);
                    swapItem.click();
                }
            });
            await sleep(1000);
            
            // 入れ替わったか確認
            const values = await page.evaluate(() => {
                return {
                    A1: AppState.sheets[0].data[1][1],
                    B1: AppState.sheets[0].data[1][2]
                };
            });
            
            console.log('入れ替え後の値:', values);
            console.log('期待: A1=2, B1=1');
            console.log('結果:', values.A1 === '2' && values.B1 === '1' ? '✅ 成功' : '❌ 失敗');
        } else {
            console.log('❌「左の列と入れ替え」が見つかりませんでした');
        }
        
        // ブラウザを閉じずに待機（手動確認用）
        console.log('\n手動確認のためブラウザを開いたままにします。確認後にCtrl+Cで終了してください。');
        await sleep(60000);
        
    } catch (error) {
        console.error('エラー:', error);
    } finally {
        await browser.close();
    }
}

testColumnSwap().catch(console.error);
