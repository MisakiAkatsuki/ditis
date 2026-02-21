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

/**
 * レガシーファイルのlayerIDを文字列形式に移行
 * 数値ID(1,2,3)を文字列ID("L1","L2","L3")に変換し、sheet.dataのキーも更新
 */
function migrateSheetLayerIds(sheet) {
    if (!sheet || !sheet.layers) return;
    
    let needsMigration = false;
    sheet.layers.forEach(layer => {
        if (typeof layer.id === 'number') {
            needsMigration = true;
        }
    });
    
    if (!needsMigration) return;
    
    // layer.id を文字列に変換
    const idMap = {}; // oldId -> newId
    sheet.layers.forEach(layer => {
        if (typeof layer.id === 'number') {
            const newId = `L${layer.id}`;
            idMap[layer.id] = newId;
            layer.id = newId;
        }
    });
    
    // sheet.data のキーも変換
    if (sheet.data && Object.keys(idMap).length > 0) {
        for (const frame in sheet.data) {
            const frameData = sheet.data[frame];
            for (const oldId in idMap) {
                if (frameData.hasOwnProperty(oldId)) {
                    frameData[idMap[oldId]] = frameData[oldId];
                    delete frameData[oldId];
                }
            }
        }
    }
}

// 二重実行防止用のフラグと時間
let lastSaveTime = 0;
const SAVE_DEBOUNCE_MS = 500;

/**
 * 現在のタブのみをJSONファイルとして保存
 * シートにファイルパスがある場合は上書き保存、ない場合はダイアログを表示
 */
