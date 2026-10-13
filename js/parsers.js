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

// XDTS v5 (2018) / v10 (2022) share the same cell instruction format.
const TIMESHEET_SYMBOLS = Object.freeze({
    SYMBOL_NULL_CELL: '×', SYMBOL_TICK_1: '○', SYMBOL_TICK_2: '●'
});

function encodeTimesheetValue(value) {
    if (value === '-' || value === 'SYMBOL_HYPHEN') return 'SYMBOL_HYPHEN';
    if (value === undefined || value === null || value === '' || value === '×') return 'SYMBOL_NULL_CELL';
    if (value === '○') return 'SYMBOL_TICK_1';
    if (value === '●') return 'SYMBOL_TICK_2';
    return String(value);
}

function cloneTimesheetData(value) { return JSON.parse(JSON.stringify(value)); }

function buildTimesheetTable(sheet, fieldId, sourceTable) {
    if (!Number.isInteger(sheet.frames) || sheet.frames < 1) throw new Error('シートの尺が不正です');
    // These file formats do not define an FPS property; Toei uses 24 fps.
    if ((sheet.fps ?? 24) !== 24) throw new Error('TDTS・XDTSの保存は24fpsのみ対応しています');
    const table = sourceTable ? cloneTimesheetData(sourceTable) : {};
    const originalField = table.fields?.find(field => field.fieldId === fieldId);
    const tracks = sheet.layers.map((layer, trackNo) => {
        const sourceTrackNo = sheet.timesheetSource?.layerTrackNos?.[layer.id];
        const originalTrack = originalField?.tracks?.find(track => track.trackNo === sourceTrackNo);
        const originalFrames = new Map((originalTrack?.frames || []).map(frame => [frame.frame, frame]));
        const frames = [];
        let previous = 'SYMBOL_NULL_CELL';
        for (let f = 1; f <= sheet.frames; f++) {
            const value = encodeTimesheetValue(sheet.data[f]?.[layer.id]);
            const original = originalFrames.get(f - 1);
            // Keep source entries (including memos/colour/other instructions),
            // and explicit blank transitions so sparse data cannot extend a cel.
            if (original || value !== previous || value === 'SYMBOL_HYPHEN') {
                const entry = original ? cloneTimesheetData(original) : { frame: f - 1, data: [] };
                entry.data ||= [];
                const instruction = entry.data.find(data => data.id === 0);
                if (instruction) instruction.values = [value];
                else entry.data.unshift({ id: 0, values: [value] });
                frames.push(entry);
            }
            if (value !== 'SYMBOL_HYPHEN') previous = value;
        }
        return { ...(originalTrack || {}), trackNo, frames };
    });
    const field = { ...(originalField || {}), fieldId, tracks };
    table.fields = [...(table.fields || []).filter(f => f.fieldId !== fieldId), field];
    const oldHeader = table.timeTableHeaders?.find(h => h.fieldId === fieldId);
    table.timeTableHeaders = [...(table.timeTableHeaders || []).filter(h => h.fieldId !== fieldId),
        { ...(oldHeader || {}), fieldId, names: sheet.layers.map(layer => layer.name) }];
    table.duration = sheet.frames;
    table.name = sheet.name;
    return table;
}

function generateTdtsData(sheet) {
    const source = sheet.timesheetSource?.format === 'TDTS' ? sheet.timesheetSource : null;
    const fieldId = source?.fieldId ?? 0; // ACTION supports both cel names and inbetween symbols.
    if (fieldId === 4 && sheet.layers.some(layer => Object.values(sheet.data).some(row => {
        const value = encodeTimesheetValue(row?.[layer.id]);
        return !['SYMBOL_NULL_CELL', 'SYMBOL_HYPHEN'].includes(value) && !/^\d+$/.test(value);
    }))) throw new Error('TDTSのCELL欄は数字と空セルのみ対応しています。文字列や中割を保存する場合はXDTSまたはDiTiS形式を使用してください');
    const document = source ? cloneTimesheetData(source.document) : { header: { cut: '', scene: '', episode: '', direction: '', colors: [[255, 255, 255], [255, 255, 255], [255, 255, 255]] },
        timeTables: [{ color: 0, operatorName: '', direction: '', headDummykomas: 24, footDummykomas: 24 }] };
    const tableIndex = source?.tableIndex ?? 0;
    document.timeTables[tableIndex] = buildTimesheetTable(sheet, fieldId, document.timeTables[tableIndex]);
    const version = source?.version ?? 5;
    return version < 7 ? { ...document, version } : { timeSheets: [document], version };
}

