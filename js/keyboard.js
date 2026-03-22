/**
 * ========================================
 * keyboard.js - キーボード入力処理
 * ========================================
 * 
 * キーボードショートカット、数字入力、矢印キー移動などの
 * 全てのキーボード入力を処理します。
 * 
 * 【主要機能】
 * - 数字入力処理
 * - 矢印キー移動
 * - +/-キー（前の値に±1）
 * - .キー（最後まで-で埋める）
 * - アスタリスクとスラッシュキー（選択範囲拡張/縮小）
 * - Ctrl+Z/Y（Undo/Redo）
 * - Ctrl+C/V/X（コピー/ペースト/カット）
 * - Delete（セル削除）
 * - Home/End（先頭/末尾へ）
 * - Escape（選択解除）
 * - Shift+矢印（範囲選択）
 * - W/A/S/D押下中（一時的な選択拡張/縮小）
 * 
 * 【依存関係】
 * - AppState（グローバル状態）
 * - getCurrentSheet（シート取得）
 * - selection.js（セル選択関数群）
 * - edit.js（セル編集関数群）
 * - frameOps.js（フレーム操作関数群）
 * - history.js（Undo/Redo）
 * ========================================
 */

// ========================================
// ヘルパー関数
// ========================================
// getCellElement は utils.js で定義（Mapキャッシュ対応版）

/**
 * 選択範囲の最初(上端)フレームの全セルに空セルマーカー(×)を挿入する
 * 上に数字があり、かつセルが空の場合のみ挿入する
 */
function insertNullCell() {
    const sheet = getCurrentSheet();
    if (!sheet || AppState.selectedCells.length === 0) return;

    const sorted = [...AppState.selectedCells].sort((a, b) => a.frame - b.frame);
    const topFrame = sorted[0].frame;
    // トップフレームの全選択セルを対象にする
    const topCells = sorted.filter(s => s.frame === topFrame);

    let inserted = false;
    topCells.forEach(topCell => {
        if (!sheet.data[topCell.frame]) sheet.data[topCell.frame] = {};
        const oldValue = sheet.data[topCell.frame][topCell.layerId] || '';

        if (oldValue === CONSTANTS.NULL_CELL) return;

        // 上方向に数値があるか確認（空セルの先頭には挿入しない）
        let hasNumberAbove = false;
        for (let f = topCell.frame - 1; f >= 1; f--) {
            const v = (sheet.data[f] && sheet.data[f][topCell.layerId]) || '';
            if (v !== '' && v !== CONSTANTS.NULL_CELL) { hasNumberAbove = true; break; }
            if (v === '' || v === CONSTANTS.NULL_CELL) break;
        }
        if (!hasNumberAbove) return;

        sheet.data[topCell.frame][topCell.layerId] = CONSTANTS.NULL_CELL;
        inserted = true;
    });

    if (!inserted) return;
    saveHistory('空セルマーカー挿入');
    renderSpreadsheetImmediate();
}

// ========================================
// キーボードショートカット処理
// ========================================
/**
 * キーボード入力を処理する
 * @param {KeyboardEvent} e - キーボードイベント
 */
