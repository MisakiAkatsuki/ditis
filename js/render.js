/**
 * render.js
 * 
 * スプレッドシート描画関連の機能
 * - タブの描画
 * - タブのドラッグ&ドロップ
 * - スプレッドシートのレンダリング（仮想スクロール対応）
 * - セルイベントの設定
 * 
 * 依存関係:
 * - AppState: グローバル状態
 * - getCurrentSheet(): 現在のシート取得
 * - saveHistory(): 履歴保存
 * - selectEntireColumn(): 列全選択
 * - selectEntireRow(): 行全選択
 * - handleCellMouseDown(): セルマウスダウン処理
 * - handleCellMouseEnter(): セルマウスエンター処理
 * - renameLayer(): レイヤー名変更
 * - selectAllInputtedCells(): 入力済みセル全選択
 * - updateStatusBar(): ステータスバー更新
 * - debugLog(): デバッグログ出力
 */

// イベントリスナー設定済みフラグ（グローバル管理でDOM再生成に依存しない）
let _eventsSetupFlags = {
    cellEvents: false,
    rowHeaderEvents: false,
    columnHeaderEvents: false,
    fpsCornerEvent: false,
    addColumnEvent: false
};

// レンダリング最適化：requestAnimationFrameでバッチ処理
let _renderScheduled = false;
let _renderForceFullRender = false;

/**
 * レンダリングをスケジュールする（バッチ処理）
 * 複数のrenderSpreadsheet()呼び出しを1回にまとめる
 * @param {boolean} forceFullRender - 強制的に全範囲をレンダリングするか
 */
function scheduleRender(forceFullRender = false) {
    if (forceFullRender) {
        _renderForceFullRender = true;
    }
    
    if (_renderScheduled) return;
    _renderScheduled = true;
    
    requestAnimationFrame(() => {
        _renderScheduled = false;
        renderSpreadsheetImmediate(_renderForceFullRender);
        _renderForceFullRender = false;
    });
}

/**
 * レンダリングを即座に実行する（従来のrenderSpreadsheet）
 */

/**
 * 特殊表示情報をキャッシュ計算する
 * @param {Object} sheet - シートオブジェクト
 */
function calculateSpecialDisplayCache(sheet) {
    const cache = new Map();
    const maxRows = getMaxVisibleRows(sheet);
    
    sheet.layers.forEach(layer => {
        const layerId = layer.id;
        const layerCache = {
            firstNumberFrame: -1,
            verticalLineRanges: []
        };
        
        // 最初に数字が出現するフレームを探す
        for (let f = 1; f <= maxRows; f++) {
            const value = (sheet.data[f] && sheet.data[f][layerId]) || '';
            if (value !== '' && value !== '-' && value !== CONSTANTS.NULL_CELL) {
                layerCache.firstNumberFrame = f;
                break;
            }
        }
        
        // 縦線範囲を計算（同じ値が最後まで続く範囲）
        for (let f = 2; f <= maxRows; f++) {
            const value = (sheet.data[f] && sheet.data[f][layerId]) || '';
            const prevValue = (sheet.data[f-1] && sheet.data[f-1][layerId]) || '';
            
            // 前のセルと同じ値（つまり表示が'-'になる）
            if (value !== '' && value !== '-' && value === prevValue) {
                // この位置から最後まで同じ値が続くかチェック
                let continueToEnd = true;
                for (let checkF = f; checkF <= maxRows; checkF++) {
                    const checkValue = (sheet.data[checkF] && sheet.data[checkF][layerId]) || '';
                    if (checkValue !== value) {
                        continueToEnd = false;
                        break;
                    }
                }
                
                if (continueToEnd) {
                    layerCache.verticalLineRanges.push({
                        start: f,
                        end: maxRows
                    });
                    break; // 一度見つけたら終了
                }
            }
        }
        
        cache.set(layerId, layerCache);
    });
    
    AppState.specialDisplayCache = cache;
    debugLog('表示', '特殊表示キャッシュ更新', {
        layers: sheet.layers.length,
        cacheSize: cache.size
    });
}

