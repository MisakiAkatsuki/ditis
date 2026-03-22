/**
 * ===================================================================
 * menuHandler.js - メニュー処理モジュール
 * ===================================================================
 * 
 * アプリケーションのメニューとイベントリスナーの設定を担当します。
 * 
 * 【主要機能】
 * - メニューボタンのイベントリスナー設定
 * - ファイル操作メニュー
 * - 編集メニュー
 * - 表示メニュー
 * - シートメニュー
 * - デバッグメニュー
 * - 右クリックコンテキストメニュー
 * 
 * 【依存関係】
 * - AppState（グローバル）
 * - 各種操作関数（app.js および他モジュール）
 * ===================================================================
 */

// ========================================
// イベントリスナー設定
// ========================================
/**
 * アプリケーション全体のイベントリスナーを一括設定
 * ボタンクリック、キーボード、右クリックメニューなど
 */
function setupEventListeners() {
    // タブ追加
    const addTabBtn = document.getElementById('add-tab-btn');
    if (addTabBtn) {
        addTabBtn.addEventListener('click', createNewSheetWithPrompt);
    }
    
    // ヘルプダイアログ
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog) {
        helpDialog.addEventListener('click', (e) => {
            if (e.target.id === 'help-dialog') {
                helpDialog.style.display = 'none';
            }
        });
    }
    
    const closeHelp = document.getElementById('close-help');
    if (closeHelp) {
        closeHelp.addEventListener('click', () => {
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog) {
                helpDialog.style.display = 'none';
            }
        });
    }
    
    // キーボードショートカット
    document.addEventListener('keydown', handleKeyboard);
    document.addEventListener('keyup', handleKeyUp);
    
    // 右クリックメニュー
    setupContextMenu();
    
    // ウィンドウクローズ前の保存確認
    window.addEventListener('beforeunload', (e) => {
        saveToLocalStorageImmediate();
    });
}


// ========================================
// 右クリックメニュー処理
// ========================================
/**
 * コンテキストメニューの表示・非表示とアクション処理
 * セル、行ヘッダー、列ヘッダーごとに異なるメニューを表示
 */

