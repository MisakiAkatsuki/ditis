/** parsers.js - ファイル形式パーサー（STS/TDTS/XDTS） */
/**
 * STS形式で保存（内部関数）
 * @param {string} filePath - 保存先パス
 * @param {Object} sheet - シートデータ
 */
async function saveStsFileInternal(filePath, sheet) {
    // 無効行（disabledFrames）のチェック
    let includeDisabledFrames = true;
    if (sheet.disabledFrames && sheet.disabledFrames.length > 0) {
        const disabledCount = sheet.disabledFrames.length;
        const confirmed = await window.TauriAPI.showConfirmDialog(
            `${disabledCount}個の無効行が存在します。\n\n無効行も含めて保存しますか？\n\n「はい」: 無効行も通常の行として保存（無効フラグは失われます）\n「いいえ」: 無効行をスキップして保存`,
            '無効行の処理'
        );
        
        includeDisabledFrames = confirmed;
    }
    
    const buffer = generateStsBuffer(sheet, includeDisabledFrames);
    if (!buffer) return false; // >255フレーム/列でバリデーション失敗
    await window.TauriAPI.saveBinaryFile(filePath, Array.from(buffer));
}

/**
 * TDTS形式で保存（内部関数）
 * @param {string} filePath - 保存先パス
 * @param {Object} sheet - シートデータ
 */
async function saveTdtsFileInternal(filePath, sheet) {
    const tdtsData = generateTdtsData(sheet);
    const content = 'toeiDigitalTimeSheet Save Data\n' + JSON.stringify(tdtsData, null, 4);
    await window.TauriAPI.saveFile(filePath, content);
}

/**
 * XDTS形式で保存（内部関数）
 * @param {string} filePath - 保存先パス
 * @param {Object} sheet - シートデータ
 */
async function saveXdtsFileInternal(filePath, sheet) {
    const xdtsData = generateXdtsData(sheet);
    const content = 'exchangeDigitalTimeSheet Save Data\n' + JSON.stringify(xdtsData, null, 4);
    await window.TauriAPI.saveFile(filePath, content);
}

/**
 * TDTS形式のデータを生成
 * @param {Object} sheet - シートデータ
 * @returns {Object} TDTS形式のデータ
 */
function generateTdtsData(sheet) {
    // レイヤーをトラックに変換
    const tracks = [];
    sheet.layers.forEach((layer, index) => {
        const frames = [];
        
        // フレームデータを収集
        for (let frame = 1; frame <= sheet.frames; frame++) {
            const value = sheet.data[frame]?.[layer.id];
            if (value !== undefined) {
                frames.push({
                    data: [{
                        fontColorId: 0,
                        id: 0,
                        values: [value === '' ? 'SYMBOL_NULL_CELL' : value]
                    }],
                    frame: frame - 1 // 1-basedから0-basedに変換
                });
            }
        }
        
        if (frames.length > 0) {
            tracks.push({
                frames: frames,
                trackNo: index
            });
        }
    });
    
    // timeTableHeadersを生成
    const timeTableHeaders = [{
        fieldId: 4,
        names: sheet.layers.map(l => l.name)
    }];
    
    return {
        timeSheets: [{
            free: [],
            header: {
                cut: '',
                episode: '',
                scene: '',
                showHeadDummy: false,
                timeTableFontColors: [
                    [0, 0, 0],
                    [224, 0, 0],
                    [32, 128, 32],
                    [32, 32, 192],
                    [192, 32, 192],
                    [255, 128, 32]
                ],
                workSlip: {
                    memo: '',
                    processes: [],
                    works: []
                }
            },
            timeTables: [{
                color: 0,
                direction: '',
                duration: sheet.frames,
                fields: [{
                    fieldId: 4,
                    tracks: tracks
                }],
                footDummykomas: 24,
                headDummykomas: 24,
                name: sheet.name,
                operatorName: '',
                timeTableHeaders: timeTableHeaders
            }]
        }],
        version: 11
    };
}

/**
 * XDTS形式のデータを生成
 * @param {Object} sheet - シートデータ
 * @returns {Object} XDTS形式のデータ
 */