/**
 * 特殊表示情報を取得する
 * @param {number} layerId - レイヤーID
 * @param {number} frame - フレーム番号
 * @returns {Object} 特殊表示情報オブジェクト
 */
function getSpecialDisplayInfo(layerId, frame) {
    const cache = AppState.specialDisplayCache.get(layerId);
    if (!cache) {
        return {isCrossMark: false, isWaveLine: false, isVerticalLine: false};
    }
    
    const result = {
        isCrossMark: false,
        isWaveLine: false,
        isVerticalLine: false
    };
    
    // ×印判定
    if (cache.firstNumberFrame > 1 && frame === 1) {
        result.isCrossMark = true;
    }
    
    // 波線判定
    if (cache.firstNumberFrame > 1 && frame > 1 && frame < cache.firstNumberFrame) {
        result.isWaveLine = true;
    }
    
    // 縦線判定
    for (const range of cache.verticalLineRanges) {
        if (frame >= range.start && frame <= range.end) {
            result.isVerticalLine = true;
            break;
        }
    }
    
    return result;
}

/**
 * 表示範囲を計算する
 * - スクロール位置から表示すべき行・列の範囲を計算
 */
function calculateViewport() {
    const container = document.getElementById('spreadsheet');
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    const viewportHeight = container.clientHeight;
    const viewportWidth = container.clientWidth;
    
    const rowHeight = CONSTANTS.CELL_HEIGHT;
    const colWidth = CONSTANTS.CELL_WIDTH;
    const buffer = AppState.viewport.rowBuffer;
    const colBuffer = AppState.viewport.colBuffer;
    
    // 表示範囲の開始・終了行を計算
    const startRow = Math.max(1, Math.floor(scrollTop / rowHeight) - buffer);
    const endRow = Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer;
    
    // 表示範囲の開始・終了列を計算
    const startCol = Math.max(1, Math.floor(scrollLeft / colWidth) - colBuffer);
    const endCol = Math.ceil((scrollLeft + viewportWidth) / colWidth) + colBuffer;
    
    const sheet = getCurrentSheet();
    const maxCols = sheet.layers.length;
    
    AppState.viewport.startRow = startRow;
    AppState.viewport.endRow = endRow;
    AppState.viewport.startCol = startCol;
    AppState.viewport.endCol = Math.min(endCol, maxCols);
    
    debugLog('表示', '表示範囲計算', {
        rows: `${startRow}-${endRow}`,
        cols: `${startCol}-${endCol}`
    });
}

/**
 * セルの状態をキャッシュキーとして生成
 * @param {number} frame - フレーム番号
 * @param {number} layerId - レイヤーID
 * @param {string} value - セルの値
 * @param {Array<string>} classes - CSSクラス配列
 * @returns {string} - キャッシュキー
 */
function getCellCacheKey(frame, layerId, value, classes) {
    return `${frame}-${layerId}-${value}-${classes.join(',')}`;
}

/**
 * スプレッドシート全体を描画する（バッチ処理版）
 * - 複数のrenderSpreadsheet()呼び出しを1回にまとめる
 * - 仮想スクロール対応：表示範囲のみレンダリング
 * - ヘッダー（fps、レイヤー名、列番号）の描画
 * - データセルの描画（値、-、縦線、×印、波線）
 * - 挿入されたフレームの色分け
 * - 無効化された行の表示制御
 * 
 * @param {boolean} forceFullRender - 強制的に全範囲をレンダリングするか
 */
function renderSpreadsheet(forceFullRender = false) {
    scheduleRender(forceFullRender);
}

/**
 * スプレッドシート全体を即座に描画する（内部用）
 * - 仮想スクロール対応：表示範囲のみレンダリング
 * - ヘッダー（fps、レイヤー名、列番号）の描画
 * - データセルの描画（値、-、縦線、×印、波線）
 * - 挿入されたフレームの色分け
 * - 無効化された行の表示制御
 * 
 * @param {boolean} forceFullRender - 強制的に全範囲をレンダリングするか
 */
