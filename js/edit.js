/**
 * edit.js
 * 
 * セル編集関連の機能
 * - セルの編集開始・終了
 * - 編集中のキー入力処理
 * - +/-キーによる値の増減
 * - 複数セル入力
 * - 次のセルへの移動
 * 
 * 依存関係:
 * - AppState: グローバル状態
 * - getCurrentSheet(): 現在のシート取得
 * - saveHistory(): 履歴保存
 * - renderSpreadsheet(): スプレッドシート再描画
 * - selectCell(): セル選択
 * - clearSelection(): 選択解除
 * - getCellElement(): セル要素取得
 * - expandSelectionDown(): 選択範囲を下に拡張
 * - shrinkSelection(): 選択範囲を縮小
 * - updateStatusBar(): ステータスバー更新
 * - debugLog(): デバッグログ出力
 */

/**
 * セル編集を開始する
 * @param {HTMLElement} cell - 編集対象のセル要素
 */
function startEditing(cell) {
    if (AppState.editingCell) return;
    
    // null チェック
    if (!cell || !cell.dataset) {
        console.error('Invalid cell element');
        return;
    }
    
    // フレーム番号とレイヤーIDのバリデーション
    const frame = parseInt(cell.dataset.frame);
    const layerId = cell.dataset.layer; // "L1" などの文字列IDをそのまま使用
    
    // NaN チェック
    if (isNaN(frame) || !layerId) {
        console.error('Invalid frame or layerId');
        return;
    }
    
    const sheet = getCurrentSheet();
    if (!sheet) {
        console.error('No active sheet');
        return;
    }
    
    const maxRows = getMaxVisibleRows(sheet);
    
    if (!validateFrame(frame, maxRows)) return;
    if (!validateLayerId(layerId, sheet.layers)) return;
    
    // 実データから値を取得（表示値'-'ではなく実際の値を使用）
    const currentValue = (sheet.data[frame] && sheet.data[frame][layerId] !== undefined)
        ? String(sheet.data[frame][layerId])
        : '';
    
    // 選択情報をデータとして保存
    const isMultiSelection = AppState.selectedCells.length > 1;
    const selectedCellsBackup = AppState.selectedCells.map(s => ({
        frame: s.frame,
        layerId: s.layerId
    }));
    
    AppState.editingCell = {
        cell,
        frame: parseInt(cell.dataset.frame),
        layerId: cell.dataset.layer, // "L1" などの文字列IDをそのまま使用
        originalValue: currentValue,
        isMultiSelection: isMultiSelection,
        selectedCellsBackup: selectedCellsBackup
    };
    
    cell.classList.add('editing');
    // XSS対策: escapeHtml関数を使用
    const escapedValue = escapeHtml(currentValue);
    cell.innerHTML = `<input type="text" value="${escapedValue}" maxlength="${CONSTANTS.MAX_CELL_INPUT_LENGTH}" inputmode="numeric" style="ime-mode: disabled;">`;
    
    const input = cell.querySelector('input');
    if (!input) {
        console.error('Failed to create input element');
        return;
    }
    
    input.focus();
    input.select();
    
    // 全角数字を半角に自動変換
    input.addEventListener('input', (e) => {
        const value = e.target.value;
        const converted = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        if (value !== converted) {
            const start = e.target.selectionStart;
            e.target.value = converted;
            e.target.setSelectionRange(start, start);
        }
    });
    
    input.addEventListener('blur', () => {
        finishEditing(true);
    });
    
    input.addEventListener('keydown', (e) => {
        handleEditKeydown(e);
    });
}

/**
 * セル編集を終了する
 * @param {boolean} save - 入力を保存するかどうか
 */
