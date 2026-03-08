/**
 * ===================================================================
 * app.js - デジタルタイムシート メインアプリケーション
 * ===================================================================
 * 
 * このファイルはアプリケーションのコア機能を統括します。
 * 各モジュール（render.js、edit.js、frameOps.js等）と連携し、
 * 全体の動作を制御します。
 * 
 * 【主要機能】
 * - アプリケーション初期化
 * - シート管理（作成・切り替え・削除）
 * - イベントリスナー設定
 * - キーボード操作処理
 * - 右クリックメニュー
 * - ファイル入出力
 * - LocalStorage永続化
 * 
 * 【依存モジュール】
 * - constants.js: 定数定義
 * - utils.js: ユーティリティ関数
 * - history.js: Undo/Redo機能
 * - selection.js: セル選択処理
 * - export.js: ExtendScript出力
 * - render.js: 描画処理
 * - edit.js: セル編集処理
 * - frameOps.js: フレーム操作
 * ===================================================================
 */

// Tauri menu handler - グローバルに早期定義
window.handleMenuEvent = null; // プレースホルダー

// ========================================
// グローバル状態管理
// ========================================
/**
 * アプリケーションの全状態を管理するグローバルオブジェクト
 * すべての機能がこのオブジェクトを参照・更新します
 */
const AppState = {
    sheets: [],
    currentSheetIndex: 0,
    // fps は getCurrentSheet().fps に委譲（下部のgetter/setterで定義）
    history: [],
    historyIndex: -1,
    maxHistory: CONSTANTS.MAX_HISTORY,
    selectedCells: [],
    editingCell: null,
    justFinishedEditing: false, // 編集完了直後フラグ（二重処理防止用）
    clipboard: null,
    isDragging: false,
    dragStart: null,
    selectionAnchor: null, // Shift選択用のアンカー
    isDraggingRow: false, // 行ドラッグ中フラグ
    dragStartRow: null, // 行ドラッグ開始行
    isDraggingColumn: false, // 列ドラッグ中フラグ
    dragStartColumn: null, // 列ドラッグ開始列
    draggedTabIndex: null, // タブドラッグ中のインデックス
    originalSelectionSize: 0, // W/A/S/D一時選択用のサイズのみ保存
    originalSelectionRows: 0, // W/A/S/D一時選択用の行数
    originalSelectionCols: 0, // W/A/S/D一時選択用の列数
    originalSelectionMinFrame: 0, // W/A/S/D一時選択用の開始フレーム
    originalSelectionMinLayerIndex: 0, // W/A/S/D一時選択用の開始レイヤーインデックス
    isWPressed: false, // W押下状態
    isAPressed: false, // A押下状態
    isSPressed: false, // S押下状態
    isDPressed: false, // D押下状態
    isWUsed: false, // 現セッションでW使用済み
    isAUsed: false, // 現セッションでA使用済み
    isSUsed: false, // 現セッションでS使用済み
    isDUsed: false, // 現セッションでD使用済み
    frameFilter: 'all', // フレーム表示フィルター
    headerDisplayMode: 'detail', // ヘッダー表示モード: 'detail' = 詳細, 'simple' = 6コマ表示
    editingHandledPlusMinus: false, // 編集中の+/-処理済みフラグ
    debugMode: false, // デバッグモード
    debugLogs: [], // デバッグログ履歴
    maxDebugLogs: 1000, // 最大ログ保存数
    theme: 'green', // テーマ: 'light', 'dark', 'green'
    currentFilePath: null, // 現在読み込まれているファイルのパス
    fontSize: 12, // フォントサイズ: 8, 10, 12, 14, 16
    alwaysOnTop: false, // 常に前面に表示
    aeMultiInstanceMode: false, // AEの複数インスタンス対応 (true: メニュー自動化, false: -r フラグ)
    showIntermediateHeaders: false, // 列間にフレームヘッダーを表示
    autoScrollToSelection: true, // カーソル位置に自動スクロール
    showNewSheetDialog: true, // 新規シート作成時にダイアログを表示
    reopenLastFile: false, // 起動時に前回のシート状態を復元する
    numericKeyMode: 'auto', // 数字キーの動作: 'auto'|'column-select'|'number-input'
    copyKeyframeMode: 'sparse', // コピーキーフレームモード: 'sparse'|'all-frames'
    emptyCellMode: false, // 空セルモード: 下矢印で×を入力してから移動
    aeKeyframeVersion: '9.0', // クリップボードにコピーするキーフレームデータのAEバージョン
    recentFiles: [], // 最近使用したファイル（最大10件）
    
    // 仮想スクロール用
    viewport: {
        startRow: 0,
        endRow: 0,
        startCol: 0,
        endCol: 0,
        rowBuffer: 10, // 上下の余裕行数
        colBuffer: 3   // 左右の余裕列数
    },
    
    // 差分レンダリング用
    cellCache: new Map(), // セルの前回の状態をキャッシュ
    lastRenderTime: 0, // 最後のレンダリング時刻
    
    // 特殊表示キャッシュ（仮想スクロール最適化用）
    specialDisplayCache: new Map(), // レイヤーごとの特殊表示情報
    
    // validFrameCountキャッシュ（パフォーマンス最適化用）
    validFrameCountCache: null // { upToFrame: number -> count: number }
};

