// ========================================
// セル選択機能
// ========================================
// セルの選択、範囲選択、移動などを管理

/**
 * 選択セルへの自動スクロール
 * オプションON時: 画面中央にスクロール
 * オプションOFF時: 最小限のスクロール（従来動作）
 * @param {HTMLElement} cell - スクロール先のセル要素
 */
function scrollToSelectionIfEnabled(cell) {
    if (!cell) return;
    
    if (AppState.autoScrollToSelection) {
        // 中央にスクロール
        cell.scrollIntoView({ block: 'center', inline: 'center' });
    } else {
        // 従来の最小限スクロール
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
}

/**
 * A1セルを選択
 * 初期化時や表のリセット時に使用
 */
function selectA1(retryCount = 0) {
    clearSelection();
    const sheet = getCurrentSheet();
    const firstLayerId = sheet?.layers?.[0]?.id || 'L1';
    const cell = getCellElement(1, firstLayerId);
    if (cell) {
        selectCell(cell, 1, firstLayerId);
        scrollToSelectionIfEnabled(cell);
        AppState.selectionAnchor = null; // アンカーはクリア
        return;
    }

    // renderSpreadsheet()はrequestAnimationFrameで非同期描画されるため、初回描画直後はA1が未生成のことがある
    if (retryCount < 3) {
        requestAnimationFrame(() => selectA1(retryCount + 1));
    }
}

/**
 * 座標配列から選択を復元する（DOM再構築後のリトライ対応）
 * @param {Array<{frame, layerId}>} coords - 復元する座標一覧
 * @param {number} retryCount - リトライ回数
 */
function restoreSelectionCoords(coords, retryCount = 0) {
    if (!coords || coords.length === 0) {
        selectA1();
        return;
    }
    clearSelection();
    let restored = 0;
    coords.forEach(pos => {
        const cell = getCellElement(pos.frame, pos.layerId);
        if (cell) {
            cell.classList.add('selected');
            AppState.selectedCells.push({ cell, frame: pos.frame, layerId: pos.layerId });
            restored++;
        }
    });
    if (restored === 0) {
        if (retryCount < 3) {
            requestAnimationFrame(() => restoreSelectionCoords(coords, retryCount + 1));
        } else {
            selectA1(); // フォールバック
        }
    }
}

/**
 * セルを選択する
 * @param {HTMLElement} cell - セル要素
 * @param {number} frame - フレーム番号
 * @param {number} layerId - レイヤーID
 */
function selectCell(cell, frame, layerId) {
    cell.classList.add('selected');
    AppState.selectedCells.push({ cell, frame, layerId });
    if (AppState.debugMode) console.log(`[選択] セル追加: F${frame}L${layerId}`);
}

/**
 * セルの選択状態をトグル
 * @param {HTMLElement} cell - セル要素
 * @param {number} frame - フレーム番号
 * @param {number} layerId - レイヤーID
 */
function toggleCellSelection(cell, frame, layerId) {
    const index = AppState.selectedCells.findIndex(
        s => s.frame === frame && s.layerId === layerId
    );
    
    if (index >= 0) {
        cell.classList.remove('selected');
        AppState.selectedCells.splice(index, 1);
        if (AppState.debugMode) console.log(`[選択] セル削除: F${frame}L${layerId}`);
    } else {
        selectCell(cell, frame, layerId);
    }
}

/**
 * 範囲選択
 * @param {Object} start - 開始位置 {frame, layerId}
 * @param {Object} end - 終了位置 {frame, layerId}
 */
function selectRange(start, end) {
    // アンカーを保存（clearSelectionがクリアしてしまうため）
    const savedAnchor = AppState.selectionAnchor;
    
    clearSelection();
    
    // アンカーを復元
    AppState.selectionAnchor = savedAnchor;
    
    const minFrame = Math.min(start.frame, end.frame);
    const maxFrame = Math.max(start.frame, end.frame);
    
    // layerIdは"L1", "L17"などの文字列なので、シート内のインデックスで比較
    const sheet = getCurrentSheet();
    const startLayerIndex = getLayerIndex(start.layerId, sheet);
    const endLayerIndex = getLayerIndex(end.layerId, sheet);
    const minLayerIndex = Math.min(startLayerIndex, endLayerIndex);
    const maxLayerIndex = Math.max(startLayerIndex, endLayerIndex);
    
    if (AppState.debugMode) {
        console.log(`[選択] 範囲選択: F${minFrame}-F${maxFrame}, Layer ${start.layerId}-${end.layerId} (index ${minLayerIndex}-${maxLayerIndex})`);
    }
    
    const selectedLayers = sheet.layers.slice(minLayerIndex, maxLayerIndex + 1);
    for (let frame = minFrame; frame <= maxFrame; frame++) {
        for (const layer of selectedLayers) {
            const cell = getCellElement(frame, layer.id);
            if (cell) selectCell(cell, frame, layer.id);
        }
    }
}

/**
 * 選択を解除する
 * - すべての選択セルをクリア
 */
function clearSelection() {
    if (AppState.debugMode && AppState.selectedCells.length > 0) {
        console.log(`[選択] クリア: ${AppState.selectedCells.length}個のセル`);
    }
    AppState.selectedCells.forEach(s => {
        // 保存されたDOM参照から直接削除
        if (s.cell && s.cell.parentNode) {
            s.cell.classList.remove('selected');
            s.cell.classList.remove('anchor');
        }
        // DOM再構築後は参照が古いため、data属性で検索もする
        const liveCell = getCellElement(s.frame, s.layerId);
        if (liveCell) {
            liveCell.classList.remove('selected');
            liveCell.classList.remove('anchor');
        }
    });
    AppState.selectedCells = [];
    AppState.selectionAnchor = null; // アンカーもリセット
}

/**
 * アンカーセルを強調表示
 */
function highlightAnchor() {
    if (!AppState.selectionAnchor || AppState.selectedCells.length <= 1) {
        return; // アンカーがないか、単体選択の場合は何もしない
    }
    
    // 既存のアンカークラスを削除
    document.querySelectorAll('td.anchor').forEach(cell => {
        cell.classList.remove('anchor');
    });
    
    // アンカーセルに .anchor クラスを追加
    const anchorCell = getCellElement(AppState.selectionAnchor.frame, AppState.selectionAnchor.layerId);
    if (anchorCell) {
        anchorCell.classList.add('anchor');
        debugLog('選択', `アンカー強調: (${AppState.selectionAnchor.frame}, ${AppState.selectionAnchor.layerId})`);
    }
}

/**
 * 列全体を選択
 * @param {HTMLElement} cell - セル要素
 */
function selectEntireColumn(cell) {
    const layerId = cell.dataset.layer; // "L1" などの文字列IDをそのまま使用
    clearSelection();
    selectEntireColumnWithoutClear(layerId);
}

/**
 * 列全体を選択（選択クリアなし）
 * @param {number} layerId - レイヤーID
 */
function selectEntireColumnWithoutClear(layerId) {
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    for (let frame = 1; frame <= maxRows; frame++) {
        const targetCell = getCellElement(frame, layerId);
        if (targetCell) {
            selectCell(targetCell, frame, layerId);
        }
    }
}

/**
 * 行全体を選択
 * @param {number} frame - フレーム番号
 */
function selectEntireRow(frame) {
    clearSelection();
    selectEntireRowWithoutClear(frame);
}

/**
 * 行全体を選択（選択クリアなし）
 * @param {number} frame - フレーム番号
 */
function selectEntireRowWithoutClear(frame) {
    const sheet = getCurrentSheet();
    sheet.layers.forEach(layer => {
        const targetCell = getCellElement(frame, layer.id);
        if (targetCell) {
            selectCell(targetCell, frame, layer.id);
        }
    });
}

/**
 * 入力済みセルを全選択
 * 数字が入力されているセル（-や縦線を除く）を全て選択
 */
function selectAllInputtedCells() {
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // 入力済みセルの範囲を取得
    let minFrame = Infinity;
    let maxFrame = -Infinity;
    let minLayerIndex = Infinity;
    let maxLayerIndex = -Infinity;
    let hasData = false;
    
    for (let frame in sheet.data) {
        for (let layerId in sheet.data[frame]) {
            const value = sheet.data[frame][layerId];
            if (value && value !== '') {
                const f = parseInt(frame);
                const lIdx = getLayerIndex(layerId, sheet);
                if (lIdx === -1) continue;
                minFrame = Math.min(minFrame, f);
                maxFrame = Math.max(maxFrame, f);
                minLayerIndex = Math.min(minLayerIndex, lIdx);
                maxLayerIndex = Math.max(maxLayerIndex, lIdx);
                hasData = true;
            }
        }
    }
    
    if (hasData) {
        const minLayerId = sheet.layers[minLayerIndex].id;
        const maxLayerId = sheet.layers[maxLayerIndex].id;
        if (AppState.debugMode) {
            console.log(`[操作] fps部分クリック: 矩形選択 F${minFrame}-F${maxFrame}, ${minLayerId}-${maxLayerId}`);
        }
        selectRange(
            { frame: minFrame, layerId: minLayerId },
            { frame: maxFrame, layerId: maxLayerId }
        );
        updateStatusBar(`矩形選択: F${minFrame}-F${maxFrame}, ${minLayerId}-${maxLayerId}`);
    } else {
        updateStatusBar('入力済みセルがありません');
    }
}

/**
 * 全セルを選択
 */
function selectAll() {
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    clearSelection();
    
    for (let frame = 1; frame <= maxRows; frame++) {
        sheet.layers.forEach(layer => {
            const targetCell = getCellElement(frame, layer.id);
            if (targetCell) {
                selectCell(targetCell, frame, layer.id);
            }
        });
    }
}

/**
 * Shift+矢印で選択を拡張する
 * @param {string} arrowKey - 矢印キー名
 */
function expandSelectionWithShift(arrowKey) {
    debugLog('キー入力', `Shift+${arrowKey} 選択数: ${AppState.selectedCells.length}`);
    
    const sheet = getCurrentSheet();
    if (AppState.selectedCells.length === 0) return;
    
    // アンカーを初期化（初回のみ）
    if (!AppState.selectionAnchor) {
        const first = AppState.selectedCells[0];
        AppState.selectionAnchor = { frame: first.frame, layerId: first.layerId };
        debugLog('選択', `アンカー初期化: (${first.frame}, ${first.layerId})`);
        debugLog('選択', `  全選択セル数: ${AppState.selectedCells.length}`);
        if (AppState.selectedCells.length > 1) {
            const allFrames = AppState.selectedCells.map(s => s.frame).join(',');
            const allLayers = AppState.selectedCells.map(s => s.layerId).join(',');
            debugLog('選択', `  全フレーム: [${allFrames}]`);
            debugLog('選択', `  全レイヤー: [${allLayers}]`);
        }
    }
    
    // 現在の選択範囲を取得
    const frames = AppState.selectedCells.map(s => s.frame);
    const layerIds = AppState.selectedCells.map(s => s.layerId);
    const minFrame = Math.min(...frames);
    const maxFrame = Math.max(...frames);
    
    // layerIdは文字列なので、シート内のインデックスで比較
    const layerIndices = layerIds.map(id => getLayerIndex(id, sheet));
    const minLayerIndex = Math.min(...layerIndices);
    const maxLayerIndex = Math.max(...layerIndices);
    
    // インデックスが-1の場合（レイヤーが見つからない）はエラー
    if (minLayerIndex === -1 || maxLayerIndex === -1) {
        console.error('レイヤーが見つかりません:', layerIds);
        return;
    }
    
    const minLayerId = sheet.layers[minLayerIndex].id;
    const maxLayerId = sheet.layers[maxLayerIndex].id;
    
    debugLog('選択', `範囲: frame(${minFrame}-${maxFrame}), layer(${minLayerId}-${maxLayerId})`);
    
    // 次の位置を計算（アンカーの反対側の角を拡張）
    // 現在の選択範囲の対角の角を取得
    let oppositeFrame, oppositeLayerId;
    
    // アンカーがどの端にあるかを判定
    const anchorAtMinFrame = (AppState.selectionAnchor.frame === minFrame);
    const anchorAtMinLayer = (AppState.selectionAnchor.layerId === minLayerId);
    
    // アンカーの反対側の角を取得
    oppositeFrame = anchorAtMinFrame ? maxFrame : minFrame;
    oppositeLayerId = anchorAtMinLayer ? maxLayerId : minLayerId;
    
    debugLog('選択', `反対側の角: (${oppositeFrame}, ${oppositeLayerId})`);
    
    // 矢印の方向に応じて反対側の角を拡張
    switch (arrowKey) {
        case 'ArrowUp':
            oppositeFrame = Math.max(1, oppositeFrame - 1);
            break;
        case 'ArrowDown':
            oppositeFrame = Math.min(getMaxVisibleRows(sheet), oppositeFrame + 1);
            break;
        case 'ArrowLeft':
            const prevLayerIndex = getLayerIndex(oppositeLayerId, sheet) - 1;
            if (prevLayerIndex < 0) return; // 移動不可
            oppositeLayerId = sheet.layers[prevLayerIndex].id;
            break;
        case 'ArrowRight':
            const nextLayerIndex = getLayerIndex(oppositeLayerId, sheet) + 1;
            if (nextLayerIndex >= sheet.layers.length) return; // 移動不可
            oppositeLayerId = sheet.layers[nextLayerIndex].id;
            break;
    }
    
    // アンカーから拡張した反対側の角までを範囲選択
    debugLog('選択', `Shift選択: アンカー=(${AppState.selectionAnchor.frame}, ${AppState.selectionAnchor.layerId}), 反対角=(${oppositeFrame}, ${oppositeLayerId})`);
    selectRange(AppState.selectionAnchor, { frame: oppositeFrame, layerId: oppositeLayerId });
    
    // アンカーセルを強調表示
    highlightAnchor();
    
    // スクロール
    const lastCell = AppState.selectedCells[AppState.selectedCells.length - 1];
    if (lastCell) {
        scrollToSelectionIfEnabled(lastCell.cell);
    }
    
    updateStatusBar();
    highlightAnchor(); // アンカーセルを強調表示
}

/**
 * 選択範囲を維持したまま下に移動
 * - 選択範囲のサイズと形状を保ったまま1フレーム下に移動
 * - 最下行を超える場合は移動しない
 */
function moveSelectionDown() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // 選択範囲の最大フレームを取得
    const maxFrame = Math.max(...AppState.selectedCells.map(s => s.frame));
    
    // 最下行を超える場合は移動しない
    if (maxFrame >= maxRows) return;
    
    // 全セルを1フレーム下に移動
    const newSelection = AppState.selectedCells.map(cell => ({
        frame: cell.frame + 1,
        layerId: cell.layerId,
        cell: getCellElement(cell.frame + 1, cell.layerId)
    })).filter(cell => cell.cell !== null);
    
    // 選択をクリアして新しい選択を設定
    clearSelection();
    newSelection.forEach(({ cell, frame, layerId }) => {
        selectCell(cell, frame, layerId);
    });
    
    // 最初のセルにスクロール
    if (newSelection.length > 0) {
        scrollToSelectionIfEnabled(newSelection[0].cell);
    }
    
    updateStatusBar();
}

