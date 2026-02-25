/**
 * ===================================================================
 * sheetManager.js - シート管理モジュール
 * ===================================================================
 * 
 * シートの作成、切り替え、削除、タブレンダリングなど、
 * シート関連の操作を管理します。
 * 
 * 【主要機能】
 * - シートの作成・削除
 * - シート切り替え
 * - タブのレンダリングとドラッグ&ドロップ
 * - フレームフィルターとヘッダー表示モード
 * ===================================================================
 */

/**
 * 新しいシートを作成
 * @param {string} name - シート名
 * @returns {Object} 作成されたシートオブジェクト
 */
function createNewSheet(name) {
    const sheet = {
        name: name || `Sheet${AppState.sheets.length + 1}`,
        fps: 24,
        layers: [],
        frames: 144,
        framePageSize: 144,
        data: {},
        insertedFrames: [],
        disabledFrames: []
    };
    
    // A-Zまでのレイヤーを作成
    for (let i = 0; i < 26; i++) {
        sheet.layers.push({
            id: `L${i + 1}`, // 文字列IDに統一（L1, L2, L3...）
            name: getLayerName(i)
        });
    }
    
    // 初期データ（空で良い）
    for (let i = 1; i <= sheet.frames; i++) {
        sheet.data[i] = {};
        sheet.layers.forEach(layer => {
            sheet.data[i][layer.id] = '';
        });
    }
    
    AppState.sheets.push(sheet);
    return sheet;
}

/**
 * 設定ダイアログを使って新規シートを作成
 * @returns {Promise<Object|null>} 作成されたシートオブジェクト、キャンセル時はnull
 */
async function createNewSheetWithDialog() {
    const settings = await showSheetSettingsDialog({ mode: 'new' });
    if (!settings) return null;
    
    const sheet = {
        name: settings.name,
        fps: settings.fps || 24,
        layers: [],
        frames: settings.frames,
        framePageSize: settings.framePageSize || settings.frames,
        data: {},
        insertedFrames: [],
        disabledFrames: []
    };
    
    // レイヤーを作成（指定された列数分）
    for (let i = 0; i < settings.columns; i++) {
        sheet.layers.push({
            id: `L${i + 1}`,
            name: getLayerName(i)
        });
    }
    
    // 初期データ
    for (let i = 1; i <= sheet.frames; i++) {
        sheet.data[i] = {};
        sheet.layers.forEach(layer => {
            sheet.data[i][layer.id] = '';
        });
    }
    
    AppState.sheets.push(sheet);
    
    return sheet;
}

/**
 * 現在のシート設定を編集
 */
async function editCurrentSheetSettings() {
    const sheet = getCurrentSheet();
    if (!sheet) return;
    
    const settings = await showSheetSettingsDialog({ mode: 'edit', sheet: sheet });
    if (!settings) return;
    
    // シート名更新
    sheet.name = settings.name;
    
    // FPS更新（シート単位）
    sheet.fps = settings.fps || sheet.fps || 24;
    
    // 尺更新
    if (settings.frames !== sheet.frames) {
        const oldFrames = sheet.frames;
        sheet.frames = settings.frames;
        sheet.visibleRows = settings.frames;
        
        // フレーム数が増えた場合は空データを追加
        for (let frame = oldFrames + 1; frame <= settings.frames; frame++) {
            if (!sheet.data[frame]) {
                sheet.data[frame] = {};
                sheet.layers.forEach(layer => {
                    sheet.data[frame][layer.id] = '';
                });
            }
        }
    }
    
    // 列数更新
    const currentColumns = sheet.layers.length;
    if (settings.columns !== currentColumns) {
        if (settings.columns > currentColumns) {
            // 既存の最大IDを計算して衝突を防ぐ
            const maxId = Math.max(...sheet.layers.map(l => {
                const num = parseInt(l.id.replace(/\D/g, ''));
                return isNaN(num) ? 0 : num;
            }), 0);
            // 列を増やす
            for (let i = currentColumns; i < settings.columns; i++) {
                const newId = `L${maxId + (i - currentColumns) + 1}`;
                sheet.layers.push({
                    id: newId,
                    name: getLayerName(i)
                });
                // 全フレームに新しい列のデータを追加
                for (let frame = 1; frame <= sheet.frames; frame++) {
                    sheet.data[frame][newId] = '';
                }
            }
        } else {
            // 列を減らす
            const removedLayers = sheet.layers.splice(settings.columns);
            // 削除したレイヤーのデータを削除
            removedLayers.forEach(layer => {
                for (let frame = 1; frame <= sheet.frames; frame++) {
                    if (sheet.data[frame]) {
                        delete sheet.data[frame][layer.id];
                    }
                }
            });
        }
    }
    
    // フレームページサイズ更新
    if (settings.framePageSize) {
        sheet.framePageSize = settings.framePageSize;
    }
    
    // キャッシュクリアと再レンダリング
    saveHistory('シート設定変更');
    AppState.specialDisplayCache.clear();
    AppState.validFrameCountCache = null;
    renderTabs();
    renderSpreadsheet(true);
    updateDurationDisplay();
    saveToLocalStorage();
    updateUndoRedoButtons();
}