// テスト・デバッグ用にwindowオブジェクトに公開
window.AppState = AppState;

// fps は現在シートのfpsに委譲（シート単位管理）
Object.defineProperty(AppState, 'fps', {
    get() {
        const sheet = this.sheets[this.currentSheetIndex];
        return sheet ? (sheet.fps ?? 24) : 24;
    },
    set(v) {
        const sheet = this.sheets[this.currentSheetIndex];
        if (sheet) sheet.fps = v;
    },
    enumerable: true,
    configurable: true
});

// ========================================
// デバッグ機能
// ========================================
/**
 * デバッグログを記録・管理する関数群
 * デバッグモードON時のみログを記録し、後で確認・エクスポート可能
 */

/**
 * デバッグログを記録
 * @param {string} category - ログのカテゴリ（例: '編集', '表示', '処理'）
 * @param {string} message - ログメッセージ
 * @param {any} data - 追加データ（オプション）
 */
function debugLog(category, message, data) {
    // デバッグモードONの場合のみコンソール出力とログ蓄積
    if (AppState.debugMode) {
        const log = {
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString('ja-JP'),
            category: category,
            message: message,
            data: data
        };
        
        AppState.debugLogs.push(log);
        
        if (AppState.debugLogs.length > AppState.maxDebugLogs) {
            AppState.debugLogs.shift();
        }
        
        if (data !== undefined) {
            console.log(`[${category}] ${message}`, data);
        } else {
            console.log(`[${category}] ${message}`);
        }
    }
}

// デバッグログを取得する関数（コンソールから呼び出し可能）
function getDebugLogs(category = null, limit = 100) {
    let logs = AppState.debugLogs;
    if (category) {
        logs = logs.filter(log => log.category === category);
    }
    return logs.slice(-limit);
}

// デバッグログをクリア
function clearDebugLogs() {
    AppState.debugLogs = [];
    console.log('デバッグログをクリアしました');
}


// ========================================
// 初期化処理
// ========================================
/**
 * DOMContentLoaded時の初期化シーケンス
 * 1. LocalStorageからデータ復元
 * 2. アプリケーション初期化
 * 3. イベントリスナー設定
 * 4. 初期レンダリング
 */
// デバッグログをエクスポート
async function exportDebugLogs() {
    const json = JSON.stringify(AppState.debugLogs, null, 2);
    
    // Tauri版の場合は保存ダイアログを表示
    if (window.TauriAPI && window.TauriAPI.isRunningInTauri()) {
        try {
            const defaultPath = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            const filePath = await window.TauriAPI.saveTextFile(json, {
                defaultPath: defaultPath,
                filters: [{
                    name: 'JSON',
                    extensions: ['json']
                }]
            });
            
            if (filePath) {
                updateStatusBar('デバッグログを出力しました');
                console.log('デバッグログを出力しました:', filePath);
            }
        } catch (error) {
            console.error('ログ出力エラー:', error);
            updateStatusBar('ログの出力に失敗しました');
        }
    } else {
        // ブラウザ版の場合は従来通り
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        updateStatusBar('デバッグログを出力しました');
        console.log('デバッグログを出力しました');
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    // グローバルエラーハンドラーをセットアップ
    setupGlobalErrorHandlers();
    
    // ブラウザのデフォルト右クリックメニューを全体的に禁止
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    loadFromLocalStorage();
    // reopenLastFile=false の場合はシートデータをリセット（設定は保持）
    if (!AppState.reopenLastFile) {
        AppState.sheets = [];
    }
    
    // initAppを非同期で実行
    initApp().then(() => {
        setupEventListeners();
        
        // ページロード後、初回は全体レンダリング（キャッシュ構築）
        setTimeout(() => {
            renderSpreadsheet(true);
            selectA1(); // 初期選択を確実に実行
            updateStatusBar();
            setupCellInfoDoubleClick(); // DOM構築後に実行
        }, 100);
    });
});

/**
 * アプリケーション初期化
 * デフォルトシートの作成、イベントリスナーの設定、初期レンダリングを行う
 */
async function initApp() {
    // テーマ初期化（システム設定または保存された設定を適用）
    initializeTheme();
    
    // 多言語UI初期化（メニュー再構築とチェックマーク復元を含む）
    await initializeI18n();
    
    // デフォルトシート作成
    if (AppState.sheets.length === 0) {
        createNewSheet('Sheet1');
    }
    
    // フォントサイズ初期化（sheetが作成された後に実行）
    initializeFontSize();
    
    // メニューのチェックマークを初期化
    updateMenuCheckmarks();

    renderTabs();
    renderSpreadsheet(true); // 初回は全体レンダリング
    
    // ステータスバーを初期化（言語が設定された後）
    updateStatusBar();
    
    
    // 初期状態を履歴に保存（loadFromLocalStorageの後、最初の操作の前）
    if (AppState.history.length === 0) {
        saveHistory();
        debugLog('初期化', '初期状態を履歴に保存しました');
    }
    
    // 起動時に更新をチェック（Tauri環境でのみ）
    if (window.__TAURI__ && window.UpdaterAPI) {
        // アップデート後の初回起動通知
        window.UpdaterAPI.checkJustUpdated();
        setTimeout(() => {
            window.UpdaterAPI.checkUpdatesOnStartup();
        }, 3000); // 起動後3秒待ってチェック
    }
    
    // スクロールイベント（スロットル制御）
    const container = document.getElementById('spreadsheet');
    if (container) {
        let scrollTimeout;
        container.addEventListener('scroll', () => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                calculateViewport();
                renderSpreadsheet();
            }, 16); // 約60fps
        });
        debugLog('処理', 'スクロールイベント登録完了');
    }


    // A1を初期選択
    selectA1();
    
    // 非Tauri環境用: ファイル入力のchangeイベントを接続
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                loadFromFile(e);
                e.target.value = ''; // 同じファイルを再度選択可能にする
            }
        });
    }
    
    // ウィンドウタイトルを初期化
    await updateWindowTitle();
}


