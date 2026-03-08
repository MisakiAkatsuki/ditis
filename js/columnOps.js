/** columnOps.js - 列（レイヤー）操作モジュール */

/**
 * 列（レイヤー）を削除する
 * - 選択されている列を削除
 * - レイヤーはIDではなく配列順序で管理（Undo対応）
 * - 最後の列は削除不可
 */
async function deleteColumnFromSelection() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    
    // 選択されている列（レイヤー）を取得
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    
    // バリデーション：各レイヤーIDが有効か確認
    for (const layerId of layerIds) {
        if (!validateLayerId(layerId, sheet.layers)) {
            return;
        }
    }
    
    if (sheet.layers.length <= layerIds.length) {
        showErrorToast('最後の列は削除できません。少なくとも1つの列が必要です。', ErrorLevel.WARNING);
        return;
    }
    
    // 確認ダイアログを表示
    const layerNames = layerIds.map(id => {
        const layer = sheet.layers.find(l => l.id === id);
        return layer ? layer.name : id;
    }).join(', ');
    
    const confirmed = await showConfirmDialog(
        `列「${layerNames}」を削除しますか？`
    );
    
    if (!confirmed) return;
    
    // レイヤーを削除
    sheet.layers = sheet.layers.filter(layer => !layerIds.includes(layer.id));

    // sheet.data から削除レイヤーのデータを完全削除（ID再利用による旧データ復活を防止）
    for (const frameKey of Object.keys(sheet.data)) {
        for (const layerId of layerIds) {
            delete sheet.data[frameKey][layerId];
        }
    }
    
    saveHistory('列削除');
    renderSpreadsheet();
    clearSelection();
    saveToLocalStorage();
    
    updateStatusBar(`${layerIds.length}列を削除しました`);
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * この列以降の列をすべて削除する
 * - 選択されている列自体も含めて削除
 * - 最後の列は削除不可（最低1列は残す）
 */