/**
 * 選択を下に拡張する
 * - 選択範囲を1フレーム下に拡張
 */
function expandSelectionDown() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    // 選択範囲の最大フレームと全レイヤーIDを取得
    const maxFrame = Math.max(...AppState.selectedCells.map(s => s.frame));
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    
    if (maxFrame < maxRows) {
        const nextFrame = maxFrame + 1;
        
        // 選択範囲の全列に対して次の行を追加
        layerIds.forEach(layerId => {
            const nextCell = getCellElement(nextFrame, layerId);
            if (nextCell) {
                selectCell(nextCell, nextFrame, layerId);
            }
        });
        
        // 最初に追加したセルにスクロール
        const firstNewCell = getCellElement(nextFrame, layerIds[0]);
        if (firstNewCell) {
            scrollToSelectionIfEnabled(firstNewCell);
        }
        updateStatusBar();
    }
}

/**
 * 選択を縮小する
 * - 選択範囲の最下行を全列削除
 */
function shrinkSelection() {
    if (AppState.selectedCells.length === 0) return;
    
    // 選択が1セルだけの場合は何もしない（縮小できない）
    if (AppState.selectedCells.length === 1) return;
    
    // 選択範囲の行数を判定
    const frames = [...new Set(AppState.selectedCells.map(s => s.frame))];
    const rowCount = frames.length;
    
    // 1行しかない場合は何もしない（下方向に縮小できない）
    if (rowCount === 1) return;
    
    // 複数行ある場合：最下行を削除
    const maxFrame = Math.max(...frames);
    const cellsToRemove = AppState.selectedCells.filter(s => s.frame === maxFrame);
    
    if (cellsToRemove.length > 0) {
        cellsToRemove.forEach(cellData => {
            cellData.cell.classList.remove('selected');
        });
        
        AppState.selectedCells = AppState.selectedCells.filter(s => s.frame !== maxFrame);
        updateStatusBar();
        
        // 残ったセルの最後の行にスクロール
        if (AppState.selectedCells.length > 0) {
            const newMaxFrame = Math.max(...AppState.selectedCells.map(s => s.frame));
            const firstCellInLastRow = AppState.selectedCells.find(s => s.frame === newMaxFrame);
            if (firstCellInLastRow && firstCellInLastRow.cell) {
                scrollToSelectionIfEnabled(firstCellInLastRow.cell);
            }
        }
    }
}