function finishEditing(save) {
    if (!AppState.editingCell) return;
    
    const { cell, frame, layerId, originalValue, isMultiSelection, selectedCellsBackup } = AppState.editingCell;
    
    // null チェック
    if (!cell) {
        console.error('Invalid editing cell');
        AppState.editingCell = null;
        return;
    }
    
    // バリデーション：frame と layerId が有効か確認
    const sheet = getCurrentSheet();
    if (!sheet) {
        console.error('No active sheet');
        AppState.editingCell = null;
        return;
    }
    
    const maxRows = getMaxVisibleRows(sheet);
    if (!validateFrame(frame, maxRows)) {
        AppState.editingCell = null;
        return;
    }
    if (!validateLayerId(layerId, sheet.layers)) {
        AppState.editingCell = null;
        return;
    }
    
    const input = cell.querySelector('input');
    if (!input) {
        console.error('Input element not found');
        AppState.editingCell = null;
        return;
    }
    
    let newValue = save ? input.value.trim() : originalValue;
    
    // 0は空セルとして扱う
    if (newValue === '0') {
        newValue = '';
    }
    
    cell.classList.remove('editing');
    AppState.editingCell = null;
    
    // 編集完了直後のフラグを立てる（keyboard.jsでの二重処理を防止）
    AppState.justFinishedEditing = true;
    requestAnimationFrame(() => {
        AppState.justFinishedEditing = false;
    });
    
    // 入力が完了したので、Ctrl/Altの一時選択をクリア
    AppState.originalSelectionSize = 0;
    AppState.originalSelectionMinFrame = 0;
    AppState.originalSelectionMinLayerIndex = 0;
    AppState.isCtrlPressed = false;
    AppState.isAltPressed = false;
    
    if (save) {
        if (isMultiSelection && selectedCellsBackup && selectedCellsBackup.length > 1) {
            // 複数選択時の処理
            const sortedCells = [...selectedCellsBackup].sort((a, b) => {
                if (a.frame !== b.frame) return a.frame - b.frame;
                return compareLayerIds(a.layerId, b.layerId, getCurrentSheet().layers);
            });
            
            // 入力前の選択範囲をログ出力
            const beforeInfo = sortedCells.map(s => ({f: s.frame, l: s.layerId}));
            debugLog("編集", "複数編集 入力前", {selection: beforeInfo, value: newValue});
            
            // レイヤーごとにグループ化
            const layerGroups = {};
            sortedCells.forEach(s => {
                // バリデーション：各セルのフレームとレイヤーIDが有効か確認
                if (!validateFrame(s.frame, maxRows)) return;
                if (!validateLayerId(s.layerId, sheet.layers)) return;
                
                if (!layerGroups[s.layerId]) {
                    layerGroups[s.layerId] = [];
                }
                layerGroups[s.layerId].push(s.frame);
            });
            
            // いずれかのセルが実際に変更されるか事前チェック
            let hasChange = false;
            Object.keys(layerGroups).forEach(lid => {
                const frames = layerGroups[lid];
                frames.forEach(f => {
                    if ((sheet.data[f] && sheet.data[f][lid] || '') !== newValue) {
                        hasChange = true;
                    }
                });
            });
            
            // 変更がある場合のみ、変更後に履歴保存（後に移動）
            
            // 各レイヤーの最初のフレームに入力値、その後も同じ値（ただし入力が空なら全て空）
            Object.keys(layerGroups).forEach(lid => {
                const layerId = lid; // "L14"などの文字列IDをそのまま使用
                const frames = layerGroups[lid].sort((a, b) => a - b);
                
                frames.forEach((f, index) => {
                    // 全てのフレームに同じ値を保存（「-」表示はrender.jsで制御）
                    sheet.data[f][layerId] = newValue;
                });
            });
            
            // 特殊表示キャッシュを更新して再レンダリング
            if (hasChange) {
                saveHistory('セル編集');
            }
            calculateSpecialDisplayCache(sheet);
            renderSpreadsheetImmediate(); // 即座に実行・選択処理があるため
            
            // レンダリング完了を待つための小さな遅延
            // （DOMの更新を確実にする）
            setTimeout(() => {
                // 選択範囲の形状を保ったまま移動
                const { minFrame, maxFrame, shiftAmount } = calculateFrameRange(sortedCells);
                
                clearSelection();
                AppState.selectionAnchor = null; // アンカーをクリア
                
                // 各セルを元の移動量で移動し、範囲内に収まるものだけ選択
                debugLog("編集", "複数選択移動開始", {
                    sortedCells: sortedCells.length,
                    shiftAmount,
                    maxRows
                });
                
                sortedCells.forEach(s => {
                    const newFrame = s.frame + shiftAmount;
                    
                    // 範囲外のセルはスキップ
                    if (newFrame > maxRows) {
                        debugLog("編集", `範囲外スキップ: F${newFrame} > ${maxRows}`);
                        return;
                    }
                    
                    const c = getCellElement(newFrame, s.layerId);
                    if (c) {
                        selectCell(c, newFrame, s.layerId);
                        debugLog("編集", `セル選択成功: F${newFrame}L${s.layerId}`);
                    } else {
                        debugLog("編集", `セル要素が見つからない: F${newFrame}L${s.layerId}`);
                    }
                });
                
                debugLog("編集", "複数選択移動後", {
                    selectedCount: AppState.selectedCells.length
                });
                
                // 選択できなかった場合は元の選択を保持
                if (AppState.selectedCells.length === 0) {
                    debugLog("編集", "移動失敗、元の選択を復元");
                    sortedCells.forEach(s => {
                        const c = getCellElement(s.frame, s.layerId);
                        if (c) {
                            selectCell(c, s.frame, s.layerId);
                        } else {
                            debugLog("編集", `復元失敗: F${s.frame}L${s.layerId}`);
                        }
                    });
                    updateStatusBar(`${sortedCells.length}セルに入力しました（最終行）`);
                } else {
                    // 最初のセルまでスクロール
                    if (AppState.selectedCells.length > 0 && AppState.selectedCells[0].cell) {
                        scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
                    }
                    updateStatusBar(`${sortedCells.length}セルに入力しました`);
                }
                
                // 移動後の選択範囲をログ出力
                const afterInfo = AppState.selectedCells.map(s => ({f: s.frame, l: s.layerId}));
                debugLog("編集", "複数編集後 移動後", afterInfo);
            }, 0);
        } else {
    // 単一選択時: 通常の編集
            // バリデーション：frame と layerId が有効か確認
            if (!validateFrame(frame, maxRows)) return;
            if (!validateLayerId(layerId, sheet.layers)) return;
            
            const oldValue = sheet.data[frame][layerId];
            
            // 前のセルの値を取得（「-」の場合はさらに上の数字を探す）
            let previousValue = '';
            let previousFrame = 0;
            if (frame > 1) {
                previousValue = sheet.data[frame - 1][layerId] || '';
                if (previousValue !== '' && previousValue !== '-') {
                    previousFrame = frame - 1;
                }
                // 前のセルが「-」の場合、さらに上の数字を探す
                if (previousValue === '-') {
                    for (let f = frame - 2; f >= 1; f--) {
                        const val = sheet.data[f][layerId] || '';
                        if (val !== '' && val !== '-') {
                            previousValue = val;
                            previousFrame = f;
                            break;
                        }
                    }
                }
            }
            
            // 入力値が前のセルと同じ場合も実際の値を保持（表示は自動で"-"になる）
            
            // 値が変更された場合のみ、変更後に履歴保存（後に移動）
            
            sheet.data[frame][layerId] = newValue;

            // 直線区間の途中に値を入れた場合、直前の数字との間は同値で埋める
            // （表示は「前と同値→-表示」のrender.jsロジックで自動的に-になる）
            if (newValue !== '' && previousFrame > 0 && frame - previousFrame > 1) {
                for (let f = previousFrame + 1; f < frame; f++) {
                    if (!sheet.data[f]) sheet.data[f] = {};
                    sheet.data[f][layerId] = newValue;
                }
            }

            // 直線（同値連続）上のセルを編集した場合、以降の連続セルも同値に更新して
            // 表示上は「-」連続になる状態を保つ
            const wasLineContinuation = oldValue === '-' || (oldValue !== '' && oldValue === previousValue);
            const wasVisualLineContinuation = typeof getSpecialDisplayInfo === 'function' &&
                getSpecialDisplayInfo(layerId, frame).isVerticalLine;
            const lineBaseValue = (oldValue === '' || oldValue === '-') ? previousValue : oldValue;
            if ((wasLineContinuation || wasVisualLineContinuation) && newValue !== '' && newValue !== oldValue) {
                for (let f = frame + 1; f <= maxRows; f++) {
                    const nextValue = (sheet.data[f] && sheet.data[f][layerId]) || '';
                    if (
                        nextValue === '' ||
                        nextValue === '-' ||
                        (lineBaseValue !== '' && nextValue === lineBaseValue)
                    ) {
                        if (!sheet.data[f]) sheet.data[f] = {};
                        sheet.data[f][layerId] = newValue;
                    } else {
                        break;
                    }
                }
            }
            
            debugLog("編集", `F${frame}L${layerId}: "${oldValue}" → "${newValue}"`);
            
            // 削除（空にした）場合、その直後の"-"を実際の値に展開
            let needRender = false;
            if (oldValue !== '' && newValue === '') {
                const nextFrame = frame + 1;
                
                if (nextFrame <= maxRows && sheet.data[nextFrame] && sheet.data[nextFrame][layerId] === '-') {
                    // 上方向に数字を探す
                    let actualValue = '';
                    for (let f = frame - 1; f >= 1; f--) {
                        const val = (sheet.data[f] && sheet.data[f][layerId]) || '';
                        if (val !== '' && val !== '-') {
                            actualValue = val;
                            if (AppState.debugMode) console.log(`フレーム${f}で数字発見: "${actualValue}"`);
                            break;
                        }
                    }
                    
                    // 次のセルを実際の値に置き換え
                    if (actualValue !== '') {
                        sheet.data[nextFrame][layerId] = actualValue;
                        if (AppState.debugMode) console.log(`フレーム${nextFrame}を"${actualValue}"に置き換えました`);
                        needRender = true;
                    }
                } else {
                    // 次のセルは"-"ではない
                }
            }
            
            if (newValue !== oldValue) {
                saveHistory('セル編集');
            }
            
            if (needRender) {
                calculateSpecialDisplayCache(sheet);
                renderSpreadsheetImmediate(); // 即座に実行・選択処理があるため
                clearSelection();
                AppState.selectionAnchor = null; // アンカーをクリア
                const newCell = getCellElement(frame, layerId);
                if (newCell) {
                    selectCell(newCell, frame, layerId);
                    moveToNextCell();
                }
            } else {
                // 通常の編集（renderして表示を更新）
                calculateSpecialDisplayCache(sheet);
                renderSpreadsheetImmediate(); // 即座に実行・選択処理があるため
                
                // 選択を復元
                clearSelection();
                AppState.selectionAnchor = null; // アンカーをクリア
                const newCell = getCellElement(frame, layerId);
                if (newCell) {
                    selectCell(newCell, frame, layerId);
                    moveToNextCell();
                }
            }
            
            
            // 移動後の選択範囲をログ出力
            const afterInfo = AppState.selectedCells.map(s => ({f: s.frame, l: s.layerId}));
            debugLog("編集", "単一編集後 移動後", afterInfo);
        }
    } else {
        cell.classList.toggle('dash-value', newValue === '-');
        cell.textContent = newValue;
    }
}

