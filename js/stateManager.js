/**
 * ===================================================================
 * stateManager.js - 状態管理モジュール
 * ===================================================================
 * 
 * アプリケーションの状態管理と永続化を担当します。
 * 
 * 【主要機能】
 * - クリップボード操作（コピー、カット、ペースト、削除）
 * - LocalStorage操作（保存・読み込み）
 * - UI更新（ステータスバー、タイム表示、ウィンドウタイトル）
 * 
 * 【依存関係】
 * - AppState（グローバル）
 * - getCurrentSheet(), debugLog(), showErrorToast() など（app.js）
 * - renderSpreadsheet(), clearSelection() など（他モジュール）
 * ===================================================================
 */

// ========================================
// クリップボード操作
// ========================================

/**
 * 選択セルをコピーする
 * - 選択中のセルをクリップボードにコピー
 */
function copySelection() {
    if (AppState.selectedCells.length === 0) return;

    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    AppState.clipboard = AppState.selectedCells.map(s => {
        // バリデーション：frame と layerId が有効か確認
        if (!validateFrame(s.frame, maxRows)) return null;
        if (!validateLayerId(s.layerId, sheet.layers)) return null;
        
        const value = (sheet.data[s.frame] && sheet.data[s.frame][s.layerId]) || '';
        // データをそのままコピー（「-」は表示のみなので、データには数値が入っているはず）
        
        return {
            frame: s.frame,
            layerId: s.layerId,
            value: value
        };
    }).filter(item => item !== null);

    updateStatusBar(`${AppState.clipboard.length} セルをコピーしました`);
}

function cutSelection() {
    copySelection();
    deleteSelection();
}

/**
 * クリップボードの内容を選択位置にペースト
 * 相対位置を保ったまま貼り付け
 */
/**
 * クリップボードからペーストする
 * - コピーしたセルを選択位置に貼り付け
 */
function pasteSelection() {
    if (!AppState.clipboard || AppState.selectedCells.length === 0) return;

    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    const anchor = AppState.selectedCells[0];
    
    // バリデーション：anchor が有効か確認
    if (!validateFrame(anchor.frame, maxRows)) return;
    if (!validateLayerId(anchor.layerId, sheet.layers)) return;

    // コピー元の形状を検出（行全体 or 列全体 or 通常）
    const clipboardFrames = [...new Set(AppState.clipboard.map(c => c.frame))];
    const clipboardLayers = [...new Set(AppState.clipboard.map(c => c.layerId))];
    const clipboardLayerCount = clipboardLayers.length;
    const clipboardFrameCount = clipboardFrames.length;
    
    // 行全体コピー：複数列で1つのフレーム
    const isRowCopy = clipboardLayerCount > 1 && clipboardFrameCount === 1;
    // 列全体コピー：1つの列で複数フレーム
    const isColumnCopy = clipboardLayerCount === 1 && clipboardFrameCount > 1;
    
    // ペースト先の形状を検出
    const selectedFrames = [...new Set(AppState.selectedCells.map(s => s.frame))];
    const selectedLayers = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    const selectedLayerCount = selectedLayers.length;
    const selectedFrameCount = selectedFrames.length;
    
    // 行全体ペースト：複数列で1つのフレーム
    const isRowPaste = selectedLayerCount > 1 && selectedFrameCount === 1;
    // 列全体ペースト：1つの列で複数フレーム
    const isColumnPaste = selectedLayerCount === 1 && selectedFrameCount > 1;
    
    // 形状の不一致をチェック
    if (isRowCopy && isColumnPaste) {
        showErrorToast('行の値を列にペーストすることはできません。', ErrorLevel.WARNING);
        return;
    }
    if (isColumnCopy && isRowPaste) {
        showErrorToast('列の値を行にペーストすることはできません。', ErrorLevel.WARNING);
        return;
    }

    // 選択情報を保存
    const selectedCellsBackup = AppState.selectedCells.map(s => ({
        frame: s.frame,
        layerId: s.layerId
    }));

    let pastedCount = 0;
    const clipboardAnchorLayerIdx = sheet.layers.findIndex(l => l.id === AppState.clipboard[0].layerId);
    if (clipboardAnchorLayerIdx === -1) return; // クリップボードのコピー元レイヤーが現在のシートに存在しない
    const anchorLayerIdx = sheet.layers.findIndex(l => l.id === anchor.layerId);
    
    AppState.clipboard.forEach(item => {
        const targetFrame = anchor.frame + (item.frame - AppState.clipboard[0].frame);
        const itemLayerIdx = sheet.layers.findIndex(l => l.id === item.layerId);
        const targetLayerIdx = anchorLayerIdx + (itemLayerIdx - clipboardAnchorLayerIdx);
        
        if (targetLayerIdx < 0 || targetLayerIdx >= sheet.layers.length) return;
        const targetLayerId = sheet.layers[targetLayerIdx].id;
        
        // バリデーション：targetFrame と targetLayerId が有効か確認
        if (!validateFrame(targetFrame, maxRows)) return;
        if (!validateLayerId(targetLayerId, sheet.layers)) return;

        // 空文字列（元が「-」だったセル）はペーストしない
        if (item.value === '' || item.value === undefined) return;

        if (sheet.data[targetFrame] && sheet.data[targetFrame][targetLayerId] !== undefined) {
            sheet.data[targetFrame][targetLayerId] = item.value;
            pastedCount++;
        }
    });

    // キャッシュを更新して仮想レンダリング
    saveHistory('貼り付け');
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet();
    clearSelection();

    // 同じセルを再選択
    selectedCellsBackup.forEach(s => {
        // バリデーション：s.frame と s.layerId が有効か確認
        if (!validateFrame(s.frame, maxRows)) return;
        if (!validateLayerId(s.layerId, sheet.layers)) return;
        
        const cell = document.querySelector(
            `td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`
        );
        if (cell) {
            selectCell(cell, s.frame, s.layerId);
        }
    });

    updateStatusBar(`${pastedCount} セルを貼り付けました`);
}