function generateXdtsData(sheet) {
    // レイヤーをトラックに変換
    const tracks = [];
    sheet.layers.forEach((layer, index) => {
        const frames = [];
        
        // フレームデータを収集
        for (let frame = 1; frame <= sheet.frames; frame++) {
            const value = sheet.data[frame]?.[layer.id];
            if (value !== undefined) {
                frames.push({
                    data: [{
                        fontColorId: 0,
                        id: 0,
                        values: [value === '' ? 'SYMBOL_NULL_CELL' : value]
                    }],
                    frame: frame - 1 // 1-basedから0-basedに変換
                });
            }
        }
        
        if (frames.length > 0) {
            tracks.push({
                frames: frames,
                trackNo: index
            });
        }
    });
    
    // timeTableHeadersを生成
    const timeTableHeaders = [{
        fieldId: 0,
        names: sheet.layers.map(l => l.name)
    }];
    
    return {
        free: [],
        timeTables: [{
            comas: null,
            duration: sheet.frames,
            fields: [{
                fieldId: 0,
                tracks: tracks
            }],
            footDummykomas: 24,
            headDummykomas: 24,
            komas: null,
            name: sheet.name,
            tableHeader: null,
            tableHeaders: null,
            timeLineHeaders: null,
            timeTableData: null,
            timeTableHeaders: timeTableHeaders
        }],
        version: 11
    };
}

// ========================================
// TDTS形式（東映タイムシート）
// ========================================

/**
 * 東映タイムシート形式(.tdts)ファイルをTauri環境で読み込み
 */