/**
 * 編集中キーボード処理を行う
 * @param {KeyboardEvent} e - キーボードイベント
 */
function handleEditKeydown(e) {
    const input = e.target;
    
    // +と-はEnterと同じ挙動（確定して次へ）
    if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        // handleKeyboardをスキップさせるフラグ
        AppState.editingHandledPlusMinus = true;
        setTimeout(() => {
            AppState.editingHandledPlusMinus = false;
        }, 50);
        finishEditing(true);
        return;
    }
    
    // . (ドット)は編集確定して縦線処理
    if (e.key === '.' || e.key === 'Decimal') {
        e.preventDefault();
        e.stopPropagation();
        
        // 縦線処理のために現在のセル位置を記憶
        const currentFrame = AppState.editingCell.frame;
        const currentLayerId = AppState.editingCell.layerId;
        
        finishEditing(true);
        
        // 編集確定後、記憶したセルから縦線を描画
        setTimeout(() => {
            // 記憶したセルを再選択
            const targetCell = getCellElement(currentFrame, currentLayerId);
            if (targetCell) {
                clearSelection();
                selectCell(targetCell, currentFrame, currentLayerId);
                
                // fillDashToEnd()を呼び出す
                if (typeof fillDashToEnd === 'function') {
                    fillDashToEnd();
                }
            }
        }, 50);
        return;
    }
    
    // *と/も編集を確定してから処理
    if (e.key === '*') {
        e.preventDefault();
        e.stopPropagation();
        finishEditing(true);
        setTimeout(() => {
            expandSelectionDown();
        }, 0);
        return;
    }
    
    if (e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        finishEditing(true);
        setTimeout(() => {
            shrinkSelection();
        }, 0);
        return;
    }
    
    switch(e.key) {
        case 'Enter':
            e.preventDefault();
            e.stopPropagation();
            finishEditing(true);
            // moveToNextCell()はfinishEditing内で呼ばれる
            break;
        case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            finishEditing(false);
            break;
        case 'Tab':
            e.preventDefault();
            e.stopPropagation();
            finishEditing(true);
            // Tabの場合は横移動
            if (AppState.selectedCells.length > 0) {
                moveToNextCell(e.shiftKey ? -1 : 1);
            }
            break;
    }
}