async function deleteColumnsAfterSelection() {
    if (AppState.selectedCells.length === 0) return;
    
    const sheet = getCurrentSheet();
    
    // 選択されている列（レイヤー）を取得
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    
    // 選択列が複数ある場合は最も右の列を基準にする
    const selectedLayerIndices = layerIds.map(id => 
        sheet.layers.findIndex(l => l.id === id)
    );
    const rightmostIndex = selectedLayerIndices.length > 0 ? Math.max(...selectedLayerIndices) : 0;
    
    // 削除対象の列を取得（選択列以降）
    const columnsToDelete = sheet.layers.slice(rightmostIndex);
    
    if (columnsToDelete.length === 0) {
        showErrorToast('削除する列がありません。', ErrorLevel.INFO);
        return;
    }
    
    if (sheet.layers.length - columnsToDelete.length < 1) {
        showErrorToast('最後の列は削除できません。少なくとも1つの列が必要です。', ErrorLevel.WARNING);
        return;
    }
    
    // 確認ダイアログを表示
    const selectedLayer = sheet.layers[rightmostIndex];
    const confirmed = await showConfirmDialog(
        `列「${selectedLayer.name}」以降の${columnsToDelete.length}列を削除しますか？`
    );
    
    if (!confirmed) return;
    
    // 選択列以降を削除
    const deletedLayerIds = columnsToDelete.map(l => l.id);
    sheet.layers = sheet.layers.slice(0, rightmostIndex);

    // sheet.data から削除レイヤーのデータを完全削除（ID再利用による旧データ復活を防止）
    for (const frameKey of Object.keys(sheet.data)) {
        for (const layerId of deletedLayerIds) {
            delete sheet.data[frameKey][layerId];
        }
    }
    
    saveHistory('列削除');
    renderSpreadsheet();
    clearSelection();
    saveToLocalStorage();
    
    updateStatusBar(`${columnsToDelete.length}列を削除しました`);
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 列（レイヤー）を挿入
 * - 選択されている列の前に新しい列を挿入
 * - 新しい列のIDは最大ID+1
 */
function insertColumnAtSelection() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('列を挿入する位置を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const sheet = getCurrentSheet();
    
    // 選択されている最初の列の位置を取得
    const firstLayerId = AppState.selectedCells[0].layerId;
    const insertIndex = sheet.layers.findIndex(layer => layer.id === firstLayerId);
    
    if (insertIndex === -1) {
        showErrorToast('挿入位置が見つかりません', ErrorLevel.ERROR);
        return;
    }
    
    // 変更前の状態を保存 → 後に移動
    
    // 新しいレイヤーIDを決定（既存の最大ID+1）
    const maxId = Math.max(...sheet.layers.map(l => {
        const num = typeof l.id === 'string' ? parseInt(l.id.replace(/\D/g, '')) : l.id;
        return isNaN(num) ? 0 : num;
    }), 0);
    const newLayerId = `L${maxId + 1}`;
    
    // 新しいレイヤー名を決定（選択していた列の名前_w）
    const selectedLayer = sheet.layers[insertIndex];
    const newName = `${selectedLayer.name}_w`;
    
    // 新しいレイヤーを挿入（選択した列の右隣に挿入）
    const newLayer = {
        id: newLayerId,
        name: newName
    };
    sheet.layers.splice(insertIndex + 1, 0, newLayer);
    
    // 新しい列のデータを空で初期化
    const maxRows = getMaxVisibleRows(sheet);
    for (let frame = 1; frame <= maxRows; frame++) {
        if (!sheet.data[frame]) {
            sheet.data[frame] = {};
        }
        sheet.data[frame][newLayerId] = '';
    }
    
    saveHistory('列挿入');
    renderSpreadsheet();
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 列を末尾に追加
 * - 次のアルファベット名で新しい列を末尾に追加
 */
function appendColumn() {
    const sheet = getCurrentSheet();
    
    // 変更前の状態を保存 → 後に移動
    
    // 新しいレイヤーIDを決定（既存の最大ID+1）
    const maxId = Math.max(...sheet.layers.map(l => {
        const num = typeof l.id === 'string' ? parseInt(l.id.replace(/\D/g, '')) : l.id;
        return isNaN(num) ? 0 : num;
    }), 0);
    const newLayerId = `L${maxId + 1}`;
    
    // 次のアルファベット名を生成（既存列名のベース部分の最大値+1）
    let maxNameIndex = -1;
    sheet.layers.forEach(l => {
        const baseName = l.name.split('_')[0].toUpperCase();
        const idx = getLayerNameIndex(baseName);
        if (idx > maxNameIndex) maxNameIndex = idx;
    });
    const newName = getLayerName(maxNameIndex + 1);
    
    // 新しいレイヤーを末尾に追加
    sheet.layers.push({
        id: newLayerId,
        name: newName
    });
    
    // 新しい列のデータを空で初期化
    const maxRows = getMaxVisibleRows(sheet);
    for (let frame = 1; frame <= maxRows; frame++) {
        if (!sheet.data[frame]) {
            sheet.data[frame] = {};
        }
        sheet.data[frame][newLayerId] = '';
    }
    
    saveHistory('列追加');
    renderSpreadsheet();
    updateUndoRedoButtons();
}

/**
 * 列名を初期化
 * - すべての列名をA, B, C...にリセット
 * - 列数とデータはそのまま維持
 */
async function resetColumnNames() {
    const sheet = getCurrentSheet();
    
    const confirmed = await showConfirmDialog(
        'すべての列名をA, B, C...に初期化しますか？'
    );
    if (!confirmed) {
        return;
    }
    
    // 各列の名前を初期化
    sheet.layers.forEach((layer, index) => {
        layer.name = getLayerName(index);
    });
    
    saveHistory('列名初期化');
    renderSpreadsheet();
    saveToLocalStorage();
    
    updateStatusBar('列名を初期化しました');
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 最大列数を変更
 * - 列数を増やす場合：新しい列を追加
 * - 列数を減らす場合：最後の列から削除
 */
async function changeMaxColumns() {
    const sheet = getCurrentSheet();
    const currentColumns = sheet.layers.length;
    
    const newColumns = await showColumnsDialog();
    if (newColumns === null) return;
    
    if (newColumns === currentColumns) {
        return;
    }
    
    if (newColumns < currentColumns) {
        const confirmed = await showConfirmDialog(
            `列を${currentColumns - newColumns}列削除します。データも削除されますがよろしいですか？`
        );
        if (!confirmed) {
            return;
        }
    }
    
    // 変更前の状態を保存 → 後に移動
    
    const maxRows = getMaxVisibleRows(sheet);
    
    if (newColumns > currentColumns) {
        // 列を増やす
        const maxId = Math.max(...sheet.layers.map(l => {
            const num = typeof l.id === 'string' ? parseInt(l.id.replace(/\D/g, '')) : l.id;
            return isNaN(num) ? 0 : num;
        }), 0);
        
        for (let i = currentColumns; i < newColumns; i++) {
            const newLayerId = `L${maxId + (i - currentColumns) + 1}`;
            const newLayer = {
                id: newLayerId,
                name: getLayerName(i)
            };
            sheet.layers.push(newLayer);
            
            // 新しい列のデータを空で初期化
            for (let frame = 1; frame <= maxRows; frame++) {
                if (!sheet.data[frame]) {
                    sheet.data[frame] = {};
                }
                sheet.data[frame][newLayerId] = '';
            }
        }
        
        updateStatusBar(`${newColumns - currentColumns}列追加しました（合計: ${newColumns}列）`);
    } else {
        const removeCount = currentColumns - newColumns;
        const removedLayers = sheet.layers.slice(newColumns);
        
        // 削除する列のIDを取得
        const removedLayerIds = removedLayers.map(l => l.id);
        
        // layersから削除
        sheet.layers = sheet.layers.slice(0, newColumns);
        
        // データからも削除（参照は残るが表示されない）
        // 実際にはUndoで戻せるようにデータは残しておく
        
        updateStatusBar(`${removeCount}列削除しました（合計: ${newColumns}列）`);
    }
    
    saveHistory('列数変更');
    renderSpreadsheet();
    clearSelection();
    saveToLocalStorage();
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 選択された列を左の列と入れ替える
 */
function swapColumnWithLeft() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('入れ替える列を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    if (layerIds.length !== 1) {
        showErrorToast('1つの列を選択してください。複数列の同時入れ替えはできません。', ErrorLevel.WARNING);
        return;
    }
    
    const sheet = getCurrentSheet();
    const layerId = layerIds[0];
    const layerIndex = sheet.layers.findIndex(l => l.id === layerId);
    
    if (layerIndex === 0) {
        showErrorToast('最初の列は左に移動できません。', ErrorLevel.WARNING);
        return;
    }
    
    // layers配列で入れ替え
    const temp = sheet.layers[layerIndex];
    sheet.layers[layerIndex] = sheet.layers[layerIndex - 1];
    sheet.layers[layerIndex - 1] = temp;
    
    // データは入れ替え不要（layerIdは維持される）
    
    saveHistory('列入れ替え');
    renderSpreadsheet(true);
    saveToLocalStorage();
    updateStatusBar('列を入れ替えました');
    updateUndoRedoButtons();
}

/**
 * 選択された列を右の列と入れ替える
 */
function swapColumnWithRight() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('入れ替える列を選択してください。', ErrorLevel.WARNING);
        return;
    }
    
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    if (layerIds.length !== 1) {
        showErrorToast('1つの列を選択してください。複数列の同時入れ替えはできません。', ErrorLevel.WARNING);
        return;
    }
    
    const sheet = getCurrentSheet();
    const layerId = layerIds[0];
    const layerIndex = sheet.layers.findIndex(l => l.id === layerId);
    
    if (layerIndex === sheet.layers.length - 1) {
        showErrorToast('最後の列は右に移動できません。', ErrorLevel.WARNING);
        return;
    }
    
    // layers配列で入れ替え
    const temp = sheet.layers[layerIndex];
    sheet.layers[layerIndex] = sheet.layers[layerIndex + 1];
    sheet.layers[layerIndex + 1] = temp;
    
    // データは入れ替え不要（layerIdは維持される）
    
    saveHistory('列入れ替え');
    renderSpreadsheet(true);
    saveToLocalStorage();
    updateStatusBar('列を入れ替えました');
    updateUndoRedoButtons();
}