/**
 * 現在選択中のシートを取得
 * @returns {Object|null} 現在のシートオブジェクト、存在しない場合はnull
 */
function getCurrentSheet() {
    if (!AppState.sheets || AppState.sheets.length === 0) {
        console.error('シートが存在しません');
        return null;
    }
    
    if (AppState.currentSheetIndex < 0 || AppState.currentSheetIndex >= AppState.sheets.length) {
        console.error('無効なシートインデックス:', AppState.currentSheetIndex);
        AppState.currentSheetIndex = 0;
    }
    
    return AppState.sheets[AppState.currentSheetIndex];
}

/**
 * シートを切り替える
 * @param {number} index - 切り替え先のシートインデックス
 */
function switchSheet(index) {
    // 現在のシートの選択座標を保存
    const currentSheet = getCurrentSheet();
    if (currentSheet && AppState.selectedCells.length > 0) {
        currentSheet.selectionCoords = AppState.selectedCells.map(s => ({ frame: s.frame, layerId: s.layerId }));
    }
    
    AppState.currentSheetIndex = index;
    renderTabs();
    clearSelection();
    renderSpreadsheet(true);
    
    // 切り替え先シートの選択を復元（なければA1）
    const newSheet = getCurrentSheet();
    if (newSheet?.selectionCoords?.length > 0) {
        restoreSelectionCoords(newSheet.selectionCoords);
    } else {
        selectA1();
    }
    
    updateWindowTitle();
    updateDurationDisplay();
}

/**
 * シート名を変更
 * @param {number} index - シートのインデックス
 */
async function renameSheet(index) {
    const newName = await showRenameSheetDialog(AppState.sheets[index].name);
    if (newName && newName.trim()) {
        AppState.sheets[index].name = newName.trim();
        saveHistory('シート名変更');
        renderTabs();
    }
}

/**
 * シートを削除（最後の1つは削除不可）
 * @param {number} index - シートのインデックス
 */
async function deleteSheet(index) {
    if (AppState.sheets.length === 1) {
        showErrorToast('最後のシートは削除できません。少なくとも1つのシートが必要です。', ErrorLevel.WARNING);
        return;
    }
    
    let confirmed;
    if (window.TauriAPI && window.TauriAPI.showConfirmDialog) {
        confirmed = await window.TauriAPI.showConfirmDialog(
            `"${AppState.sheets[index].name}" を削除しますか?`,
            'シートの削除'
        );
    } else {
        confirmed = confirm(`"${AppState.sheets[index].name}" を削除しますか?`);
    }
    
    if (confirmed) {
        AppState.sheets.splice(index, 1);
        if (AppState.currentSheetIndex >= AppState.sheets.length) {
            AppState.currentSheetIndex = AppState.sheets.length - 1;
        }
        saveHistory('シート削除');
        renderTabs();
        updateWindowTitle(); // ウィンドウタイトルを更新
    }
}

/**
 * タブをレンダリング
 * シートタブを描画し、クリック・ダブルクリック・ドラッグ&ドロップイベントを設定
 */