async function loadTdtsFileTauri() {
    try {
        const filePath = await window.TauriAPI.openFileDialog({
            filters: [
                { name: 'TDTS Files', extensions: ['tdts'] }
            ]
        });
        
        if (filePath) {
            const fileContent = await window.TauriAPI.loadFile(filePath);
            parseTdtsFile(fileContent, filePath.split(/[/\\]/).pop());
        }
    } catch (error) {
        console.error('TDTSファイル読み込みエラー:', error);
        showErrorToast(`ファイル読み込みエラー: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

/**
 * 東映タイムシート形式(.tdts)ファイルをブラウザで読み込み
 */
function loadTdtsFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            parseTdtsFile(event.target.result, file.name);
        } catch (error) {
            console.error('TDTSファイル解析エラー:', error);
            showErrorToast(`ファイル解析エラー: ${error.message}`, ErrorLevel.ERROR, 5000);
        }
    };
    reader.onerror = () => {
        showErrorToast('ファイル読み込みエラー', ErrorLevel.ERROR, 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
}

/**
 * TDTSファイルの内容を解析してシートに変換
 */
function parseTdtsFile(fileContent, fileName) {
    try {
        // 最初の行（"toeiDigitalTimeSheet Save Data"）をスキップ
        const lines = fileContent.split('\n');
        const jsonContent = lines.slice(1).join('\n');
        
        const tdtsData = JSON.parse(jsonContent);
        
        if (!tdtsData.timeSheets || !Array.isArray(tdtsData.timeSheets)) {
            throw new Error('無効なTDTS形式です: timeSheets配列が見つかりません');
        }
    
    debugLog('ファイル', `TDTSファイル読み込み: ${fileName}`);
    
    const startIndex = AppState.sheets.length;
    
    // 各タイムシートをシートに変換
    tdtsData.timeSheets.forEach((timeSheet, sheetIndex) => {
        if (!timeSheet.timeTables || timeSheet.timeTables.length === 0) return;
        
        const timeTable = timeSheet.timeTables[0]; // 最初のtimeTableを使用
        const sheetName = timeTable.name || `TDTS_Sheet${sheetIndex + 1}`;
        const duration = timeTable.duration || 144;
        
        // 新しいシートを作成
        const newSheet = {
            name: sheetName,
            frames: duration,
            visibleRows: duration,
            layers: [],
            data: {},
            insertedFrames: [],
            disabledFrames: []
        };
        
        // フィールドからレイヤーを作成
        if (timeTable.fields && timeTable.fields.length > 0) {
            const field = timeTable.fields[0]; // fieldId=4を使用
            const fieldHeader = timeTable.timeTableHeaders
                ? timeTable.timeTableHeaders.find(h => h.fieldId === field.fieldId)
                : null;
            
            if (field.tracks && fieldHeader) {
                field.tracks.forEach((track, trackIndex) => {
                    const layerName = fieldHeader.names[trackIndex] || `Layer${trackIndex + 1}`;
                    const layerId = `L${newSheet.layers.length + 1}`;
                    
                    newSheet.layers.push({
                        id: layerId,
                        name: layerName
                    });
                    
                    // フレームデータを変換（キーフレーム間にホールド"-"を挿入）
                    if (track.frames && track.frames.length > 0) {
                        // フレームをソート
                        const sortedFrames = [...track.frames].sort((a, b) => a.frame - b.frame);
                        
                        for (let i = 0; i < sortedFrames.length; i++) {
                            const frameData = sortedFrames[i];
                            const frameNum = frameData.frame + 1; // 0-basedから1-basedに変換
                            
                            if (!newSheet.data[frameNum]) {
                                newSheet.data[frameNum] = {};
                            }
                            
                            if (frameData.data && frameData.data.length > 0) {
                                const cellData = frameData.data[0];
                                const value = cellData.values[0];
                                
                                // "SYMBOL_NULL_CELL"は空セルとして扱う
                                if (value !== "SYMBOL_NULL_CELL") {
                                    newSheet.data[frameNum][layerId] = value;
                                    
                                    // 次のキーフレームまでの間に実際の値を保持（ホールド）
                                    const nextFrame = sortedFrames[i + 1];
                                    if (nextFrame) {
                                        const nextFrameNum = nextFrame.frame + 1;
                                        for (let f = frameNum + 1; f < nextFrameNum; f++) {
                                            if (!newSheet.data[f]) {
                                                newSheet.data[f] = {};
                                            }
                                            newSheet.data[f][layerId] = value;
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
        
        // シートを追加
        AppState.sheets.push(newSheet);
    });
    
    // 新しく追加したシートのみ列が26未満の場合は26列に設定
    const newTdtsSheets = AppState.sheets.slice(startIndex);
    newTdtsSheets.forEach(sheet => {
        if (sheet.layers.length < 26) {
            const maxId = Math.max(...sheet.layers.map(l => {
                const num = parseInt(l.id.replace(/\D/g, ''));
                return isNaN(num) ? 0 : num;
            }), 0);
            const currentCount = sheet.layers.length;
            for (let i = currentCount; i < 26; i++) {
                sheet.layers.push({
                    id: `L${maxId + (i - currentCount) + 1}`,
                    name: String.fromCharCode(65 + i)
                });
            }
        }
    });
    
    // 最後に追加したシートに切り替え
    if (AppState.sheets.length > 0) {
        AppState.currentSheetIndex = AppState.sheets.length - 1;
        
        // 選択状態をクリア
        AppState.selectedCells = [];
        AppState.selectionAnchor = null;
        
        saveHistory('ファイル読み込み');
        renderTabs();
        renderSpreadsheet(true);
        updateWindowTitle();
        showErrorToast(`TDTSファイルから${tdtsData.timeSheets.length}個のシートを読み込みました`, ErrorLevel.INFO, 3000);
    }
    
    } catch (error) {
        console.error('TDTSファイル解析エラー:', error);
        throw new Error(`TDTSファイルの解析に失敗しました: ${error.message}`);
    }
}

// ========================================
// XDTS形式（交換タイムシート）
// ========================================

/**
 * 交換タイムシート形式(.xdts)ファイルをTauri環境で読み込み
 */
async function loadXdtsFileTauri() {
    try {
        const filePath = await window.TauriAPI.openFileDialog({
            filters: [
                { name: 'XDTS Files', extensions: ['xdts'] }
            ]
        });
        
        if (filePath) {
            const fileContent = await window.TauriAPI.loadFile(filePath);
            parseXdtsFile(fileContent, filePath.split(/[/\\]/).pop());
        }
    } catch (error) {
        console.error('XDTSファイル読み込みエラー:', error);
        showErrorToast(`ファイル読み込みエラー: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

/**
 * 交換タイムシート形式(.xdts)ファイルをブラウザで読み込み
 */
function loadXdtsFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            parseXdtsFile(event.target.result, file.name);
        } catch (error) {
            console.error('XDTSファイル解析エラー:', error);
            showErrorToast(`ファイル解析エラー: ${error.message}`, ErrorLevel.ERROR, 5000);
        }
    };
    reader.onerror = () => {
        showErrorToast('ファイル読み込みエラー', ErrorLevel.ERROR, 5000);
    };
    reader.readAsText(file);
    e.target.value = '';
}

