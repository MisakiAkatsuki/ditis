/** frameOps.js - フレーム（行）操作モジュール */

/**
 * 選択位置にフレームを挿入する
 * - 選択中の最小フレーム位置に挿入
 * - 挿入された分、既存データを後ろにシフト
 * - 挿入フレームの情報を記録（追加1、追加2...）
 * - 縦線が途切れた場合は"-"を数字に変換
 * - 総尺を挿入分増やす
 */
async function insertFramesAtSelection() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('行を挿入する位置を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const frames = AppState.selectedCells.map(s => s.frame);
    const minFrame = Math.min(...frames);
    
    const sheet = getCurrentSheet();
    
    if (!validateFrame(minFrame, sheet.frames)) {
        return;
    }
    
    const count = await showInsertFramesDialog(minFrame);
    if (count === null) return;
    
    const newData = {};
    if (!sheet.insertedFrameMap) sheet.insertedFrameMap = {};
    if (!sheet.insertedFrames) sheet.insertedFrames = [];
    
    // 既存の挿入フレーム番号を先にシフト
    const newInsertedFrameMap = {};
    Object.keys(sheet.insertedFrameMap).forEach(key => {
        const frameNum = parseInt(key);
        if (frameNum >= minFrame) {
            newInsertedFrameMap[frameNum + count] = sheet.insertedFrameMap[key];
        } else {
            newInsertedFrameMap[frameNum] = sheet.insertedFrameMap[key];
        }
    });
    sheet.insertedFrameMap = newInsertedFrameMap;
    
    sheet.insertedFrames = sheet.insertedFrames.map(f => f >= minFrame ? f + count : f);
    
    // 無効化されたフレームもシフト
    if (!sheet.disabledFrames) sheet.disabledFrames = [];
    sheet.disabledFrames = sheet.disabledFrames.map(f => f >= minFrame ? f + count : f);
    
    // 新しく挿入するフレームを記録（連番で追加1、追加2...）
    for (let i = 0; i < count; i++) {
        const newFrameNum = minFrame + i;
        sheet.insertedFrames.push(newFrameNum);
        // 追加番号を保持（1から始まる連番）
        sheet.insertedFrameMap[newFrameNum] = i + 1;
    }
    
    // 前半をコピー
    for (let frame = 1; frame < minFrame; frame++) {
        newData[frame] = sheet.data[frame] || {};
    }
    
    // 空フレームを挿入
    for (let i = 0; i < count; i++) {
        newData[minFrame + i] = {};
        sheet.layers.forEach(layer => {
            newData[minFrame + i][layer.id] = '';
        });
    }
    
    // 後半をシフト（挿入前のsheet.framesを保存しておく）
    const oldFrames = sheet.frames;
    for (let frame = minFrame; frame <= oldFrames; frame++) {
        newData[frame + count] = sheet.data[frame];
    }
    
    // 挿入箇所で縦線が途切れた場合、その後の"-"を数字に変換
    sheet.layers.forEach(layer => {
        // 挿入箇所の直前に数字があるかチェック
        const beforeValue = minFrame > 1 ? (sheet.data[minFrame - 1] && sheet.data[minFrame - 1][layer.id]) : '';
        if (beforeValue && beforeValue !== '' && beforeValue !== '-') {
            // 挿入後の位置から"-"を探して数字に変換
            for (let frame = minFrame + count; frame <= oldFrames + count; frame++) {
                const value = (newData[frame] && newData[frame][layer.id]) || '';
                if (value === '-') {
                    // ひとつ前の数字を探す
                    let prevNumber = beforeValue;
                    for (let f = frame - 1; f >= 1; f--) {
                        const checkValue = (newData[f] && newData[f][layer.id]) || '';
                        if (checkValue !== '' && checkValue !== '-') {
                            prevNumber = checkValue;
                            break;
                        }
                    }
                    newData[frame][layer.id] = prevNumber;
                } else if (value !== '') {
                    // 数字が出たら終了
                    break;
                }
            }
        }
    });
    
    // 総尺を挿入分増やす
    sheet.frames = oldFrames + count;
    sheet.visibleRows = sheet.frames;
    sheet.data = newData;
    
    debugLog('処理', '挿入後', {frames: sheet.frames, visibleRows: sheet.visibleRows});
    
    // 挿入後はキャッシュをクリアして全体レンダリング（構造が大きく変わるため）
    saveHistory('行挿入');
    AppState.specialDisplayCache.clear();
    renderSpreadsheet(true);
    selectA1(); // A1を選択
    
    saveToLocalStorage(); // ローカルストレージに保存
    
    updateStatusBar(`フレーム ${minFrame} に ${count} フレーム挿入しました（総尺: ${sheet.frames}フレーム）`);
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 最後まで"-"で埋める
 * - 選択セルから最後まで"-"を入力
 */
function fillDashToEnd() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // 選択中のセルをソート
    const sortedCells = [...AppState.selectedCells].sort((a, b) => {
        if (a.frame !== b.frame) return a.frame - b.frame;
        return compareLayerIds(a.layerId, b.layerId, sheet.layers);
    });
    
    // 選択範囲のサイズを記憶
    const selectionSize = sortedCells.length;
    const minFrame = Math.min(...sortedCells.map(s => s.frame));
    const maxFrame = Math.max(...sortedCells.map(s => s.frame));
    const shiftAmount = maxFrame - minFrame + 1;
    
    let needFill = false;
    
    // 事前にfillが必要か判定
    sortedCells.forEach(s => {
        const frame = s.frame;
        const layerId = s.layerId;
        if (!validateFrame(frame, maxRows)) return;
        if (!validateLayerId(layerId, sheet.layers)) return;
        const currentValue = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
        if (currentValue !== '' && currentValue !== CONSTANTS.NULL_CELL) {
            needFill = true;
            return;
        }
        const prevFrame = frame - 1;
        const prevValue = prevFrame >= 1 ? ((sheet.data[prevFrame] && sheet.data[prevFrame][layerId]) || '') : '';
        if (prevValue !== '' && /^\d+$/.test(String(prevValue))) {
            needFill = true;
        }
    });
    
    // 変更前に履歴保存 → 変更後に移動
    
    // 各選択セルについて処理
    sortedCells.forEach(s => {
        const frame = s.frame;
        const layerId = s.layerId;
        
        // バリデーション：frame と layerId が有効か確認
        if (!validateFrame(frame, maxRows)) return;
        if (!validateLayerId(layerId, sheet.layers)) return;
        
        // 現在のセルの値をチェック
        const currentValue = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
        
        if (currentValue !== '' && currentValue !== CONSTANTS.NULL_CELL) {
            // 数字がある場合：次のフレームから最後まで同じ値で埋める（「-」表示はrender.jsで制御）
            needFill = true;
            for (let f = frame + 1; f <= maxRows; f++) {
                if (!sheet.data[f]) {
                    sheet.data[f] = {};
                }
                sheet.data[f][layerId] = currentValue;
            }
            return;
        }
        
        // 現在のセルが空の場合、ひとつ前のセルをチェック
        const prevFrame = frame - 1;
        const prevValue = prevFrame >= 1 ? ((sheet.data[prevFrame] && sheet.data[prevFrame][layerId]) || '') : '';
        
        // ひとつ前に何かある場合（数字かどうかチェック - 文字列または数値）
        const prevValueStr = String(prevValue);
        if (prevValue !== '' && /^\d+$/.test(prevValueStr)) {
            // 現在のセルから最後まで同じ値を入力（「-」表示はrender.jsで制御）
            needFill = true;
            for (let f = frame; f <= maxRows; f++) {
                if (!sheet.data[f]) {
                    sheet.data[f] = {};
                }
                sheet.data[f][layerId] = prevValue;
            }
        }
        // ひとつ前に何もない場合：何もしない（移動のみ）
    });
    
    if (needFill) {
        // キャッシュを更新して仮想レンダリング
        saveHistory('末尾まで埋める');
        calculateSpecialDisplayCache(sheet);
        renderSpreadsheet();
        
        // 選択を復元
        clearSelection();
        sortedCells.forEach(s => {
            const cell = document.querySelector(
                `td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`
            );
            if (cell) {
                selectCell(cell, s.frame, s.layerId);
            }
        });
        
        updateStatusBar('最後まで"-"を入力しました');
    }
    
    // 移動処理（選択範囲を維持したまま移動）
    const currentSelection = [...AppState.selectedCells].sort((a, b) => {
        if (a.frame !== b.frame) return a.frame - b.frame;
        return compareLayerIds(a.layerId, b.layerId, getCurrentSheet().layers);
    });
    
    clearSelection();
    
    currentSelection.forEach(s => {
        const newFrame = s.frame + shiftAmount;
        
        if (newFrame <= maxRows) {
            const cell = document.querySelector(
                `td[data-frame="${newFrame}"][data-layer="${s.layerId}"]`
            );
            if (cell) {
                selectCell(cell, newFrame, s.layerId);
            }
        }
    });
    
    if (AppState.selectedCells.length > 0) {
        scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
    }
    
    // 移動後、縦線を更新（needFillの場合のみ再描画）
    // renderSpreadsheetは既に上で実行済みなので不要
}