function renderTabs() {
    const tabsContainer = document.getElementById('tabs-container');
    if (!tabsContainer) return;
    
    tabsContainer.innerHTML = '';
    
    AppState.sheets.forEach((sheet, index) => {
        const tab = document.createElement('div');
        tab.className = 'sheet-tab' + (index === AppState.currentSheetIndex ? ' active' : '');
        tab.dataset.index = index;
        tab.draggable = true;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'sheet-tab-name';
        nameSpan.textContent = sheet.name;
        tab.appendChild(nameSpan);
        
        const closeBtn = document.createElement('span');
        closeBtn.className = 'tab-close';
        closeBtn.textContent = '×';
        closeBtn.title = '閉じる';
        closeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await closeFileByIndex(index);
        });
        closeBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // ドラッグ開始を防ぐ
        });
        tab.appendChild(closeBtn);
        
        // クリック: シート切り替え
        tab.addEventListener('click', () => {
            switchSheet(index);
        });
        
        // ダブルクリック: シート名変更
        tab.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            renameSheet(index);
        });
        
        // 右クリック: コンテキストメニュー表示
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTabContextMenu(e.pageX, e.pageY, index);
        });
        
        // ドラッグ開始
        tab.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', index);
            tab.classList.add('dragging');
        });
        
        // ドラッグ終了
        tab.addEventListener('dragend', (e) => {
            tab.classList.remove('dragging');
            // すべてのタブからdrag-overクラスを削除
            document.querySelectorAll('.sheet-tab').forEach(t => {
                t.classList.remove('drag-over');
            });
        });
        
        // ドラッグオーバー
        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // ドラッグ中のタブ以外にdrag-overクラスを追加
            const draggingTab = document.querySelector('.sheet-tab.dragging');
            if (draggingTab !== tab) {
                tab.classList.add('drag-over');
            }
        });
        
        // ドラッグリーブ
        tab.addEventListener('dragleave', (e) => {
            tab.classList.remove('drag-over');
        });
        
        // ドロップ
        tab.addEventListener('drop', (e) => {
            e.preventDefault();
            tab.classList.remove('drag-over');
            
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = parseInt(tab.dataset.index);
            
            if (fromIndex !== toIndex) {
                // シートを並び替え
                const [movedSheet] = AppState.sheets.splice(fromIndex, 1);
                AppState.sheets.splice(toIndex, 0, movedSheet);
                
                // 現在のシートインデックスを調整
                if (AppState.currentSheetIndex === fromIndex) {
                    AppState.currentSheetIndex = toIndex;
                } else if (fromIndex < AppState.currentSheetIndex && toIndex >= AppState.currentSheetIndex) {
                    AppState.currentSheetIndex--;
                } else if (fromIndex > AppState.currentSheetIndex && toIndex <= AppState.currentSheetIndex) {
                    AppState.currentSheetIndex++;
                }
                
                saveHistory('シート並び替え');
                renderTabs();
                saveToLocalStorage();
                updateStatusBar('シートを並び替えました');
            }
        });
        
        tabsContainer.appendChild(tab);
    });
}

/**
 * タブの右クリックメニューを表示
 */
let currentTabContextIndex = null;

function showTabContextMenu(x, y, tabIndex) {
    currentTabContextIndex = tabIndex;
    const menu = document.getElementById('tab-context-menu');
    if (!menu) return;
    
    document.getElementById('context-menu')?.style && (document.getElementById('context-menu').style.display = 'none');
    menu.style.display = 'block';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

/**
 * フレームフィルターを設定
 * @param {string} filter - 'all', 'used', 'unused'
 */
function setFrameFilter(filter) {
    AppState.frameFilter = filter;
    // updateMenuCheckmarks(); // Tauriメニューはイベントハンドラーで自動更新される
    renderSpreadsheet(true);
    saveToLocalStorage();
}

/**
 * ヘッダー表示モードを設定
 * @param {string} mode - 'detail' または 'simple'
 */
function setHeaderDisplayMode(mode) {
    AppState.headerDisplayMode = mode;
    // updateMenuCheckmarks(); // Tauriメニューはイベントハンドラーで自動更新される
    renderSpreadsheet(true);
    saveToLocalStorage();
}

// タブコンテキストメニューのイベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    const tabContextMenu = document.getElementById('tab-context-menu');
    if (tabContextMenu) {
        tabContextMenu.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            if (!action) return;
            
            if (action === 'rename-sheet') {
                if (currentTabContextIndex !== null) {
                    await renameSheet(currentTabContextIndex);
                }
            } else if (action === 'clear-sheet') {
                if (currentTabContextIndex !== null) {
                    // 対象シートに切り替えてから初期化
                    AppState.currentSheetIndex = currentTabContextIndex;
                    renderTabs();
                    renderSpreadsheet(true);
                    await clearSheet();
                }
            } else if (action === 'close-sheet') {
                if (currentTabContextIndex !== null) {
                    // 指定されたシートを閉じる
                    if (AppState.sheets.length === 1) {
                        showErrorToast('最後のシートは閉じられません', ErrorLevel.WARNING, 3000);
                    } else {
                        const sheetName = AppState.sheets[currentTabContextIndex].name;
                        const confirmed = await showConfirmDialog(
                            `シート「${sheetName}」を閉じますか？\n保存していないデータは失われます。`
                        );
                        
                        if (confirmed) {
                            AppState.sheets.splice(currentTabContextIndex, 1);
                            
                            // インデックスを調整
                            if (AppState.currentSheetIndex >= AppState.sheets.length) {
                                AppState.currentSheetIndex = AppState.sheets.length - 1;
                            } else if (currentTabContextIndex <= AppState.currentSheetIndex) {
                                AppState.currentSheetIndex = Math.max(0, AppState.currentSheetIndex - 1);
                            }
                            
                            saveHistory('シート削除');
                            renderTabs();
                            renderSpreadsheet(true);
                        }
                    }
                }
            } else if (action === 'close-all-sheets') {
                await closeAllSheets();
            }
            
            tabContextMenu.style.display = 'none';
            currentTabContextIndex = null;
        });
        
        // メニュー外をクリックで閉じる
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#tab-context-menu')) {
                tabContextMenu.style.display = 'none';
                currentTabContextIndex = null;
            }
        });
    }
});