/**
 * 選択範囲を下に繰り返す（ループ）
 * 選択範囲のパターンをシートの最後まで繰り返しペーストする
 */
function loopSelection() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // 選択範囲の情報を取得
    const selectedFrames = [...new Set(AppState.selectedCells.map(s => s.frame))].sort((a, b) => a - b);
    const selectedLayers = [...new Set(AppState.selectedCells.map(s => s.layerId))].sort((a, b) => compareLayerIds(a, b, sheet.layers));
    
    const minFrame = Math.min(...selectedFrames);
    const maxFrame = Math.max(...selectedFrames);
    const patternHeight = maxFrame - minFrame + 1;
    
    // 選択範囲のデータをコピー
    const pattern = [];
    for (let frame = minFrame; frame <= maxFrame; frame++) {
        for (const layerId of selectedLayers) {
            const cell = AppState.selectedCells.find(s => s.frame === frame && s.layerId === layerId);
            if (cell) {
                const value = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
                pattern.push({
                    frameOffset: frame - minFrame,
                    layerId: layerId,
                    value: value
                });
            }
        }
    }
    
    // パターンを下に繰り返す
    let pastedCount = 0;
    let currentFrame = maxFrame + 1;
    
    while (currentFrame <= maxRows) {
        for (const item of pattern) {
            const targetFrame = currentFrame + item.frameOffset;
            
            if (targetFrame > maxRows) break;
            if (!validateFrame(targetFrame, maxRows)) continue;
            if (!validateLayerId(item.layerId, sheet.layers)) continue;
            
            // 空文字列はスキップ
            if (item.value === '' || item.value === undefined) continue;
            
            if (sheet.data[targetFrame] && sheet.data[targetFrame][item.layerId] !== undefined) {
                sheet.data[targetFrame][item.layerId] = item.value;
                pastedCount++;
            }
        }
        
        currentFrame += patternHeight;
    }
    
    // キャッシュを更新して仮想レンダリング
    saveHistory('ループ貼り付け');
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet();
    
    updateStatusBar(`${pastedCount} セルにパターンをループしました`);
}

/**
 * 選択範囲のセル内容を削除
 * Deleteキー押下時に呼ばれる
 */
/**
 * 選択セルを削除する
 * - 選択中のセルのデータを削除
 */