function handleKeyboard(e) {
    // IME変換中は処理しない
    if (e.isComposing || e.keyCode === 229) return;
    // ダイアログが表示中は無視
    const dialogOverlay = document.getElementById('custom-dialog-overlay');
    if (dialogOverlay && dialogOverlay.style.display !== 'none') return;
    
    // ヘルプ表示中はF1/Escのみ許可
    const helpDialog = document.getElementById('help-dialog');
    if (helpDialog && helpDialog.style.display === 'flex') {
        if (e.key !== 'F1' && e.key !== 'Escape') {
            e.preventDefault();
            return;
        }
    }
    
    // 編集中は無視
    if (AppState.editingCell) return;
    
    // W/A/S/Dの一時選択処理
    // W/A/S/Dキー：一時的な選択範囲の拡張/縮小（押下中のみ）
    if ((e.key === 'w' || e.key === 'W' || e.code === 'KeyW') && !e.ctrlKey && !AppState.isWPressed && !e.metaKey && !AppState.isWUsed && AppState.selectedCells.length > 1) {
        e.preventDefault();
        AppState.isWPressed = true;
        AppState.isWUsed = true;
        
        // 現在の選択範囲をバックアップ（セッション最初の1キー目の場合のみ）
        if (AppState.originalSelectionSize === 0) {
            const sheet = getCurrentSheet();
            const frames = AppState.selectedCells.map(s => s.frame);
            const layerIds = AppState.selectedCells.map(s => s.layerId);
            const layerIndices = layerIds.map(id => getLayerIndex(id, sheet)).filter(i => i !== -1);
            const minFrame = Math.min(...frames);
            const maxFrame = Math.max(...frames);
            const minLayerIndex = Math.min(...layerIndices);
            const maxLayerIndex = Math.max(...layerIndices);
            AppState.originalSelectionSize = AppState.selectedCells.length;
            AppState.originalSelectionRows = maxFrame - minFrame + 1;
            AppState.originalSelectionCols = maxLayerIndex - minLayerIndex + 1;
            AppState.originalSelectionMinFrame = minFrame;
            AppState.originalSelectionMinLayerIndex = minLayerIndex;
        }
        
        // 選択範囲を下から1つ減らす（最低1行は残す）
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            const aIndex = getLayerIndex(a.layerId, sheet);
            const bIndex = getLayerIndex(b.layerId, sheet);
            return aIndex - bIndex;
        });
        
        const maxFrame = Math.max(...sortedCells.map(s => s.frame));
        const layerIds = [...new Set(sortedCells.map(s => s.layerId))];
        const uniqueFrames = [...new Set(sortedCells.map(s => s.frame))];
        
        // 行が1つしかない場合は削除しない
        if (uniqueFrames.length <= 1) { updateStatusBar(); return; }
        
        // 最大フレームのセルを選択解除
        layerIds.forEach(layerId => {
            const cellToRemove = AppState.selectedCells.find(
                s => s.frame === maxFrame && s.layerId === layerId
            );
            if (cellToRemove) {
                const el = getCellElement(cellToRemove.frame, cellToRemove.layerId);
                if (el) el.classList.remove('selected');
                AppState.selectedCells = AppState.selectedCells.filter(s => s !== cellToRemove);
            }
        });
        
        updateStatusBar();
        return;
    }
    
    if ((e.key === 's' || e.key === 'S' || e.code === 'KeyS') && !e.ctrlKey && !AppState.isSPressed && !e.metaKey && !AppState.isSUsed && AppState.selectedCells.length > 0) {
        e.preventDefault();
        AppState.isSPressed = true;
        AppState.isSUsed = true;
        
        // 現在の選択範囲をバックアップ（セッション最初の1キー目の場合のみ）
        if (AppState.originalSelectionSize === 0) {
            const sheet = getCurrentSheet();
            const frames = AppState.selectedCells.map(s => s.frame);
            const layerIds = AppState.selectedCells.map(s => s.layerId);
            const layerIndices = layerIds.map(id => getLayerIndex(id, sheet)).filter(i => i !== -1);
            const minFrame = Math.min(...frames);
            const maxFrame = Math.max(...frames);
            const minLayerIndex = Math.min(...layerIndices);
            const maxLayerIndex = Math.max(...layerIndices);
            AppState.originalSelectionSize = AppState.selectedCells.length;
            AppState.originalSelectionRows = maxFrame - minFrame + 1;
            AppState.originalSelectionCols = maxLayerIndex - minLayerIndex + 1;
            AppState.originalSelectionMinFrame = minFrame;
            AppState.originalSelectionMinLayerIndex = minLayerIndex;
        }
        
        // 選択範囲を下に1つ拡大
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            const aIndex = getLayerIndex(a.layerId, sheet);
            const bIndex = getLayerIndex(b.layerId, sheet);
            return aIndex - bIndex;
        });
        
        const maxFrame = Math.max(...sortedCells.map(s => s.frame));
        const layerIds = [...new Set(sortedCells.map(s => s.layerId))];
        const maxRows = getMaxVisibleRows(sheet);
        
        if (maxFrame < maxRows) {
            layerIds.forEach(layerId => {
                const cell = getCellElement(maxFrame + 1, layerId);
                if (cell) {
                    selectCell(cell, maxFrame + 1, layerId);
                }
            });
        }
        updateStatusBar();
        return;
    }
    
    if ((e.key === 'a' || e.key === 'A' || e.code === 'KeyA') && !e.ctrlKey && !AppState.isAPressed && !e.metaKey && !AppState.isAUsed && AppState.selectedCells.length > 1) {
        e.preventDefault();
        AppState.isAPressed = true;
        AppState.isAUsed = true;
        
        // 現在の選択範囲をバックアップ（セッション最初の1キー目の場合のみ）
        if (AppState.originalSelectionSize === 0) {
            const sheet = getCurrentSheet();
            const frames = AppState.selectedCells.map(s => s.frame);
            const layerIds = AppState.selectedCells.map(s => s.layerId);
            const layerIndices = layerIds.map(id => getLayerIndex(id, sheet)).filter(i => i !== -1);
            const minFrame = Math.min(...frames);
            const maxFrame = Math.max(...frames);
            const minLayerIndex = Math.min(...layerIndices);
            const maxLayerIndex = Math.max(...layerIndices);
            AppState.originalSelectionSize = AppState.selectedCells.length;
            AppState.originalSelectionRows = maxFrame - minFrame + 1;
            AppState.originalSelectionCols = maxLayerIndex - minLayerIndex + 1;
            AppState.originalSelectionMinFrame = minFrame;
            AppState.originalSelectionMinLayerIndex = minLayerIndex;
        }
        
        // 選択範囲を右から1つ減らす（最低1列は残す）
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            const aIndex = getLayerIndex(a.layerId, sheet);
            const bIndex = getLayerIndex(b.layerId, sheet);
            return aIndex - bIndex;
        });
        
        const layerIndices = sortedCells.map(s => getLayerIndex(s.layerId, sheet));
        const maxLayerIndex = Math.max(...layerIndices);
        const maxLayerId = sheet.layers[maxLayerIndex].id;
        const frames = [...new Set(sortedCells.map(s => s.frame))];
        const uniqueLayerIds = [...new Set(sortedCells.map(s => s.layerId))];
        
        // 列が1つしかない場合は削除しない
        if (uniqueLayerIds.length <= 1) { updateStatusBar(); return; }
        
        // 最大レイヤーIDのセルを選択解除
        frames.forEach(frame => {
            const cellToRemove = AppState.selectedCells.find(
                s => s.frame === frame && s.layerId === maxLayerId
            );
            if (cellToRemove) {
                const el = getCellElement(cellToRemove.frame, cellToRemove.layerId);
                if (el) el.classList.remove('selected');
                AppState.selectedCells = AppState.selectedCells.filter(s => s !== cellToRemove);
            }
        });
        
        updateStatusBar();
        return;
    }
    
    if ((e.key === 'd' || e.key === 'D' || e.code === 'KeyD') && !e.ctrlKey && !AppState.isDPressed && !e.metaKey && !AppState.isDUsed && AppState.selectedCells.length > 0) {
        e.preventDefault();
        AppState.isDPressed = true;
        AppState.isDUsed = true;
        
        // 現在の選択範囲をバックアップ（セッション最初の1キー目の場合のみ）
        if (AppState.originalSelectionSize === 0) {
            const sheet = getCurrentSheet();
            const frames = AppState.selectedCells.map(s => s.frame);
            const layerIds = AppState.selectedCells.map(s => s.layerId);
            const layerIndices = layerIds.map(id => getLayerIndex(id, sheet)).filter(i => i !== -1);
            const minFrame = Math.min(...frames);
            const maxFrame = Math.max(...frames);
            const minLayerIndex = Math.min(...layerIndices);
            const maxLayerIndex = Math.max(...layerIndices);
            AppState.originalSelectionSize = AppState.selectedCells.length;
            AppState.originalSelectionRows = maxFrame - minFrame + 1;
            AppState.originalSelectionCols = maxLayerIndex - minLayerIndex + 1;
            AppState.originalSelectionMinFrame = minFrame;
            AppState.originalSelectionMinLayerIndex = minLayerIndex;
        }
        
        // 選択範囲を右に1つ拡大
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            const aIndex = getLayerIndex(a.layerId, sheet);
            const bIndex = getLayerIndex(b.layerId, sheet);
            return aIndex - bIndex;
        });
        
        const layerIndices = sortedCells.map(s => getLayerIndex(s.layerId, sheet));
        const maxLayerIndex = Math.max(...layerIndices);
        const maxLayerId = sheet.layers[maxLayerIndex].id;
        const frames = [...new Set(sortedCells.map(s => s.frame))];
        const maxColumns = sheet.layers.length;
        
        // 次のレイヤーが存在するか確認
        const nextLayerIndex = maxLayerIndex + 1;
        if (nextLayerIndex < maxColumns) {
            const nextLayerId = sheet.layers[nextLayerIndex].id;
            frames.forEach(frame => {
                const cell = getCellElement(frame, nextLayerId);
                if (cell) {
                    selectCell(cell, frame, nextLayerId);
                }
            });
        }
        updateStatusBar();
        return;
    }
    
    // セルが1つ以上選択されている場合
    if (AppState.selectedCells.length >= 1) {
        // Shift+矢印キーで範囲選択
        if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            expandSelectionWithShift(e.key);
            return;
        }
        
        // 矢印キーでセル移動（単一/複数両方対応）
        if (!e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            // 空セルモードがONかつ下矢印の場合、移動前に選択範囲の1コマ目に×を挿入
            if (AppState.emptyCellMode && e.key === 'ArrowDown') {
                insertNullCell();
            }
            moveCellSelection(e.key);
            return;
        }
        
        // スペースキー: 選択範囲を維持したまま下に移動
        if (e.key === ' ' && !AppState.editingCell) {
            e.preventDefault();
            if (AppState.emptyCellMode) {
                insertNullCell();
            }
            moveSelectionDown();
            return;
        }
        
        // * : 選択範囲を下に1フレーム拡張
        if (e.key === '*' || e.key === 'Multiply') {
            e.preventDefault();
            debugLog('キー入力', `* キー検出、選択数: ${AppState.selectedCells.length}`);
            expandSelectionDown();
            return;
        }
        
        // / : 選択を1フレーム縮小
        if (e.key === '/' || e.key === 'Divide') {
            e.preventDefault();
            debugLog('キー入力', `/ キー検出、選択数: ${AppState.selectedCells.length}`);
            shrinkSelection();
            return;
        }
        
        // + と - の処理（単一/複数両方対応）
        // ===== +/- キー: 前の値に±1 =====
    // +キー: 前のセルの値+1、-キー: 前のセルの値-1
    if (e.key === '+' || e.key === '-') {
            // 編集中の+/-処理済みフラグがtrueならスキップ
            if (AppState.editingHandledPlusMinus) {
                debugLog("キー入力", "編集中の+/-なのでスキップ");
                e.preventDefault();
                return;
            }
            e.preventDefault();
            handlePlusMinusKey(e.key);
            return;
        }
        
        // 数字キー（1-9、テンキーを除く）が押されたら、モード設定に従って動作
        // auto: NumLock ON → 列選択 / NumLock OFF → 数値入力
        // column-select: 常に列選択
        // number-input: 常に数値入力
        if (/^[0-9]$/.test(e.key) && !AppState.editingCell && e.code.startsWith('Digit')) {
            e.preventDefault();
            const mode = AppState.numericKeyMode || 'auto';
            const useColumnSelect = mode === 'column-select' ||
                (mode === 'auto' && e.getModifierState('NumLock'));

            if (useColumnSelect) {
                const columnPosition = e.key === '0' ? 10 : parseInt(e.key);
                const sheet = getCurrentSheet();
                if (columnPosition <= sheet.layers.length) {
                    const layer = sheet.layers[columnPosition - 1];
                    const layerId = layer.id;
                    const targetCell = getCellElement(1, layerId);
                    if (targetCell) {
                        clearSelection();
                        selectCell(targetCell, 1, layerId);
                        updateStatusBar();
                        scrollToSelectionIfEnabled(targetCell);
                        debugLog('キー入力', `数字キー${e.key}で画面上${columnPosition}番目の列（${layer.name}）のF1を選択`);
                    } else {
                        showErrorToast(`列${columnPosition}が見つかりません。`, ErrorLevel.WARNING);
                    }
                } else {
                    showErrorToast(`列${columnPosition}は存在しません。現在の列数: ${sheet.layers.length}`, ErrorLevel.WARNING);
                }
            } else {
                if (AppState.selectedCells.length > 0) {
                    startEditingWithKey(getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId), e.key);
                }
            }
            return;
        }
        
        // テンキーの数字キー（0-9）が押されたら編集開始（従来の動作）
        if (/^[0-9]$/.test(e.key) && !AppState.editingCell && e.code.startsWith('Numpad')) {
            e.preventDefault();
            // 最初のセルで編集開始
            if (AppState.selectedCells.length > 0) {
                startEditingWithKey(getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId), e.key);
            }
            return;
        }
        
        // . (ピリオド): ひとつ前のセルに数字がある場合のみ縦線処理
        // ===== . キー: セルに数字がある場合はEnterと同じ、なければ縦線 =====
    // テンキーの . キー
    if (e.key === '.' || e.key === 'Decimal') {
            e.preventDefault();
            
            // 選択中のセルをチェック
            if (AppState.selectedCells.length > 0) {
                const sheet = getCurrentSheet();
                const firstCell = AppState.selectedCells[0];
                const frame = firstCell.frame;
                const layerId = firstCell.layerId;
                
                // 現在のセルの値をチェック
                const currentValue = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
                
                // 現在のセルに数字がある場合はEnterと同じ動作（次のセルに移動するだけ）
                if (currentValue !== '') {
                    if (AppState.selectedCells.length === 1) {
                        moveCellSelection('ArrowDown');
                    } else {
                        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
                            if (a.frame !== b.frame) return a.frame - b.frame;
                            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
                        });
                        
                        const { minFrame, maxFrame, shiftAmount } = calculateFrameRange(sortedCells);
                        
                        const maxRows = getMaxVisibleRows(sheet);
                        
                        clearSelection();
                        
                        sortedCells.forEach(s => {
                            const newFrame = s.frame + shiftAmount;
                            
                            if (newFrame <= maxRows) {
                                const cell = getCellElement(newFrame, s.layerId);
                                if (cell) {
                                    selectCell(cell, newFrame, s.layerId);
                                }
                            }
                        });
                        
                        renderSpreadsheet();
                        updateStatusBar();
                    }
                    return;
                }
                
                // 現在のセルが空の場合、ひとつ前のセルをチェック
                const prevFrame = frame - 1;
                const prevValue = prevFrame >= 1 ? ((sheet.data[prevFrame] && sheet.data[prevFrame][layerId]) || '') : '';
                
                // ひとつ前に数字がある場合はfillDashToEnd
                if (prevValue !== '') {
                    // 縦線処理
                    fillDashToEnd();
                } else {
                    // ひとつ前が空の場合はEnterと同じ動作
                    if (AppState.selectedCells.length === 1) {
                        moveCellSelection('ArrowDown');
                    } else {
                        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
                            if (a.frame !== b.frame) return a.frame - b.frame;
                            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
                        });
                        
                        const { minFrame, maxFrame, shiftAmount } = calculateFrameRange(sortedCells);
                        
                        const maxRows = getMaxVisibleRows(sheet);
                        
                        clearSelection();
                        
                        sortedCells.forEach(s => {
                            const newFrame = s.frame + shiftAmount;
                            
                            if (newFrame <= maxRows) {
                                const cell = getCellElement(newFrame, s.layerId);
                                if (cell) {
                                    selectCell(cell, newFrame, s.layerId);
                                }
                            }
                        });
                        
                        if (AppState.selectedCells.length > 0) {
                            const el = getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId);
                            if (el) scrollToSelectionIfEnabled(el);
                        }
                    }
                }
            }
            return;
        }
    }
    
    // セルが選択されていない時：矢印キーや数字キーでA1を選択
    if (AppState.selectedCells.length === 0) {
        const shouldSelectA1 = 
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
            /^[0-9]$/.test(e.key) ||
            e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/' ||
            e.key === '.' || e.key === 'Decimal' ||
            e.key === 'Enter' || e.key === 'Home' || e.key === 'End';
        
        if (shouldSelectA1) {
            e.preventDefault();
            const firstLayerId = getCurrentSheet()?.layers?.[0]?.id || 'L1';
            const a1Cell = getCellElement(1, firstLayerId);
            if (a1Cell) {
                selectCell(a1Cell, 1, firstLayerId);
                updateStatusBar('A1を選択しました');
            }
            return;
        }
    }
    
    // Ctrl+N: 新規作成
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewSheetWithPrompt();
        return;
    }
    
    // Ctrl+S: 保存
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveToFile();
        return;
    }
    
    // Ctrl+Shift+S: 名前を付けて保存
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveAsFile();
        return;
    }
    
    // Ctrl+O: 開く
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        // Tauriの場合は直接ダイアログを表示、ブラウザの場合はinputをクリック
        if (window.TauriAPI && window.TauriAPI.isRunningInTauri()) {
            loadFromFileTauri();
        } else {
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.click();
            }
        }
        return;
    }
    
    // Ctrl+W: 閉じる
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'w') {
        e.preventDefault();
        closeFile();
        return;
    }

    // Ctrl+Shift+W: すべてのシートを閉じる
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        closeAllSheets();
        return;
    }

    // Ctrl+,: シート設定
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        editCurrentSheetSettings();
        return;
    }

    // Ctrl+Shift+D: 尺を変更
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        changeDuration();
        return;
    }

    // Ctrl+Shift+F: フレームレートを変更
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        changeFPS();
        return;
    }

    // Ctrl+Shift+P: ページあたりのコマ数を変更
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        changeFramePage();
        return;
    }

    // Ctrl+Shift+C: 列数を変更
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        changeMaxColumns();
        return;
    }

    // Ctrl+P: 印刷
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        printCurrentSheet();
        return;
    }

    
    // Ctrl+E: After Effectsにタイムリマップとして送信
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'e') {
        e.preventDefault();
        sendToAfterEffects();
        return;
    }
    
    // Ctrl+Shift+E: ExtendScriptとして出力
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        exportJSX();
        return;
    }
    
    // Ctrl+I: AEからタイムリマップを取得
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'i') {
        e.preventDefault();
        getTimeremapFromAE();
        return;
    }
    
    // Ctrl+Z: Undo
    // ===== Ctrl+Z/Y: Undo/Redo =====
    // 履歴の前後移動で編集操作を取り消し/やり直し
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    
    // Ctrl+Y: Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
        return;
    }
    
    // Ctrl+C: コピー
    // ===== Ctrl+C/V/X: クリップボード操作 =====
    // コピー・ペースト・カット機能
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copySelection();
        return;
    }
    
    // Ctrl+X: 切り取り
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        cutSelection();
        return;
    }
    
    // Ctrl+V: ペースト
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteSelection();
        return;
    }
    
    // Ctrl+A: 全選択
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
    }
    
    // ===== F1: ヘルプダイアログの開閉 =====
    if (e.key === 'F1') {
        e.preventDefault();
        const helpDialog = document.getElementById('help-dialog');
        if (helpDialog) {
            if (helpDialog.style.display === 'flex') {
                helpDialog.style.display = 'none';
                debugLog('操作', 'F1キーでヘルプダイアログを閉じる');
            } else {
                // ヘルプコンテンツを動的に生成
                const helpContent = helpDialog.querySelector('.help-content');
                if (helpContent && typeof generateHelpHTML === 'function') {
                    // 閉じるボタン以外をクリア
                    const closeBtn = helpContent.querySelector('.close-button');
                    helpContent.innerHTML = '';
                    if (closeBtn) {
                        helpContent.appendChild(closeBtn);
                    } else {
                        helpContent.innerHTML = '<span class="close-button" id="close-help">&times;</span>';
                    }
                    // ヘルプHTMLを追加
                    helpContent.innerHTML += generateHelpHTML();
                    
                    // 閉じるボタンのイベントリスナーを登録
                    const newCloseBtn = helpContent.querySelector('.close-button');
                    if (newCloseBtn) {
                        newCloseBtn.addEventListener('click', () => {
                            helpDialog.style.display = 'none';
                        });
                    }
                }
                helpDialog.style.display = 'flex';
                debugLog('操作', 'F1キーでヘルプダイアログを表示');
            }
        }
        return;
    }
    
    // Esc: ヘルプダイアログが開いていたら閉じる、なければ選択を左上1つに
    // ===== Escape: ヘルプダイアログを閉じる、または選択範囲を左上1つに =====
    if (e.key === 'Escape') {
        // ヘルプダイアログが開いている場合は閉じる
        const helpDialog = document.getElementById('help-dialog');
        if (helpDialog && helpDialog.style.display === 'flex') {
            helpDialog.style.display = 'none';
            debugLog('操作', 'Escapeキーでヘルプダイアログを閉じる');
            return;
        }
        
        // 複数選択を解除して左上のセル1つのみ選択
        if (AppState.selectedCells.length > 1) {
            // 複数選択時: 左上のセル1つだけ残す
            const sheet = getCurrentSheet();
            const sortedCells = [...AppState.selectedCells].sort((a, b) => {
                if (a.frame !== b.frame) return a.frame - b.frame;
                // layerIdは文字列なので、シート内のインデックスで比較
                const aIndex = getLayerIndex(a.layerId, sheet);
                const bIndex = getLayerIndex(b.layerId, sheet);
                return aIndex - bIndex;
            });
            
            const topLeft = sortedCells[0];
            clearSelection();
            const topLeftEl = getCellElement(topLeft.frame, topLeft.layerId);
            if (topLeftEl) {
                selectCell(topLeftEl, topLeft.frame, topLeft.layerId);
                scrollToSelectionIfEnabled(topLeftEl, { block: 'center', inline: 'nearest' });
            }
            updateStatusBar('選択を1つにしました');
        } else if (AppState.selectedCells.length === 1) {
            // 単一選択時: A1に移動
            clearSelection();
            const firstLayerId = getCurrentSheet()?.layers?.[0]?.id || 'L1';
            const a1Cell = getCellElement(1, firstLayerId);
            if (a1Cell) {
                selectCell(a1Cell, 1, firstLayerId);
                // スクロールして表示（ヘッダーの高さを考慮）
                const container = document.querySelector('.spreadsheet-container');
                if (container) {
                    // 一番上にスクロール
                    container.scrollTop = 0;
                    container.scrollLeft = 0;
                }
            }
            updateStatusBar();
        }
    }
    
    // Delete: 削除
    if (e.key === 'Delete' && AppState.selectedCells.length > 0) {
        deleteSelection();
    }
    
    // Shift+Home: 選択中のセルより上を全選択
    if (e.shiftKey && e.key === 'Home' && AppState.selectedCells.length >= 1) {
        e.preventDefault();
        
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
        });
        
        const { minFrame } = calculateFrameRange(sortedCells);
        const layerIds = [...new Set(sortedCells.map(s => s.layerId))];
        
        // 1行目から現在の選択範囲の上端まで追加選択
        for (let frame = 1; frame < minFrame; frame++) {
            layerIds.forEach(layerId => {
                const cell = getCellElement(frame, layerId);
                if (cell) {
                    selectCell(cell, frame, layerId);
                }
            });
        }
        
        updateStatusBar();
        return;
    }
    
    // Shift+End: 選択中のセルより下を全選択
    if (e.shiftKey && e.key === 'End' && AppState.selectedCells.length >= 1) {
        e.preventDefault();
        
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
        });
        
        const { maxFrame } = calculateFrameRange(sortedCells);
        const layerIds = [...new Set(sortedCells.map(s => s.layerId))];
        const maxRows = getMaxVisibleRows(sheet);
        
        // 現在の選択範囲の下端から最終行まで追加選択
        for (let frame = maxFrame + 1; frame <= maxRows; frame++) {
            layerIds.forEach(layerId => {
                const cell = getCellElement(frame, layerId);
                if (cell) {
                    selectCell(cell, frame, layerId);
                }
            });
        }
        
        updateStatusBar();
        return;
    }
    
    // End: 列の最後の入力の次のセルへ移動（Shiftなし）
    if (!e.shiftKey && e.key === 'End' && AppState.selectedCells.length >= 1) {
        e.preventDefault();
        
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
        });
        
        const selectionSize = AppState.selectedCells.length;
        const uniqueLayerIds = [...new Set(sortedCells.map(s => s.layerId))];
        const layerCount = uniqueLayerIds.length;
        const rowCount = Math.floor(selectionSize / layerCount);
        const { minFrame } = calculateFrameRange(sortedCells);
        const layerIndices = uniqueLayerIds.map(id => getLayerIndex(id, sheet)).filter(i => i !== -1);
        const minLayerIdx = Math.min(...layerIndices);
        const maxLayerIdx = Math.max(...layerIndices);
        const maxRows = getMaxVisibleRows(sheet);
        
        // 各レイヤーで最後の入力を探す
        let targetFrame = 1;
        for (let li = minLayerIdx; li <= maxLayerIdx; li++) {
            const layerId = sheet.layers[li].id;
            let lastInputFrame = 0;
            for (let frame = 1; frame <= maxRows; frame++) {
                const value = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
                if (value && value !== '') {
                    lastInputFrame = frame;
                }
            }
            let nextFrame;
            if (lastInputFrame === 0) {
                nextFrame = 1;
            } else if (lastInputFrame >= maxRows) {
                nextFrame = maxRows;
            } else {
                nextFrame = lastInputFrame + 1;
            }
            targetFrame = Math.max(targetFrame, nextFrame);
        }
        
        // 選択範囲のサイズを保って移動
        clearSelection();
        for (let f = targetFrame; f < targetFrame + rowCount && f <= maxRows; f++) {
            for (let li = minLayerIdx; li <= maxLayerIdx; li++) {
                const lId = sheet.layers[li].id;
                const cell = getCellElement(f, lId);
                if (cell) {
                    selectCell(cell, f, lId);
                }
            }
        }
        
        // スクロールして表示
        if (AppState.selectedCells.length > 0) {
            const el = getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId);
            if (el) scrollToSelectionIfEnabled(el);
        }
        
        updateStatusBar();
        return;
    }
    
    // Home: 選択範囲を先頭に移動（Shiftなし）
    if (!e.shiftKey && e.key === 'Home' && AppState.selectedCells.length >= 1) {
        e.preventDefault();
        
        const sheet = getCurrentSheet();
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
        });
        
        const { minFrame } = calculateFrameRange(sortedCells);
        const offset = minFrame - 1; // フレーム1に移動するためのオフセット
        
        clearSelection();
        
        // 各セルを先頭に移動
        sortedCells.forEach(s => {
            const newFrame = s.frame - offset;
            
            const newCell = getCellElement(newFrame, s.layerId);
            
            if (newCell) {
                selectCell(newCell, newFrame, s.layerId);
            }
        });
        
        // スクロールして表示（ヘッダーの高さを考慮）
        if (AppState.selectedCells.length > 0) {
            const targetCell = getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId);
            const container = document.querySelector('.spreadsheet-container');
            if (container && targetCell) {
                // ヘッダー行の高さを取得
                const headerRow = document.querySelector('thead tr');
                const headerHeight = headerRow ? headerRow.offsetHeight : 40;
                
                // セルの位置を取得
                const cellRect = targetCell.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                // 現在のスクロール位置 + セルの相対位置 - ヘッダーの高さ
                container.scrollTop = container.scrollTop + (cellRect.top - containerRect.top) - headerHeight;
            }
        }
        
        updateStatusBar();
        return;
    }
    
    // Ctrl+Enter: 次の列の先頭（フレーム1）に移動
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && AppState.selectedCells.length > 0) {
        e.preventDefault();
        
        const sheet = getCurrentSheet();
        const currentCell = AppState.selectedCells[0];
        const currentLayerId = currentCell.layerId;
        
        // 現在の列の位置（画面上の左から何番目か）を取得
        const currentLayerIndex = sheet.layers.findIndex(layer => layer.id === currentLayerId);
        
        if (currentLayerIndex === -1) {
            showErrorToast('現在の列が見つかりません。', ErrorLevel.WARNING);
            return;
        }
        
        // 次の列のインデックス
        const nextLayerIndex = currentLayerIndex + 1;
        
        if (nextLayerIndex >= sheet.layers.length) {
            // 最後の列の場合は最初の列に戻る
            const firstLayer = sheet.layers[0];
            const targetCell = getCellElement(1, firstLayer.id);
            
            if (targetCell) {
                clearSelection();
                selectCell(targetCell, 1, firstLayer.id);
                
                // Homeキーと同じスクロール処理
                const container = document.querySelector('.spreadsheet-container');
                if (container && targetCell) {
                    const headerRow = document.querySelector('thead tr');
                    const headerHeight = headerRow ? headerRow.offsetHeight : 40;
                    const cellRect = targetCell.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    container.scrollTop = container.scrollTop + (cellRect.top - containerRect.top) - headerHeight;
                }
                
                updateStatusBar();
                debugLog('キー入力', `Ctrl+Enter: 最初の列（${firstLayer.name}）のF1に移動`);
            }
        } else {
            // 次の列のF1に移動
            const nextLayer = sheet.layers[nextLayerIndex];
            const targetCell = getCellElement(1, nextLayer.id);
            
            if (targetCell) {
                clearSelection();
                selectCell(targetCell, 1, nextLayer.id);
                
                // Homeキーと同じスクロール処理
                const container = document.querySelector('.spreadsheet-container');
                if (container && targetCell) {
                    const headerRow = document.querySelector('thead tr');
                    const headerHeight = headerRow ? headerRow.offsetHeight : 40;
                    const cellRect = targetCell.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    container.scrollTop = container.scrollTop + (cellRect.top - containerRect.top) - headerHeight;
                }
                
                updateStatusBar();
                debugLog('キー入力', `Ctrl+Enter: 次の列（${nextLayer.name}）のF1に移動`);
            }
        }
        return;
    }
    
    // Enter: 下のセルに移動（複数選択時は範囲ごと移動）
    // ただし、編集モード中または編集完了直後は edit.js の handleEditKeydown で処理されるのでスキップ
    if (e.key === 'Enter' && AppState.selectedCells.length >= 1 && !AppState.editingCell && !AppState.justFinishedEditing) {
        e.preventDefault();
        
        const sheet = getCurrentSheet();
        
        const selectionInfo = AppState.selectedCells.map(s => ({f: s.frame, l: s.layerId}));
        debugLog('キー入力', 'Enter押下', selectionInfo);
        
        // 移動前のセル情報を保存
        const cellsBeforeInput = AppState.selectedCells.map(s => ({
            frame: s.frame,
            layerId: s.layerId
        }));

        // 直前フレームに数字がある場合、同じ値を引き継ぐ（既存値も上書き）
        let needRender = false;
        cellsBeforeInput.forEach(s => {
            const prevFrame = s.frame - 1;
            if (prevFrame >= 1) {
                const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][s.layerId]) || '';
                const currentValue = (sheet.data[s.frame] && sheet.data[s.frame][s.layerId]) || '';
                if (prevValue !== '' && /^\d+$/.test(prevValue) && currentValue !== CONSTANTS.NULL_CELL) {
                    if (!sheet.data[s.frame]) sheet.data[s.frame] = {};
                    sheet.data[s.frame][s.layerId] = prevValue;
                    needRender = true;
                }
            }
        });

        if (needRender) {
            saveHistory('セル編集');
            calculateSpecialDisplayCache(sheet);
            renderSpreadsheetImmediate(true);
        }

        if (AppState.selectedCells.length === 1) {
            // 単一選択：1つ下に移動
            moveCellSelection('ArrowDown');
        } else {
            // 複数選択：選択範囲の高さ分下に移動
            // 移動前のセル情報を使用
            const sortedCells = [...cellsBeforeInput].sort((a, b) => {
                if (a.frame !== b.frame) return a.frame - b.frame;
                return compareLayerIds(a.layerId, b.layerId, sheet.layers);
            });
            
            const { minFrame, maxFrame, shiftAmount } = calculateFrameRange(sortedCells);
            
            const maxRows = getMaxVisibleRows(sheet);
            
            // 移動後の最大フレームが範囲を超える場合は、超えないように調整
            const adjustedShiftAmount = Math.min(shiftAmount, maxRows - maxFrame);
            
            // 移動しない場合はそのまま選択を保持
            if (adjustedShiftAmount === 0) {
                updateStatusBar('最終行です');
                return;
            }
            
            // セル選択（renderSpreadsheetImmediate済みなので即時選択）
            clearSelection();
            sortedCells.forEach(s => {
                const newFrame = s.frame + adjustedShiftAmount;
                const cell = getCellElement(newFrame, s.layerId);
                if (cell) {
                    selectCell(cell, newFrame, s.layerId);
                }
            });
            
            // スクロール
            if (AppState.selectedCells.length > 0) {
                const el = getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId);
                if (el) scrollToSelectionIfEnabled(el);
            }
            
            updateStatusBar();
        }
    }
    
    // F2: 編集開始
    if (e.key === 'F2' && AppState.selectedCells.length === 1) {
        e.preventDefault();
        startEditing(getCellElement(AppState.selectedCells[0].frame, AppState.selectedCells[0].layerId));
    }
}