function renderSpreadsheetImmediate(forceFullRender = false) {
    const startTime = performance.now();
    const sheet = getCurrentSheet();
    const container = document.getElementById('spreadsheet');
    const filter = AppState.frameFilter || 'all';
    const headerMode = AppState.headerDisplayMode || 'detail';
    
    // フレームページサイズ（左ヘッダーの折り返し）
    const framePageSize = sheet.framePageSize || 144;
    
    // sheet.framesを最大行として使用
    const maxRows = Math.max(getMaxVisibleRows(sheet), sheet.frames || CONSTANTS.DEFAULT_ROWS);
    
    // 特殊表示キャッシュを更新（強制全描画時、または初回時）
    if (forceFullRender || AppState.specialDisplayCache.size === 0) {
        calculateSpecialDisplayCache(sheet);
    }
    
    // 表示範囲を計算
    const maxCols = sheet.layers.length;
    if (forceFullRender) {
        // 強制全描画時は全範囲
        AppState.viewport.startRow = 1;
        AppState.viewport.endRow = maxRows;
        AppState.viewport.startCol = 1;
        AppState.viewport.endCol = maxCols;
    } else {
        // 仮想スクロール時はビューポートを計算
        if (!AppState.viewport.endRow) {
            // 初回はビューポート計算
            calculateViewport();
            // 初回の計算が不正確な場合のフォールバック
            if (!AppState.viewport.endRow || AppState.viewport.endRow < AppState.viewport.startRow) {
                AppState.viewport.startRow = 1;
                AppState.viewport.endRow = Math.min(30, maxRows);
                AppState.viewport.startCol = 1;
                AppState.viewport.endCol = maxCols;
            }
        }
    }
    
    // 中間フレーム番号のbodyクラス切り替え
    if (AppState.showIntermediateHeaders) {
        document.body.classList.add('intermediate-headers');
    } else {
        document.body.classList.remove('intermediate-headers');
    }
    
    let html = '<table><thead><tr><th class="fps-corner-cell">fps<br><span style="font-size: var(--column-number-font-size); color: var(--text-secondary);">' + AppState.fps + '</span></th>';
    
    // ヘッダー（レイヤー名と列番号）
    sheet.layers.forEach((layer, index) => {
        if (AppState.showIntermediateHeaders && index > 0 && index % 6 === 0) {
            html += '<th class="intermediate-header"></th>';
        }
        html += `<th data-layer-id="${escapeHtml(layer.id)}" title="${escapeHtml(layer.name)}">${escapeHtml(layer.name)}<br><span style="font-size: var(--column-number-font-size); color: var(--text-secondary);">${index + 1}</span></th>`;
    });
    html += `<th class="add-column-header" id="add-column-btn" title="列を追加">+</th>`;
    html += '</tr></thead><tbody>';
    
    // 実数表記モード用：無効化行を除いた連番カウンター
    let validFrameCount = 0;
    
    // データ行（表示範囲のみレンダリング）
    const renderStartRow = AppState.viewport.startRow || 1;
    const renderEndRow = Math.min(AppState.viewport.endRow || maxRows, maxRows);
    
    // validFrameCountキャッシュの構築（初回またはキャッシュクリア時）
    if (!AppState.validFrameCountCache || forceFullRender) {
        AppState.validFrameCountCache = new Map();
        let count = 0;
        for (let f = 1; f <= maxRows; f++) {
            const isDisabled = sheet.disabledFrames && sheet.disabledFrames.includes(f);
            if (!isDisabled) {
                count++;
            }
            AppState.validFrameCountCache.set(f, count);
        }
    }
    
    // キャッシュから取得
    validFrameCount = AppState.validFrameCountCache.get(renderStartRow - 1) || 0;
    
    debugLog('表示', `レンダリング行: ${renderStartRow}-${renderEndRow} / ${maxRows}`);
    
    // 波線表示に使うcellHeightをループ外でキャッシュ
    const cachedComputedStyle = getComputedStyle(document.documentElement);
    const cachedCellHeight = parseInt(cachedComputedStyle.getPropertyValue('--cell-height')) || 16;

    for (let frame = renderStartRow; frame <= renderEndRow; frame++) {
        // 無効化チェック
        const isDisabled = sheet.disabledFrames && sheet.disabledFrames.includes(frame);
        
        // 無効化されていない行のみカウント
        if (!isDisabled) {
            validFrameCount++;
        }
        
        // 挿入されたフレームかどうか判定
        const isInserted = sheet.insertedFrames && sheet.insertedFrames.includes(frame);
        const frameClass = isInserted ? 'inserted-frame' : '';
        
        // シート番号とシート内フレーム番号を計算
        let frameLabel = '';
        let originalFrame = frame; // 元のフレーム番号（太線判定用）
        
        // 実数表記モード用：無効化行を除いたカウントから計算
        const currentSheetNumber = Math.floor((validFrameCount - 1) / framePageSize) + 1;
        const currentFrameInSheet = ((validFrameCount - 1) % framePageSize) + 1;
        
        // フィルター適用の判定（挿入フレーム・通常フレーム共通）
        let shouldDisplayRow = true; // 行全体を表示するかどうか
        
        if (isInserted && sheet.insertedFrameMap && sheet.insertedFrameMap[frame] !== undefined) {
            // 挿入されたフレーム：insertNumber（+1,+2,+3...）で奇数・偶数判定
            const insertNumber = sheet.insertedFrameMap[frame];
            
            // フィルター適用：挿入番号で判定（表示自体は常に行う）
            let shouldDisplayNumber = true;
            if (filter === 'odd' && insertNumber % 2 === 0) shouldDisplayNumber = false;
            if (filter === 'even' && insertNumber % 2 === 1) shouldDisplayNumber = false;
            
            // 直前の通常フレームを探してoriginalFrameを計算（表示用）
            let prevNormalFrame = frame - 1;
            while (prevNormalFrame > 0 && sheet.insertedFrames && sheet.insertedFrames.includes(prevNormalFrame)) {
                prevNormalFrame--;
            }
            
            if (prevNormalFrame > 0) {
                const insertedBeforePrev = sheet.insertedFrames ? sheet.insertedFrames.filter(f => f < prevNormalFrame).length : 0;
                originalFrame = prevNormalFrame - insertedBeforePrev;
            } else {
                let nextNormalFrame = frame + 1;
                const maxRows = getMaxVisibleRows(sheet);
                while (nextNormalFrame <= maxRows && sheet.insertedFrames && sheet.insertedFrames.includes(nextNormalFrame)) {
                    nextNormalFrame++;
                }
                
                if (nextNormalFrame <= maxRows) {
                    const insertedBeforeNext = sheet.insertedFrames ? sheet.insertedFrames.filter(f => f < nextNormalFrame).length : 0;
                    originalFrame = Math.max(1, nextNormalFrame - insertedBeforeNext - 1);
                } else {
                    originalFrame = 1;
                }
            }
            
            // 挿入フレームの表示
            
            if (headerMode === 'simple') {
                // 連番表記モード：挿入フレームも含めて通しの連番で表示
                // validFrameCountを使用（無効化行を除いたカウント）
                let shouldDisplayInserted = true;
                // 連番表記では挿入番号ではなく通しの番号で奇数/偶数判定
                if (filter === 'odd' && validFrameCount % 2 === 0) shouldDisplayInserted = false;
                if (filter === 'even' && validFrameCount % 2 === 1) shouldDisplayInserted = false;
                
                if (isDisabled) {
                    frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">-</span>`;
                } else if (shouldDisplayInserted) {
                    // 挿入フレームも赤色で通しの連番を表示
                    const displaySheetNumber = Math.floor((validFrameCount - 1) / framePageSize) + 1;
                    const displayFrameInSheet = ((validFrameCount - 1) % framePageSize) + 1;
                    frameLabel = `<span style="float: left; color: #ff4444;">${displaySheetNumber}</span><span style="float: right; padding-right: 2px; color: #ff4444;">${displayFrameInSheet}</span>`;
                } else {
                    // フィルター条件に合わない場合は「-」表示（行は表示する）
                    frameLabel = `<span style="float: left; color: #ff4444;">-</span><span style="float: right; padding-right: 2px; color: #ff4444;">-</span>`;
                }
            } else {
                // コマ表記モード：+1, +2と表示（フィルターに応じて番号または-）
                if (shouldDisplayNumber) {
                    if (isDisabled) {
                        frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">${insertNumber}</span>`;
                    } else {
                        frameLabel = `<span style="float: left; color: #ff4444;">+</span><span style="float: right; padding-right: 2px; color: #ff4444;">${insertNumber}</span>`;
                    }
                } else {
                    // フィルター条件に合わない場合は番号を「-」に
                    if (isDisabled) {
                        frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">-</span>`;
                    } else {
                        frameLabel = `<span style="float: left; color: #ff4444;">+</span><span style="float: right; padding-right: 2px; color: #ff4444;">-</span>`;
                    }
                }
            }
        } else {
            // 通常のフレームは元の番号を計算
            // 挿入された分を引いて元のフレーム番号を計算
            if (sheet.insertedFrames) {
                const insertedBefore = sheet.insertedFrames.filter(f => f < frame).length;
                originalFrame = frame - insertedBefore;
            }
            const sheetNumber = Math.floor((originalFrame - 1) / framePageSize) + 1;
            const frameInSheet = ((originalFrame - 1) % framePageSize) + 1;
            
            if (headerMode === 'simple') {
                // 連番表記モード：実際のフレーム番号（originalFrame）を使用
                // フィルター適用時は奇数/偶数のみ表示
                let shouldDisplay = true;
                if (filter === 'odd' && validFrameCount % 2 === 0) shouldDisplay = false;
                if (filter === 'even' && validFrameCount % 2 === 1) shouldDisplay = false;
                
                if (isDisabled) {
                    frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">-</span>`;
                } else if (shouldDisplay) {
                    // フィルター条件に合う場合：連番を表示
                    const displaySheetNumber = Math.floor((validFrameCount - 1) / framePageSize) + 1;
                    const displayFrameInSheet = ((validFrameCount - 1) % framePageSize) + 1;
                    frameLabel = `<span style="float: left;">${displaySheetNumber}</span><span style="float: right; padding-right: 2px;">${displayFrameInSheet}</span>`;
                } else {
                    // フィルター条件に合わない場合：「-」表示（行は表示する）
                    frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">-</span>`;
                }
            } else {
                // コマ表記モード：シート番号+コマ番号表示
                // フィルター適用（ヘッダーの表示のみ制御）
                let shouldDisplay = true;
                if (filter === 'odd' && frameInSheet % 2 === 0) shouldDisplay = false;
                if (filter === 'even' && frameInSheet % 2 === 1) shouldDisplay = false;
                
                if (shouldDisplay) {
                    if (isDisabled) {
                        frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">${frameInSheet}</span>`;
                    } else {
                        frameLabel = `<span style="float: left;">${sheetNumber}</span><span style="float: right; padding-right: 2px;">${frameInSheet}</span>`;
                    }
                } else {
                    // フィルター条件に合わない場合：シート番号は表示、コマ数は「-」
                    if (isDisabled) {
                        frameLabel = `<span style="float: left;">-</span><span style="float: right; padding-right: 2px;">-</span>`;
                    } else {
                        frameLabel = `<span style="float: left;">${sheetNumber}</span><span style="float: right; padding-right: 2px;">-</span>`;
                    }
                }
            }
        }
        
        // 太線判定用のクラス（元のフレーム番号で6の倍数か判定）
        const isBoldRow = !isInserted && originalFrame % 6 === 0;
        const rowClass = isBoldRow ? 'bold-row' : '';
        const disabledClass = isDisabled ? 'disabled-row' : '';
        
        html += `<tr class="${rowClass} ${disabledClass}"><td class="${frameClass} frame-header" data-frame-header="${frame}">${frameLabel}</td>`;
        
        sheet.layers.forEach((layer, layerIndex) => {
            // 中間フレーム番号列の挿入
            if (AppState.showIntermediateHeaders && layerIndex > 0 && layerIndex % 6 === 0) {
                html += `<td class="intermediate-frame-number ${frameClass}">${frameLabel}</td>`;
            }
            
            // データが存在しない場合は空文字
            if (!sheet.data[frame]) {
                sheet.data[frame] = {};
            }
            if (sheet.data[frame][layer.id] === undefined) {
                sheet.data[frame][layer.id] = '';
            }
            
            const value = sheet.data[frame][layer.id] || '';
            let cellClass = '';
            let cellContent = value;
            let cellStyle = ''; // インラインスタイル用
            
            // 前のセルと同じ値なら「-」を表示（表示のみ、データは実数値）
            // ただし空セルマーカー(×)は常にそのまま表示する
            if (value !== '' && value !== CONSTANTS.NULL_CELL && frame > 1) {
                const prevValue = (sheet.data[frame - 1] && sheet.data[frame - 1][layer.id]) || '';
                if (value === prevValue) {
                    cellContent = '-';
                }
            }
            
            // 特殊表示判定（キャッシュを使用）
            const specialInfo = getSpecialDisplayInfo(layer.id, frame);
            
            // 空セルマーカー(×)は専用クラスで表示
            if (value === CONSTANTS.NULL_CELL) {
                cellClass = 'null-cell';
            } else if (specialInfo.isCrossMark && value === '') {
                // ×印表示
                cellClass = 'cross-mark';
                cellContent = '';
            } else if (specialInfo.isWaveLine && value === '') {
                // 波線表示
                const actualWaveHeight = cachedCellHeight * 3;
                const relativePosition = frame - 2;
                const absolutePosition = relativePosition * cachedCellHeight;
                const offset = absolutePosition % actualWaveHeight;
                
                cellClass = 'wave-line';
                cellStyle = `--wave-offset: ${offset}px`;
                cellContent = '';
            } else if (specialInfo.isVerticalLine && cellContent === '-') {
                // 縦線表示（cellContentが'-'の場合）
                const maxRows = getMaxVisibleRows(sheet);
                const isLast = frame === maxRows;
                
                // キャッシュから縦線範囲を取得して開始位置を判定
                const cache = AppState.specialDisplayCache.get(layer.id);
                const isStart = cache && cache.verticalLineRanges.some(r => r.start === frame);
                
                if (isStart) {
                    cellClass = 'vertical-line-start';
                    cellContent = '';
                } else if (isLast) {
                    cellClass = 'vertical-line-end';
                    cellContent = '';
                } else {
                    cellClass = 'vertical-line-continue';
                    cellContent = '';
                }
            }

            // 空セルモードON時: 特殊表示が適用されていない空セルで上に数字があれば×を表示（データ変更なし）
            if (cellClass === '' && AppState.emptyCellMode && value === '' && frame > 1) {
                let hasNumberAbove = false;
                for (let f = frame - 1; f >= 1; f--) {
                    const v = (sheet.data[f] && sheet.data[f][layer.id]) || '';
                    if (v !== '' && v !== CONSTANTS.NULL_CELL) { hasNumberAbove = true; break; }
                    if (v === '' || v === CONSTANTS.NULL_CELL) break;
                }
                if (hasNumberAbove) {
                    cellClass = 'null-cell';
                    cellContent = CONSTANTS.NULL_CELL;
                }
            }
            
            // 挿入された行のセルには inserted-cell クラスを追加
            const cellClasses = [cellClass];
            if (isInserted) {
                cellClasses.push('inserted-cell');
                debugLog('表示', `挿入セル: frame=${frame}, layer=${layer.id}, classes="${cellClasses.join(' ')}"`);
            }
            
            // styleがある場合は追加
            const styleAttr = cellStyle ? ` style="${cellStyle}"` : '';
            html += `<td class="${cellClasses.join(' ')}"${styleAttr} data-frame="${frame}" data-layer="${escapeHtml(layer.id)}">${escapeHtml(cellContent)}</td>`;
        });
        
        html += '<td class="add-column-spacer"></td></tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;

    // 再レンダリングでDOMが差し替わるため、選択状態を新しいセル要素に復元する
    if (AppState.selectedCells.length > 0) {
        const selectedPositions = AppState.selectedCells.map(s => ({ frame: s.frame, layerId: s.layerId }));
        AppState.selectedCells = [];

        selectedPositions.forEach(pos => {
            const liveCell = getCellElement(pos.frame, pos.layerId);
            if (liveCell) {
                liveCell.classList.add('selected');
                AppState.selectedCells.push({
                    cell: liveCell,
                    frame: pos.frame,
                    layerId: pos.layerId
                });
            }
        });

        // 復元できなかった場合はリトライ
        if (AppState.selectedCells.length === 0) {
            requestAnimationFrame(() => restoreSelectionCoords(selectedPositions));
        }
    }
    
    // セルイベントの設定
    setupCellEvents();
}

/**
 * セルイベントを設定する
 * - セルのクリック・ドラッグ選択などのイベントを設定
 */
/**
 * セルイベントをイベント委譲で設定
 * 全セルではなく親要素に1つだけリスナーを登録
 */
function setupCellEvents() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;
    
    // 既存のリスナーを削除（重複防止） - グローバルフラグで管理
    if (_eventsSetupFlags.cellEvents) return;
    _eventsSetupFlags.cellEvents = true;
    
    // イベント委譲：親要素で全セルイベントをキャッチ
    spreadsheet.addEventListener('mousedown', (e) => {
        // 行ヘッダーでないことを確認
        if (e.target.closest('td[data-frame-header]')) return;
        
        const cell = e.target.closest('td[data-frame]');
        if (cell) handleCellMouseDown(cell, e);
    });
    
    spreadsheet.addEventListener('mouseenter', (e) => {
        // 行ヘッダーでないことを確認
        if (e.target.closest('td[data-frame-header]')) return;
        
        const cell = e.target.closest('td[data-frame]');
        if (cell && e.buttons === 1) handleCellMouseEnter(cell, e);
    }, true);
    
    spreadsheet.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('td[data-frame]');
        if (cell) {
            e.preventDefault();
            selectEntireColumn(cell);
        }
    });
    
    // ヘッダー選択のイベント委譲（行、列、fpsコーナー）
    // ヘッダーは再描画されるため個別リスナーは失われる
    
    // フレームヘッダー（左の行番号）のクリック/ドラッグで行全体を選択
    if (!_eventsSetupFlags.rowHeaderEvents) {
        _eventsSetupFlags.rowHeaderEvents = true;
        
        spreadsheet.addEventListener('mousedown', (e) => {
            const header = e.target.closest('td[data-frame-header]');
            if (!header) return;
            
            // 右クリックの場合は選択を変更しない
            if (e.button === 2) return;
            
            e.stopPropagation();
            const frame = parseInt(header.dataset.frameHeader);
            
            // ドラッグ開始
            AppState.isDraggingRow = true;
            AppState.dragStartRow = frame;
            
            clearSelection();
            selectEntireRow(frame);
        });
        
        spreadsheet.addEventListener('mouseenter', (e) => {
            const header = e.target.closest('td[data-frame-header]');
            if (!header) return;
            
            // 行ドラッグ中のみ処理
            if (!AppState.isDraggingRow || !AppState.dragStartRow) return;
            
            const frame = parseInt(header.dataset.frameHeader);
            const minFrame = Math.min(AppState.dragStartRow, frame);
            const maxFrame = Math.max(AppState.dragStartRow, frame);
            
            clearSelection();
            
            // 範囲内の全行を選択
            for (let f = minFrame; f <= maxFrame; f++) {
                selectEntireRowWithoutClear(f);
            }
            
            updateStatusBar();
        }, true);
    }
    
    // 列ヘッダー（上のレイヤー名）のクリック/ドラッグで列全体を選択
    if (!_eventsSetupFlags.columnHeaderEvents) {
        _eventsSetupFlags.columnHeaderEvents = true;
        
        spreadsheet.addEventListener('mousedown', (e) => {
            const header = e.target.closest('th[data-layer-id]');
            if (!header) return;
            
            // 右クリックの場合は選択を変更しない
            if (e.button === 2) return;
            
            e.stopPropagation();
            const layerId = header.dataset.layerId; // "L1" などの文字列IDをそのまま使用
            
            // ドラッグ開始
            AppState.isDraggingColumn = true;
            AppState.dragStartColumn = layerId;
            
            clearSelection();
            selectEntireColumnWithoutClear(layerId);
            updateStatusBar();
        });
        
        spreadsheet.addEventListener('mouseenter', (e) => {
            const header = e.target.closest('th[data-layer-id]');
            if (!header) return;
            
            // 列ドラッグ中のみ処理
            if (!AppState.isDraggingColumn || !AppState.dragStartColumn) return;
            
            const layerId = header.dataset.layerId; // "L1" などの文字列IDをそのまま使用
            const sheet = getCurrentSheet();
            
            const startIndex = sheet.layers.findIndex(l => l.id === AppState.dragStartColumn);
            const endIndex = sheet.layers.findIndex(l => l.id === layerId);
            const minIndex = Math.min(startIndex, endIndex);
            const maxIndex = Math.max(startIndex, endIndex);
            
            clearSelection();
            
            // 範囲内の全列を選択
            for (let i = minIndex; i <= maxIndex; i++) {
                const lid = sheet.layers[i].id;
                selectEntireColumnWithoutClear(lid);
            }
            
            updateStatusBar();
        }, true);
        
        spreadsheet.addEventListener('dblclick', (e) => {
            const header = e.target.closest('th[data-layer-id]');
            if (header) {
                renameLayer(header.dataset.layerId);
            }
        });
    }
    
    // fpsコーナーセルのクリックで入力済みセルを全選択、ダブルクリックでフレームレート変更
    if (!_eventsSetupFlags.fpsCornerEvent) {
        _eventsSetupFlags.fpsCornerEvent = true;
        
        spreadsheet.addEventListener('click', (e) => {
            const fpsCorner = e.target.closest('.fps-corner-cell');
            if (fpsCorner) {
                e.stopPropagation();
                selectAllInputtedCells();
            }
        });
        
        spreadsheet.addEventListener('dblclick', (e) => {
            const fpsCorner = e.target.closest('.fps-corner-cell');
            if (fpsCorner) {
                e.stopPropagation();
                e.preventDefault();
                changeFPS();
            }
        });
    }
    
    // 「+」ボタンで列を追加
    if (!_eventsSetupFlags.addColumnEvent) {
        _eventsSetupFlags.addColumnEvent = true;
        
        spreadsheet.addEventListener('click', (e) => {
            const addBtn = e.target.closest('.add-column-header');
            if (addBtn) {
                e.stopPropagation();
                appendColumn();
            }
        });
    }
    
    // マウスアップでドラッグ終了（初回のみ登録）
    if (!document._mouseupEventSetup) {
        document._mouseupEventSetup = true;
        
        document.addEventListener('mouseup', () => {
            if (AppState.isDragging) {
                AppState.isDragging = false;
                AppState.dragStart = null;
                AppState.selectionAnchor = null; // アンカーもクリア
            }
            if (AppState.isDraggingRow) {
                AppState.isDraggingRow = false;
                AppState.dragStartRow = null;
                updateStatusBar();
            }
            if (AppState.isDraggingColumn) {
                AppState.isDraggingColumn = false;
                AppState.dragStartColumn = null;
                updateStatusBar();
            }
        });
    }
}
