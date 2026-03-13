/**
 * ===================================================================
 * fileOperations.js - ファイル入出力モジュール
 * ===================================================================
 * 
 * ファイルの保存・読み込み、および各種ファイル形式の処理を担当します。
 * 
 * 【主要機能】
 * - JSON形式の保存・読み込み
 * - STS形式（シラヘイタイムシート）の保存・読み込み・変換
 * - TDTS形式（東映タイムシート）の読み込み・変換
 * - XDTS形式（交換タイムシート）の読み込み・変換
 * - ファイルダイアログ操作
 * - シート閉じる処理
 * 
 * 【依存関係】
 * - AppState（グローバル）
 * - getCurrentSheet(), debugLog(), showErrorToast() など（app.js）
 * - renderTabs(), renderSpreadsheet(), updateStatusBar() など（他モジュール）
 * ===================================================================
 */

// ========================================
// JSON形式 保存・読み込み
// ========================================



let lastSaveTime = 0;
const SAVE_DEBOUNCE_MS = 500;
let isSaving = false;

/**
 * 読み込んだシートの layers・data を内部形式に展開する
 * layers: 名前配列 → [{id: "L1", name: "A"}, ...] 形式
 * data: 列ごとの配列 → {frame: {layerId: value}} 形式
 * @param {Object} sheet
 */
function loadSheetData(sheet) {
    if (!sheet || !sheet.layers) return;

    // layers が文字列配列の場合は {id, name} 形式に展開
    if (sheet.layers.length === 0 || typeof sheet.layers[0] === 'string') {
        sheet.layers = sheet.layers.map((name, i) => ({ id: `L${i + 1}`, name }));
    }

    // data の列ごと配列形式 → {frame: {layerId: value}} に展開
    if (!sheet.data) return;
    if (!Array.isArray(sheet.data)) return; // 想定外の形式はスキップ
    const newData = {};
    sheet.data.forEach((colArr, colIdx) => {
        const layer = sheet.layers[colIdx];
        if (!layer) return;
        colArr.forEach((val, frameIdx) => {
            const frame = frameIdx + 1;
            if (!newData[frame]) newData[frame] = {};
            newData[frame][layer.id] = val ?? '';
        });
    });
    sheet.data = newData;
}

/**
 * 保存用にシートを正規化したコピーを返す
 * - layers を名前の配列に変換
 * - data を列ごとの配列形式に変換（空列省略、末尾の空要素省略）
 * - visibleRows / visibleColumns を除外
 * @param {Object} sheet
 * @returns {Object} 正規化されたシートオブジェクト
 */
function normalizeSheetForSave(sheet) {
    const layerNames = sheet.layers.map(l => l.name);

    // data を列ごとの配列に変換
    // data[colIdx] = [frame1val, frame2val, ...] (末尾の空文字は省略)
    const colArrays = sheet.layers.map(layer => {
        const col = [];
        for (let frame = 1; frame <= sheet.frames; frame++) {
            col.push((sheet.data[frame] && sheet.data[frame][layer.id]) || '');
        }
        // 末尾の空文字を削除
        let last = col.length - 1;
        while (last >= 0 && col[last] === '') last--;
        return col.slice(0, last + 1);
    });

    // 末尾の空列を削除
    let lastCol = colArrays.length - 1;
    while (lastCol >= 0 && colArrays[lastCol].length === 0) lastCol--;
    const newData = colArrays.slice(0, lastCol + 1);

    const { visibleRows, visibleColumns, id, filePath, ...rest } = sheet;
    return { ...rest, layers: layerNames, data: newData };
}

/**
 * .ditis 保存データを構築する
 * @param {Object} sheet
 * @returns {string} JSON文字列
 */
function buildDitisJson(sheet) {
    const normalized = normalizeSheetForSave(sheet);
    const data = {
        version: '1.0',
        sheets: [normalized]
    };
    return JSON.stringify(data, null, 2);
}