/**
 * メニューを現在のAppStateで再構築するヘルパー関数
 */
async function triggerMenuRebuild() {
    if (window.TauriAPI && window.TauriAPI.rebuildMenu) {
        const currentLang = getCurrentLanguage ? getCurrentLanguage() : 'ja';
        try {
            await window.TauriAPI.rebuildMenu(
                currentLang,
                AppState.theme || 'green',
                AppState.frameFilter || 'all',
                AppState.headerDisplayMode || 'detail',
                AppState.fontSize || 12,
                AppState.debugMode || false,
                AppState.alwaysOnTop || false,
                AppState.autoScrollToSelection !== false,
                AppState.showNewSheetDialog || false,
                AppState.showIntermediateHeaders || false,
                AppState.reopenLastFile || false,
                AppState.numericKeyMode || 'auto',
                AppState.copyKeyframeMode || 'sparse',
                AppState.emptyCellMode || false,
                AppState.aeMultiInstanceMode !== false,
                AppState.recentFiles || []
            );
        } catch (error) {
            console.warn('[triggerMenuRebuild] エラー:', error);
        }
    }
}
window.triggerMenuRebuild = triggerMenuRebuild;

/**
 * 多言語UIテキストを初期化
 */
async function initializeI18n() {
    const currentLang = getCurrentLanguage();
            
    // HTMLのUIテキストを更新
    updateAllUIText();
    
    // Tauriメニューを現在の設定で再構築（起動時のチェックマーク復元）
    // Rust側のsetupが完了するのを待つため少し遅延を入れる
    if (window.TauriAPI && window.TauriAPI.rebuildMenu) {
        try {
            // setup完了を確実にするため少し待機
            await new Promise(resolve => setTimeout(resolve, 100));
            await triggerMenuRebuild();
        } catch (error) {
            console.error('[initializeI18n] メニュー再構築エラー:', error);
        }
    } else {
        console.warn('[initializeI18n] TauriAPI.rebuildMenuが利用できません');
    }
    
        
    debugLog('初期化', `言語を初期化: ${currentLang}`);
}


// セルイベント設定
// ========================================
// セルイベント処理
// ========================================
/**
 * セルのクリック・ダブルクリック・マウスイベントを処理
 * ドラッグ選択、編集開始などのユーザー操作を受け付ける
 */

/**
 * セルのマウスダウンイベント処理
 * - 通常クリック: セル選択開始
 * - Shift+クリック: 範囲選択
 * - 右クリック: メニュー表示（選択は変更しない）
 * @param {HTMLElement} cell - セル要素
 * @param {MouseEvent} event - マウスイベント
 */
function handleCellMouseDown(cell, event) {
    if (AppState.editingCell) return;
    
    // 右クリックの場合は選択を変更しない
    if (event.button === 2) return;
    
    const frame = parseInt(cell.dataset.frame);
    const layerId = cell.dataset.layer; // "L1" などの文字列IDをそのまま使用
    
    if (event.ctrlKey) {
        // 複数選択
        toggleCellSelection(cell, frame, layerId);
    } else if (event.shiftKey && AppState.selectedCells.length > 0) {
        // 範囲選択
        selectRange(AppState.selectedCells[0], { cell, frame, layerId });
    } else {
        // 単一選択とドラッグ開始
        clearSelection();
        selectCell(cell, frame, layerId);
        AppState.isDragging = true;
        AppState.dragStart = { cell, frame, layerId };
                AppState.selectionAnchor = null; // アンカーをクリア
    }
    
    updateStatusBar();
}

/**
 * セルのマウスエンター（ドラッグ選択）処理
 * @param {HTMLElement} cell - セル要素
 * @param {MouseEvent} event - マウスイベント
 */
function handleCellMouseEnter(cell, event) {
    // ドラッグ中のみ処理
    if (!AppState.isDragging || !AppState.dragStart) return;
    
    const frame = parseInt(cell.dataset.frame);
    const layerId = cell.dataset.layer; // "L1" などの文字列IDをそのまま使用
    
    // ドラッグ開始位置から現在位置まで選択
    selectRange(AppState.dragStart, { cell, frame, layerId });
    updateStatusBar();
}

function handleCellClick(cell, event) {
    // クリックイベントは mousedown/mouseup で処理されるため、ここでは何もしない
    // ダブルクリックは別途処理
}

// セル編集
// キー入力で編集開始
/**
 * キー入力で編集を開始
 * 数字キーが押された時に呼ばれ、その数字を初期値として編集モードに入る
 * @param {HTMLElement} cell - セル要素
 * @param {string} key - 入力されたキー
 */
