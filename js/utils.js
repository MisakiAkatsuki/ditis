// ユーティリティ関数

/**
 * 列番号からアルファベットに変換
 * @param {number} num - 列番号（1-26）
 * @returns {string} アルファベット（A-Z）
 */
function columnNumberToLetter(num) {
    return String.fromCharCode(64 + num);
}

/**
 * アルファベットから列番号に変換
 * @param {string} letter - アルファベット（A-Z）
 * @returns {number} 列番号（1-26）
 */
function columnLetterToNumber(letter) {
    return letter.charCodeAt(0) - 64;
}

/**
 * フレーム番号をタイムコードに変換
 * @param {number} frame - フレーム番号
 * @param {number} fps - フレームレート
 * @returns {string} タイムコード（HH:MM:SS:FF）
 */
function frameToTimecode(frame, fps = 24) {
    const totalFrames = frame - 1;
    const hours = Math.floor(totalFrames / (fps * 3600));
    const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
    const seconds = Math.floor((totalFrames % (fps * 60)) / fps);
    const frames = totalFrames % fps;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

/**
 * ディープコピー
 * @param {*} obj - コピー対象
 * @returns {*} コピーされたオブジェクト
 */
function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * セルIDを生成
 * @param {number} frame - フレーム番号
 * @param {number} layerId - レイヤーID
 * @returns {string} セルID（例: "F1L1"）
 */
function getCellId(frame, layerId) {
    return `F${frame}L${layerId}`;
}

/**
 * セルIDをパース
 * @param {string} cellId - セルID（例: "F1L1"）
 * @returns {{frame: number, layerId: number}} フレームとレイヤーID
 */
function parseCellId(cellId) {
    const match = cellId.match(/F(\d+)L(\d+)/);
    if (match) {
        return {
            frame: parseInt(match[1]),
            layerId: parseInt(match[2])
        };
    }
    return null;
}

/**
 * HTML エスケープ（XSS対策）
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたテキスト
 */
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * 数値かどうかチェック
 * @param {string} value - チェックする値
 * @returns {boolean} 数値の場合true
 */
function isNumeric(value) {
    return /^\d+$/.test(value);
}

/**
 * 空かどうかチェック（空文字列、null、undefined）
 * @param {*} value - チェックする値
 * @returns {boolean} 空の場合true
 */
function isEmpty(value) {
    return value === '' || value === null || value === undefined;
}

/**
 * デバウンス関数
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * スロットル関数
 * @param {Function} func - 実行する関数
 * @param {number} limit - 実行間隔（ミリ秒）
 * @returns {Function} スロットルされた関数
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * セル要素を取得
 * @param {number} frame - フレーム番号
 * @param {number} layerId - レイヤーID
 * @returns {HTMLElement|null} セル要素
 */
function getCellElement(frame, layerId) {
    return document.querySelector(`td[data-frame="${frame}"][data-layer="${layerId}"]`);
}

/**
 * 選択範囲のフレーム範囲を計算
 * @param {Array} selectedCells - 選択セル配列 [{frame, layerId}, ...]
 * @returns {{minFrame: number, maxFrame: number, shiftAmount: number}} フレーム範囲情報
 */
function calculateFrameRange(selectedCells) {
    if (!selectedCells || selectedCells.length === 0) {
        return { minFrame: 0, maxFrame: 0, shiftAmount: 0 };
    }
    const frames = selectedCells.map(s => s.frame);
    const minFrame = Math.min(...frames);
    const maxFrame = Math.max(...frames);
    const shiftAmount = maxFrame - minFrame + 1;
    return { minFrame, maxFrame, shiftAmount };
}

/**
 * 選択範囲のレイヤー範囲を計算（インデックスベース）
 * @param {Array} selectedCells - 選択セル配列 [{frame, layerId}, ...]
 * @returns {{minLayerIndex: number, maxLayerIndex: number, layerIds: Array}} レイヤー範囲情報
 */
function calculateLayerRange(selectedCells) {
    if (!selectedCells || selectedCells.length === 0) {
        return { minLayerIndex: 0, maxLayerIndex: 0, layerIds: [] };
    }
    const layerIds = [...new Set(selectedCells.map(s => s.layerId))];
    const sheet = getCurrentSheet();
    const indices = layerIds.map(id => sheet.layers.findIndex(l => l.id === id)).filter(i => i !== -1);
    const minLayerIndex = Math.min(...indices);
    const maxLayerIndex = Math.max(...indices);
    return { minLayerIndex, maxLayerIndex, layerIds };
}

/**
 * layerIdからレイヤーインデックスを取得するヘルパー
 * @param {string} layerId - レイヤーID (例: "L1")
 * @param {Array} layers - レイヤー配列
 * @returns {number} インデックス（見つからない場合は-1）
 */
function getLayerIndex(layerId, layers) {
    return layers.findIndex(l => l.id === layerId);
}

/**
 * layerIdの比較関数（ソート用）
 * @param {string} aLayerId 
 * @param {string} bLayerId 
 * @param {Array} layers 
 * @returns {number}
 */
function compareLayerIds(aLayerId, bLayerId, layers) {
    return getLayerIndex(aLayerId, layers) - getLayerIndex(bLayerId, layers);
}

/**
 * レイヤー名を生成（A-Z, AA-AZ, BA-BZ...）
 * @param {number} index - インデックス（0から開始）
 * @returns {string} レイヤー名（A, B, ..., Z, AA, AB, ...）
 */
function getLayerName(index) {
    let name = '';
    let num = index;
    
    while (num >= 0) {
        name = String.fromCharCode(65 + (num % 26)) + name;
        num = Math.floor(num / 26) - 1;
    }
    
    return name;
}

/**
 * レイヤー名からインデックスを逆算（A→0, B→1, ..., Z→25, AA→26, ...）
 * @param {string} name - レイヤー名（大文字アルファベットのみ）
 * @returns {number} インデックス（一致しない場合は-1）
 */
function getLayerNameIndex(name) {
    if (!/^[A-Z]+$/.test(name)) return -1;
    let index = 0;
    for (let i = 0; i < name.length; i++) {
        index = index * 26 + (name.charCodeAt(i) - 64);
    }
    return index - 1;
}

/**
 * 最大表示行数を取得（デフォルト値対応）
 * @param {Object} sheet - シートオブジェクト
 * @returns {number} 最大表示行数
 */
function getMaxVisibleRows(sheet) {
    if (!sheet) return CONSTANTS.MAX_VISIBLE_ROWS;
    const visibleRows = sheet.visibleRows || CONSTANTS.MAX_VISIBLE_ROWS;
    return Math.max(visibleRows, sheet.frames || 0);
}

/**
 * 配列の範囲を取得（min～max）
 * @param {Array<{frame: number}>} cells - セル配列
 * @returns {{minFrame: number, maxFrame: number}} 範囲
 */
function getCellRange(cells) {
    const frames = cells.map(c => c.frame);
    return {
        minFrame: Math.min(...frames),
        maxFrame: Math.max(...frames)
    };
}

// エクスポート（モジュールとして使用する場合）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        columnNumberToLetter,
        columnLetterToNumber,
        frameToTimecode,
        deepCopy,
        getCellId,
        parseCellId,
        isNumeric,
        isEmpty,
        debounce,
        throttle,
        getCellElement,
        getLayerName,
        getCellRange,
        escapeHtml,
        getMaxVisibleRows
    };
}