/**
 * 現在のタブのみをJSONファイルとして保存
 * シートにファイルパスがある場合は上書き保存、ない場合はダイアログを表示
 */
async function saveToFile() {
    // 二重実行防止（前回の保存完了を待つ）
    if (isSaving) {
        debugLog('ファイル', '二重実行防止: 保存処理をスキップ');
        return;
    }
    const now = Date.now();
    if (now - lastSaveTime < SAVE_DEBOUNCE_MS) {
        debugLog('ファイル', '二重実行防止: 保存処理をスキップ');
        return;
    }
    isSaving = true;
    lastSaveTime = now;
    
    const currentSheet = getCurrentSheet();
    const sheetName = currentSheet.name;
    
    debugLog('ファイル', `保存 シート「${sheetName}」を保存開始`);
    debugLog('ファイル', `シートのファイルパス: ${currentSheet.filePath || '(未設定)'}`);
    
    // Tauriの場合はダイアログとファイル保存API、ブラウザの場合はダウンロード
    if (window.TauriAPI && window.TauriAPI.isRunningInTauri()) {
        try {
            // シートごとのファイルパスのみを使用（グローバルパスは使わない）
            // これにより、新規シートは必ずダイアログが表示される
            let filePath = currentSheet.filePath;
            
            // ファイルパスが存在しない場合のみダイアログを表示
            if (!filePath) {
                debugLog('ファイル', 'ファイルパスが未設定のため、ダイアログを表示');
                filePath = await window.TauriAPI.saveFileDialog({
                    defaultPath: `${sheetName}.ditis`,
                    filters: [
                        { name: 'DiTiS Files', extensions: ['ditis'] },
                        { name: 'JSON Files', extensions: ['json'] },
                        { name: 'STS Files', extensions: ['sts'] },
                        { name: 'TDTS Files', extensions: ['tdts'] },
                        { name: 'XDTS Files', extensions: ['xdts'] }
                    ]
                });
            }
            
            if (filePath) {
                // 拡張子を確認して保存形式を決定
                const ext = filePath.toLowerCase();
                
                if (ext.endsWith('.sts')) {
                    // STS形式で保存（単一シート）- 失敗時はreturnで中断
                    const result = await saveStsFileInternal(filePath, currentSheet);
                    if (result === false) return;
                } else if (ext.endsWith('.tdts')) {
                    // TDTS形式で保存
                    await saveTdtsFileInternal(filePath, currentSheet);
                } else if (ext.endsWith('.xdts')) {
                    // XDTS形式で保存
                    await saveXdtsFileInternal(filePath, currentSheet);
                } else {
                    // .ditis / .json 形式で保存（v1.1）
                    const json = buildDitisJson(currentSheet);
                    await window.TauriAPI.saveFile(filePath, json);
                }
                
                currentSheet.filePath = filePath;
                addToRecentFiles(filePath);
                // ファイル名（拡張子なし）をシート名に反映
                const savedFileName = filePath.split(/[/\\]/).pop().replace(/\.[^.]+$/, '');
                if (savedFileName) {
                    currentSheet.name = savedFileName;
                    renderTabs();
                }
                updateWindowTitle();
                updateStatusBar(`シート「${currentSheet.name}」を保存しました: ${filePath}`);
                showErrorToast(`保存しました: ${filePath}`, ErrorLevel.INFO, 3000);
            }
        } catch (error) {
            console.error('ファイル保存エラー:', error);
            showErrorToast(`保存に失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
        } finally {
            isSaving = false;
        }
    } else {
        // ブラウザ版: 従来のダウンロード
        try {
            const json = buildDitisJson(currentSheet);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const filename = `${sheetName}.ditis`;
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            currentSheet.filePath = filename;
            updateWindowTitle();
            updateStatusBar(`シート「${sheetName}」を保存しました`);
            debugLog('ファイル', `保存完了 シート「${sheetName}」`);
        } finally {
            isSaving = false;
        }
    }
}

/**
 * 別名でファイルを保存（常にダイアログを表示）
 */
async function saveAsFile() {
    const currentSheet = getCurrentSheet();
    const sheetName = currentSheet.name;
    
    debugLog('ファイル', `別名で保存 シート「${sheetName}」`);
    
    if (window.TauriAPI && window.TauriAPI.isRunningInTauri()) {
        try {
            // シートのファイルパス、またはシート名をデフォルトに
            const defaultPath = currentSheet.filePath || `${sheetName}.ditis`;
            const filePath = await window.TauriAPI.saveFileDialog({ 
                defaultPath,
                filters: [
                    { name: 'DiTiS Files', extensions: ['ditis'] },
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'STS Files', extensions: ['sts'] },
                    { name: 'TDTS Files', extensions: ['tdts'] },
                    { name: 'XDTS Files', extensions: ['xdts'] }
                ]
            });
            
            if (filePath) {
                // 拡張子を確認して保存形式を決定
                const ext = filePath.toLowerCase();
                
                if (ext.endsWith('.sts')) {
                    // STS形式で保存 - 失敗時はreturnで中断
                    const result = await saveStsFileInternal(filePath, currentSheet);
                    if (result === false) return;
                } else if (ext.endsWith('.tdts')) {
                    // TDTS形式で保存
                    await saveTdtsFileInternal(filePath, currentSheet);
                } else if (ext.endsWith('.xdts')) {
                    // XDTS形式で保存
                    await saveXdtsFileInternal(filePath, currentSheet);
                } else {
                    // .ditis / .json 形式で保存（v1.1）
                    const json = buildDitisJson(currentSheet);
                    await window.TauriAPI.saveFile(filePath, json);
                }
                
                currentSheet.filePath = filePath;
                addToRecentFiles(filePath);
                // ファイル名（拡張子なし）をシート名に反映
                const savedFileName = filePath.split(/[/\\]/).pop().replace(/\.[^.]+$/, '');
                if (savedFileName) {
                    currentSheet.name = savedFileName;
                    renderTabs();
                }
                updateWindowTitle();
                updateStatusBar(`シート「${currentSheet.name}」を保存しました: ${filePath}`);
                showErrorToast(`保存しました: ${filePath}`, ErrorLevel.INFO, 3000);
            }
        } catch (error) {
            console.error('ファイル保存エラー:', error);
            showErrorToast(`保存に失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
        }
    } else {
        // ブラウザ版: ダウンロード
        const json = buildDitisJson(currentSheet);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const filename = `${sheetName}.ditis`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        currentSheet.filePath = filename;
        updateWindowTitle();
        updateStatusBar(`シート「${sheetName}」を保存しました`);
        debugLog('ファイル', `別名で保存完了 シート「${sheetName}」`);
    }
}


/**
 * ファイルから読み込む（Tauri版）
 * 拡張子に応じて適切な読み込み方法を選択
 */
async function loadFromFileTauri() {
    try {
        const filePath = await window.TauriAPI.openFileDialog({
            filters: [
                { name: 'All Supported', extensions: ['ditis', 'json', 'sts', 'tdts', 'xdts'] },
                { name: 'DiTiS Files', extensions: ['ditis'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'STS Files', extensions: ['sts'] },
                { name: 'TDTS Files', extensions: ['tdts'] },
                { name: 'XDTS Files', extensions: ['xdts'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (!filePath) return; // キャンセルされた
        
        debugLog('ファイル', `読み込み ファイル読み込み開始: ${filePath}`);
        
        // 拡張子を取得
        const fileName = filePath.split(/[/\\]/).pop();
        const extension = fileName.split('.').pop().toLowerCase();
        
        // 拡張子に応じて処理を分岐
        if (extension === 'sts') {
            // STSファイルはバイナリとして読み込み
            const binaryData = await window.TauriAPI.loadBinaryFile(filePath);
            parseStsFile(binaryData, fileName);
            return;
        } else if (extension === 'tdts') {
            // TDTSファイルはテキストとして読み込み
            const contents = await window.TauriAPI.loadFile(filePath);
            parseTdtsFile(contents, fileName);
            return;
        } else if (extension === 'xdts') {
            // XDTSファイルはテキストとして読み込み
            const contents = await window.TauriAPI.loadFile(filePath);
            parseXdtsFile(contents, fileName);
            return;
        }
        
        // DiTiS/JSONファイル（デフォルト）
        const contents = await window.TauriAPI.loadFile(filePath);
        
        let data;
        try {
            data = JSON.parse(contents);
        } catch (parseError) {
            console.error('JSON解析エラー:', parseError);
            showErrorToast(`ファイル形式が不正です: ${parseError.message}`, ErrorLevel.ERROR, 5000);
            return;
        }
        
        // データバリデーション
        if (!data.sheets || !Array.isArray(data.sheets)) {
            handleValidationError('sheets', data.sheets, '配列');
            return;
        }
        
        // ファイルから読み込んだシートを新規タブとして追加
        debugLog('ファイル', `${data.sheets.length}個のシートを新規タブとして追加`);
        
        // 全シートを一時配列で検証・変換してから一括追加（失敗時はロールバック）
        const startIndex = AppState.sheets.length;
        const newSheets = [];
        data.sheets.forEach((sheet, index) => {
            loadSheetData(sheet);
            if (index === 0) {
                sheet.filePath = filePath;
            } else {
                sheet.filePath = null;
            }
            newSheets.push(sheet);
        });
        newSheets.forEach(sheet => AppState.sheets.push(sheet));
        
        // 最後に追加したシート（最初の読み込みシート）に切り替え
        AppState.currentSheetIndex = startIndex;
        
        // FPSは既存の設定を維持（変更しない）
        
        saveHistory('ファイル読み込み');
        renderTabs();
        renderSpreadsheet(true);
        selectA1();
        addToRecentFiles(filePath);
        updateStatusBar(`${data.sheets.length}個のシートを追加しました`);
        updateWindowTitle();
        showErrorToast(`${data.sheets.length}個のシートを新規タブとして追加しました`, ErrorLevel.INFO, 3000);
    } catch (error) {
        console.error('ファイル読み込みエラー:', error);
        showErrorToast(`読み込みに失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

/**
 * ファイルから読み込む（ブラウザ版）
 * @param {Event} e - ファイル選択イベント
 */
function loadFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    debugLog('ファイル', `読み込み ファイル読み込み開始: ${file.name}`);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // データバリデーション
            if (!data.sheets || !Array.isArray(data.sheets)) {
                handleValidationError('sheets', data.sheets, '配列');
                return;
            }
            
            // ファイルから読み込んだシートを新規タブとして追加
            debugLog('ファイル', `${data.sheets.length}個のシートを新規タブとして追加`);
            
            // 全シートを一時配列で変換してから一括追加（失敗時はロールバック）
            const startIndex = AppState.sheets.length;
            const newSheets = [];
            data.sheets.forEach((sheet, index) => {
                loadSheetData(sheet);
                if (index === 0) sheet.filePath = file.name;
                newSheets.push(sheet);
            });
            newSheets.forEach(sheet => AppState.sheets.push(sheet));
            
            // 最後に追加したシート（最初の読み込みシート）に切り替え
            AppState.currentSheetIndex = startIndex;
            
            // FPSは既存の設定を維持（変更しない）
            
            saveHistory('ファイル読み込み');
            renderTabs();
            renderSpreadsheet(true); // ファイル読み込み時は全体レンダリング
            updateStatusBar(`${data.sheets.length}個のシートを追加しました`);
            updateWindowTitle();
            showErrorToast(`${data.sheets.length}個のシートを新規タブとして追加しました`, ErrorLevel.INFO, 3000);
        } catch (error) {
            handleFileReadError(error, file.name);
        }
    };
    
    reader.onerror = () => {
        handleFileReadError(new Error('ファイル読込エラー'), file.name);
    };
    
    reader.readAsText(file);
    e.target.value = '';
}

/**
 * 確認ダイアログを表示（Tauri/ブラウザ両対応）
 * @param {string} message - 確認メッセージ
 * @returns {Promise<boolean>} - OKならtrue、キャンセルならfalse
 */
async function showConfirmDialog(message) {
    if (window.__TAURI_INTERNALS__) {
        // Tauri環境: 非同期confirm
        try {
            const result = await window.__TAURI_INTERNALS__.invoke('plugin:dialog|confirm', {
                message: message,
                title: '確認',
                kind: 'warning'
            });
            return result;
        } catch (error) {
            console.error('Confirm dialog error:', error);
            return false;
        }
    } else {
        // ブラウザ環境: 同期confirm
        return confirm(message);
    }
}

/**
 * 現在のタブ（シート）を閉じる
 */
async function closeFile() {
    await closeFileByIndex(AppState.currentSheetIndex);
}

/**
 * 指定インデックスのシートを閉じる（確認ダイアログあり）
 */
async function closeFileByIndex(index) {
    // 最後の1つのシートは閉じられない
    if (AppState.sheets.length === 1) {
        showErrorToast('最後のシートは閉じられません', ErrorLevel.WARNING, 3000);
        return;
    }
    
    const sheet = AppState.sheets[index];
    if (!sheet) return;
    const sheetName = sheet.name;
    
    // 確認ダイアログ
    const confirmed = await showConfirmDialog(
        `シート「${sheetName}」を閉じますか？\n保存していないデータは失われます。`
    );
    
    if (!confirmed) {
        return;
    }
    
    debugLog('ファイル', `シート「${sheetName}」を閉じる`);
    
    // 指定シートを削除
    AppState.sheets.splice(index, 1);
    
    // インデックスを調整
    if (AppState.currentSheetIndex >= AppState.sheets.length) {
        AppState.currentSheetIndex = AppState.sheets.length - 1;
    } else if (AppState.currentSheetIndex > index) {
        AppState.currentSheetIndex--;
    }
    
    // 再描画
    renderTabs();
    renderSpreadsheet(true);
}

/**
 * すべてのシートを閉じて初期化する
 */
async function closeAllSheets() {
    // 確認ダイアログ
    const confirmed = await showConfirmDialog(
        'すべてのシートを閉じますか？\n保存していないデータは失われます。'
    );
    
    if (!confirmed) {
        return;
    }
    
    debugLog('ファイル', 'すべてのシートを閉じる');
    
    // すべてのシートをクリアして新しい初期シートを作成
    AppState.sheets = [];
    AppState.currentSheetIndex = 0;
    
    // 初期化済みのシートを1つ作成
    createNewSheet('Sheet1');
    
    // 再描画
    renderTabs();
    renderSpreadsheet(true);
    selectA1();
    updateWindowTitle();
    updateStatusBar('すべてのシートを閉じました');
}

/**
 * 新規シートを作成（オプションでダイアログ表示）
 */
async function createNewSheetWithPrompt() {
    if (AppState.showNewSheetDialog) {
        // ダイアログを表示して作成
        const sheet = await createNewSheetWithDialog();
        if (!sheet) return;
        
        AppState.currentSheetIndex = AppState.sheets.length - 1;
        saveHistory('シート作成');
        renderTabs();
        renderSpreadsheet(true);
        selectA1();
        updateWindowTitle();
        updateDurationDisplay();
    } else {
        // 自動命名で作成
        const sheetName = `Sheet${AppState.sheets.length + 1}`;
        createNewSheet(sheetName);
        AppState.currentSheetIndex = AppState.sheets.length - 1;
        saveHistory('シート作成');
        renderTabs();
        renderSpreadsheet(true);
        selectA1();
        updateWindowTitle();
    }
}


/**
 * ファイルパスから直接ファイルを読み込む
 * ファイル関連付けからの起動時に使用
 * @param {string} filePath - 読み込むファイルのパス
 */
async function loadFileFromPath(filePath) {
    if (!window.TauriAPI || !window.TauriAPI.isRunningInTauri()) {
        console.warn('[loadFileFromPath] Tauri環境でのみ動作します');
        return;
    }
    
    try {
        debugLog('ファイル', `ファイル関連付けから読み込み: ${filePath}`);
        
        // 拡張子を取得
        const fileName = filePath.split(/[/\\]/).pop();
        const extension = fileName.split('.').pop().toLowerCase();
        
        // 拡張子に応じて処理を分岐
        if (extension === 'sts') {
            const binaryData = await window.TauriAPI.loadBinaryFile(filePath);
            parseStsFile(binaryData, fileName);
            return;
        } else if (extension === 'tdts') {
            const contents = await window.TauriAPI.loadFile(filePath);
            parseTdtsFile(contents, fileName);
            return;
        } else if (extension === 'xdts') {
            const contents = await window.TauriAPI.loadFile(filePath);
            parseXdtsFile(contents, fileName);
            return;
        }
        
        // DiTiS/JSONファイル
        const contents = await window.TauriAPI.loadFile(filePath);
        
        let data;
        try {
            data = JSON.parse(contents);
        } catch (parseError) {
            console.error('JSON解析エラー:', parseError);
            showErrorToast(`ファイル形式が不正です: ${parseError.message}`, ErrorLevel.ERROR, 5000);
            return;
        }
        
        // データバリデーション
        if (!data.sheets || !Array.isArray(data.sheets)) {
            showErrorToast('ファイル形式が不正です: sheetsが見つかりません', ErrorLevel.ERROR, 5000);
            return;
        }
        
        // シートを追加
        const startIndex = AppState.sheets.length;
        data.sheets.forEach((sheet, index) => {
            loadSheetData(sheet);
            // 最初のシートだけにfilePathを設定（他は個別ファイルとして保存させる）
            if (index === 0) {
                sheet.filePath = filePath;
            } else {
                sheet.filePath = null;
            }
            AppState.sheets.push(sheet);
        });
        
        AppState.currentSheetIndex = startIndex; // 最初に読み込んだシートを選択
        
        renderTabs();
        renderSpreadsheet();
        selectA1();
        updateWindowTitle();
        updateStatusBar(`ファイルを読み込みました: ${fileName}`);
        showErrorToast(`読み込みました: ${fileName}`, ErrorLevel.INFO, 3000);
        addToRecentFiles(filePath);
        
        debugLog('ファイル', `ファイル関連付けから読み込み完了: ${fileName}`);
    } catch (error) {
        console.error('ファイル読み込みエラー:', error);
        showErrorToast(`ファイルの読み込みに失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

// グローバルに公開（Rustから呼び出し可能にする）
window.loadFileFromPath = loadFileFromPath;

/**
 * 最近使用したファイルリストに追加
 * @param {string} filePath - 追加するファイルパス
 */
function addToRecentFiles(filePath) {
    if (!filePath) return;
    const supportedExts = ['.ditis', '.sts', '.tdts', '.xdts'];
    if (!supportedExts.some(ext => filePath.toLowerCase().endsWith(ext))) return;
    const list = AppState.recentFiles || [];
    const filtered = list.filter(p => p !== filePath);
    AppState.recentFiles = [filePath, ...filtered].slice(0, 10);
    saveToLocalStorage();
    if (window.triggerMenuRebuild) {
        window.triggerMenuRebuild();
    }
}

// Tauriイベントリスナー（ファイル関連付けからの起動時）
if (window.__TAURI__ && window.__TAURI__.event) {
    let lastOpenFilePath = null;
    let lastOpenFileTime = 0;
    window.__TAURI__.event.listen('open-file', (event) => {
        const now = Date.now();
        // 同じファイルが1.5秒以内に再度開かれた場合は無視（重複イベント防止）
        if (event.payload === lastOpenFilePath && now - lastOpenFileTime < 1500) return;
        lastOpenFilePath = event.payload;
        lastOpenFileTime = now;
        const filePath = event.payload;
        if (filePath && window.loadFileFromPath) {
            window.loadFileFromPath(filePath);
        }
    });

    // CSP連携モードイベントリスナー（CLI引数でXDTSファイルを開いた場合）
    window.__TAURI__.event.listen('csp-sync-mode', (event) => {
        const filePath = event.payload;
        if (filePath) {
            AppState.cspSyncMode = true;
            AppState.cspSyncFilePath = filePath;
            console.log('[CSP連携] 自動保存モード有効化:', filePath);
            updateStatusBar('CSP連携モード: 編集内容を自動保存します');
            updateCspSyncIndicator(true);
        }
    });
}

// ========================================
// CSP連携 自動保存機能
// ========================================

let cspAutoSaveTimer = null;
const CSP_AUTOSAVE_DEBOUNCE_MS = 300;
let cspAutoSaveInProgress = false;

/**
 * CSP連携モード用の自動保存をトリガー（デバウンス付き）
 * saveHistory()から呼ばれる
 */
function triggerCspAutoSave() {
    if (!AppState.cspSyncMode || !AppState.cspSyncFilePath) return;

    // デバウンス: 前回のタイマーをクリアして新しいタイマーを設定
    if (cspAutoSaveTimer) {
        clearTimeout(cspAutoSaveTimer);
    }

    cspAutoSaveTimer = setTimeout(async () => {
        await executeCspAutoSave();
    }, CSP_AUTOSAVE_DEBOUNCE_MS);
}

/**
 * CSP連携モード用の自動保存を実行
 */
async function executeCspAutoSave() {
    if (cspAutoSaveInProgress) return;
    cspAutoSaveInProgress = true;

    try {
        const currentSheet = getCurrentSheet();
        if (!currentSheet) return;

        const filePath = AppState.cspSyncFilePath;
        const ext = filePath.toLowerCase();

        if (ext.endsWith('.xdts')) {
            await saveXdtsFileInternal(filePath, currentSheet);
        } else if (ext.endsWith('.tdts')) {
            await saveTdtsFileInternal(filePath, currentSheet);
        } else {
            // fallback: ditis形式で保存
            const json = buildDitisJson(currentSheet);
            await window.TauriAPI.saveFile(filePath, json);
        }

        console.log('[CSP連携] 自動保存完了:', filePath);
        updateCspSyncIndicator(true, '保存済み');
    } catch (error) {
        console.error('[CSP連携] 自動保存エラー:', error);
        updateCspSyncIndicator(true, 'エラー');
    } finally {
        cspAutoSaveInProgress = false;
    }
}

/**
 * CSP連携インジケーターを更新
 * @param {boolean} active - CSP連携モードが有効か
 * @param {string} [status] - 追加ステータステキスト
 */
function updateCspSyncIndicator(active, status) {
    let indicator = document.getElementById('csp-sync-indicator');
    if (!indicator) {
        // インジケーターが存在しない場合は作成
        const statusBar = document.querySelector('.status-bar') || document.getElementById('status-bar');
        if (!statusBar) return;
        indicator = document.createElement('span');
        indicator.id = 'csp-sync-indicator';
        indicator.style.cssText = 'margin-left: 8px; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: bold;';
        statusBar.appendChild(indicator);
    }

    if (active) {
        const statusText = status ? ` (${status})` : '';
        indicator.textContent = `CSP連携${statusText}`;
        indicator.style.backgroundColor = status === 'エラー' ? '#e74c3c' : '#2ecc71';
        indicator.style.color = '#fff';
        indicator.style.display = 'inline-block';

        // 「保存済み」表示は2秒後にデフォルトに戻す
        if (status === '保存済み') {
            setTimeout(() => {
                if (indicator) {
                    indicator.textContent = 'CSP連携';
                    indicator.style.backgroundColor = '#2ecc71';
                }
            }, 2000);
        }
    } else {
        indicator.style.display = 'none';
    }
}

// グローバルに公開（history.jsから呼び出し可能にする）
window.triggerCspAutoSave = triggerCspAutoSave;