/**
 * キー入力で編集を開始する
 * @param {HTMLElement} cell - 編集対象のセル要素
 * @param {string} key - 入力されたキー
 */
function startEditingWithKey(cell, key) {
    if (AppState.editingCell) return;

    // フレーム番号とレイヤーIDのバリデーション
    const frame = parseInt(cell.dataset.frame);
    const layerId = cell.dataset.layer; // "L1" などの文字列IDをそのまま使用
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    
    if (!validateFrame(frame, maxRows)) return;
    if (!validateLayerId(layerId, sheet.layers)) return;

    // 複数選択されているかを保存（DOM参照ではなくデータのみ）
    const isMultiSelection = AppState.selectedCells.length > 1;
    const selectedCellsBackup = AppState.selectedCells.map(s => ({
        frame: s.frame,
        layerId: s.layerId
    }));

    // 実データから値を取得（表示値'-'ではなく実際の値を使用）
    const actualValue = (sheet.data[frame] && sheet.data[frame][layerId] !== undefined)
        ? String(sheet.data[frame][layerId])
        : '';

    AppState.editingCell = {
        cell,
        frame: frame,
        layerId: layerId,
        originalValue: actualValue,
        isMultiSelection: isMultiSelection,
        selectedCellsBackup: selectedCellsBackup
    };
    
    cell.classList.add('editing');
    cell.innerHTML = `<input type="text" value="${escapeHtml(key)}" maxlength="10">`;
    
    const input = cell.querySelector('input');
    input.focus();
    // カーソルを末尾に移動
    input.setSelectionRange(1, 1);
    
    input.addEventListener('blur', () => {
        finishEditing(true);
    });
    
    input.addEventListener('keydown', (e) => {
        handleEditKeydown(e);
    });
}


async function renameLayer(layerId) {
    const sheet = getCurrentSheet();
    
    // バリデーション：layerId が有効か確認
    if (!validateLayerId(layerId, sheet.layers)) {
        return;
    }
    
    const layer = sheet.layers.find(l => l.id === layerId);

    if (layer) {
        const newName = await showRenameLayerDialog(layer.name);
        if (newName && newName.trim()) {
            layer.name = newName.trim();
            saveHistory('列名変更');
            renderSpreadsheet(true);
        }
    }
}

async function renameLayerFromSelection() {
    if (AppState.selectedCells.length === 0) return;

    const sheet = getCurrentSheet();
    const layerId = AppState.selectedCells[0].layerId;
    
    if (!validateLayerId(layerId, sheet.layers)) {
        return;
    }
    
    await renameLayer(layerId);
}

// ========================================
// データ操作関数
// ========================================
/**
 * シート全体のデータ操作（クリア、尺変更、フレーム挿入など）
 * フレーム操作以外の基本的なデータ変更処理
 */

/**
 * 現在のシートの全データをクリア
 * 確認ダイアログを表示し、OKの場合のみ実行
 */
/**
 * シートをクリアする
 * - 現在のシートのデータをすべて削除
 */
async function clearSheet() {
    debugLog('操作', '表を初期化 実行');
    
    // 確認ダイアログを表示
    const confirmed = await showConfirmDialog(
        '現在のシートのすべてのデータを削除しますか？'
    );
    
    if (!confirmed) return;
    
    const sheet = getCurrentSheet();
    
    // バリデーション：maxRows が有効か確認
    const maxRows = getMaxVisibleRows(sheet);
    if (!validateFrame(1, maxRows)) {
        return;
    }

    // レイヤーを26列（A-Z）に初期化
    sheet.layers = [];
    for (let i = 0; i < 26; i++) {
        sheet.layers.push({
            id: `L${i + 1}`,
            name: getLayerName(i)
        });
    }

    // 尺・ページサイズをデフォルトにリセット
    sheet.frames = 144;
    sheet.visibleRows = 144;
    sheet.framePageSize = 144;

    // 全データをクリア
    sheet.data = {};
    for (let frame = 1; frame <= sheet.frames; frame++) {
        if (!validateFrame(frame, sheet.frames)) {
            continue;
        }
        
        sheet.data[frame] = {};
        sheet.layers.forEach(layer => {
            if (!validateLayerId(layer.id, sheet.layers)) {
                return;
            }
            sheet.data[frame][layer.id] = '';
        });
    }
    
    // 挿入フレームの記録もクリア
    sheet.insertedFrames = [];
    
    // 無効化フレームもクリア
    sheet.disabledFrames = [];
    
    // キャッシュをクリアして全体レンダリング
    saveHistory('シートクリア');
    AppState.specialDisplayCache.clear();
    AppState.validFrameCountCache = null;
    renderSpreadsheet(true);
    
    // A1を選択状態にする
    clearSelection();
    selectA1();
    
    saveToLocalStorage();
    
    updateStatusBar('表を初期化しました');
    
    // Undo/Redoボタンの状態を更新
    updateUndoRedoButtons();
}

/**
 * 現在のシートを削除する。シートが1枚の場合はデフォルトシートに置き換える。
 */