/**
 * 次のセルへ移動する
 * - direction = 0: 下に移動（デフォルト）
 * - direction = 1: 右に移動
 * - direction = -1: 左に移動
 * 
 * @param {number} direction - 移動方向（0=下、1=右、-1=左）
 */
function moveToNextCell(direction = 0) {
    if (AppState.selectedCells.length === 0) return;
    
    const current = AppState.selectedCells[0];
    const sheet = getCurrentSheet();
    
    let nextFrame = current.frame;
    let nextLayerId = current.layerId;
    
    if (direction === 0) {
        // 下に移動
        nextFrame++;
        if (nextFrame > sheet.frames) {
            nextFrame = 1;
            const layerIndex = sheet.layers.findIndex(l => l.id === current.layerId);
            if (layerIndex < sheet.layers.length - 1) {
                nextLayerId = sheet.layers[layerIndex + 1].id;
            }
        }
    } else if (direction === 1) {
        // 右に移動
        const layerIndex = sheet.layers.findIndex(l => l.id === current.layerId);
        if (layerIndex < sheet.layers.length - 1) {
            nextLayerId = sheet.layers[layerIndex + 1].id;
        } else {
            nextLayerId = sheet.layers[0].id;
            nextFrame++;
        }
    } else if (direction === -1) {
        // 左に移動
        const layerIndex = sheet.layers.findIndex(l => l.id === current.layerId);
        if (layerIndex > 0) {
            nextLayerId = sheet.layers[layerIndex - 1].id;
        } else {
            nextLayerId = sheet.layers[sheet.layers.length - 1].id;
            nextFrame--;
        }
    }
    
    const nextCell = document.querySelector(
        `td[data-frame="${nextFrame}"][data-layer="${nextLayerId}"]`
    );
    
    if (nextCell) {
        clearSelection();
        selectCell(nextCell, nextFrame, nextLayerId);
        scrollToSelectionIfEnabled(nextCell);
    }
}