/**
 * XDTSファイルの内容を解析してシートに変換
 */
function parseXdtsFile(fileContent, fileName) {
    try {
        // 最初の行（"exchangeDigitalTimeSheet Save Data"）をスキップ
        const lines = fileContent.split('\n');
        const jsonContent = lines.slice(1).join('\n');
        
        const xdtsData = JSON.parse(jsonContent);
        
        if (!xdtsData.timeTables || !Array.isArray(xdtsData.timeTables)) {
            throw new Error('無効なXDTS形式です: timeTables配列が見つかりません');
        }
    
    debugLog('ファイル', `XDTSファイル読み込み: ${fileName}`);
    
    const startIndex = AppState.sheets.length;
    
    // 各タイムテーブルをシートに変換
    xdtsData.timeTables.forEach((timeTable, tableIndex) => {
        const sheetName = timeTable.name || `XDTS_Sheet${tableIndex + 1}`;
        const duration = timeTable.duration || 144;
        
        // 新しいシートを作成
        const newSheet = {
            name: sheetName,
            frames: duration,
            visibleRows: duration,
            layers: [],
            data: {},
            insertedFrames: [],
            disabledFrames: []
        };
        
        // フィールドからレイヤーを作成
        if (timeTable.fields && timeTable.fields.length > 0) {
            const field = timeTable.fields[0]; // 最初のfieldを使用
            const fieldHeader = timeTable.timeTableHeaders ? 
                timeTable.timeTableHeaders.find(h => h.fieldId === field.fieldId) : null;
            
            if (field.tracks) {
                field.tracks.forEach((track, trackIndex) => {
                    const layerName = (fieldHeader && fieldHeader.names[trackIndex]) || 
                                      String.fromCharCode(97 + trackIndex); // a, b, c, ...
                    const layerId = `L${newSheet.layers.length + 1}`;
                    
                    newSheet.layers.push({
                        id: layerId,
                        name: layerName
                    });
                    
                    // フレームデータを変換（キーフレーム間にホールド"-"を挿入）
                    if (track.frames && track.frames.length > 0) {
                        // フレームをソート
                        const sortedFrames = [...track.frames].sort((a, b) => a.frame - b.frame);
                        
                        for (let i = 0; i < sortedFrames.length; i++) {
                            const frameData = sortedFrames[i];
                            const frameNum = frameData.frame + 1; // 0-basedから1-basedに変換
                            
                            if (!newSheet.data[frameNum]) {
                                newSheet.data[frameNum] = {};
                            }
                            
                            if (frameData.data && frameData.data.length > 0) {
                                const cellData = frameData.data[0];
                                let value = cellData.values[0];
                                
                                // "SYMBOL_NULL_CELL"は空セルとして扱う
                                if (value !== "SYMBOL_NULL_CELL") {
                                    // xdts形式では"a0001"のような形式なので数字部分のみ抽出
                                    // 先頭のゼロを除去して数字のみにする
                                    const numMatch = value.match(/(\d+)$/);
                                    if (numMatch) {
                                        value = String(parseInt(numMatch[1], 10));
                                    }
                                    
                                    newSheet.data[frameNum][layerId] = value;
                                    
                                    // 次のキーフレームまでの間に実際の値を保持（ホールド）
                                    const nextFrame = sortedFrames[i + 1];
                                    if (nextFrame) {
                                        const nextFrameNum = nextFrame.frame + 1;
                                        for (let f = frameNum + 1; f < nextFrameNum; f++) {
                                            if (!newSheet.data[f]) {
                                                newSheet.data[f] = {};
                                            }
                                            newSheet.data[f][layerId] = value;
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
        
        // シートを追加
        AppState.sheets.push(newSheet);
    });
    
    // 新しく追加したシートのみ列が26未満の場合は26列に設定
    const newXdtsSheets = AppState.sheets.slice(startIndex);
    newXdtsSheets.forEach(sheet => {
        if (sheet.layers.length < 26) {
            const maxId = Math.max(...sheet.layers.map(l => {
                const num = parseInt(l.id.replace(/\D/g, ''));
                return isNaN(num) ? 0 : num;
            }), 0);
            const currentCount = sheet.layers.length;
            for (let i = currentCount; i < 26; i++) {
                sheet.layers.push({
                    id: `L${maxId + (i - currentCount) + 1}`,
                    name: String.fromCharCode(65 + i)
                });
            }
        }
    });
    
    // 最後に追加したシートに切り替え
    if (AppState.sheets.length > 0) {
        AppState.currentSheetIndex = AppState.sheets.length - 1;
        
        // 選択状態をクリア
        AppState.selectedCells = [];
        AppState.selectionAnchor = null;
        
        saveHistory('ファイル読み込み');
        renderTabs();
        renderSpreadsheet(true);
        updateWindowTitle();
        showErrorToast(`XDTSファイルから${xdtsData.timeTables.length}個のシートを読み込みました`, ErrorLevel.INFO, 3000);
    }
    
    } catch (error) {
        console.error('XDTSファイル解析エラー:', error);
        throw new Error(`XDTSファイルの解析に失敗しました: ${error.message}`);
    }
}

// ========================================
// STS形式（シラヘイタイムシート）
// ========================================

/**
 * STS形式(.sts)ファイルをTauri環境で読み込み
 */
async function loadStsFileTauri() {
    try {
        const filePath = await window.TauriAPI.openFileDialog({
            filters: [
                { name: 'STS Files', extensions: ['sts'] }
            ]
        });
        
        if (filePath) {
            const fileContent = await window.TauriAPI.loadBinaryFile(filePath);
            parseStsFile(fileContent, filePath.split(/[/\\]/).pop());
        }
    } catch (error) {
        console.error('STSファイル読み込みエラー:', error);
        showErrorToast(`ファイル読み込みエラー: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

/**
 * STS形式(.sts)ファイルをブラウザで読み込み
 */
function loadStsFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            parseStsFile(event.target.result, file.name);
        } catch (error) {
            console.error('STSファイル解析エラー:', error);
            showErrorToast(`ファイル解析エラー: ${error.message}`, ErrorLevel.ERROR, 5000);
        }
    };
    reader.onerror = () => {
        showErrorToast('ファイル読み込みエラー', ErrorLevel.ERROR, 5000);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}

/**
 * STSファイルの内容を解析してシートに変換
 * 
 * フォーマット（解析結果）:
 * - Bytes 0-17: "ShiraheiTimeSheet" (シグネチャ、最初の1バイトは長さマーカー0x11)
 * - Byte 18: レイヤー数
 * - Byte 19: フレーム数
 * - Bytes 20-22: 予約領域（FPS情報など）
 * - Byte 23以降: データ領域（列優先、各列にフレーム数分の2バイトペア）
 * - 最後: 列名セクション（各列名が2バイト）
 * 
 * データレイアウト（列優先）:
 * - ヘッダー: 23バイト
 * - Layer 1: Frame 1-N (各フレーム2バイト: [type, value])
 * - Layer 2: Frame 1-N
 * - ...
 * - Layer M: Frame 1-N
 * - Layer names: [name1, 0x01], [name2, 0x01], ..., [nameM, 0x00or0x01]
 */
function parseStsFile(fileContent, fileName) {
    debugLog('ファイル', `STSファイル読み込み: ${fileName}`);
    
    // バイナリデータをUint8Arrayに変換
    const data = typeof fileContent === 'string' 
        ? new TextEncoder().encode(fileContent)
        : new Uint8Array(fileContent);
    
    // ヘッダーチェック（オフセット1から"ShiraheiTimeSheet"）
    const headerText = String.fromCharCode(...data.slice(1, 18));
    if (!headerText.includes('ShiraheiTimeSheet')) {
        throw new Error('無効なSTSファイル形式です');
    }
    
    // byte 18 - レイヤー数
    const savedLayers = data[18];
    
    // byte 19 - フレーム数
    const totalFrames = data[19];
    
    // byte 20 - FPS (STSファイルにはFPS情報が含まれていないため、デフォルト値を使用)
    const fps = AppState.fps;  // 現在のFPSを維持
    
    debugLog('ファイル', `レイヤー数: ${savedLayers}, フレーム数: ${totalFrames}, FPS: ${fps}`);
    debugLog('ファイル', `ファイルサイズ: ${data.length} bytes`);
    
    // 表示列数はSTSファイルの列数または26の大きい方
    const displayColumns = Math.max(savedLayers, 26);
    
    // シート名
    const sheetName = fileName.replace('.sts', '');
    
    // 新しいシートを作成
    const newSheet = {
        name: sheetName,
        frames: totalFrames,
        framePageSize: totalFrames, // フレームページサイズをフレーム数に設定
        layers: [],
        data: {},
        visibleColumns: displayColumns,
        visibleRows: totalFrames
    };
    
    // データセクションのサイズを計算（Column-major、2バイト/セル）
    const framesPerColumn = totalFrames;  // Byte 19の値
    const dataSectionSize = savedLayers * framesPerColumn * 2;
    const layerNamesOffset = 23 + dataSectionSize + 1;  // ヘッダー23バイト + データ + 1バイトギャップ
    
    // 列名を読み取る
    const layerNames = [];
    for (let i = 0; i < savedLayers; i++) {
        const offset = layerNamesOffset + i * 2;
        if (offset < data.length) {
            const nameChar = String.fromCharCode(data[offset]);
            layerNames.push(nameChar);
        } else {
            layerNames.push(String.fromCharCode(65 + i)); // A, B, C...
        }
    }
    
    // displayColumns分の列を作成（読み取った列名またはデフォルト名を使用）
    for (let i = 0; i < displayColumns; i++) {
        let layerName;
        if (i < layerNames.length) {
            // STSファイルから読み取った列名を使用
            layerName = layerNames[i];
        } else {
            // デフォルト名を生成（A, B, ..., Z, AA, AB, ...）
            layerName = getLayerName(i);
        }
        newSheet.layers.push({
            id: `L${i + 1}`,
            name: layerName
        });
    }
    
    // データを読み取り（列優先、ヘッダー23バイト後から開始）
    debugLog('ファイル', `データ読み取り開始: framesPerColumn=${framesPerColumn}, layerNamesOffset=${layerNamesOffset}`);
    
    let cellsRead = 0;
    for (let layer_num = 1; layer_num <= savedLayers; layer_num++) {
        const layer_id = `L${layer_num}`;
        
        // この列の開始オフセット（ヘッダー23バイト + 列オフセット）
        const column_start = 23 + (layer_num - 1) * framesPerColumn * 2;
        
        // フレーム1から144まで順に読む
        for (let frame_num = 1; frame_num <= totalFrames; frame_num++) {
            const offset = column_start + (frame_num - 1) * 2;
            
            if (offset + 1 >= layerNamesOffset || offset + 1 >= data.length) break;
            
            // 2バイトペアを読み取り: [value, type]
            const value_byte = data[offset];  // 値は最初のバイト
            
            // valueByte が 0 でない場合、セルに値を設定
            if (value_byte !== 0 && layer_num <= displayColumns) {
                if (!newSheet.data[frame_num]) {
                    newSheet.data[frame_num] = {};
                }
                
                newSheet.data[frame_num][layer_id] = value_byte.toString();
                cellsRead++;
                
                // 最初の5個だけログ
                if (cellsRead <= 5) {
                    debugLog('ファイル', `セル読み取り: F${frame_num}${layer_id}=${value_byte}`);
                }
            }
        }
    }
    
    debugLog('ファイル', `データ読み取り完了: ${cellsRead}個のセル`);
    
    debugLog('ファイル', `読み込み完了: ${totalFrames}フレーム × ${savedLayers}レイヤー`);
    
    // シートを追加
    AppState.sheets.push(newSheet);
    AppState.currentSheetIndex = AppState.sheets.length - 1;
    
    // FPSは変更しない（STSファイルにはFPS情報が含まれていない）
    
    // 選択状態をクリア
    AppState.selectedCells = [];
    AppState.selectionAnchor = null;
    
    saveHistory('ファイル読み込み');
    renderTabs();
    renderSpreadsheet(true);
    updateWindowTitle();
    updateDurationDisplay(); // タイム表示を更新
    showErrorToast(`STSファイルを読み込みました (${totalFrames}フレーム, ${savedLayers}レイヤー)`, ErrorLevel.INFO, 3000);
}

/**
 * STSファイルとして保存
 */
async function saveStsFile() {
    try {
        const sheet = getCurrentSheet();
        
        // 無効行（disabledFrames）のチェック
        let includeDisabledFrames = true;
        if (sheet.disabledFrames && sheet.disabledFrames.length > 0) {
            const disabledCount = sheet.disabledFrames.length;
            const confirmed = await window.TauriAPI.showConfirmDialog(
                `${disabledCount}個の無効行が存在します。\n\n無効行も含めて保存しますか？\n\n「はい」: 無効行も通常の行として保存（無効フラグは失われます）\n「いいえ」: 無効行をスキップして保存`,
                '無効行の処理'
            );
            
            // confirmはtrue/falseを返す（キャンセルボタンはない）
            includeDisabledFrames = confirmed;
        }
        
        const buffer = generateStsBuffer(sheet, includeDisabledFrames);
        if (!buffer) return; // >255フレームでバリデーション失敗        
        // Tauri環境: ファイルダイアログで保存
        if (window.TauriAPI) {
            const filePath = await window.TauriAPI.saveFileDialog({
                filters: [
                    { name: 'STS Files', extensions: ['sts'] }
                ],
                defaultPath: `${sheet.name}.sts`
            });
            
            if (filePath) {
                await window.TauriAPI.saveBinaryFile(filePath, Array.from(buffer));
                sheet.filePath = filePath;
                updateWindowTitle();
                updateStatusBar(`STSファイルを保存しました: ${filePath}`);
                showErrorToast('STSファイルを保存しました', ErrorLevel.INFO, 3000);
            }
        } else {
            // ブラウザ環境: ダウンロード
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${sheet.name}.sts`;
            a.click();
            URL.revokeObjectURL(url);
            showErrorToast('STSファイルをダウンロードしました', ErrorLevel.INFO, 3000);
        }
    } catch (error) {
        console.error('STS保存エラー:', error);
        showErrorToast(`STS保存エラー: ${error.message}`, ErrorLevel.ERROR, 5000);
    }
}

/**
 * シートデータからSTSバイナリバッファを生成
 * 
 * フォーマット:
 * - Bytes 0-17: "ShiraheiTimeSheet" (シグネチャ、最初の1バイトは長さマーカー0x11)
 * - Byte 18: レイヤー数
 * - Byte 19: フレーム数
 * - Bytes 20-22: 予約領域 (0x00)
 * - Byte 23以降: データ領域（列優先、各列にフレーム数分の2バイトペア [value, type]）
 * - ギャップ: 0x01
 * - レイヤー名: 各レイヤー2バイト [ASCII, 0x01]（最後は1バイトの場合あり）
 * 
 * @param {Object} sheet - シートデータ
 * @param {boolean} includeDisabledFrames - 無効行を含めるか（デフォルト: true）
 */
function generateStsBuffer(sheet, includeDisabledFrames = true) {
    const layers = sheet.layers;
    const originalFrames = sheet.frames;
    const layerCount = layers.length;
    const disabledFrames = sheet.disabledFrames || [];
    
    // 有効なフレームのリストを作成
    let validFrames = [];
    for (let frame = 1; frame <= originalFrames; frame++) {
        if (includeDisabledFrames || !disabledFrames.includes(frame)) {
            validFrames.push(frame);
        }
    }
    
    const actualFrameCount = validFrames.length;
    
    // STS形式は最大255フレーム・255列まで（1バイトで格納）
    if (actualFrameCount > 255) {
        showErrorToast(`STS形式は最大255フレームまでです（現在: ${actualFrameCount}フレーム）。DITIS形式で保存してください。`, ErrorLevel.ERROR, 5000);
        return null;
    }
    if (layerCount > 255) {
        showErrorToast(`STS形式は最大255列までです（現在: ${layerCount}列）。DITIS形式で保存してください。`, ErrorLevel.ERROR, 5000);
        return null;
    }
    
    // ファイルサイズ計算: 23 + (layers × frames × 2) + 1 + (layers × 2)
    const dataSize = layerCount * actualFrameCount * 2;
    const layerNamesSize = layerCount * 2;
    const bufferSize = 23 + dataSize + 1 + layerNamesSize;
    
    const buffer = new Uint8Array(bufferSize);
    let offset = 0;
    
    // ヘッダー: "ShiraheiTimeSheet"
    buffer[offset++] = 0x11; // 長さマーカー (17)
    const signature = "ShiraheiTimeSheet";
    for (let i = 0; i < signature.length; i++) {
        buffer[offset++] = signature.charCodeAt(i);
    }
    
    // レイヤー数とフレーム数（無効行を除外した実際のフレーム数）
    buffer[offset++] = layerCount;
    buffer[offset++] = actualFrameCount;
    
    // 予約領域 (3バイト)
    buffer[offset++] = 0x00;
    buffer[offset++] = 0x00;
    buffer[offset++] = 0x00;
    
    // データセクション (列優先)
    debugLog('ファイル', `STS書き出し: ${layerCount}列 × ${actualFrameCount}フレーム (元: ${originalFrames}フレーム, 無効行を${includeDisabledFrames ? '含む' : '除外'})`);
    
    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
        const layerId = layers[layerIdx].id;
        
        // 有効なフレームのみを書き込み（連番になる）
        for (let validFrame of validFrames) {
            // データ取得: data[validFrame][layerId]
            const value = sheet.data[validFrame]?.[layerId] || "";
            
            // 値を数値に変換（空文字列は0）
            let valueByte = 0;
            if (value !== "" && value !== null && value !== undefined) {
                // レガシーデータの"-"（ホールドマーカー）を実際の値に解決
                let resolvedValue = value;
                if (value === '-') {
                    for (let prevF = validFrames.indexOf(validFrame) - 1; prevF >= 0; prevF--) {
                        const pv = sheet.data[validFrames[prevF]]?.[layerId] || '';
                        if (pv !== '' && pv !== '-') {
                            resolvedValue = pv;
                            break;
                        }
                    }
                }
                const parsed = parseInt(resolvedValue);
                valueByte = isNaN(parsed) ? 0 : Math.min(255, Math.max(0, parsed));
            }
            
            // 2バイト書き込み: [value, type]
            buffer[offset++] = valueByte;
            buffer[offset++] = 0x00; // type (常に0x00)
        }
    }
    
    // ギャップ (1バイト)
    buffer[offset++] = 0x01;
    
    // レイヤー名セクション
    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
        const layerName = layers[layerIdx].name;
        // 最初の1文字のASCIIコード
        buffer[offset++] = layerName.charCodeAt(0);
        // フラグ (0x01)
        buffer[offset++] = 0x01;
    }
    
    debugLog('ファイル', `STSバッファ生成完了: ${buffer.length}バイト`);
    
    return buffer;
}