async function deleteCurrentSheet() {
    const sheet = getCurrentSheet();
    const confirmed = await showConfirmDialog(
        `シート「${sheet.name}」を削除しますか？\n保存していないデータは失われます。`
    );
    if (!confirmed) return;

    if (AppState.sheets.length === 1) {
        // 最後の1枚はデフォルトシートに置き換え
        createNewSheet('Sheet1');
        AppState.sheets.splice(0, 1);
        AppState.currentSheetIndex = 0;
    } else {
        AppState.sheets.splice(AppState.currentSheetIndex, 1);
        if (AppState.currentSheetIndex >= AppState.sheets.length) {
            AppState.currentSheetIndex = AppState.sheets.length - 1;
        }
    }

    saveHistory('シート削除');
    renderTabs();
    renderSpreadsheet(true);
    clearSelection();
    selectA1();
    saveToLocalStorage();
    updateStatusBar(`シート「${sheet.name}」を削除しました`);
    updateUndoRedoButtons();
}

/**
 * FPSを変更する
 */
async function changeFPS() {
    const newFPS = await showFpsDialog();
    if (newFPS === null) return;
    
    if (!newFPS || newFPS < 1 || newFPS > 120 || !Number.isInteger(newFPS)) {
        showErrorToast('フレームレートは1〜120の整数で指定してください。', ErrorLevel.WARNING);
        return;
    }
    
    AppState.fps = newFPS;
    renderSpreadsheet(true);
    updateStatusBar(`FPSを ${newFPS}fps に変更しました`);
    updateDurationDisplay();
    saveToLocalStorage();
    
    setTimeout(() => updateStatusBar(), 3100);
}

/**
 * フレームページ設定を変更する
 */
async function changeFramePage() {
    const pageSize = await showFramePageDialog();
    if (pageSize === null) return;
    
    const sheet = getCurrentSheet();
    sheet.framePageSize = pageSize;
    
    saveHistory('設定変更');
    renderSpreadsheet(true);
    updateStatusBar(`フレームページを ${pageSize}フレーム に変更しました`);
    saveToLocalStorage();
    
    debugLog('シート', `フレームページ設定: ${pageSize}フレーム`);
    setTimeout(() => updateStatusBar(), 3100);
}

/**
 * 総尺を変更する
 */
async function changeDuration() {
    const totalFrames = await showDurationDialog();
    if (totalFrames === null) return;
    
    const sheet = getCurrentSheet();
    
    // 変更後に履歴保存（後に移動）
    
    // 尺を変更
    sheet.frames = totalFrames;
    sheet.visibleRows = totalFrames;
    
    // 範囲外のdisabledFrames/insertedFramesを除去
    if (sheet.disabledFrames) {
        sheet.disabledFrames = sheet.disabledFrames.filter(f => f <= totalFrames);
    }
    if (sheet.insertedFrames) {
        sheet.insertedFrames = sheet.insertedFrames.filter(f => f <= totalFrames);
    }
    if (sheet.insertedFrameMap) {
        const newMap = {};
        for (const key in sheet.insertedFrameMap) {
            if (parseInt(key) <= totalFrames) {
                newMap[key] = sheet.insertedFrameMap[key];
            }
        }
        sheet.insertedFrameMap = newMap;
    }
    
    // 範囲外のデータを削除
    for (const key in sheet.data) {
        if (parseInt(key) > totalFrames) {
            delete sheet.data[key];
        }
    }
    
    // 新しい尺に合わせてデータを調整
    if (!sheet.data) sheet.data = {};
    for (let frame = 1; frame <= totalFrames; frame++) {
        if (!sheet.data[frame]) {
            sheet.data[frame] = {};
            sheet.layers.forEach(layer => {
                sheet.data[frame][layer.id] = '';
            });
        }
    }
    
    // キャッシュをクリアして全体レンダリング
    saveHistory('尺変更');
    AppState.specialDisplayCache.clear();
    AppState.validFrameCountCache = null;
    renderSpreadsheet(true);
    saveToLocalStorage();
    
    updateStatusBar(`尺を ${Math.floor(totalFrames / AppState.fps)}秒+${totalFrames % AppState.fps}コマ (${totalFrames}フレーム) に変更しました`);
    updateDurationDisplay();
    updateUndoRedoButtons();
}

// 尺変更
/**
 * 現在の状態を履歴に保存
 * Undo/Redo機能のために、シートデータと選択範囲をJSON化して保存
 * 最大100段階まで保存可能
 */
/**
 * Undo（元に戻す）
 * 履歴を一つ前の状態に戻す
 */
/**
 * Redo（やり直し）
 * Undoで戻した状態を再度進める
/**
 * cell-infoにダブルクリックイベントを設定
 * ダブルクリックでフレームレート変更ダイアログを表示
 * （注：現在は使用されていません。FPSコーナーセルでフレームレート変更を実装済み）
 */
function setupCellInfoDoubleClick() {
    // この関数は使用されていません
    // フレームレート変更はrender.jsのFPSコーナーセルで実装されています
}

// ========================================
// Tauriネイティブメニューハンドラ
// ========================================
/**
 * Tauriのネイティブメニューからのイベントを処理
 * Rust側から呼び出されるグローバル関数
 */
