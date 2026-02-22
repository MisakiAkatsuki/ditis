// ========================================
// Undo/Redo機能（履歴管理）
// ========================================
// アプリケーション状態の履歴を管理し、元に戻す・やり直し機能を提供

/**
 * 現在の状態を履歴に保存
 * Undo/Redo機能のために、シートデータと選択範囲をJSON化して保存
 * 最大500段階まで保存可能
 */
function saveHistory(label = '') {
    try {
        const state = JSON.stringify({
            sheets: AppState.sheets,
            currentSheetIndex: AppState.currentSheetIndex,
            fps: AppState.fps,
            selectedCells: AppState.selectedCells.map(s => ({ frame: s.frame, layerId: s.layerId })), // 選択範囲を保存
            label: label
        });
        
        // 現在位置以降の履歴を削除
        AppState.history = AppState.history.slice(0, AppState.historyIndex + 1);
        
        AppState.history.push(state);
        
        // 上限を超えたら古い履歴を削除
        if (AppState.history.length > CONSTANTS.MAX_HISTORY) {
            AppState.history.shift();
            AppState.historyIndex = AppState.history.length - 1;
        }
        
        AppState.historyIndex = AppState.history.length - 1;
        
        if (AppState.debugMode) {
            console.log(`saveHistory呼出: historyIndex=${AppState.historyIndex}, 履歴数=${AppState.history.length}`);
            console.trace('saveHistory呼出元');
            
            // デバッグ: 現在のシートデータを出力（保存される状態）
            try {
                const sheet = AppState.sheets[AppState.currentSheetIndex];
                if (sheet) {
                    console.log(`  シート情報: name="${sheet.name}", layers=${sheet.layers.length}列, frames=${sheet.frames}`);
                
                if (sheet.data) {
                    const dataSnapshot = {};
                    let totalCells = 0;
                    for (let frame = 1; frame <= 10; frame++) { // 最初の10フレームのみ
                        if (sheet.data[frame]) {
                            const debugLayers = sheet.layers ? sheet.layers.slice(0, 3) : [];
                            for (const layer of debugLayers) {
                                const value = sheet.data[frame][layer.id] || '';
                                if (value !== '') {
                                    if (!dataSnapshot[layer.id]) dataSnapshot[layer.id] = {};
                                    dataSnapshot[layer.id][`F${frame}`] = value;
                                    totalCells++;
                                }
                            }
                        }
                    }
                    console.log(`  データ (最初10フレーム×3列): ${totalCells}個のセルに入力あり`, JSON.stringify(dataSnapshot));
                }
            }
        } catch (e) {
            console.error('データ出力エラー:', e);
        }
    }
    
    updateUndoRedoButtons();
    } catch (error) {
        console.error('履歴保存エラー:', error);
        // エラーが発生しても処理を継続
    }
}

/**
 * Undo（元に戻す）
 * 履歴を一つ前の状態に戻す
 */
function undo() {
    debugLog('操作', `Undo historyIndex=${AppState.historyIndex}, 履歴数=${AppState.history.length}`);
    if (AppState.historyIndex > 0) {
        AppState.historyIndex--;
        debugLog('操作', `  → historyIndex=${AppState.historyIndex}に戻します`);
        // Ctrl/Altの一時選択状態をクリア
        AppState.originalSelectionSize = 0;
        AppState.originalSelectionMinFrame = 0;
        AppState.originalSelectionMinLayerIndex = 0;
        restoreHistory();
        const sheetName = getCurrentSheet()?.name || 'Sheet';
        let undoneLabel = '';
        try { const s = JSON.parse(AppState.history[AppState.historyIndex + 1]); undoneLabel = s.label || ''; } catch(e) {}
        updateStatusBar(`[${sheetName}] 元に戻しました${undoneLabel ? '：' + undoneLabel : ''}`);
    } else {
        debugLog('操作', '  → これ以上戻せません');
    }
}

/**
 * Redo（やり直し）
 * Undoで戻した状態を再度進める
 */
function redo() {
    debugLog('操作', `Redo historyIndex=${AppState.historyIndex}, 履歴数=${AppState.history.length}`);
    if (AppState.historyIndex < AppState.history.length - 1) {
        AppState.historyIndex++;
        debugLog('操作', `  → historyIndex=${AppState.historyIndex}に進めます`);
        // Ctrl/Altの一時選択状態をクリア
        AppState.originalSelectionSize = 0;
        AppState.originalSelectionMinFrame = 0;
        AppState.originalSelectionMinLayerIndex = 0;
        restoreHistory();
        const sheetName = getCurrentSheet()?.name || 'Sheet';
        let redoneLabel = '';
        try { const s = JSON.parse(AppState.history[AppState.historyIndex]); redoneLabel = s.label || ''; } catch(e) {}
        updateStatusBar(`[${sheetName}] やり直しました${redoneLabel ? '：' + redoneLabel : ''}`);
    } else {
        debugLog('操作', '  → これ以上進めません');
    }
}

