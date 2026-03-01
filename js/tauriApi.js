/**
 * Tauri API Wrapper
 * ブラウザ版とTauri版の両方で動作するAPIラッパー
 */

// DOMContentLoaded後に初期化（Tauriスクリプトの読み込みを待つ）
if (typeof window.TauriAPI === 'undefined') {
    // 初期化関数
    const initTauriAPI = () => {
        // Tauri 2.xの検出（複数の方法を試す）
        const isTauri = typeof window.__TAURI__ !== 'undefined' || 
                       typeof window.__TAURI_INTERNALS__ !== 'undefined' ||
                       'ipc' in window;

    /**
     * ファイル保存ダイアログを表示
     * @param {Object} options - オプション
     * @param {string} options.defaultPath - デフォルトのファイル名
     * @param {Array} options.filters - ファイルフィルター
     * @returns {Promise<string|null>} 選択されたパス、キャンセル時はnull
     */
    async function saveFileDialog({ defaultPath = 'timesheet.ditis', filters = [] } = {}) {
        if (isTauri) {
            // Tauri 2.xのinvoke APIを使用
            const filePath = await window.__TAURI_INTERNALS__.invoke('plugin:dialog|save', {
                options: {
                    defaultPath,
                    filters: filters.length > 0 ? filters : [
                        { name: 'DiTiS Files', extensions: ['ditis'] },
                        { name: 'JSON Files', extensions: ['json'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                }
            });
            return filePath;
        } else {
            // ブラウザ版: 従来のダウンロード方式
            return null;
        }
    }

    /**
     * ファイル読み込みダイアログを表示
     * @param {Object} options - オプション
     * @param {Array} options.filters - ファイルフィルター
     * @returns {Promise<string|null>} 選択されたパス、キャンセル時はnull
     */
    async function openFileDialog({ filters = [] } = {}) {
        if (isTauri) {
            const filePath = await window.__TAURI_INTERNALS__.invoke('plugin:dialog|open', {
                options: {
                    multiple: false,
                    filters: filters.length > 0 ? filters : [
                        { name: 'All Supported', extensions: ['ditis', 'json', 'sts', 'tdts', 'xdts'] },
                        { name: 'DiTiS Files', extensions: ['ditis'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                }
            });
            return filePath;
        } else {
            // ブラウザ版: input[type=file]を使用
            return null;
        }
    }

    /**
     * ファイルを保存
     * @param {string} path - 保存先のパス
     * @param {string} contents - 保存する内容
     * @returns {Promise<void>}
     */
    async function saveFile(path, contents) {
        if (isTauri) {
            await window.__TAURI_INTERNALS__.invoke('save_file', { path, contents });
        } else {
            // ブラウザ版: ダウンロード
            const blob = new Blob([contents], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split(/[/\\]/).pop(); // ファイル名のみ抽出
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * ファイルを読み込み
     * @param {string} path - 読み込むファイルのパス
     * @returns {Promise<string>} ファイルの内容
     */
    async function loadFile(path) {
        if (isTauri) {
            return await window.__TAURI_INTERNALS__.invoke('load_file', { path });
        } else {
            throw new Error('ブラウザ版では直接パスからの読み込みは非対応です');
        }
    }

    /**
     * バイナリファイルを読み込み
     * @param {string} path - 読み込むファイルのパス
     * @returns {Promise<Uint8Array>} ファイルの内容（バイナリ）
     */
    async function loadBinaryFile(path) {
        if (isTauri) {
            const data = await window.__TAURI_INTERNALS__.invoke('load_binary_file', { path });
            return new Uint8Array(data);
        } else {
            throw new Error('ブラウザ版では直接パスからの読み込みは非対応です');
        }
    }

    /**
     * バイナリファイルを保存
     * @param {string} path - 保存先のパス
     * @param {Array<number>} contents - 保存する内容（バイナリ配列）
     * @returns {Promise<void>}
     */
    async function saveBinaryFile(path, contents) {
        if (isTauri) {
            await window.__TAURI_INTERNALS__.invoke('save_binary_file', { path, contents });
        } else {
            // ブラウザ版: ダウンロード
            const blob = new Blob([new Uint8Array(contents)], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split(/[/\\]/).pop(); // ファイル名のみ抽出
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    /**
     * テキストファイルを保存ダイアログで保存
     * @param {string} content - 保存する内容（テキスト）
     * @param {Object} options - オプション
     * @param {string} options.defaultPath - デフォルトのファイル名
     * @param {Array} options.filters - ファイルフィルター
     * @returns {Promise<string|null>} 保存されたパス、キャンセル時はnull
     */
    async function saveTextFile(content, { defaultPath = 'file.txt', filters = [] } = {}) {
        if (isTauri) {
            // 保存ダイアログを表示
            const filePath = await saveFileDialog({ defaultPath, filters });
            if (filePath) {
                // ファイルを保存
                await saveFile(filePath, content);
                return filePath;
            }
            return null;
        } else {
            // ブラウザ版: ダウンロード
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultPath;
            a.click();
            URL.revokeObjectURL(url);
            return defaultPath;
        }
    }

    /**
     * フォルダーを開く（ファイルを選択状態で）
     * @param {string} path - ファイルのパス
     * @returns {Promise<void>}
     */
    async function showInFolder(path) {
        if (isTauri) {
            await window.__TAURI_INTERNALS__.invoke('show_in_folder', { path });
        } else {
            alert('この機能はデスクトップアプリ版でのみ利用できます。\n\nTauri版をダウンロードしてご利用ください。');
        }
    }

    /**
     * Tauriで実行中かどうか
     * @returns {boolean}
     */
    function isRunningInTauri() {
        return isTauri;
    }

    /**
     * メニューアイテムのチェック状態を更新
     * @param {string} menuId - メニューアイテムのID
     * @param {boolean} checked - チェック状態
     * @returns {Promise<void>}
     */
    async function updateMenuItemCheck(menuId, checked) {
        if (isTauri) {
            try {
                await window.__TAURI_INTERNALS__.invoke('update_menu_item_check', { menuId, checked });
            } catch (error) {
                // IPCエラーは無視（Rust側で正しく処理されている）
                console.warn('[TauriAPI] IPC error (expected in Tauri v2):', error.message || error);
            }
        }
    }

    /**
     * ウィンドウを常に前面に表示するかを設定
     * @param {boolean} alwaysOnTop - 常に前面に表示するか
     * @returns {Promise<void>}
     */
    async function setAlwaysOnTop(alwaysOnTop) {
        if (isTauri) {
            try {
                await window.__TAURI_INTERNALS__.invoke('set_always_on_top', { alwaysOnTop });
            } catch (error) {
                console.error('[TauriAPI] Error invoking set_always_on_top:', error);
                throw error;
            }
        }
    }

    /**
     * ウィンドウタイトルを設定
     * @param {string} title - ウィンドウタイトル
     * @returns {Promise<void>}
     */
    async function setWindowTitle(title) {
        if (isTauri) {
            try {
                await window.__TAURI_INTERNALS__.invoke('set_window_title', { title });
            } catch (error) {
                console.error('[TauriAPI] Error setting window title:', error);
            }
        } else {
            // ブラウザ版はdocument.titleで設定
            document.title = title;
        }
    }

    /**
     * After Effectsでスクリプトを実行
     * @param {string} scriptContent - 実行するExtendScriptスクリプトの内容
     * @returns {Promise<void>}
     */
    async function executeAfterEffectsScript(scriptContent) {
        if (isTauri) {
            await window.__TAURI_INTERNALS__.invoke('execute_after_effects_script', { 
                scriptContent 
            });
        } else {
            throw new Error('After Effectsスクリプト実行はTauri環境でのみ利用可能です');
        }
    }

    /**
     * 確認ダイアログを表示（はい/いいえ）
     * @param {string} message - メッセージ
     * @param {string} title - タイトル
     * @returns {Promise<boolean>} はいの場合true、いいえの場合false
     */
    async function showConfirmDialog(message, title = '確認') {
        if (isTauri) {
            // Tauri 2.xのaskダイアログ（はい/いいえボタン）
            const result = await window.__TAURI_INTERNALS__.invoke('plugin:dialog|ask', {
                message: message,
                title: title,
                kind: 'warning'
            });
            return result;
        } else {
            // ブラウザ版: 標準confirm
            return confirm(message);
        }
    }

    /**
     * メニューを再構築（言語切り替え・起動時の設定復元用）
     * @param {string} lang - 言語コード ('ja' または 'en')
     * @param {string} theme - テーマ ('light', 'dark', 'green')
     * @param {string} frameFilter - フレームフィルター ('all', 'odd', 'even')
     * @param {string} headerMode - ヘッダーモード ('detail', 'simple')
     * @param {number} fontSize - フォントサイズ (10, 12, 14, 16)
     * @param {boolean} debugMode - デバッグモード
     * @param {boolean} alwaysOnTop - 常に前面に表示
     * @param {boolean} autoScroll - 自動スクロール
     * @returns {Promise<void>}
     */
    async function rebuildMenu(lang, theme, frameFilter, headerMode, fontSize, debugMode, alwaysOnTop, autoScroll, showNewSheetDialog, showIntermediateHeaders, reopenLastFile, numericKeyMode, copyKeyframeMode, emptyCellMode, recentFiles) {
        if (isTauri) {
            try {
                const params = { 
                    lang, 
                    theme,
                    frameFilter,
                    headerMode,
                    fontSize,
                    debugMode,
                    alwaysOnTop,
                    autoScroll,
                    showNewSheetDialog,
                    showIntermediateHeaders,
                    reopenLastFile,
                    numericKeyMode: numericKeyMode || 'auto',
                    copyKeyframeMode: copyKeyframeMode || 'sparse',
                    emptyCellMode: emptyCellMode || false,
                    recentFiles: recentFiles || []
                };
                await window.__TAURI_INTERNALS__.invoke('rebuild_menu', params);
            } catch (error) {
                console.error('[rebuildMenu] メニュー再構築エラー:', error);
            }
        }
    }

    /**
     * After Effectsからタイムリマップデータを取得
     * @returns {Promise<Object>} タイムリマップデータ
     */
    async function getTimeremapFromAE() {
        if (isTauri) {
            try {
                const response = await window.__TAURI_INTERNALS__.invoke('get_timeremap_from_ae');
                
                // 空レスポンスチェック
                if (!response || response.trim() === '') {
                    throw new Error('AEからのレスポンスが空です');
                }
                
                const data = JSON.parse(response);
                
                // エラーレスポンスチェック
                if (data.error) {
                    throw new Error(data.error);
                }
                
                return data;
            } catch (error) {
                console.error('[getTimeremapFromAE] エラー:', error);
                throw error;
            }
        } else {
            throw new Error('この機能はTauri環境でのみ使用できます');
        }
    }

    // グローバルに公開
    window.TauriAPI = {
        saveFileDialog,
        openFileDialog,
        saveFile,
        loadFile,
        loadBinaryFile,
        saveBinaryFile,
        saveTextFile,
        showInFolder,
        isRunningInTauri,
        updateMenuItemCheck,
        setAlwaysOnTop,
        setWindowTitle,
        executeAfterEffectsScript,
        showConfirmDialog,
        rebuildMenu,
        getTimeremapFromAE
    };
    };
    
    // すぐに初期化を実行（__TAURI__が既に利用可能な場合もある）
    initTauriAPI();
}
