/**
 * エラーハンドリングとユーザー通知システム
 * アプリケーション全体のエラー処理を統一的に管理
 */

/**
 * エラーの重要度レベル
 * @enum {string}
 */
const ErrorLevel = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

function repositionToasts() {
    let offset = 20;
    document.querySelectorAll('.error-toast').forEach(el => {
        el.style.top = offset + 'px';
        offset += el.offsetHeight + 8;
    });
}

/**
 * エラートースト通知を表示
 * @param {string} message - エラーメッセージ
 * @param {ErrorLevel} level - エラーレベル
 * @param {number} duration - 表示時間（ミリ秒）
 */
function showErrorToast(message, level = ErrorLevel.ERROR, duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `error-toast error-${level}`;
    toast.textContent = message;

    const existing = document.querySelectorAll('.error-toast');
    const offset = 20 + Array.from(existing).reduce((sum, el) => sum + el.offsetHeight + 8, 0);

    // スタイルを適用
    Object.assign(toast.style, {
        position: 'fixed',
        top: offset + 'px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '4px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        zIndex: '10000',
        maxWidth: '400px',
        fontSize: '14px',
        fontWeight: '500',
        animation: 'slideIn 0.3s ease-out',
        pointerEvents: 'auto',
        cursor: 'pointer'
    });
    
    // レベルに応じた色
    switch (level) {
        case ErrorLevel.INFO:
            toast.style.backgroundColor = '#e3f2fd';
            toast.style.color = '#1976d2';
            toast.style.border = '1px solid #1976d2';
            break;
        case ErrorLevel.WARNING:
            toast.style.backgroundColor = '#fff3e0';
            toast.style.color = '#f57c00';
            toast.style.border = '1px solid #f57c00';
            break;
        case ErrorLevel.ERROR:
            toast.style.backgroundColor = '#ffebee';
            toast.style.color = '#c62828';
            toast.style.border = '1px solid #c62828';
            break;
        case ErrorLevel.CRITICAL:
            toast.style.backgroundColor = '#b71c1c';
            toast.style.color = '#ffffff';
            toast.style.border = '1px solid #b71c1c';
            break;
    }
    
    function removeToast() {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            toast.remove();
            repositionToasts();
        }, 300);
    }

    // クリックで閉じる
    toast.addEventListener('click', removeToast);
    
    document.body.appendChild(toast);
    
    // 自動削除
    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
    
    debugLog('エラー', `トースト表示: [${level}] ${message}`);
}

/**
 * ファイル読み込みエラーのハンドリング
 * @param {Error} error - エラーオブジェクト
 * @param {string} fileName - ファイル名
 */
function handleFileReadError(error, fileName) {
    const message = `ファイル「${fileName}」の読み込みに失敗しました。\nJSON形式が正しいか確認してください。`;
    showErrorToast(message, ErrorLevel.ERROR);
    debugLog('エラー', `ファイル読込失敗: ${fileName}`, error);
    console.error('File read error:', error);
}

/**
 * データバリデーションエラーのハンドリング
 * @param {string} field - フィールド名
 * @param {any} value - 不正な値
 * @param {string} expected - 期待される形式
 */
function handleValidationError(field, value, expected) {
    const message = `データが不正です: ${field}\n期待: ${expected}, 実際: ${value}`;
    showErrorToast(message, ErrorLevel.WARNING);
    debugLog('エラー', `バリデーション失敗: ${field}`, {value, expected});
}

/**
 * DOM要素が見つからない場合のハンドリング
 * @param {string} selector - セレクタ
 * @param {boolean} critical - 致命的エラーかどうか
 * @returns {null}
 */
function handleElementNotFound(selector, critical = false) {
    const level = critical ? ErrorLevel.CRITICAL : ErrorLevel.WARNING;
    const message = critical 
        ? `必須要素が見つかりません: ${selector}`
        : `要素が見つかりません: ${selector}`;
    
    showErrorToast(message, level);
    debugLog('エラー', `DOM要素未発見: ${selector}`);
    
    if (critical) {
        console.error('Critical element not found:', selector);
    }
    
    return null;
}

/**
 * LocalStorageエラーのハンドリング
 * @param {Error} error - エラーオブジェクト
 * @param {string} operation - 操作名（'save' or 'load'）
 */
function handleLocalStorageError(error, operation) {
    const message = operation === 'save'
        ? 'データの自動保存に失敗しました。ブラウザの容量が不足している可能性があります。'
        : 'データの読み込みに失敗しました。';
    
    showErrorToast(message, ErrorLevel.WARNING);
    debugLog('エラー', `localStorage ${operation}失敗`, error);
    console.error('LocalStorage error:', error);
}

/**
 * フレーム番号のバリデーション
 * @param {number} frame - フレーム番号
 * @param {number} maxRows - 最大行数
 * @returns {boolean} - 有効かどうか
 */
function validateFrame(frame, maxRows) {
    if (typeof frame !== 'number' || isNaN(frame)) {
        handleValidationError('フレーム番号', frame, '数値');
        return false;
    }
    if (frame < 1 || frame > maxRows) {
        handleValidationError('フレーム番号', frame, `1-${maxRows}`);
        return false;
    }
    return true;
}

/**
 * レイヤーIDのバリデーション
 * @param {number} layerId - レイヤーID
 * @param {Array} layers - レイヤー配列
 * @returns {boolean} - 有効かどうか
 */
function validateLayerId(layerId, layers) {
    // layerIdは"L1", "L2"などの文字列
    if (typeof layerId !== 'string' || !layerId) {
        handleValidationError('レイヤーID', layerId, '文字列');
        return false;
    }
    if (!layers.find(l => l.id === layerId)) {
        handleValidationError('レイヤーID', layerId, `存在するレイヤーID`);
        return false;
    }
    return true;
}

/**
 * グローバルエラーハンドラーの設定
 */
function setupGlobalErrorHandlers() {
    // 未処理のエラーをキャッチ
    window.addEventListener('error', (event) => {
        showErrorToast('予期しないエラーが発生しました', ErrorLevel.CRITICAL);
        console.error('Unhandled error:', event.error);
    });
    
    // Promise の未処理エラーをキャッチ
    window.addEventListener('unhandledrejection', (event) => {
        showErrorToast('非同期処理でエラーが発生しました', ErrorLevel.ERROR);
        console.error('Unhandled rejection:', event.reason);
    });
    
    debugLog('システム', 'グローバルエラーハンドラー設定完了');
}

// アニメーション用CSS（動的に追加）
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