/**
 * 複数セルへの一括入力処理
 * - 最初のセルに入力値
 * - 残りのセルに「-」
 * - 選択範囲を下にシフトして再選択
 * 
 * @param {string} key - 入力されたキー
 */
function handleMultiCellInput(key) {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // セルをフレーム順、レイヤー順にソート
    const sortedCells = [...AppState.selectedCells].sort((a, b) => {
        if (a.frame !== b.frame) return a.frame - b.frame;
        return compareLayerIds(a.layerId, b.layerId, getCurrentSheet().layers);
    });
    const firstCell = sortedCells[0];
    sheet.data[firstCell.frame][firstCell.layerId] = key;
    
    // 2つ目以降のセルにも同じ値を入力（「-」表示はrender.jsで制御）
    for (let i = 1; i < sortedCells.length; i++) {
        const cell = sortedCells[i];
        sheet.data[cell.frame][cell.layerId] = key;
    }
    
    // 再レンダリング（即座に実行・選択処理があるため）
    saveHistory('セル編集');
    renderSpreadsheetImmediate();
    clearSelection();
    
    // 同じ範囲を下にシフトして再選択
    const minFrame = Math.min(...sortedCells.map(s => s.frame));
    const maxFrame = Math.max(...sortedCells.map(s => s.frame));
    const frameCount = maxFrame - minFrame + 1;
    const layerIds = [...new Set(sortedCells.map(s => s.layerId))].sort();
    
    const newStartFrame = maxFrame + 1;
    
    // 新しい範囲を選択
    for (let i = 0; i < frameCount; i++) {
        const frame = newStartFrame + i;
        if (frame > maxRows) break;
        
        layerIds.forEach(layerId => {
            const cell = document.querySelector(
                `td[data-frame="${frame}"][data-layer="${layerId}"]`
            );
            if (cell) {
                selectCell(cell, frame, layerId);
            }
        });
    }
    
    // 最初のセルまでスクロール
    if (AppState.selectedCells.length > 0) {
        scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
    }
    
    updateStatusBar(`${sortedCells.length}セルに入力しました`);
}