// 複数選択時の入力処理
// キーアップ時の処理（W/A/S/D解放時に選択を元に戻す）
/**
 * キーアップイベント処理
 * W/A/S/Dキーの解放を検知し、一時的な選択拡張を確定
 * @param {KeyboardEvent} e - キーボードイベント
 */
function handleKeyUp(e) {
    // ダイアログが表示中は無視
    const dialogOverlay = document.getElementById('custom-dialog-overlay');
    if (dialogOverlay && dialogOverlay.style.display !== 'none') return;
    
    debugLog("キー入力", `keyup: ${e.key}`, {originalSelectionSize: AppState.originalSelectionSize, isW: AppState.isWPressed, isA: AppState.isAPressed, isS: AppState.isSPressed, isD: AppState.isDPressed});
    
    if (e.key === 'w' || e.key === 'W' || e.code === 'KeyW') {
        AppState.isWPressed = false;
    }
    
    if (e.key === 's' || e.key === 'S' || e.code === 'KeyS') {
        AppState.isSPressed = false;
    }
    
    if (e.key === 'a' || e.key === 'A' || e.code === 'KeyA') {
        AppState.isAPressed = false;
    }
    
    if (e.key === 'd' || e.key === 'D' || e.code === 'KeyD') {
        AppState.isDPressed = false;
    }
    
    // すべてのW/A/S/Dキーが離されたら選択を元に戻す
    if (!AppState.isWPressed && !AppState.isAPressed && !AppState.isSPressed && !AppState.isDPressed && AppState.originalSelectionSize > 0) {
        debugLog("キー入力", "すべてのキー解放、元のサイズに戻します");
        
        const sheet = getCurrentSheet();
        
        // バックアップ時に保存した開始位置を使う
        const minFrame = AppState.originalSelectionMinFrame;
        const minLayerIndex = AppState.originalSelectionMinLayerIndex;
        
        // 元のサイズに合わせて選択し直す
        clearSelection();
        
        for (let f = minFrame; f < minFrame + AppState.originalSelectionRows; f++) {
            for (let colOffset = 0; colOffset < AppState.originalSelectionCols; colOffset++) {
                const layerIndex = minLayerIndex + colOffset;
                if (layerIndex >= 0 && layerIndex < sheet.layers.length) {
                    const layerId = sheet.layers[layerIndex].id;
                    const cell = getCellElement(f, layerId);
                    if (cell) {
                        selectCell(cell, f, layerId);
                    }
                }
            }
        }
        updateStatusBar();
        
        // クリア
        AppState.originalSelectionSize = 0;
        AppState.originalSelectionRows = 0;
        AppState.originalSelectionCols = 0;
        AppState.originalSelectionMinFrame = 0;
        AppState.originalSelectionMinLayerIndex = 0;
        AppState.isWUsed = false;
        AppState.isAUsed = false;
        AppState.isSUsed = false;
        AppState.isDUsed = false;
    }
}