/**
 * 選択された行の無効化/有効化を切り替える
 * - 無効化された行は背景がグレーになり、実数表記時にカウントされない
 * - すべて無効化されている → 有効化
 * - 一部またはすべて有効 → 無効化
 */
function toggleDisableFrames() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('無効化する行を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    if (!sheet.disabledFrames) sheet.disabledFrames = [];
    
    // 選択されているフレーム番号を取得
    const frames = [...new Set(AppState.selectedCells.map(s => s.frame))];
    
    // バリデーション：各フレーム番号が有効か確認
    for (const frame of frames) {
        if (!validateFrame(frame, maxRows)) {
            return;
        }
    }
    
    // すべて無効化されているかチェック
    const allDisabled = frames.every(f => sheet.disabledFrames.includes(f));
    
    if (allDisabled) {
        // すべて無効化されている → 有効化
        frames.forEach(f => {
            const index = sheet.disabledFrames.indexOf(f);
            if (index > -1) {
                sheet.disabledFrames.splice(index, 1);
            }
        });
        updateStatusBar(`${frames.length}行を有効化しました`);
    } else {
        // 一部またはすべて有効 → 無効化
        frames.forEach(f => {
            if (!sheet.disabledFrames.includes(f)) {
                sheet.disabledFrames.push(f);
            }
        });
        updateStatusBar(`${frames.length}行を無効化しました`);
    }
    
    saveHistory('行の有効化/無効化');
    AppState.validFrameCountCache = null;
    renderSpreadsheet(true);
    saveToLocalStorage();
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 選択された行を削除する
 * - 選択範囲の最小～最大フレームを削除
 * - 後ろのフレームを前に詰める
 * - 挿入フレーム記録も更新
 * - 総尺を削除分減らす
 */
async function deleteSelectedFrames() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('削除する行を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const frames = [...new Set(AppState.selectedCells.map(s => s.frame))].sort((a, b) => a - b);
    const minFrame = frames[0];
    const maxFrame = frames[frames.length - 1];
    const deleteCount = maxFrame - minFrame + 1;
    
    const sheet = getCurrentSheet();
    
    // バリデーション：minFrame と maxFrame が有効なフレーム番号か確認
    if (!validateFrame(minFrame, sheet.frames)) {
        return;
    }
    if (!validateFrame(maxFrame, sheet.frames)) {
        return;
    }
    
    // 確認ダイアログを表示
    const confirmed = await showConfirmDialog(
        `フレーム ${minFrame}-${maxFrame}（${deleteCount}行）を削除しますか？`
    );
    
    if (!confirmed) return;
    
    const newData = {};
    for (let frame = 1; frame < minFrame; frame++) {
        newData[frame] = sheet.data[frame] || {};
    }
    
    // 後半を前に詰める
    let newFrame = minFrame;
    for (let frame = maxFrame + 1; frame <= sheet.frames; frame++) {
        newData[newFrame] = sheet.data[frame];
        newFrame++;
    }
    
    // 挿入フレーム記録を更新
    if (sheet.insertedFrames) {
        const newInsertedFrames = [];
        const newInsertedFrameMap = {};
        
        sheet.insertedFrames.forEach(f => {
            if (f < minFrame) {
                // 削除範囲より前：そのまま
                newInsertedFrames.push(f);
                if (sheet.insertedFrameMap && sheet.insertedFrameMap[f]) {
                    newInsertedFrameMap[f] = sheet.insertedFrameMap[f];
                }
            } else if (f > maxFrame) {
                // 削除範囲より後：前に詰める
                const newF = f - deleteCount;
                newInsertedFrames.push(newF);
                if (sheet.insertedFrameMap && sheet.insertedFrameMap[f]) {
                    newInsertedFrameMap[newF] = sheet.insertedFrameMap[f];
                }
            }
            // 削除範囲内：除外
        });
        
        sheet.insertedFrames = newInsertedFrames;
        sheet.insertedFrameMap = newInsertedFrameMap;
    }
    
    // 無効化フレーム記録を更新
    if (sheet.disabledFrames) {
        const newDisabledFrames = [];
        
        sheet.disabledFrames.forEach(f => {
            if (f < minFrame) {
                // 削除範囲より前：そのまま
                newDisabledFrames.push(f);
            } else if (f > maxFrame) {
                // 削除範囲より後：前に詰める
                newDisabledFrames.push(f - deleteCount);
            }
            // 削除範囲内：除外
        });
        
        sheet.disabledFrames = newDisabledFrames;
    }
    
    sheet.frames -= deleteCount;
    sheet.visibleRows = sheet.frames;
    sheet.data = newData;
    
    saveHistory('行削除');
    AppState.specialDisplayCache.clear();
    AppState.validFrameCountCache = null;
    renderSpreadsheet(true);
    saveToLocalStorage();
    clearSelection();
    
    updateStatusBar(`${deleteCount} フレーム削除しました（総尺: ${sheet.frames}フレーム）`);
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 先頭にフレームを挿入する
 * - 指定数のフレームを先頭に挿入
 */
async function insertFramesStart() {
    const count = await showInsertFramesDialog(1, true);
    if (count === null) return;
    
    const sheet = getCurrentSheet();
    
    if (!validateFrame(1, sheet.frames + count)) {
        return;
    }
    
    // 挿入前の状態を保存（操作後に移動）
    
    const newData = {};
    
    // 既存の挿入フレーム情報を退避（変更前にコピー）
    if (!sheet.insertedFrames) sheet.insertedFrames = [];
    if (!sheet.insertedFrameMap) sheet.insertedFrameMap = {};
    const oldInsertedFrames = [...sheet.insertedFrames];
    const oldInsertedFrameMap = {...sheet.insertedFrameMap};
    
    // 空フレームを追加
    for (let i = 1; i <= count; i++) {
        newData[i] = {};
        sheet.layers.forEach(layer => {
            newData[i][layer.id] = '';
        });
    }
    
    // 既存データをシフト
    for (let frame = 1; frame <= sheet.frames; frame++) {
        newData[frame + count] = sheet.data[frame];
    }
    
    // 挿入フレーム記録を再構築
    sheet.insertedFrames = [];
    sheet.insertedFrameMap = {};
    
    // 新しく挿入したフレームを記録
    for (let i = 1; i <= count; i++) {
        sheet.insertedFrames.push(i);
        sheet.insertedFrameMap[i] = i;
    }
    
    // 既存の挿入フレームをシフトして追加
    oldInsertedFrames.forEach(f => {
        sheet.insertedFrames.push(f + count);
        if (oldInsertedFrameMap[f] !== undefined) {
            sheet.insertedFrameMap[f + count] = oldInsertedFrameMap[f];
        }
    });
    
    // 無効化されたフレームもシフト
    if (!sheet.disabledFrames) sheet.disabledFrames = [];
    sheet.disabledFrames = sheet.disabledFrames.map(f => f + count);
    
    sheet.frames += count;
    sheet.visibleRows = sheet.frames;
    sheet.data = newData;
    
    debugLog('処理', '先頭挿入後', {frames: sheet.frames, count});
    
    // 先頭挿入後はキャッシュをクリアして全体レンダリング
    saveHistory('先頭に行挿入');
    AppState.specialDisplayCache.clear();
    renderSpreadsheet(true);
    updateStatusBar(`先頭に ${count} フレーム挿入しました`);
    selectA1(); // A1を選択
    
    saveToLocalStorage(); // ローカルストレージに保存
}

/**
 * 指定位置にフレームを挿入する
 * - 指定位置に指定数のフレームを挿入
 */
async function insertFramesMiddle() {
    const result = await showInsertFramesAtPositionDialog();
    if (result === null) return;
    
    const { position, count } = result;
    const sheet = getCurrentSheet();
    
    if (!validateFrame(position, sheet.frames)) {
        return;
    }
    
    const newData = {};
    
    // 既存の挿入フレーム番号を先にシフト
    if (!sheet.insertedFrames) sheet.insertedFrames = [];
    if (!sheet.insertedFrameMap) sheet.insertedFrameMap = {};
    
    // insertedFrameMapもシフト
    const newInsertedFrameMap = {};
    Object.keys(sheet.insertedFrameMap).forEach(key => {
        const frameNum = parseInt(key);
        if (frameNum >= position) {
            newInsertedFrameMap[frameNum + count] = sheet.insertedFrameMap[key];
        } else {
            newInsertedFrameMap[frameNum] = sheet.insertedFrameMap[key];
        }
    });
    sheet.insertedFrameMap = newInsertedFrameMap;
    
    sheet.insertedFrames = sheet.insertedFrames.map(f => f >= position ? f + count : f);
    
    // 無効化されたフレームもシフト
    if (!sheet.disabledFrames) sheet.disabledFrames = [];
    sheet.disabledFrames = sheet.disabledFrames.map(f => f >= position ? f + count : f);
    
    // 新しく挿入するフレームを記録
    for (let i = 0; i < count; i++) {
        sheet.insertedFrames.push(position + i);
        sheet.insertedFrameMap[position + i] = i + 1;
    }
    
    // 前半をコピー
    for (let frame = 1; frame < position; frame++) {
        newData[frame] = sheet.data[frame] || {};
    }
    
    // 空フレームを挿入
    for (let i = 0; i < count; i++) {
        newData[position + i] = {};
        sheet.layers.forEach(layer => {
            newData[position + i][layer.id] = '';
        });
    }
    
    // 後半をシフト
    for (let frame = position; frame <= sheet.frames; frame++) {
        newData[frame + count] = sheet.data[frame];
    }
    
    sheet.frames += count;
    sheet.visibleRows = sheet.frames;
    sheet.data = newData;
    
    debugLog('処理', '途中挿入後', {position, count, frames: sheet.frames});
    
    // 強制的に全レンダリング（波線の再計算を確実に行う）
    // 末尾追加後はキャッシュをクリアして全体レンダリング
    saveHistory('行挿入（途中）');
    AppState.specialDisplayCache.clear();
    renderSpreadsheet(true);
    updateStatusBar(`フレーム ${position} に ${count} フレーム挿入しました`);
    selectA1(); // A1を選択
    
    saveToLocalStorage(); // ローカルストレージに保存
}

/**
 * 末尾にフレームを追加する
 * - 指定した数のフレームを末尾に追加
 * - 総尺を追加分増やす
 */
async function addFramesEnd() {
    const count = await showInsertFramesDialog(null, false, true);
    if (count === null) return;
    
    const sheet = getCurrentSheet();
    
    for (let i = 1; i <= count; i++) {
        const frame = sheet.frames + i;
        sheet.data[frame] = {};
        sheet.layers.forEach(layer => {
            sheet.data[frame][layer.id] = '';
        });
    }
    
    sheet.frames += count;
    sheet.visibleRows = sheet.frames;
    
    saveHistory('末尾に行追加');
    AppState.specialDisplayCache.clear();
    AppState.validFrameCountCache = null;
    renderSpreadsheet(true);
    updateStatusBar(`末尾に ${count} フレーム追加しました`);
    selectA1();
    saveToLocalStorage();
}


/**
 * 選択されたフレーム以降のデータをシフト
 * - 選択されたフレームから最後まで、全てのデータを指定フレーム分移動
 * - 正の数: 下にシフト（データが後ろに移動）
 * - 負の数: 上にシフト（データが前に移動）
 */
async function shiftDataDownFromFrame() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('シフトを開始する行を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    const selectedFrames = [...new Set(AppState.selectedCells.map(s => s.frame))];
    
    if (selectedFrames.length !== 1) {
        showErrorToast('1つの行を選択してください。複数行の同時シフトはできません。', ErrorLevel.WARNING);
        return;
    }
    
    const startFrame = selectedFrames[0];
    
    if (!validateFrame(startFrame, maxRows)) {
        return;
    }
    
    const shiftAmount = await showShiftFramesDialog(startFrame, maxRows);
    if (shiftAmount === null) {
        return;
    }
    
    if (shiftAmount > 0) {
        // 下にシフト（正の数）
        // 最後のフレームから逆順にシフト（上書きを防ぐ）
        for (let frame = maxRows; frame >= startFrame + shiftAmount; frame--) {
            const sourceFrame = frame - shiftAmount;
            
            // ソースフレームのデータを現在のフレームにコピー
            if (sheet.data[sourceFrame]) {
                sheet.data[frame] = { ...sheet.data[sourceFrame] };
            } else {
                sheet.data[frame] = {};
            }
        }
        
        // シフトで空いたフレームを空にする
        for (let frame = startFrame; frame < startFrame + shiftAmount; frame++) {
            sheet.data[frame] = {};
            sheet.layers.forEach(layer => {
                sheet.data[frame][layer.id] = '';
            });
        }
    } else {
        // 上にシフト（負の数）
        const absShift = Math.abs(shiftAmount);
        
        // 開始フレームから順にシフト（上書きを防ぐ）
        for (let frame = startFrame; frame <= maxRows; frame++) {
            const sourceFrame = frame + absShift;
            
            if (sourceFrame <= maxRows && sheet.data[sourceFrame]) {
                sheet.data[frame] = { ...sheet.data[sourceFrame] };
            } else {
                // ソースがない場合は空にする
                sheet.data[frame] = {};
                sheet.layers.forEach(layer => {
                    sheet.data[frame][layer.id] = '';
                });
            }
        }
    }
    
    // 挿入フレームと無効フレームの情報も調整
    if (sheet.insertedFrames && sheet.insertedFrames.length > 0) {
        sheet.insertedFrames = sheet.insertedFrames.map(f => {
            if (f >= startFrame) {
                return f + shiftAmount;
            }
            return f;
        }).filter(f => f >= 1 && f <= maxRows);
    }

    if (sheet.insertedFrameMap) {
        const newMap = {};
        for (const [key, val] of Object.entries(sheet.insertedFrameMap)) {
            const frameNum = parseInt(key);
            const newFrame = frameNum >= startFrame ? frameNum + shiftAmount : frameNum;
            if (newFrame >= 1 && newFrame <= maxRows) {
                newMap[newFrame] = val;
            }
        }
        sheet.insertedFrameMap = newMap;
    }

    if (sheet.disabledFrames && sheet.disabledFrames.length > 0) {
        sheet.disabledFrames = sheet.disabledFrames.map(f => {
            if (f >= startFrame) {
                return f + shiftAmount;
            }
            return f;
        }).filter(f => f >= 1 && f <= maxRows);
    }
    
    // キャッシュを更新して再描画
    saveHistory('データシフト');
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet(true);
    saveToLocalStorage();
    
    const direction = shiftAmount > 0 ? '下' : '上';
    updateStatusBar(`フレーム${startFrame}以降を${Math.abs(shiftAmount)}フレーム${direction}にシフトしました`);
    updateUndoRedoButtons();
}