/**
 * 履歴から状態を復元
 * シートデータ、選択範囲、FPS設定を復元する
 */
function restoreHistory() {
    try {
        if (AppState.debugMode) console.log(`restoreHistory: historyIndex=${AppState.historyIndex}の状態を復元`);
        
        if (AppState.historyIndex < 0 || AppState.historyIndex >= AppState.history.length) {
            console.error('Invalid historyIndex:', AppState.historyIndex);
            return;
        }
        
        const state = JSON.parse(AppState.history[AppState.historyIndex]);
    AppState.sheets = state.sheets;
    AppState.currentSheetIndex = state.currentSheetIndex;
    AppState.fps = state.fps;
    
    // FPSセレクトがある場合のみ更新
    const fpsSelect = document.getElementById('fps-select');
    if (fpsSelect) {
        fpsSelect.value = AppState.fps;
    }
    
    // デバッグ: 復元後のシートデータを出力
    if (AppState.debugMode) {
        try {
            const sheet = AppState.sheets[AppState.currentSheetIndex];
            if (sheet) {
                console.log(`  復元後シート: name="${sheet.name}", layers=${sheet.layers.length}列, frames=${sheet.frames}`);
                
                if (sheet.data) {
                    const dataSnapshot = {};
                    let totalCells = 0;
                    for (let frame = 1; frame <= 10; frame++) { // 最初の10フレームのみ
                        if (sheet.data[frame]) {
                            const debugLayers = sheet.layers ? sheet.layers.slice(0, 3) : [];
                            for (const layer of debugLayers) {
                                const value = sheet.data[frame][layer.id] || '';
                                if (value !== '') {
                                    if (!dataSnapshot[layer.id]) dataSnapshot[layer.id] = {};
                                    dataSnapshot[layer.id][`F${frame}`] = value;
                                    totalCells++;
                                }
                            }
                        }
                    }
                    console.log(`  復元後データ (最初10フレーム×3列): ${totalCells}個のセルに入力あり`, JSON.stringify(dataSnapshot));
                }
            }
        } catch (e) {
            console.error('データ出力エラー:', e);
        }
    }
    
    renderTabs();
    renderSpreadsheetImmediate(true);
    
    // 選択範囲を復元（即時レンダリング後なのでDOMは最新）
    debugLog("操作", "選択範囲復元開始", state.selectedCells);
    clearSelection();
    if (state.selectedCells && state.selectedCells.length > 0) {
        if (AppState.debugMode) console.log(`  ${state.selectedCells.length}個のセルを復元します`);
        state.selectedCells.forEach((s, index) => {
            if (AppState.debugMode) console.log(`    [${index}] frame=${s.frame}, layerId=${s.layerId}`);
            const cell = document.querySelector(
                `td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`
            );
            if (AppState.debugMode) console.log(`    → セル取得:`, cell ? 'OK' : 'NG');
            if (cell) {
                selectCell(cell, s.frame, s.layerId);
            }
        });
        if (AppState.debugMode) console.log(`  復元後のAppState.selectedCells.length: ${AppState.selectedCells.length}`);
        // 最初のセルまでスクロール
        if (AppState.selectedCells.length > 0) {
            scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
        }
    } else {
        debugLog("操作", "選択範囲なし");
    }
    
    updateUndoRedoButtons();
    updateStatusBar(); // 尺を再計算
    // saveToLocalStorage(); // Undo/Redoではローカルストレージを更新しない
    if (AppState.debugMode) console.log(`  → 復元完了`);
    } catch (error) {
        console.error('履歴復元エラー:', error);
        // エラーが発生した場合はデフォルトの状態を維持
    }
}

/**
 * Undo/Redoボタンの有効/無効を更新
 */
function updateUndoRedoButtons() {
    // ボタンが存在する場合のみ更新（メニュー項目は動的に制御しない）
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.disabled = AppState.historyIndex <= 0;
    }
    
    const redoBtn = document.getElementById('redo-btn');
    if (redoBtn) {
        redoBtn.disabled = AppState.historyIndex >= AppState.history.length - 1;
    }

    const undoInfo = document.getElementById('undo-info');
    if (undoInfo) {
        const total = AppState.history.length;
        const pos = AppState.historyIndex;
        let undoLabel = '';
        let redoLabel = '';
        if (pos > 0) {
            try { const s = JSON.parse(AppState.history[pos]); undoLabel = s.label || ''; } catch(e) {}
        }
        if (pos < total - 1) {
            try { const s = JSON.parse(AppState.history[pos + 1]); redoLabel = s.label || ''; } catch(e) {}
        }
        let parts = [];
        if (total > 1) parts.push(`${pos}/${total - 1}`);
        if (undoLabel) parts.push(`↩ ${undoLabel}`);
        if (redoLabel) parts.push(`↪ ${redoLabel}`);
        undoInfo.textContent = parts.join(' | ');
    }
}