async function saveToFile() {
    // 二重実行防止（500ms以内の連続呼び出しをスキップ）
    const now = Date.now();
    if (now - lastSaveTime < SAVE_DEBOUNCE_MS) {
        debugLog('ファイル', '二重実行防止: 保存処理をスキップ');
        return;
    }
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
                    // JSON形式で保存（現在のシートのみ）
                    const data = {
                        version: '1.0',
                        fps: AppState.fps,
                        sheets: [currentSheet]
                    };
                    const json = JSON.stringify(data, null, 2);
                    await window.TauriAPI.saveFile(filePath, json);
                }
                
                currentSheet.filePath = filePath;
                updateWindowTitle();
                updateStatusBar(`シート「${sheetName}」を保存しました: ${filePath}`);
                showErrorToast(`保存しました: ${filePath}`, ErrorLevel.INFO, 3000);
            }
        } catch (error) {
            console.error('ファイル保存エラー:', error);
            showErrorToast(`保存に失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
        }
    } else {
        // ブラウザ版: 従来のダウンロード
        const data = {
            version: '1.0',
            fps: AppState.fps,
            sheets: [currentSheet]
        };
        const json = JSON.stringify(data, null, 2);
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
                    // JSON形式で保存
                    const data = {
                        version: '1.0',
                        fps: AppState.fps,
                        sheets: [currentSheet]
                    };
                    const json = JSON.stringify(data, null, 2);
                    await window.TauriAPI.saveFile(filePath, json);
                }
                
                currentSheet.filePath = filePath;
                updateWindowTitle();
                updateStatusBar(`シート「${sheetName}」を保存しました: ${filePath}`);
                showErrorToast(`保存しました: ${filePath}`, ErrorLevel.INFO, 3000);
            }
        } catch (error) {
            console.error('ファイル保存エラー:', error);
            showErrorToast(`保存に失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
        }
    } else {
        // ブラウザ版: ダウンロード
        const data = {
            version: '1.0',
            fps: AppState.fps,
            sheets: [currentSheet]
        };
        const json = JSON.stringify(data, null, 2);
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
        if (typeof data.fps !== 'number') {
            handleValidationError('fps', data.fps, '数値');
            return;
        }
        
        // ファイルから読み込んだシートを新規タブとして追加
        debugLog('ファイル', `${data.sheets.length}個のシートを新規タブとして追加`);
        
        // 読み込んだシートを既存のシートの後ろに追加
        const startIndex = AppState.sheets.length;
        data.sheets.forEach((sheet, index) => {
            migrateSheetLayerIds(sheet);
            // 最初のシートにのみファイルパスを設定（他はクリア）
            if (index === 0) {
                sheet.filePath = filePath;
            } else {
                sheet.filePath = null;
            }
            AppState.sheets.push(sheet);
        });
        
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
            if (typeof data.fps !== 'number') {
                handleValidationError('fps', data.fps, '数値');
                return;
            }
            
            // ファイルから読み込んだシートを新規タブとして追加
            debugLog('ファイル', `${data.sheets.length}個のシートを新規タブとして追加`);
            
            // 読み込んだシートを既存のシートの後ろに追加
            const startIndex = AppState.sheets.length;
            data.sheets.forEach((sheet, index) => {
                migrateSheetLayerIds(sheet);
                // 最初のシートにのみファイル名を設定
                if (index === 0) {
                    sheet.filePath = file.name;
                }
                AppState.sheets.push(sheet);
            });
            
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
    // 最後の1つのシートは閉じられない
    if (AppState.sheets.length === 1) {
        showErrorToast('最後のシートは閉じられません', ErrorLevel.WARNING, 3000);
        return;
    }
    
    const currentSheet = getCurrentSheet();
    const sheetName = currentSheet.name;
    
    // 確認ダイアログ
    const confirmed = await showConfirmDialog(
        `シート「${sheetName}」を閉じますか？\n保存していないデータは失われます。`
    );
    
    if (!confirmed) {
        return;
    }
    
    debugLog('ファイル', `シート「${sheetName}」を閉じる`);
    
    // 現在のシートを削除
    AppState.sheets.splice(AppState.currentSheetIndex, 1);
    
    // インデックスを調整（削除後、前のシートを表示）
    if (AppState.currentSheetIndex >= AppState.sheets.length) {
        AppState.currentSheetIndex = AppState.sheets.length - 1;
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
            migrateSheetLayerIds(sheet);
            // 最初のシートだけにfilePathを設定（他は個別ファイルとして保存させる）
            if (index === 0) {
                sheet.filePath = filePath;
            } else {
                sheet.filePath = null; // 別ファイルとして保存させる
            }
            AppState.sheets.push(sheet);
        });
        
        if (data.fps) {
            AppState.fps = data.fps;
        }
        
        AppState.currentSheetIndex = startIndex; // 最初に読み込んだシートを選択
        
        renderTabs();
        renderSpreadsheet();
        updateWindowTitle();
        updateStatusBar(`ファイルを読み込みました: ${fileName}`);
        showErrorToast(`読み込みました: ${fileName}`, ErrorLevel.INFO, 3000);
        
        debugLog('ファイル', `ファイル関連付けから読み込み完了: ${fileName}`);
    } catch (error) {
        console.error('ファイル読み込みエラー:', error);
        showErrorToast(`ファイルの読み込みに失敗しました: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

// グローバルに公開（Rustから呼び出し可能にする）
window.loadFileFromPath = loadFileFromPath;

// Tauriイベントリスナー（ファイル関連付けからの起動時）
if (window.__TAURI__ && window.__TAURI__.event) {
    let lastOpenFilePath = null;
    let lastOpenFileTime = 0;
    window.__TAURI__.event.listen('open-file', (event) => {
        const now = Date.now();
        // 同じファイルが1秒以内に再度開かれた場合は無視（重複イベント防止）
        if (event.payload === lastOpenFilePath && now - lastOpenFileTime < 1000) return;
        lastOpenFilePath = event.payload;
        lastOpenFileTime = now;
        const filePath = event.payload;
        if (filePath && window.loadFileFromPath) {
            window.loadFileFromPath(filePath);
        }
    });
}