window.handleMenuEvent = async function(menuId) {
    // メニューが選択されたらコンテキストメニューを閉じる
    closeAllContextMenus();
    
    // メニューIDに応じて対応する関数を呼び出し
    const handlers = {
        'new-sheet': () => createNewSheetWithPrompt(),
        'open-file': () => loadFromFileTauri(),
        'save-file': () => saveToFile(),
        'save-as-file': () => saveAsFile(),
        'export-jsx': () => exportJSX(),
        'close-file': () => closeFile(),
        'close-all-sheets': () => closeAllSheets(),
        'undo': () => undo(),
        'redo': () => redo(),
        'sheet-settings': async () => await editCurrentSheetSettings(),
        'print-sheet': () => printCurrentSheet(),
        'change-duration': () => changeDuration(),
        'change-fps': () => changeFPS(),
        'change-frame-page': () => changeFramePage(),
        'change-max-columns': async () => await changeMaxColumns(),
        'reset-column-names': () => resetColumnNames(),
        'send-to-ae': () => sendToAfterEffects(),
        'get-from-ae': async () => await getTimeremapFromAE(AppState.aeMultiInstanceMode !== false),
        'clear-sheet': async () => await clearSheet(),
        'reload-page': () => {
                        location.reload();
        },
        'frame-filter-all': async () => {
            setFrameFilter('all');
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('frame-filter-all', true);
                await window.TauriAPI.updateMenuItemCheck('frame-filter-odd', false);
                await window.TauriAPI.updateMenuItemCheck('frame-filter-even', false);
            }
        },
        'frame-filter-odd': async () => {
            setFrameFilter('odd');
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('frame-filter-all', false);
                await window.TauriAPI.updateMenuItemCheck('frame-filter-odd', true);
                await window.TauriAPI.updateMenuItemCheck('frame-filter-even', false);
            }
        },
        'frame-filter-even': async () => {
            setFrameFilter('even');
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('frame-filter-all', false);
                await window.TauriAPI.updateMenuItemCheck('frame-filter-odd', false);
                await window.TauriAPI.updateMenuItemCheck('frame-filter-even', true);
            }
        },
        'header-mode-detail': async () => {
            setHeaderDisplayMode('detail');
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('header-mode-detail', true);
                await window.TauriAPI.updateMenuItemCheck('header-mode-simple', false);
            }
        },
        'header-mode-simple': async () => {
            setHeaderDisplayMode('simple');
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('header-mode-detail', false);
                await window.TauriAPI.updateMenuItemCheck('header-mode-simple', true);
            }
        },
        'font-size-xsmall': async () => {
            changeFontSize(8);
            
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('font-size-xsmall', true);
                await window.TauriAPI.updateMenuItemCheck('font-size-small', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-normal', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-large', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
            }
        },
        'font-size-small': async () => {
            changeFontSize(10);
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-small', true);
                await window.TauriAPI.updateMenuItemCheck('font-size-normal', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-large', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
            }
        },
        'font-size-normal': async () => {
            changeFontSize(12);
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-small', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-normal', true);
                await window.TauriAPI.updateMenuItemCheck('font-size-large', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
            }
        },
        'font-size-large': async () => {
            changeFontSize(14);
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-small', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-normal', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-large', true);
                await window.TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
            }
        },
        'font-size-xlarge': async () => {
            changeFontSize(16);
            
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-small', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-normal', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-large', false);
                await window.TauriAPI.updateMenuItemCheck('font-size-xlarge', true);
            }
        },
        'show-new-sheet-dialog': async () => {
            AppState.showNewSheetDialog = !AppState.showNewSheetDialog;
            saveToLocalStorage();
            
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('show-new-sheet-dialog', AppState.showNewSheetDialog);
            }
        },
        'reopen-last-file': async () => {
            AppState.reopenLastFile = !AppState.reopenLastFile;
            saveToLocalStorage();
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('reopen-last-file', AppState.reopenLastFile);
            }
        },
        'numeric-key-mode-auto': async () => {
            AppState.numericKeyMode = 'auto';
            saveToLocalStorage();
            await triggerMenuRebuild();
        },
        'numeric-key-mode-column': async () => {
            AppState.numericKeyMode = 'column-select';
            saveToLocalStorage();
            await triggerMenuRebuild();
        },
        'numeric-key-mode-input': async () => {
            AppState.numericKeyMode = 'number-input';
            saveToLocalStorage();
            await triggerMenuRebuild();
        },
        'copy-keyframe-mode-sparse': async () => {
            AppState.copyKeyframeMode = 'sparse';
            saveToLocalStorage();
            await triggerMenuRebuild();
        },
        'copy-keyframe-mode-all-frames': async () => {
            AppState.copyKeyframeMode = 'all-frames';
            saveToLocalStorage();
            await triggerMenuRebuild();
        },
        'empty-cell-mode': async () => {
            AppState.emptyCellMode = !AppState.emptyCellMode;
            saveToLocalStorage();
            await triggerMenuRebuild();
        },
        'change-ae-keyframe-version': async () => {
            const current = AppState.aeKeyframeVersion || '9.0';
            const { t } = window.i18n;
            const input = await showInputDialog(
                t('menu.edit.aeKeyframeVersionChange'),
                t('menu.edit.aeKeyframeVersionLabel'),
                current,
                t('menu.edit.aeKeyframeVersionHint', current)
            );
            if (input === null) return; // キャンセル
            const trimmed = input.trim();
            if (!/^\d+(\.\d)?$/.test(trimmed)) {
                showErrorToast(t('menu.edit.aeKeyframeVersionInvalid'), ErrorLevel.WARNING, 3000);
                return;
            }
            AppState.aeKeyframeVersion = trimmed;
            saveToLocalStorage();
            showErrorToast(t('menu.edit.aeKeyframeVersionChanged', trimmed), ErrorLevel.INFO, 2000);
        },
        'toggle-intermediate-headers': async () => {
            AppState.showIntermediateHeaders = !AppState.showIntermediateHeaders;
            saveToLocalStorage();
            renderSpreadsheet();
            
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('toggle-intermediate-headers', AppState.showIntermediateHeaders);
            }
        },
        'reset-view-settings': async () => {
                        resetViewSettings();
            
            // Tauriメニューを再構築（デフォルト設定で）
            await triggerMenuRebuild();
        },
        'language-ja': async () => {
            setLanguage('ja');
            updateAllUIText();
            updateStatusBar();
            await triggerMenuRebuild();
        },
        'language-en': async () => {
            setLanguage('en');
            updateAllUIText();
            updateStatusBar();
            await triggerMenuRebuild();
        },
        'theme-light': async () => {
                        setTheme('light');
                        
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('theme-light', true);
                await window.TauriAPI.updateMenuItemCheck('theme-dark', false);
                await window.TauriAPI.updateMenuItemCheck('theme-green', false);
            }
        },
        'theme-dark': async () => {
                        setTheme('dark');
                        
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('theme-light', false);
                await window.TauriAPI.updateMenuItemCheck('theme-dark', true);
                await window.TauriAPI.updateMenuItemCheck('theme-green', false);
            }
        },
        'theme-green': async () => {
                        setTheme('green');
                        
            // Tauriメニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('theme-light', false);
                await window.TauriAPI.updateMenuItemCheck('theme-dark', false);
                await window.TauriAPI.updateMenuItemCheck('theme-green', true);
            }
        },
        'always-on-top': async () => {
            // 状態をトグル
            AppState.alwaysOnTop = !AppState.alwaysOnTop;
                        
            // Tauriウィンドウの設定を変更
            if (window.TauriAPI && window.TauriAPI.setAlwaysOnTop) {
                await window.TauriAPI.setAlwaysOnTop(AppState.alwaysOnTop);
            }
            
            // メニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('always-on-top', AppState.alwaysOnTop);
            }
            
            // ステータスバーに表示
            updateStatusBar(`常に前面に表示: ${AppState.alwaysOnTop ? 'ON' : 'OFF'}`);
        },
        'ae-multi-instance-mode': async () => {
            AppState.aeMultiInstanceMode = !AppState.aeMultiInstanceMode;

            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('ae-multi-instance-mode', AppState.aeMultiInstanceMode);
            }

            saveToLocalStorage();
            updateStatusBar(`複数インスタンス起動に対応する: ${AppState.aeMultiInstanceMode ? 'ON' : 'OFF'}`);
        },
        'auto-scroll': async () => {
            // 状態をトグル
            AppState.autoScrollToSelection = !AppState.autoScrollToSelection;
                        
            // 設定を保存
            saveToLocalStorage();
            
            // メニューのチェック状態を更新
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('auto-scroll', AppState.autoScrollToSelection);
            }
            
            const i18n = window.i18n || {};
            updateStatusBar(`${i18n.autoScrollStatus || 'Auto scroll'}: ${AppState.autoScrollToSelection ? 'ON' : 'OFF'}`);
        },
        'show-help': () => {
            const helpDialog = document.getElementById('help-dialog');
            if (helpDialog) {
                const helpContent = helpDialog.querySelector('.help-content');
                if (helpContent && typeof generateHelpHTML === 'function') {
                    const closeBtn = helpContent.querySelector('.close-button');
                    helpContent.innerHTML = '';
                    if (closeBtn) {
                        helpContent.appendChild(closeBtn);
                    } else {
                        helpContent.innerHTML = '<span class="close-button" id="close-help">&times;</span>';
                    }
                    helpContent.innerHTML += generateHelpHTML();
                    const newCloseBtn = helpContent.querySelector('.close-button');
                    if (newCloseBtn) {
                        newCloseBtn.addEventListener('click', () => {
                            helpDialog.style.display = 'none';
                        });
                    }
                }
                helpDialog.style.display = 'flex';
            }
        },
        'show-about': () => {
            const about = i18n[getCurrentLanguage()].about;
            const ver = window.DITIS_VERSION || 'v2026.02.22';
            const build = window.DITIS_BUILD ?? '';
            const title = `DiTiS - ${ver} (build ${build})`;
            alert(`${title}\n\n${about.description}`);
        },
        'open-website': async () => {
            if (window.TauriAPI) {
                await window.__TAURI__.core.invoke('open_url', { url: 'https://sunrisemoon.net/program/ditis/' });
            }
        },
        'open-github': async () => {
            if (window.TauriAPI) {
                await window.__TAURI__.core.invoke('open_url', { url: 'https://github.com/MisakiAkatsuki/ditis' });
            }
        },
        'open-releases': async () => {
            if (window.TauriAPI) {
                await window.__TAURI__.core.invoke('open_url', { url: 'https://github.com/MisakiAkatsuki/ditis/releases' });
            }
        },
        'check-updates': async () => {
            const dialog = document.getElementById('release-notes-dialog');
            const titleEl = document.getElementById('release-notes-title');
            const banner = document.getElementById('release-notes-update-banner');
            const body = document.getElementById('release-notes-body');

            // ダイアログを先に開いてローディング表示
            titleEl.textContent = '更新内容';
            banner.style.display = 'none';
            body.innerHTML = '<p style="color: var(--text-secondary)">読み込み中...</p>';
            const closeBtn = document.getElementById('close-release-notes');
            closeBtn.onclick = () => { dialog.style.display = 'none'; };
            dialog.onclick = (e) => { if (e.target === dialog) dialog.style.display = 'none'; };
            dialog.style.display = 'flex';
            updateStatusBar('更新を確認中...');

            try {
                // 更新チェックとリリースノート取得を並列実行
                const [releaseRes, updateResult] = await Promise.all([
                    fetch('https://api.github.com/repos/MisakiAkatsuki/ditis/releases/latest').catch(() => null),
                    (async () => {
                        if (!window.UpdaterAPI) return { updateInfo: null, currentVersion: null };
                        const [updateInfo, currentVersion] = await Promise.all([
                            window.UpdaterAPI.checkForUpdates(true).catch(() => false),
                            window.UpdaterAPI.getCurrentVersion().catch(() => null),
                        ]);
                        return { updateInfo, currentVersion };
                    })(),
                ]);

                const releaseData = (releaseRes && releaseRes.ok) ? await releaseRes.json() : null;
                const { updateInfo, currentVersion } = updateResult;

                // タイトル
                titleEl.textContent = releaseData?.tag_name ? `更新内容 - ${releaseData.tag_name}` : '更新内容';

                // 更新状況バナー
                banner.style.display = '';
                if (updateInfo && updateInfo !== false) {
                    const safeVer = (updateInfo.version || '').replace(/</g, '&lt;');
                    const safeCur = (currentVersion || '').replace(/</g, '&lt;');
                    banner.className = 'release-notes-banner release-notes-banner--available';
                    banner.innerHTML = `<span>新しいバージョン <strong>v${safeVer}</strong> が利用可能です（現在: v${safeCur}）</span>`
                        + `<button id="rn-download-btn">今すぐダウンロード</button>`;
                    document.getElementById('rn-download-btn').onclick = async () => {
                        const success = await window.UpdaterAPI.installUpdate();
                        dialog.style.display = 'none';
                        if (success) {
                            showDialog({
                                title: '再起動',
                                content: '<p>アップデートのインストールが完了しました。再起動しますか？</p>',
                                okText: '今すぐ再起動',
                                cancelText: '後で再起動',
                                onOk: () => window.__TAURI__.process.relaunch(),
                            });
                        }
                    };
                } else if (updateInfo === null) {
                    banner.className = 'release-notes-banner release-notes-banner--latest';
                    banner.textContent = '最新バージョンを使用しています';
                } else {
                    // false = エラー or UpdaterAPI なし
                    banner.style.display = 'none';
                }

                // 更新内容
                const md = releaseData?.body || '（内容なし）';
                body.innerHTML = (typeof marked !== 'undefined')
                    ? marked.parse(md)
                    : md.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

                updateStatusBar('準備完了');
            } catch (e) {
                body.innerHTML = `<p style="color: var(--error-color)">取得に失敗しました: ${e.message}</p>`;
                updateStatusBar('準備完了');
            }
        },
        'auto-check-updates': async () => {
            // 自動チェックのトグル
            if (window.UpdaterAPI) {
                const settings = window.UpdaterAPI.getUpdateSettings();
                const newState = !settings.autoCheckUpdates;
                
                window.UpdaterAPI.toggleAutoCheckUpdates(newState);
                
                // メニューのチェック状態を更新
                if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                    await window.TauriAPI.updateMenuItemCheck('auto-check-updates', newState);
                }
                
                const i18n = window.i18n || { t: (key) => key };
                updateStatusBar(`${i18n.t('menu.help.autoCheckUpdates')}: ${newState ? 'ON' : 'OFF'}`);
            }
        },
        'toggle-debug': async () => {
            AppState.debugMode = !AppState.debugMode;
            updateMenuCheckmarks();
            updateStatusBar(`デバッグモード: ${AppState.debugMode ? 'ON' : 'OFF'}`);
            if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
                await window.TauriAPI.updateMenuItemCheck('toggle-debug', AppState.debugMode);
            }
        },
        'export-logs': async () => {
            await exportDebugLogs();
        },
        'clear-recent-files': async () => {
            AppState.recentFiles = [];
            saveToLocalStorage();
            await triggerMenuRebuild();
        }
    };

    // recent-file-N ハンドラーを動的に登録
    for (let i = 0; i < 10; i++) {
        handlers[`recent-file-${i}`] = async () => {
            const path = AppState.recentFiles && AppState.recentFiles[i];
            if (path && window.loadFileFromPath) {
                await window.loadFileFromPath(path);
            }
        };
    }
    
    const handler = handlers[menuId];
    if (handler) {
                await handler();
            } else {
        console.warn('[メニュー] 未処理のメニューID:', menuId);
    }
};