// 右クリックメニューの設定
function setupContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) {
        handleElementNotFound('context-menu', true);
        return;
    }
    
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) {
        handleElementNotFound('spreadsheet', true);
        return;
    }
    
    const t = window.i18n ? window.i18n.t : (key) => key;
    
    // 右クリックでメニュー表示
    // 列ヘッダーの右ダブルクリック検出用
    let _lastColRightClickTime = 0;
    let _lastColRightClickLayerId = null;

    spreadsheet.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // 右クリックした要素を取得
        const targetCell = e.target.closest('td[data-frame]');
        const targetFrameHeader = e.target.closest('td[data-frame-header]');
        const targetColumnHeader = e.target.closest('th[data-layer-id]');
        
        let menuItems = [];
        
        // セルの上で右クリックした場合
        if (targetCell) {
            const frame = parseInt(targetCell.dataset.frame);
            const layerId = targetCell.dataset.layer; // "L1" などの文字列IDをそのまま使用
            
            // そのセルが選択範囲に含まれていない場合、または何も選択されていない場合は選択
            const isInSelection = AppState.selectedCells.some(s => s.frame === frame && s.layerId === layerId);
            if (!isInSelection || AppState.selectedCells.length === 0) {
                clearSelection();
                selectCell(targetCell, frame, layerId);
                updateStatusBar();
            }
            
            // セル用メニュー
            menuItems = [];
            
            // 複数セル選択時のみループオプションを追加
            if (AppState.selectedCells.length > 1) {
                menuItems.push({ action: 'loop-selection', label: t('contextMenu.loopSelection') });
                menuItems.push({ divider: true });
            }
            
            menuItems.push(
                { action: 'delete-content', label: t('contextMenu.deleteContent') },
                { divider: true },
                { action: 'copy', label: t('contextMenu.copy') },
                { action: 'cut', label: t('contextMenu.cut') },
                { action: 'paste', label: t('contextMenu.paste') }
            );
        }
        // フレームヘッダーの上で右クリックした場合
        else if (targetFrameHeader) {
            const frame = parseInt(targetFrameHeader.dataset.frameHeader);
            const sheet = getCurrentSheet();
            
            // 既存の選択が「行選択」かどうかを判定
            // 行選択 = 各フレームに対して全ての列が選択されている
            const selectedFrames = [...new Set(AppState.selectedCells.map(s => s.frame))];
            const isRowSelection = selectedFrames.length > 0 && selectedFrames.every(f => {
                const cellsInFrame = AppState.selectedCells.filter(s => s.frame === f);
                return cellsInFrame.length === sheet.layers.length;
            });
            
            // その行が選択範囲に含まれているかチェック
            const isRowSelected = AppState.selectedCells.some(s => s.frame === frame);
            
            if (isRowSelection && isRowSelected) {
                // 既に行選択状態で、その行が含まれている場合は、選択範囲内の各行を全体選択に拡張
                clearSelection();
                selectedFrames.forEach(f => selectEntireRowWithoutClear(f));
            } else {
                // それ以外の場合は、新規に行全体を選択
                clearSelection();
                selectEntireRowWithoutClear(frame);
            }
            
            // 行ヘッダー用メニュー
            menuItems = [
                { action: 'insert-here', label: t('contextMenu.insertHere') },
                { action: 'delete-frames', label: t('contextMenu.deleteFrames') },
                { action: 'toggle-disable-frames', label: t('contextMenu.toggleDisableFrames') },
                { divider: true },
                { action: 'shift-down-from-here', label: t('contextMenu.shiftDownFromHere') },
                { divider: true },
                { action: 'copy', label: t('contextMenu.copyRowValues') },
                { action: 'cut', label: t('contextMenu.cutRowValues') },
                { action: 'paste', label: t('contextMenu.pasteRowValues') }
            ];
        }
        // 列ヘッダーの上で右クリックした場合
        else if (targetColumnHeader) {
            const layerId = targetColumnHeader.dataset.layerId;
            
            // 右ダブルクリック検出（400ms以内に同じ列ヘッダーを2回右クリック）
            const now = Date.now();
            if (layerId === _lastColRightClickLayerId && now - _lastColRightClickTime < 400) {
                _lastColRightClickTime = 0;
                _lastColRightClickLayerId = null;
                contextMenu.style.display = 'none'; // 1回目のメニューを閉じる
                copyColumnKeyframeData(layerId);
                return;
            }
            _lastColRightClickTime = now;
            _lastColRightClickLayerId = layerId;
            
            const sheet = getCurrentSheet();
            const maxRows = getMaxVisibleRows(sheet);
            
            // 既存の選択が「列選択」かどうかを判定
            // 列選択 = 各列に対して全てのフレームが選択されている
            const selectedLayerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
            const isColumnSelection = selectedLayerIds.length > 0 && selectedLayerIds.every(lid => {
                const cellsInLayer = AppState.selectedCells.filter(s => s.layerId === lid);
                return cellsInLayer.length === maxRows;
            });
            
            // その列が選択範囲に含まれているかチェック
            const isColumnSelected = AppState.selectedCells.some(s => s.layerId === layerId);
            
            if (isColumnSelection && isColumnSelected) {
                // 既に列選択状態で、その列が含まれている場合は、選択範囲内の各列を全体選択に拡張
                clearSelection();
                selectedLayerIds.forEach(lid => selectEntireColumnWithoutClear(lid));
            } else {
                // それ以外の場合は、新規に列全体を選択
                clearSelection();
                selectEntireColumnWithoutClear(layerId);
            }
            updateStatusBar();
            
            // 列ヘッダー用メニュー
            menuItems = [
                { action: 'insert-column', label: t('contextMenu.insertColumn') },
                { action: 'rename-layer', label: t('contextMenu.renameLayer') },
                { action: 'swap-column-left', label: t('contextMenu.swapColumnLeft') },
                { action: 'swap-column-right', label: t('contextMenu.swapColumnRight') },
                { action: 'delete-column', label: t('contextMenu.deleteColumn') },
                { action: 'delete-columns-after', label: t('contextMenu.deleteColumnsAfter') },
                { divider: true },
                { action: 'delete-content', label: t('contextMenu.deleteContent') },
                { divider: true },
                { action: 'copy', label: t('contextMenu.copyColumnValues') },
                { action: 'cut', label: t('contextMenu.cutColumnValues') },
                { action: 'paste', label: t('contextMenu.pasteColumnValues') }
            ];
        }
        else {
            return; // それ以外の場所では何もしない
        }
        
        // メニューを構築
        contextMenu.innerHTML = '';
        menuItems.forEach(item => {
            if (item.divider) {
                const div = document.createElement('div');
                div.className = 'context-menu-divider';
                contextMenu.appendChild(div);
            } else {
                const div = document.createElement('div');
                div.className = 'context-menu-item';
                div.dataset.action = item.action;
                div.textContent = item.label;
                contextMenu.appendChild(div);
            }
        });
        
        // メニューを表示位置に配置（画面外に出ないように調整）
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        document.getElementById('tab-context-menu')?.style && (document.getElementById('tab-context-menu').style.display = 'none');
        contextMenu.style.display = 'block';
        
        // メニューが画面外に出る場合は位置を調整
        const menuRect = contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (menuRect.right > windowWidth) {
            contextMenu.style.left = `${windowWidth - menuRect.width - 10}px`;
        }
        if (menuRect.bottom > windowHeight) {
            contextMenu.style.top = `${windowHeight - menuRect.height - 10}px`;
        }
    });
    
    // メニュー外クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = 'none';
        }
    });
    
    // メニュー項目のクリック
    contextMenu.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        
        contextMenu.style.display = 'none';
        
        switch (action) {
            case 'insert-here':
                insertFramesAtSelection();
                break;
            case 'insert-column':
                insertColumnAtSelection();
                break;
            case 'delete-frames':
                await deleteSelectedFrames();
                break;
            case 'toggle-disable-frames':
                toggleDisableFrames();
                break;
            case 'shift-down-from-here':
                shiftDataDownFromFrame();
                break;
            case 'delete-content':
                deleteSelection();
                break;
            case 'delete-column':
                await deleteColumnFromSelection();
                break;
            case 'delete-columns-after':
                await deleteColumnsAfterSelection();
                break;
            case 'rename-layer':
                renameLayerFromSelection();
                break;
            case 'swap-column-left':
                swapColumnWithLeft();
                break;
            case 'swap-column-right':
                swapColumnWithRight();
                break;
            case 'reset-column-names':
                resetColumnNames();
                break;
            case 'change-max-columns':
                changeMaxColumns();
                break;
            case 'copy':
                copySelection();
                break;
            case 'cut':
                cutSelection();
                break;
            case 'paste':
                pasteSelection();
                break;
            case 'loop-selection':
                loopSelection();
                break;
        }
    });
}

function closeAllContextMenus() {
    document.getElementById('context-menu')?.style && (document.getElementById('context-menu').style.display = 'none');
    document.getElementById('tab-context-menu')?.style && (document.getElementById('tab-context-menu').style.display = 'none');
}

window.addEventListener('blur', closeAllContextMenus);
document.documentElement.addEventListener('mouseleave', closeAllContextMenus);