/**
 * セル選択を移動（矢印キー）
 * @param {string} arrowKey - 矢印キー ('ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')
 */
function moveCellSelection(arrowKey) {
    if (AppState.selectedCells.length === 0) return;
    
    debugLog('キー入力', `矢印キー ${arrowKey} 選択数: ${AppState.selectedCells.length}`);
    
    const sheet = getCurrentSheet();
    
    // アンカーをリセット
    AppState.selectionAnchor = null;
    
    if (AppState.selectedCells.length === 1) {
        // 単一選択: 1セルだけ移動
        const current = AppState.selectedCells[0];
        let nextFrame = current.frame;
        let nextLayerId = current.layerId;
        
        switch (arrowKey) {
            case 'ArrowUp':
                nextFrame = Math.max(1, current.frame - 1);
                break;
            case 'ArrowDown':
                nextFrame = Math.min(getMaxVisibleRows(sheet), current.frame + 1);
                break;
            case 'ArrowLeft':
                const prevLayerIndex = getLayerIndex(current.layerId, sheet) - 1;
                if (prevLayerIndex >= 0) {
                    nextLayerId = sheet.layers[prevLayerIndex].id;
                }
                break;
            case 'ArrowRight':
                const nextLayerIndex = getLayerIndex(current.layerId, sheet) + 1;
                if (nextLayerIndex < sheet.layers.length) {
                    nextLayerId = sheet.layers[nextLayerIndex].id;
                }
                break;
        }
        
        // 移動先のセルを選択
        const nextCell = getCellElement(nextFrame, nextLayerId);
        
        if (nextCell) {
            clearSelection();
            selectCell(nextCell, nextFrame, nextLayerId);
            scrollToSelectionIfEnabled(nextCell);
            updateStatusBar();
        }
    } else {
        // 複数選択: 選択範囲全体を移動
        const sortedCells = [...AppState.selectedCells].sort((a, b) => {
            if (a.frame !== b.frame) return a.frame - b.frame;
            return compareLayerIds(a.layerId, b.layerId, sheet.layers);
        });
        
        const frames = sortedCells.map(s => s.frame);
        const layerIds = sortedCells.map(s => s.layerId);
        
        const minFrame = Math.min(...frames);
        const maxFrame = Math.max(...frames);
        const layerIndices = layerIds.map(id => getLayerIndex(id, sheet)).filter(i => i !== -1);
        const minLayerIndex = Math.min(...layerIndices);
        const maxLayerIndex = Math.max(...layerIndices);
        
        const frameHeight = maxFrame - minFrame + 1;
        const layerWidth = maxLayerIndex - minLayerIndex + 1;
        
        let shiftFrame = 0;
        let shiftLayer = 0;
        let canMove = true;
        
        switch (arrowKey) {
            case 'ArrowUp':
                // フレーム1にいる場合は移動不可、フレーム2以上なら通常は範囲分、端なら1セル分
                if (minFrame === 1) {
                    canMove = false;
                } else if (minFrame - frameHeight < 1) {
                    // 範囲分移動すると0以下になる場合は1セル分だけ
                    shiftFrame = -1;
                } else {
                    shiftFrame = -frameHeight;
                }
                break;
            case 'ArrowDown':
                if (maxFrame + frameHeight <= getMaxVisibleRows(sheet)) {
                    shiftFrame = frameHeight;
                } else {
                    canMove = false;
                }
                break;
            case 'ArrowLeft':
                // A列にいる場合は移動不可、B列以上なら通常は範囲分、端なら1セル分
                if (minLayerIndex === 0) {
                    canMove = false;
                } else if (minLayerIndex - layerWidth < 0) {
                    // 範囲分移動すると0未満になる場合は1セル分だけ
                    shiftLayer = -1;
                } else {
                    shiftLayer = -layerWidth;
                }
                break;
            case 'ArrowRight':
                if (maxLayerIndex + layerWidth < sheet.layers.length) {
                    shiftLayer = layerWidth;
                } else {
                    canMove = false;
                }
                break;
        }
        
        if (!canMove) return;
        
        clearSelection();
        
        // 各セルを移動
        sortedCells.forEach(s => {
            const newFrame = s.frame + shiftFrame;
            let newLayerId = s.layerId;
            
            if (shiftLayer !== 0) {
                const layerIndex = getLayerIndex(s.layerId, sheet);
                const newLayerIndex = layerIndex + shiftLayer;
                if (newLayerIndex >= 0 && newLayerIndex < sheet.layers.length) {
                    newLayerId = sheet.layers[newLayerIndex].id;
                }
            }
            
            const newCell = getCellElement(newFrame, newLayerId);
            
            if (newCell) {
                selectCell(newCell, newFrame, newLayerId);
            }
        });
        
        // 最初のセルまでスクロール
        if (AppState.selectedCells.length > 0) {
            scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
        }
        
        updateStatusBar();
    }
}