function generateXdtsData(sheet) {
    const source = sheet.timesheetSource?.format === 'XDTS' ? sheet.timesheetSource : null;
    const document = source ? cloneTimesheetData(source.document) : {};
    const table = buildTimesheetTable(sheet, 0, source?.document.timeTables[source.tableIndex]);
    // v10 is required for camera coordinates; v5 remains compatible with older readers.
    const version = source?.version === 10 || table.fields.some(f => f.fieldId === 5 &&
        f.tracks?.some(t => t.frames?.some(frame => frame.data?.some(d => d.values?.length > 1)))) ? 10 : 5;
    return { ...document, timeTables: [table], version };
}

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
    importExchangeTimesheet(fileContent, fileName, 'TDTS');
}

/** Read old flat TDTS v5 and wrapped TDTS v7+ without changing cel names. */
function importExchangeTimesheet(fileContent, fileName, format) {
    try {
        const lines = fileContent.replace(/^\uFEFF/, '').split(/\r?\n/);
        const signature = format === 'TDTS' ? 'toeiDigitalTimeSheet Save Data' : 'exchangeDigitalTimeSheet Save Data';
        if (lines.shift() !== signature) throw new Error('ファイル先頭の識別行が不正です');
        const root = JSON.parse(lines.join('\n'));
        const documents = format === 'TDTS' && Array.isArray(root.timeSheets) ? root.timeSheets : [root];
        const imported = [];
        for (const document of documents) {
            if (!Array.isArray(document.timeTables) || !document.timeTables.length) throw new Error('timeTables配列がありません');
            // TDTS tables are successive revisions; import the newest revision.
            // XDTS tables are independent timelines and are all imported.
            const indexes = format === 'TDTS' ? [document.timeTables.length - 1] : document.timeTables.map((_, i) => i);
            for (const tableIndex of indexes) {
                const table = document.timeTables[tableIndex];
                if (!Number.isInteger(table.duration) || table.duration < 1) throw new Error('durationが不正です');
                const fields = table.fields || [];
                const hasContent = f => f?.tracks?.some(t => t.frames?.some(frame => frame.data?.some(d =>
                    d.id === 0 && d.values?.some(v => v !== '' && v !== 'SYMBOL_NULL_CELL'))));
                const cell = fields.find(f => f.fieldId === 4);
                const action = fields.find(f => f.fieldId === 0);
                const field = format === 'TDTS' && hasContent(cell) ? cell : action || cell;
                const fieldId = field?.fieldId ?? (format === 'TDTS' ? 4 : 0);
                const names = table.timeTableHeaders?.find(h => h.fieldId === fieldId)?.names || [];
                const tracks = field?.tracks || [];
                const numbers = tracks.map(t => t.trackNo);
                if (numbers.some(n => !Number.isInteger(n) || n < 0) || new Set(numbers).size !== numbers.length) {
                    throw new Error('trackNoが不正または重複しています');
                }
                const count = Math.max(26, names.length, ...numbers.map(n => n + 1));
                const sheet = { name: table.name || `${format}_Sheet${imported.length + 1}`, frames: table.duration,
                    fps: 24, visibleRows: table.duration, layers: [], data: {}, insertedFrames: [], disabledFrames: [],
                    timesheetSource: { format, version: root.version ?? 5, document: cloneTimesheetData(document), tableIndex, fieldId } };
                sheet.timesheetSource.layerTrackNos = {};
                for (let i = 0; i < count; i++) {
                    sheet.layers.push({ id: `L${i + 1}`, name: names[i] ?? getLayerName(i) });
                    sheet.timesheetSource.layerTrackNos[`L${i + 1}`] = i;
                }
                for (const track of tracks) {
                    const entries = new Map();
                    for (const frame of track.frames || []) {
                        if (!Number.isInteger(frame.frame)) throw new Error('frameが不正です');
                        if (format === 'XDTS' && frame.frame < 0) throw new Error('frameが負数です');
                        if (frame.frame < 0 || frame.frame >= table.duration) continue;
                        const instruction = frame.data?.find(d => d.id === 0);
                        if (!instruction) continue;
                        if (!Array.isArray(instruction.values) || typeof instruction.values[0] !== 'string') throw new Error('valuesが不正です');
                        entries.set(frame.frame, instruction.values[0]);
                    }
                    let value = '';
                    for (let frame = 0; frame < table.duration; frame++) {
                        const instruction = entries.get(frame);
                        if (instruction !== undefined && instruction !== 'SYMBOL_HYPHEN') value = TIMESHEET_SYMBOLS[instruction] ?? instruction;
                        if (value !== '') {
                            sheet.data[frame + 1] ||= {};
                            sheet.data[frame + 1][`L${track.trackNo + 1}`] = value;
                        }
                    }
                }
                imported.push(sheet);
            }
        }
        if (!imported.length) throw new Error('読み込めるシートがありません');
        // Validate the entire file first; a bad later table must not leave partial tabs.
        AppState.sheets.push(...imported);
        AppState.currentSheetIndex = AppState.sheets.length - 1;
        AppState.selectedCells = [];
        AppState.selectionAnchor = null;
        saveHistory('ファイル読み込み');
        renderTabs(); renderSpreadsheet(true); updateWindowTitle();
        debugLog('ファイル', `${format}ファイル読み込み: ${fileName}`);
        showErrorToast(`${format}ファイルから${imported.length}個のシートを読み込みました`, ErrorLevel.INFO, 3000);
    } catch (error) {
        throw new Error(`${format}ファイルの解析に失敗しました: ${error.message}`);
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
    importExchangeTimesheet(fileContent, fileName, 'XDTS');
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
 * - Layer names: [name1..., 0x01], [name2..., 0x01], ..., [nameM..., 0x00or0x01]
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
    const layerNamesOffset = 23 + dataSectionSize;  // ヘッダー23バイト + データ
    
    // 列名を読み取る（[長さバイト][文字バイト列] のPascal文字列形式）
    const layerNames = [];
    let namePos = layerNamesOffset;
    for (let i = 0; i < savedLayers; i++) {
        if (namePos >= data.length) break;
        const nameLen = data[namePos++];
        const nameBytes = [];
        for (let j = 0; j < nameLen && namePos < data.length; j++) {
            nameBytes.push(data[namePos++]);
        }
        if (nameBytes.length > 0) {
            layerNames.push(new TextDecoder().decode(new Uint8Array(nameBytes)));
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
 * - レイヤー名: 各レイヤー可変長 [文字列バイト列..., 0x01]
 * 
 * @param {Object} sheet - シートデータ
 * @param {boolean} includeDisabledFrames - 無効行を含めるか（デフォルト: true）
 */
function generateStsBuffer(sheet, includeDisabledFrames = true) {
    const layers = sheet.layers;
    const originalFrames = sheet.frames;
    const layerCount = layers.length;
    const disabledFrames = sheet.disabledFrames || [];
    const disabledSet = new Set(disabledFrames);
    
    // 有効なフレームのリストを作成
    let validFrames = [];
    for (let frame = 1; frame <= originalFrames; frame++) {
        if (includeDisabledFrames || !disabledSet.has(frame)) {
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
    
    // ファイルサイズ計算: 23 + (layers × frames × 2) + 1 + (各レイヤー名: 長さバイト1 + UTF-8バイト列)
    const dataSize = layerCount * actualFrameCount * 2;
    const encoder = new TextEncoder();
    const encodedLayerNames = layers.map(l => encoder.encode(l.name));
    let layerNamesSize = 0;
    for (let i = 0; i < layerCount; i++) {
        layerNamesSize += 1 + encodedLayerNames[i].length; // 長さバイト1 + UTF-8バイト数
    }
    const bufferSize = 23 + dataSize + layerNamesSize;
    
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
        for (let idx = 0; idx < validFrames.length; idx++) {
            const validFrame = validFrames[idx];
            // データ取得: data[validFrame][layerId]
            const value = sheet.data[validFrame]?.[layerId] || "";
            
            // 値を数値に変換（空文字列は0）
            let valueByte = 0;
            if (value !== "" && value !== null && value !== undefined) {
                // レガシーデータの"-"（ホールドマーカー）を実際の値に解決
                let resolvedValue = value;
                if (value === '-') {
                    for (let prevF = idx - 1; prevF >= 0; prevF--) {
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
    
    // レイヤー名セクション（[長さバイト][UTF-8文字バイト列] のPascal文字列形式）
    for (let layerIdx = 0; layerIdx < layerCount; layerIdx++) {
        const nameBytes = encodedLayerNames[layerIdx];
        buffer[offset++] = nameBytes.length; // 長さバイト
        buffer.set(nameBytes, offset);
        offset += nameBytes.length;
    }
    
    debugLog('ファイル', `STSバッファ生成完了: ${buffer.length}バイト`);
    
    return buffer;
}