function deleteSelection() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // 選択情報を保存
    const selectedCellsBackup = AppState.selectedCells.map(s => ({
        frame: s.frame,
        layerId: s.layerId
    }));
    
    // フレーム降順でソート（後ろから処理してダッシュ展開の連鎖問題を防ぐ）
    const sortedBackup = [...selectedCellsBackup].sort((a, b) => b.frame - a.frame);
    
    // データを削除
    sortedBackup.forEach(s => {
        // バリデーション：frame と layerId が有効か確認
        if (!validateFrame(s.frame, maxRows)) return;
        if (!validateLayerId(s.layerId, sheet.layers)) return;
        
        const oldValue = sheet.data[s.frame] ? sheet.data[s.frame][s.layerId] : '';
        if (!sheet.data[s.frame]) sheet.data[s.frame] = {};
        sheet.data[s.frame][s.layerId] = '';

        // 削除した場合、その直後の"-"を実際の値に展開
        if (oldValue !== '') {
            const nextFrame = s.frame + 1;
            
            if (nextFrame <= maxRows && sheet.data[nextFrame] && sheet.data[nextFrame][s.layerId] === '-') {
                // 上方向に数字を探す
                let actualValue = '';
                for (let f = s.frame - 1; f >= 1; f--) {
                    const val = (sheet.data[f] && sheet.data[f][s.layerId]) || '';
                    if (val !== '' && val !== '-') {
                        actualValue = val;
                        break;
                    }
                }
                
                // 次のセルを実際の値に置き換え
                if (actualValue !== '') {
                    sheet.data[nextFrame][s.layerId] = actualValue;
                }
            }
        }
    });
    
    // キャッシュを更新して仮想レンダリング
    saveHistory('セル削除');
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet();
    clearSelection();
    
    // 同じセルを再選択
    selectedCellsBackup.forEach(s => {
        const cell = document.querySelector(
            `td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`
        );
        if (cell) {
            selectCell(cell, s.frame, s.layerId);
        }
    });
    
    updateStatusBar(`${selectedCellsBackup.length} セルを削除しました`);
}

// ========================================
// LocalStorage操作
// ========================================

/**
 * 現在の状態をLocalStorageに自動保存
 * ページリロード時に復元可能
 */
function saveToLocalStorage() {
    const data = {
        sheets: AppState.sheets,
        currentSheetIndex: AppState.currentSheetIndex,
        fps: AppState.fps,
        theme: AppState.theme,
        fontSize: AppState.fontSize,
        frameFilter: AppState.frameFilter,
        headerDisplayMode: AppState.headerDisplayMode,
        showIntermediateHeaders: AppState.showIntermediateHeaders,
        autoScrollToSelection: AppState.autoScrollToSelection,
        showNewSheetDialog: AppState.showNewSheetDialog,
        reopenLastFile: AppState.reopenLastFile,
        alwaysOnTop: AppState.alwaysOnTop,
        aeKeyframeVersion: AppState.aeKeyframeVersion,
        recentFiles: AppState.recentFiles || []
    };
    
    try {
        localStorage.setItem('timesheet-data', JSON.stringify(data));
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('LocalStorage容量超過:', error);
            updateStatusBar('保存容量が不足しています。ファイルとして保存することをお勧めします。');
        } else {
            console.error('LocalStorage保存エラー:', error);
            updateStatusBar('データの自動保存に失敗しました。');
        }
    }
}

/**
 * LocalStorageから前回の状態を復元
 * データがない場合はデフォルトシートを作成
 */
function loadFromLocalStorage() {
    const saved = localStorage.getItem('timesheet-data');
    
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (!Array.isArray(data.sheets)) {
                handleLocalStorageError(new Error('sheets is not an array'), 'load');
                AppState.sheets = [];
                return;
            }
            AppState.sheets = data.sheets;
            AppState.currentSheetIndex = data.currentSheetIndex;
            // fps はシート単位で管理（後方互換: 旧データの root fps を各シートに配布）
            AppState.theme = data.theme || 'green';
            AppState.fontSize = data.fontSize || 12;
            AppState.frameFilter = data.frameFilter || 'all';
            AppState.headerDisplayMode = data.headerDisplayMode || 'detail';
            AppState.showIntermediateHeaders = data.showIntermediateHeaders || false;
            AppState.autoScrollToSelection = data.autoScrollToSelection !== false;
            AppState.showNewSheetDialog = data.showNewSheetDialog || false;
            AppState.reopenLastFile = data.reopenLastFile || false;
            AppState.alwaysOnTop = data.alwaysOnTop || false;
            AppState.aeKeyframeVersion = data.aeKeyframeVersion || '9.0';
            AppState.recentFiles = data.recentFiles || [];
            
            // 既存シートの列数と行数を復元
            AppState.sheets.forEach(sheet => {
                if (!sheet.frames) sheet.frames = 144;
                if (typeof sheet.fps !== 'number') sheet.fps = 24;
                
                // insertedFramesが存在しない場合は初期化
                if (!sheet.insertedFrames) {
                    sheet.insertedFrames = [];
                }
                
                // データをsheet.framesまで確保
                const maxFrames = sheet.frames || 144;
                for (let frame = 1; frame <= maxFrames; frame++) {
                    if (!sheet.data[frame]) {
                        sheet.data[frame] = {};
                    }
                    sheet.layers.forEach(layer => {
                        if (sheet.data[frame][layer.id] === undefined) {
                            sheet.data[frame][layer.id] = '';
                        }
                    });
                }
            });
        } catch (error) {
            handleLocalStorageError(error, 'load');
            AppState.sheets = []; // 破損データからの回復
        }
    }
}