/**
 * +/-キーによる値の増減処理
 * - 単一選択時：前のセルの値に+1/-1して次へ移動
 * - 複数選択時：各レイヤーの最初のセルに+1/-1、残りに「-」、範囲を下にシフト
 * - 前のセルに有効な数値がない場合は何もしない
 * - 0や負の値は使用不可
 * 
 * @param {string} key - '+' または '-'
 */
function handlePlusMinusKey(key) {
    if (AppState.debugMode) console.log(`handlePlusMinusKey呼出: key=${key}`);
    const sheet = getCurrentSheet();
    
    // デバッグ: 現在選択中のセルのデータを表示
    if (AppState.selectedCells.length > 0) {
        const firstCell = AppState.selectedCells[0];
        const currentValue = (sheet.data[firstCell.frame] && sheet.data[firstCell.frame][firstCell.layerId]) || '';
        if (AppState.debugMode) console.log(`選択セル: Frame=${firstCell.frame}, Layer=${firstCell.layerId}, 値="${currentValue}"`);
    }
    
    // 前のセルの有効な数値を取得する関数（0は無視）
    const getPreviousValue = (frame, layerId) => {
        if (AppState.debugMode) console.log(`getPreviousValue: frame=${frame}, layer=${layerId}`);
        for (let f = frame - 1; f >= 1; f--) {
            const cellValue = (sheet.data[f] && sheet.data[f][layerId]) || '';
            if (AppState.debugMode) console.log(`  チェック: frame=${f}, 値="${cellValue}"`);
            if (cellValue === CONSTANTS.NULL_CELL) break; // ×はシリーズ終端として扱う
            if (cellValue && cellValue !== '-' && cellValue !== '' && cellValue !== '0') {
                const numValue = parseInt(cellValue);
                if (!isNaN(numValue) && numValue !== 0) {
                    if (AppState.debugMode) console.log(`  → 見つかった値: ${numValue}`);
                    return { value: numValue, frame: f };
                }
            }
        }
        if (AppState.debugMode) console.log(`  → 見つからず`);
        return null;
    };
    
    if (AppState.selectedCells.length === 1) {
        // 単一選択時
        const selected = AppState.selectedCells[0];
        const frame = selected.frame;
        const layerId = selected.layerId;
        
        // 前のセルの値を取得（遡り検索）
        const prevInfo = getPreviousValue(frame, layerId);
        
        // 前のセルに有効な数値がない場合は何も入力せずに次のセルに移動
        if (prevInfo === null) {
            const maxRows = getMaxVisibleRows(sheet);
            if (frame < maxRows) {
                moveToNextCell();
                updateStatusBar('前のセルに数値がないため次のセルに移動しました');
            } else {
                updateStatusBar('前のセルに数値がありません（最終行）');
            }
            return;
        }
        
        // +1 または -1
        const prevValue = prevInfo.value;
        const prevFrame = prevInfo.frame;
        let segmentStartFrame = prevFrame;
        const segmentValue = String(prevValue);

        // 直線区間の途中での +/- 入力に対応するため、同一区間の開始位置を上方向に探索
        for (let f = prevFrame - 1; f >= 1; f--) {
            const v = (sheet.data[f] && sheet.data[f][layerId]) || '';
            const isVisualLine = typeof getSpecialDisplayInfo === 'function' &&
                getSpecialDisplayInfo(layerId, f).isVerticalLine;
            if (v === segmentValue || v === '-' || (v === '' && isVisualLine)) {
                segmentStartFrame = f;
            } else {
                break;
            }
        }
        const newValue = key === '+' ? prevValue + 1 : prevValue - 1;
        const oldValue = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
        
        // 変更前に履歴保存 → 後に移動
        
        // 0または負の値の場合は空セルにする
        if (newValue <= 0) {
            if (!sheet.data[frame]) sheet.data[frame] = {};
            sheet.data[frame][layerId] = '';
        } else {
            if (!sheet.data[frame]) sheet.data[frame] = {};
            sheet.data[frame][layerId] = String(newValue);

            // 直線区間の途中で +/- した場合、直前の数字との間のセグメント内セルを同値で埋める
            // （セグメント開始〜現在フレームの間に空セルのギャップがある場合はスキップ）
            if (frame - segmentStartFrame > 1) {
                let hasGap = false;
                for (let f = segmentStartFrame + 1; f < frame; f++) {
                    const v = (sheet.data[f] && sheet.data[f][layerId]) || '';
                    const isVisualLine = typeof getSpecialDisplayInfo === 'function' &&
                        getSpecialDisplayInfo(layerId, f).isVerticalLine;
                    if ((v === '' || v === CONSTANTS.NULL_CELL) && !isVisualLine) { hasGap = true; break; }
                }
                if (!hasGap) {
                    for (let f = segmentStartFrame + 1; f < frame; f++) {
                        if (!sheet.data[f]) sheet.data[f] = {};
                        sheet.data[f][layerId] = String(newValue);
                    }
                }
            }

            // 直線区間上で +/- 入力した場合、後続の同一区間も同値に更新する
            const oldSegmentValue = (oldValue === '' || oldValue === '-') ? String(prevValue) : String(oldValue);
            if (oldSegmentValue !== String(newValue)) {
                const maxRows = getMaxVisibleRows(sheet);
                for (let f = frame + 1; f <= maxRows; f++) {
                    const nextValue = (sheet.data[f] && sheet.data[f][layerId]) || '';
                    if (nextValue === '-' || nextValue === oldSegmentValue) {
                        if (!sheet.data[f]) sheet.data[f] = {};
                        sheet.data[f][layerId] = String(newValue);
                    } else {
                        break;
                    }
                }
            }
        }
        
        // キャッシュを再計算してから再レンダリング
        saveHistory('±キー操作');
        calculateSpecialDisplayCache(sheet);
        renderSpreadsheetImmediate();
        clearSelection();
        
        // 現在のセルを再選択
        const currentCell = document.querySelector(
            `td[data-frame="${frame}"][data-layer="${layerId}"]`
        );
        if (currentCell) {
            selectCell(currentCell, frame, layerId);
            
            // 最後の行でなければ下に移動、最後の行なら現在位置に留まる
            const maxRows = getMaxVisibleRows(sheet);
            if (frame < maxRows) {
                moveToNextCell();
            }
        }
        
        const action = newValue <= 0 ? '空セル' : (key === '+' ? '+1' : '-1');
        const moveMsg = frame < getMaxVisibleRows(sheet) ? '次へ移動しました' : '（最終行）';
        updateStatusBar(`${action} にして${moveMsg}`);
    }else {
        // 複数選択時
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            // layerIdは文字列なので、シート内のインデックスで比較
            const aIndex = sheet.layers.findIndex(l => l.id === a.layerId);
            const bIndex = sheet.layers.findIndex(l => l.id === b.layerId);
            return aIndex - bIndex;
        });
        
        // レイヤーごとにグループ化
        const layerGroups = {};
        sortedCells.forEach(s => {
            if (!layerGroups[s.layerId]) {
                layerGroups[s.layerId] = [];
            }
            layerGroups[s.layerId].push(s.frame);
        });
        
        let allSuccess = true;
        
        // 変更前に履歴保存 → 後に移動
        
        // 各レイヤーの最初のフレームに +1/-1 を適用
        Object.keys(layerGroups).forEach(lid => {
            const layerId = lid; // "L14"などの文字列IDをそのまま使用
            const frames = layerGroups[lid].sort((a, b) => a - b);
            const firstFrame = frames[0];
            
            // 前のセルの値を取得（遡り検索）
            const prevInfo = getPreviousValue(firstFrame, layerId);
            
            if (prevInfo !== null) {
                const prevValue = prevInfo.value;
                const newValue = key === '+' ? prevValue + 1 : prevValue - 1;
                
                // 0や負の値はスキップ
                if (newValue > 0) {
                    // 全てのフレームに新しい値を保存（「-」表示はrender.jsで制御）
                    for (let i = 0; i < frames.length; i++) {
                        if (!sheet.data[frames[i]]) sheet.data[frames[i]] = {};
                        sheet.data[frames[i]][layerId] = String(newValue);
                    }
                } else {
                    allSuccess = false;
                }
            } else {
                allSuccess = false;
            }
        });
        
        // キャッシュを再計算してから再レンダリング
        saveHistory('±キー操作');
        calculateSpecialDisplayCache(sheet);
        renderSpreadsheetImmediate();
        clearSelection();
        
        // 選択範囲を下に移動
        const minFrame = Math.min(...sortedCells.map(s => s.frame));
        const maxFrame = Math.max(...sortedCells.map(s => s.frame));
        const shiftAmount = maxFrame - minFrame + 1;
        const maxRows = getMaxVisibleRows(sheet);
        
        // 各セルを元の移動量で移動し、範囲内に収まるものだけ選択
        sortedCells.forEach(s => {
            const newFrame = s.frame + shiftAmount;
            
            // 範囲外のセルはスキップ
            if (newFrame > maxRows) {
                return;
            }
            
            const c = document.querySelector(
                `td[data-frame="${newFrame}"][data-layer="${s.layerId}"]`
            );
            if (c) {
                selectCell(c, newFrame, s.layerId);
            }
        });
        
        // 選択できなかった場合は元の位置を保持
        if (AppState.selectedCells.length === 0) {
            sortedCells.forEach(s => {
                const c = document.querySelector(
                    `td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`
                );
                if (c) {
                    selectCell(c, s.frame, s.layerId);
                }
            });
        }
        
        if (AppState.selectedCells.length > 0) {
            scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
        }
        
        const moveMsg = AppState.selectedCells.length < sortedCells.length ? '（一部移動、最終行到達）' : '次へ移動しました';
        updateStatusBar(allSuccess ? `${key === '+' ? '+1' : '-1'} して${moveMsg}` : '一部のセルで処理できませんでした');
    }
}