// ========================================
// UI更新
// ========================================

/**
 * ステータスバーを更新する
 * @param {string} message - 表示するメッセージ
 */
function updateStatusBar(message) {
    const statusText = document.getElementById('status-text');
    if (!statusText) {
        handleElementNotFound('status-text');
        return;
    }
    
    const cellInfo = document.getElementById('cell-info');
    if (!cellInfo) {
        handleElementNotFound('cell-info');
        return;
    }
    
    const durationInfo = document.getElementById('duration-info');
    if (!durationInfo) {
        handleElementNotFound('duration-info');
        return;
    }
    
    if (message) {
        statusText.textContent = message;
        setTimeout(() => {
            statusText.textContent = t('status.ready');
        }, 3000);
    } else {
        // messageがない場合も現在の言語で「準備完了」を表示
        statusText.textContent = t('status.ready');
    }
    
    const sheet = getCurrentSheet();
    
    // 現在の尺を表示（無効化された行を除く）
    const totalFrames = sheet.frames || 144;
    const disabledCount = (sheet.disabledFrames && sheet.disabledFrames.length) || 0;
    const effectiveFrames = totalFrames - disabledCount;
    const seconds = Math.floor(effectiveFrames / AppState.fps);
    const remainingFrames = effectiveFrames % AppState.fps;
    durationInfo.textContent = t('status.time', seconds, remainingFrames, effectiveFrames);
    
    if (AppState.selectedCells.length > 0) {
        const first = AppState.selectedCells[0];
        const layer = sheet.layers.find(l => l.id === first.layerId);
        if (layer) {
            cellInfo.textContent = t('status.cellSelected', `${layer.name}${first.frame}`, AppState.selectedCells.length);
        } else {
            cellInfo.textContent = t('status.cellsSelected', AppState.selectedCells.length);
        }
    } else {
        cellInfo.textContent = t('status.sheetInfo', sheet.name, sheet.layers.length, effectiveFrames, AppState.fps);
    }
    
    // ツールバーの尺情報も更新
    updateDurationDisplay();
}

/**
 * ツールバーの尺情報表示を更新
 */
function updateDurationDisplay() {
    const durationDisplay = document.getElementById('duration-display');
    if (!durationDisplay) return;
    
    const sheet = getCurrentSheet();
    const totalFrames = sheet.frames || 144;
    const disabledCount = (sheet.disabledFrames && sheet.disabledFrames.length) || 0;
    const effectiveFrames = totalFrames - disabledCount;
    const seconds = Math.floor(effectiveFrames / AppState.fps);
    const remainingFrames = effectiveFrames % AppState.fps;
    
    durationDisplay.textContent = t('status.timeShort', seconds, remainingFrames, effectiveFrames);
}

/**
 * ウィンドウタイトルを更新
 * 形式: DiTiS - v2026.02.22 - [ファイル名]
 */
async function updateWindowTitle() {
    const currentSheet = getCurrentSheet();
    // シートごとのファイルパスのみを使用（グローバルパスは使わない）
    const filePath = currentSheet?.filePath;
    
    // バージョン情報を取得（グローバル変数から）
    const version = window.DITIS_VERSION || 'v2026.02.22';
    let title = `DiTiS - ${version}`;
    
    // ファイルパスがある場合はフルパスを追加
    if (filePath) {
        title = `DiTiS - ${version} - ${filePath}`;
    }
    
    // Tauri APIまたはdocument.titleで設定
    if (window.TauriAPI && window.TauriAPI.setWindowTitle) {
        await window.TauriAPI.setWindowTitle(title);
    } else {
        document.title = title;
    }
}
