/**
 * export.js
 * ExtendScript出力処理を担当するモジュール
 */

/**
 * ExtendScript用の文字列エスケープ
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープ済み文字列
 */
function escapeJsx(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

/**
 * After Effectsにスクリプトを送信（コマンドライン実行）
 */
async function sendToAfterEffects() {
    const jsx = generateJSXSingleComp();
    
    debugLog('ファイル', 'After Effectsにスクリプト送信開始');
    
    // エラーメッセージを現在の言語に変換
    const currentLang = getCurrentLanguage();
    const errorMsg = i18n[currentLang].error.aeNotRunning;
    
    try {
        if (window.TauriAPI && window.TauriAPI.executeAfterEffectsScript) {
            // Tauri環境: コマンドライン実行
            await window.TauriAPI.executeAfterEffectsScript(jsx);
            updateStatusBar('After Effectsにスクリプトを送信しました');
            debugLog('ファイル', 'After Effectsスクリプト実行成功');
        } else {
            // ブラウザ環境: エラーメッセージ
            alert(i18n[getCurrentLanguage()].error.aeDesktopOnly);
        }
    } catch (error) {
        console.error('After Effects実行エラー:', error);
        // エラーメッセージを多言語対応に変換
        const errorStr = String(error?.message || error || '');
        let displayError = errorStr;
        if (errorStr.includes('After Effects')) {
            displayError = errorMsg;
        }
        
        if (window.__TAURI__ && window.__TAURI__.dialog) {
            await window.__TAURI__.dialog.message(displayError, { 
                title: i18n[currentLang].dialogTitle.warning, 
                type: 'warning' 
            });
        } else {
            alert(displayError);
        }
    }
}

/**
 * ExtendScriptファイルをエクスポート
 */
async function exportJSX() {
    const jsx = generateJSXSingleComp();
    
    // 現在のシート名をファイル名に使用
    const sheet = getCurrentSheet();
    const defaultFilename = `${sheet.name}.jsx`;
    
    debugLog('ファイル', 'ExtendScriptエクスポート開始', {filename: defaultFilename});
    
    // Tauri環境の場合は保存ダイアログを表示
    if (window.TauriAPI && window.TauriAPI.saveFileDialog) {
        try {
            const filePath = await window.TauriAPI.saveFileDialog({
                defaultPath: defaultFilename,
                filters: [
                    { name: 'Adobe ExtendScript Files', extensions: ['jsx'] }
                ]
            });
            
            if (filePath) {
                await window.TauriAPI.saveFile(filePath, jsx);
                updateStatusBar('ExtendScriptファイルを出力しました');
                debugLog('ファイル', 'ExtendScriptファイル保存完了', {filePath});
            }
        } catch (error) {
            console.error('ファイル保存エラー:', error);
            showErrorToast('ファイルの保存に失敗しました', ErrorLevel.ERROR, 5000);
        }
    } else {
        // ブラウザ環境の場合は従来のダウンロード方式
        downloadTextFile(jsx, defaultFilename);
        updateStatusBar('ExtendScriptファイルを出力しました');
    }
}


/**
 * 単一コンポジション用のExtendScriptコードを生成
 * @returns {string} ExtendScriptコード
 */
function generateJSXSingleComp() {
    const sheet = getCurrentSheet();
    const lang = getCurrentLanguage();
    
    let jsx = '';
    
    // 即時関数でラップして早期returnを可能に
    jsx += '(function() {\n';
    jsx += '  var ADBE_TIME_REMAPPING = "ADBE Time Remapping";\n';
    jsx += '  var ADBE_EFFECT_PARADE = "ADBE Effect Parade";\n';
    jsx += '  var ADBE_VENETIAN_BLINDS = "ADBE Venetian Blinds";\n';
    jsx += '  var ADBE_VENETIAN_BLINDS_0001 = "ADBE Venetian Blinds-0001";\n';
    jsx += '  \n';
    
    // 多言語テキストを埋め込み
    jsx += generateExtendScriptI18n(lang);
    
    jsx += '  var comp = app.project.activeItem;\n';
    jsx += '  if (comp == null || !(comp instanceof CompItem)) {\n';
    jsx += `    alert(i18n.error.noActiveComp);\n`;
    jsx += '    return;\n';
    jsx += '  }\n';
    jsx += '  \n';
    jsx += `  var fps = ${AppState.fps};\n`;
    jsx += '  var selectedLayers = comp.selectedLayers;\n';
    jsx += '  \n';
    jsx += '  // フレームレートの一致チェック\n';
    jsx += '  if (Math.abs(comp.frameRate - fps) > 0.01) {\n';
    jsx += '    var continueExec = confirm(\n';
    jsx += '      "警告: コンポジションのフレームレート (" + comp.frameRate.toFixed(2) + " fps) と\\n" +\n';
    jsx += '      "シートのフレームレート (" + fps + " fps) が一致しません。\\n\\n" +\n';
    jsx += '      "このまま続行しますか？"\n';
    jsx += '    );\n';
    jsx += '    if (!continueExec) return;\n';
    jsx += '  }\n';
    jsx += '  \n';
    jsx += '  // AVLayerのみをフィルタリング\n';
    jsx += '  var avLayers = [];\n';
    jsx += '  if (selectedLayers.length === 0) {\n';
    jsx += '    // レイヤーが選択されていない場合は全AVLayerを対象\n';
    jsx += '    for (var i = 1; i <= comp.numLayers; i++) {\n';
    jsx += '      var layer = comp.layer(i);\n';
    jsx += '      if (layer instanceof AVLayer) {\n';
    jsx += '        avLayers.push(layer);\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '  } else {\n';
    jsx += '    // 選択されたレイヤーからAVLayerのみを抽出\n';
    jsx += '    for (var i = 0; i < selectedLayers.length; i++) {\n';
    jsx += '      if (selectedLayers[i] instanceof AVLayer) {\n';
    jsx += '        avLayers.push(selectedLayers[i]);\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '  }\n';
    jsx += '  selectedLayers = avLayers;\n';
    jsx += '  \n';
    jsx += '  if (selectedLayers.length === 0) {\n';
    jsx += `    alert(i18n.error.noLayers);\n`;
    jsx += '    return;\n';
    jsx += '  }\n';
    jsx += '  \n';
    
    // 列名リストを作成
    const layerNames = sheet.layers.map(l => l.name);
    jsx += `  var sheetColumns = ["×", ${layerNames.map(n => `"${escapeJsx(n)}"`).join(', ')}];\n`;
    jsx += '  \n';
    
    // 列データを配列として生成（連続する同じ値を圧縮）
    jsx += '  // 列データ定義（キーフレーム形式）\n';
    jsx += '  var columnData = [\n';
    
    const allColumnsData = [];
    
    sheet.layers.forEach((layer, colIndex) => {
        const keyframes = [];
        let lastValue = null;
        let frameIndex = 0;
        
        for (let frame = 1; frame <= sheet.frames; frame++) {
            if (sheet.disabledFrames && sheet.disabledFrames.includes(frame)) {
                continue;
            }
            
            const value = sheet.data[frame] && sheet.data[frame][layer.id];
            const currentValue = value || '';
            
            // 値が変わった時だけ記録
            if (currentValue !== lastValue) {
                keyframes.push({
                    frame: frameIndex,
                    value: currentValue
                });
                lastValue = currentValue;
            }
            
            frameIndex++;
        }
        
        allColumnsData.push(keyframes);
    });
    
    // 各列のキーフレームデータを出力
    allColumnsData.forEach((keyframes, colIndex) => {
        jsx += `    {frames:[`;
        keyframes.forEach((kf, idx) => {
            jsx += `${kf.frame}`;
            if (idx < keyframes.length - 1) jsx += ',';
        });
        jsx += `],values:[`;
        keyframes.forEach((kf, idx) => {
            jsx += `"${escapeJsx(kf.value)}"`;
            if (idx < keyframes.length - 1) jsx += ',';
        });
        jsx += `]}`;
        if (colIndex < allColumnsData.length - 1) jsx += ',\n';
    });
    
    jsx += '\n  ];\n';
    jsx += '  \n';
    
    // ダイアログ作成
    jsx += '  var tsWin = new Window("dialog", i18n.dialog.title, undefined, {resizeable: true});\n';
    jsx += '  tsWin.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.FILL];\n';
    jsx += '  tsWin.spacing = 3;\n';
    jsx += '  \n';
    jsx += '  tsWin.add("statictext", undefined, i18n.dialog.selectLayer);\n';
    jsx += '  tsWin.add("statictext", undefined, i18n.dialog.frameInfo);\n';
    jsx += '  \n';
    jsx += '  // レイヤーを名前でソート（降順：Z→A）\n';
    jsx += '  // ※ただし元々comp.selectedLayers由来の場合のみソート（全レイヤーの場合はソート不要）\n';
    jsx += '  var sortedLayers = [];\n';
    jsx += '  var needsSort = comp.selectedLayers.length > 0;\n';
    jsx += '  for (var i = 0; i < selectedLayers.length; i++) {\n';
    jsx += '    sortedLayers.push(selectedLayers[i]);\n';
    jsx += '  }\n';
    jsx += '  if (needsSort) {\n';
    jsx += '    sortedLayers.sort(function(a, b) {\n';
    jsx += '      var nameA = a.name.toUpperCase();\n';
    jsx += '      var nameB = b.name.toUpperCase();\n';
    jsx += '      if (nameA < nameB) return 1;\n';
    jsx += '      if (nameA > nameB) return -1;\n';
    jsx += '      return 0;\n';
    jsx += '    });\n';
    jsx += '  }\n';
    jsx += '  \n';
    jsx += '  // レイヤーリストを作成（動的に列数を決定）\n';
    jsx += '  var totalLayers = sortedLayers.length;\n';
    jsx += '  var layersPerColumn = 13;\n';
    jsx += '  var numColumns = totalLayers <= layersPerColumn ? 1 : Math.ceil(totalLayers / layersPerColumn);\n';
    jsx += '  var actualLayersPerColumn = Math.ceil(totalLayers / numColumns);\n';
    jsx += '  \n';
    jsx += '  var celPanel = tsWin.add("panel");\n';
    jsx += '  celPanel.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.FILL];\n';
    jsx += '  celPanel.orientation = "column";\n';
    jsx += '  \n';
    jsx += '  var topGrp = celPanel.add("group");\n';
    jsx += '  topGrp.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.FILL];\n';
    jsx += '  topGrp.orientation = "row";\n';
    jsx += '  topGrp.margins = [0, 0, 0, 0];\n';
    jsx += '  topGrp.spacing = 10;\n';
    jsx += '  \n';
    jsx += '  var dropdowns = [];\n';
    jsx += '  var layerIndexMap = [];\n';
    jsx += '  var curTopGrp = null;\n';
    jsx += '  \n';
    jsx += '  for (var i = 0; i < sortedLayers.length; i++) {\n';
    jsx += '    // 計算された列数に基づいて新しい列を作成\n';
    jsx += '    if (i % actualLayersPerColumn === 0) {\n';
    jsx += '      if (i !== 0) {\n';
    jsx += '        var tempPanel = topGrp.add("panel");\n';
    jsx += '        tempPanel.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.FILL];\n';
    jsx += '        tempPanel.maximumSize.width = 1;\n';
    jsx += '      }\n';
    jsx += '      curTopGrp = topGrp.add("group");\n';
    jsx += '      curTopGrp.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.FILL];\n';
    jsx += '      curTopGrp.orientation = "column";\n';
    jsx += '      curTopGrp.margins = [0, 0, 0, 0];\n';
    jsx += '      curTopGrp.spacing = 1;\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    // 元のインデックスを保存\n';
    jsx += '    for (var j = 0; j < selectedLayers.length; j++) {\n';
    jsx += '      if (sortedLayers[i] === selectedLayers[j]) {\n';
    jsx += '        layerIndexMap[i] = j;\n';
    jsx += '        break;\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    var rowGrp = curTopGrp.add("group");\n';
    jsx += '    rowGrp.orientation = "row";\n';
    jsx += '    rowGrp.margins = [0, 0, 0, 0];\n';
    jsx += '    rowGrp.spacing = 3;\n';
    jsx += '    rowGrp.alignment = [ScriptUI.Alignment.RIGHT, ScriptUI.Alignment.FILL];\n';
    jsx += '    \n';
    jsx += '    var layerNameText = rowGrp.add("statictext", undefined, (sortedLayers[i].name || "レイヤー" + (i+1)).substring(0, 7) + " :");\n';
    jsx += '    layerNameText.alignment = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.FILL];\n';
    jsx += '    var dropdown = rowGrp.add("dropdownlist", undefined, sheetColumns);\n';
    jsx += '    dropdown.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.FILL];\n';
    jsx += '    \n';
    jsx += '    var infoText = rowGrp.add("statictext", undefined, "");\n';
    jsx += '    infoText.alignment = [ScriptUI.Alignment.RIGHT, ScriptUI.Alignment.FILL];\n';
    jsx += '    infoText.characters = 8;\n';
    jsx += '    infoText.justify = "right";\n';
    jsx += '    rowGrp.add("statictext", undefined, "   ");\n';
    jsx += '    \n';
    jsx += '    // レイヤーインデックスを保存\n';
    jsx += '    dropdown.layerIndex = i;\n';
    jsx += '    dropdown.infoText = infoText;\n';
    jsx += '    \n';
    jsx += '    // レイヤーのセル枚数を取得する関数\n';
    jsx += '    dropdown.updateInfo = function() {\n';
    jsx += '      var selIdx = this.selection.index;\n';
    jsx += '      if (selIdx === 0) {\n';
    jsx += '        this.infoText.text = i18n.info.notApplicable;\n';
    jsx += '        this.infoText.graphics.foregroundColor = this.infoText.graphics.newPen(this.infoText.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);\n';
    jsx += '        return;\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      var layer = sortedLayers[this.layerIndex];\n';
    jsx += '      var sourceFrames = 0;\n';
    jsx += '      if (layer.source && layer.source.duration) {\n';
    jsx += '        sourceFrames = Math.floor(layer.source.duration * fps);\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // 実際の列インデックス（×分を引く）\n';
    jsx += '      var colIdx = selIdx - 1;\n';
    jsx += '      \n';
    jsx += '      // 選択列の最大コマ数を取得\n';
    jsx += '      var maxFrame = 0;\n';
    jsx += '      if (columnData[colIdx] != null) {\n';
    jsx += '        for (var k = 0; k < columnData[colIdx].values.length; k++) {\n';
    jsx += '          var val = columnData[colIdx].values[k];\n';
    jsx += '          if (!isNaN(Number(val)) && val !== "") {\n';
    jsx += '            var num = Number(val);\n';
    jsx += '            if (num > maxFrame) maxFrame = num;\n';
    jsx += '          }\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      if (maxFrame > 0) {\n';
    jsx += '        this.infoText.text = "(" + maxFrame + "/" + sourceFrames + ")";\n';
    jsx += '        if (maxFrame > sourceFrames) {\n';
    jsx += '          this.infoText.graphics.foregroundColor = this.infoText.graphics.newPen(this.infoText.graphics.PenType.SOLID_COLOR, [1, 0, 0], 1);\n';
    jsx += '        }\n';
    jsx += '      } else {\n';
    jsx += '        this.infoText.text = i18n.info.hidden;\n';
    jsx += '        this.infoText.graphics.foregroundColor = this.infoText.graphics.newPen(this.infoText.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1);\n';
    jsx += '      }\n';
    jsx += '    };\n';
    jsx += '    \n';
    jsx += '    dropdown.onChange = function() {\n';
    jsx += '      this.updateInfo();\n';
    jsx += '    };\n';
    jsx += '    \n';
    jsx += '    // レイヤー名と列名を自動マッチング（優先順位: 完全一致 > 大文字小文字無視 > _で分割した最初の部分）\n';
    jsx += '    // 全角アルファベットを半角に変換\n';
    jsx += '    var layerName = sortedLayers[i].name.replace(/[Ａ-Ｚａ-ｚ]/g, function(s) {\n';
    jsx += '      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);\n';
    jsx += '    });\n';
    jsx += '    var matched = false;\n';
    jsx += '    \n';
    jsx += '    // 1. 完全一致を試す\n';
    jsx += '    for (var j = 1; j < sheetColumns.length; j++) {\n';
    jsx += '      if (sheetColumns[j] === layerName) {\n';
    jsx += '        dropdown.selection = j;\n';
    jsx += '        matched = true;\n';
    jsx += '        break;\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    // 2. 大文字小文字を無視して一致を試す\n';
    jsx += '    if (!matched) {\n';
    jsx += '      var layerNameLower = layerName.toLowerCase();\n';
    jsx += '      for (var j = 1; j < sheetColumns.length; j++) {\n';
    jsx += '        if (sheetColumns[j].toLowerCase() === layerNameLower) {\n';
    jsx += '          dropdown.selection = j;\n';
    jsx += '          matched = true;\n';
    jsx += '          break;\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    // 3. _で分割して最初の部分で一致を試す（例: A_wxp → A）\n';
    jsx += '    if (!matched) {\n';
    jsx += '      var firstPart = layerName.split("_")[0];\n';
    jsx += '      for (var j = 1; j < sheetColumns.length; j++) {\n';
    jsx += '        if (sheetColumns[j] === firstPart) {\n';
    jsx += '          dropdown.selection = j;\n';
    jsx += '          matched = true;\n';
    jsx += '          break;\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    // 4. _で分割して最初の部分を大文字小文字無視で一致を試す\n';
    jsx += '    if (!matched) {\n';
    jsx += '      var firstPartLower = layerName.split("_")[0].toLowerCase();\n';
    jsx += '      for (var j = 1; j < sheetColumns.length; j++) {\n';
    jsx += '        if (sheetColumns[j].toLowerCase() === firstPartLower) {\n';
    jsx += '          dropdown.selection = j;\n';
    jsx += '          matched = true;\n';
    jsx += '          break;\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    // 5. 先頭のアルファベットで大文字小文字無視で一致を試す（例: "d 2" → "D"）\n';
    jsx += '    if (!matched) {\n';
    jsx += '      var leadingAlpha = layerName.match(/^[A-Za-z]+/);\n';
    jsx += '      if (leadingAlpha) {\n';
    jsx += '        var leadingLower = leadingAlpha[0].toLowerCase();\n';
    jsx += '        for (var j = 1; j < sheetColumns.length; j++) {\n';
    jsx += '          if (sheetColumns[j].toLowerCase() === leadingLower) {\n';
    jsx += '            dropdown.selection = j;\n';
    jsx += '            matched = true;\n';
    jsx += '            break;\n';
    jsx += '          }\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    if (!matched) dropdown.selection = 0; // ×を選択\n';
    jsx += '    \n';
    jsx += '    // 初期表示を更新\n';
    jsx += '    dropdown.updateInfo();\n';
    jsx += '    \n';
    jsx += '    dropdowns.push(dropdown);\n';
    jsx += '  }\n';
    jsx += '  \n';
    jsx += '  // ダイアログのサイズを設定\n';
    jsx += '  tsWin.onResizing = tsWin.onResize = function() {\n';
    jsx += '    this.layout.resize();\n';
    jsx += '  };\n';
    jsx += '  \n';
    jsx += '  // AE環境設定から前回の設定を読み込み\n';
    jsx += '  var savedEmptyMethod = "blind";\n';
    jsx += '  var savedAddMarkers = false;\n';
    jsx += '  try {\n';
    jsx += '    if (app.settings.haveSetting("DiTiS", "emptyCellMethod")) {\n';
    jsx += '      savedEmptyMethod = app.settings.getSetting("DiTiS", "emptyCellMethod");\n';
    jsx += '    }\n';
    jsx += '    if (app.settings.haveSetting("DiTiS", "addMarkers")) {\n';
    jsx += '      savedAddMarkers = app.settings.getSetting("DiTiS", "addMarkers") === "true";\n';
    jsx += '    }\n';
    jsx += '  } catch(e) {}\n';
    jsx += '  var savedAutoPrecompose = false;\n';
    jsx += '  try {\n';
    jsx += '    if (app.settings.haveSetting("DiTiS", "autoPrecompose")) {\n';
    jsx += '      savedAutoPrecompose = app.settings.getSetting("DiTiS", "autoPrecompose") === "true";\n';
    jsx += '    }\n';
    jsx += '  } catch(e) {}\n';
    jsx += '  \n';
    jsx += '  // 空セル処理オプション\n';
    jsx += '  var optPanel = tsWin.add("panel", undefined, i18n.dialog.emptyCellMethod);\n';
    jsx += '  optPanel.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  optPanel.alignChildren = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  \n';
    jsx += '  var radioBlind = optPanel.add("radiobutton", undefined, i18n.dialog.blindEffect);\n';
    jsx += '  radioBlind.alignment = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.FILL];\n';
    jsx += '  var radioComp = optPanel.add("radiobutton", undefined, i18n.dialog.timeRemap);\n';
    jsx += '  radioComp.alignment = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.FILL];\n';
    jsx += '  radioBlind.value = (savedEmptyMethod !== "timeRemap");\n';
    jsx += '  radioComp.value = (savedEmptyMethod === "timeRemap");\n';
    jsx += '  \n';
    jsx += '  // マーカー追加オプション\n';
    jsx += '  var markerPanel = tsWin.add("panel", undefined, i18n.dialog.markerOption);\n';
    jsx += '  markerPanel.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  markerPanel.alignChildren = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  \n';
    jsx += '  var markerCheck = markerPanel.add("checkbox", undefined, i18n.dialog.addMarkers || "タイムリマップの値をマーカーで追加する");\n';
    jsx += '  markerCheck.alignment = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.FILL];\n';
    jsx += '  markerCheck.value = savedAddMarkers;\n';
    jsx += '  \n';
    jsx += '  // プリコンポーズオプション\n';
    jsx += '  var precompPanel = tsWin.add("panel", undefined, i18n.dialog.precomposeOption);\n';
    jsx += '  precompPanel.alignment = [ScriptUI.Alignment.FILL, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  precompPanel.alignChildren = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  \n';
    jsx += '  var precompCheck = precompPanel.add("checkbox", undefined, i18n.dialog.autoPrecompose);\n';
    jsx += '  precompCheck.alignment = [ScriptUI.Alignment.LEFT, ScriptUI.Alignment.FILL];\n';
    jsx += '  precompCheck.value = savedAutoPrecompose;\n';
    jsx += '  \n';
    jsx += '  var btnGrp = tsWin.add("group");\n';
    jsx += '  btnGrp.orientation = "row";\n';
    jsx += '  btnGrp.alignment = [ScriptUI.Alignment.CENTER, ScriptUI.Alignment.BOTTOM];\n';
    jsx += '  var okBtn = btnGrp.add("button", undefined, i18n.dialog.apply, {name: "ok"});\n';
    jsx += '  var cancelBtn = btnGrp.add("button", undefined, i18n.dialog.cancel, {name: "cancel"});\n';
    jsx += '  \n';
    
    // OKボタンのonClickイベント
    jsx += '  okBtn.onClick = function() {\n';
    jsx += '    var useCompZero = radioComp.value;\n';
    jsx += '    \n';
    jsx += '    // AE環境設定に保存\n';
    jsx += '    try {\n';
    jsx += '      app.settings.saveSetting("DiTiS", "emptyCellMethod", useCompZero ? "timeRemap" : "blind");\n';
    jsx += '      app.settings.saveSetting("DiTiS", "addMarkers", markerCheck.value ? "true" : "false");\n';
    jsx += '      app.settings.saveSetting("DiTiS", "autoPrecompose", precompCheck.value ? "true" : "false");\n';
    jsx += '    } catch(e) {}\n';
    jsx += '    \n';
    jsx += '    tsWin.close();\n';
    jsx += '    \n';
    jsx += `    app.beginUndoGroup("Set TimeSheet [${escapeJsx(sheet.name)}]");\n`;
    jsx += '    \n';
    jsx += '    // 実行前のレイヤー選択状態を保存\n';
    jsx += '    var savedSelection = [];\n';
    jsx += '    for (var i = 0; i < sortedLayers.length; i++) {\n';
    jsx += '      savedSelection.push(sortedLayers[i].selected);\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    for (var i = 0; i < sortedLayers.length; i++) {\n';
    jsx += '      var layer = sortedLayers[i];\n';
    jsx += '      var selectedIndex = dropdowns[i].selection.index;\n';
    jsx += '      var isComposition = layer.source && (layer.source instanceof CompItem);\n';
    jsx += '      \n';
    jsx += '      // ×が選択されている場合はスキップ\n';
    jsx += '      if (selectedIndex === 0) continue;\n';
    jsx += '      \n';
    jsx += '      // 実際の列インデックス（×分を引く）\n';
    jsx += '      var colIdx = selectedIndex - 1;\n';
    jsx += '      var keyframeData = columnData[colIdx];\n';
    jsx += '      if (keyframeData == null) continue;\n';
    jsx += '      \n';
    jsx += '      // コンポジションでない場合に自動プリコンポーズ\n';
    jsx += '      if (precompCheck.value && !isComposition) {\n';
    jsx += '        var precompName = layer.name;\n';
    jsx += '        comp.layers.precompose([layer.index], precompName, true);\n';
    jsx += '        layer = comp.layer(precompName);\n';
    jsx += '        sortedLayers[i] = layer;\n';
    jsx += '        isComposition = true;\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // 既存のエフェクトとタイムリマップをクリア\n';
    jsx += '      var remapEnable = layer.canSetTimeRemapEnabled;\n';
    jsx += '      if (remapEnable && layer.property(ADBE_TIME_REMAPPING) != null) {\n';
    jsx += '        layer.timeRemapEnabled = false;\n';
    jsx += '      }\n';
    jsx += '      if (layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS) != null) {\n';
    jsx += '        layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS).remove();\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      if (remapEnable) {\n';
    jsx += '        layer.timeRemapEnabled = true;\n';
    jsx += '        layer.property(ADBE_TIME_REMAPPING).removeKey(2);\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // タイムリマップ用のキーフレーム配列を構築\n';
    jsx += '      var times = [];\n';
    jsx += '      var values = [];\n';
    jsx += '      var lastNumValue = null;\n';
    jsx += '      var maxFrameValue = 0;\n';
    jsx += '      \n';
    jsx += '      // コンポジションの最大尺を計算（空セル用）\n';
    jsx += '      var compMaxFrame = 0;\n';
    jsx += '      if (useCompZero && isComposition && layer.source) {\n';
    jsx += '        compMaxFrame = Math.floor(layer.source.duration * fps) + 1;\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // ブラインド用のキーフレーム配列\n';
    jsx += '      var blindTimes = [];\n';
    jsx += '      var blindValues = [];\n';
    jsx += '      var blindEnabled = true;\n';
    jsx += '      var needsBlinds = false;\n';
    jsx += '      \n';
    jsx += '      // 最大コマ数を取得\n';
    jsx += '      var hasNumbers = false;\n';
    jsx += '      for (var k = 0; k < keyframeData.values.length; k++) {\n';
    jsx += '        var val = keyframeData.values[k];\n';
    jsx += '        if (!isNaN(Number(val)) && val !== "") {\n';
    jsx += '          hasNumbers = true;\n';
    jsx += '          var numVal = Number(val);\n';
    jsx += '          if (numVal > maxFrameValue) maxFrameValue = numVal;\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // 数字が全くない場合はレイヤーを非表示にしてスキップ\n';
    jsx += '      if (!hasNumbers) {\n';
    jsx += '        layer.enabled = false;\n';
    jsx += '        if (remapEnable) {\n';
    jsx += '          layer.timeRemapEnabled = false;\n';
    jsx += '        }\n';
    jsx += '        continue;\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // ソースの長さをチェック\n';
    jsx += '      if (remapEnable && layer.source && layer.source.duration) {\n';
    jsx += '        var sourceDuration = layer.source.duration;\n';
    jsx += '        var sourceFrames = Math.floor(sourceDuration * fps);\n';
    jsx += '        if (maxFrameValue > sourceFrames) {\n';
    jsx += '          alert(i18n.error.insufficientFrames + "\\n" +\n';
    jsx += '                i18n.error.layerInfo.replace("{0}", layer.name).replace("{1}", maxFrameValue).replace("{2}", sourceFrames));\n';
    jsx += '          remapEnable = false;\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // キーフレームデータを処理\n';
    jsx += '      for (var k = 0; k < keyframeData.frames.length; k++) {\n';
    jsx += '        var frameIndex = keyframeData.frames[k];\n';
    jsx += '        var currentValue = keyframeData.values[k];\n';
    jsx += '        \n';
    jsx += '        if (currentValue === "X" || currentValue === "×") {\n';
    jsx += '          if (frameIndex === 0) {\n';
    jsx += '            layer.enabled = false;\n';
    jsx += '          }\n';
    jsx += '          if (useCompZero && isComposition && compMaxFrame > 0) {\n';
    jsx += '            // タイムリマップ選択時：コンポ最大尺+1で空セル処理\n';
    jsx += '            if (remapEnable) {\n';
    jsx += '              times.push(frameIndex / fps);\n';
    jsx += '              values.push((compMaxFrame - 1) / fps);\n';
    jsx += '              lastNumValue = null;\n';
    jsx += '            }\n';
    jsx += '          } else {\n';
    jsx += '            // ブラインド選択時\n';
    jsx += '            blindEnabled = false;\n';
    jsx += '            needsBlinds = true;\n';
    jsx += '            if (layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS) == null) {\n';
    jsx += '              layer.property(ADBE_EFFECT_PARADE).addProperty(ADBE_VENETIAN_BLINDS);\n';
    jsx += '            }\n';
    jsx += '            blindTimes.push(frameIndex / fps);\n';
    jsx += '            blindValues.push(100);\n';
    jsx += '            if (remapEnable) {\n';
    jsx += '              times.push(frameIndex / fps);\n';
    jsx += '              values.push(0 / fps);\n';
    jsx += '              lastNumValue = null;\n';
    jsx += '            }\n';
    jsx += '          }\n';
    jsx += '        }\n';
    jsx += '        else if (!isNaN(Number(currentValue)) && currentValue !== "") {\n';
    jsx += '          layer.enabled = true;\n';
    jsx += '          var numValue = Number(currentValue);\n';
    jsx += '          \n';
    jsx += '          if (remapEnable && numValue !== lastNumValue) {\n';
    jsx += '            times.push(frameIndex / fps);\n';
    jsx += '            values.push((numValue - 1) / fps);\n';
    jsx += '            lastNumValue = numValue;\n';
    jsx += '          }\n';
    jsx += '          \n';
    jsx += '          if (blindEnabled == false) {\n';
    jsx += '            if (layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS) != null) {\n';
    jsx += '              blindTimes.push(frameIndex / fps);\n';
    jsx += '              blindValues.push(0);\n';
    jsx += '            }\n';
    jsx += '            blindEnabled = true;\n';
    jsx += '          } else {\n';
    jsx += '            if (layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS) == null) {\n';
    jsx += '              layer.property(ADBE_EFFECT_PARADE).addProperty(ADBE_VENETIAN_BLINDS);\n';
    jsx += '              blindTimes.push(frameIndex / fps);\n';
    jsx += '              blindValues.push(0);\n';
    jsx += '            }\n';
    jsx += '          }\n';
    jsx += '        }\n';
    jsx += '        else if (currentValue === "-") {\n';
    jsx += '          // ハイフンは繰り返し（直前の値を継続）なので何もしない\n';
    jsx += '          // タイムリマップもブラインドもキーフレームを追加しない\n';
    jsx += '        }\n';
    jsx += '        else if (currentValue === "") {\n';
    jsx += '          // 空白セル処理\n';
    jsx += '          if (useCompZero && isComposition && compMaxFrame > 0) {\n';
    jsx += '            // コンポジションかつオプション有効：タイムリマップでコンポの最大尺+1を使用\n';
    jsx += '            if (remapEnable) {\n';
    jsx += '              times.push(frameIndex / fps);\n';
    jsx += '              values.push((compMaxFrame - 1) / fps);\n';
    jsx += '              lastNumValue = null;\n';
    jsx += '            }\n';
    jsx += '          } else {\n';
    jsx += '            // コンポジション以外、またはオプション無効：ブラインドを使用\n';
    jsx += '            if (blindEnabled == true) {\n';
    jsx += '              needsBlinds = true;\n';
    jsx += '              if (layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS) == null) {\n';
    jsx += '                layer.property(ADBE_EFFECT_PARADE).addProperty(ADBE_VENETIAN_BLINDS);\n';
    jsx += '              }\n';
    jsx += '              blindTimes.push(frameIndex / fps);\n';
    jsx += '              blindValues.push(100);\n';
    jsx += '              blindEnabled = false;\n';
    jsx += '            }\n';
    jsx += '          }\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // タイムリマップのキーフレームを一括設定\n';
    jsx += '      if (remapEnable && times.length > 0) {\n';
    jsx += '        layer.property(ADBE_TIME_REMAPPING).setValuesAtTimes(times, values);\n';
    jsx += '        \n';
    jsx += '        // すべてのキーフレームをHOLD補間に設定\n';
    jsx += '        for (var j = 1; j <= layer.property(ADBE_TIME_REMAPPING).numKeys; j++) {\n';
    jsx += '          layer.property(ADBE_TIME_REMAPPING).setInterpolationTypeAtKey(j, KeyframeInterpolationType.HOLD);\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // ブラインドエフェクトのキーフレーム設定\n';
    jsx += '      if (blindTimes.length > 0) {\n';
    jsx += '        var blindProp = layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS).property(ADBE_VENETIAN_BLINDS_0001);\n';
    jsx += '        \n';
    jsx += '        blindProp.setValuesAtTimes(blindTimes, blindValues);\n';
    jsx += '        \n';
    jsx += '        // すべてのキーフレームをHOLD補間に設定\n';
    jsx += '        for (var j = 1; j <= blindProp.numKeys; j++) {\n';
    jsx += '          blindProp.setInterpolationTypeAtKey(j, KeyframeInterpolationType.HOLD);\n';
    jsx += '        }\n';
    jsx += '        \n';
    jsx += '        // キーフレームが1つだけの場合はエフェクトを削除\n';
    jsx += '        if (blindProp.numKeys <= 1) {\n';
    jsx += '          layer.property(ADBE_EFFECT_PARADE).property(ADBE_VENETIAN_BLINDS).remove();\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // レイヤーのイン・アウトポイントを設定\n';
    jsx += '      if (!layer.locked) {\n';
    jsx += '        layer.inPoint = 0;\n';
    const enabledFrameCount = (sheet.disabledFrames && sheet.disabledFrames.length > 0)
        ? sheet.frames - sheet.disabledFrames.length
        : sheet.frames;
    jsx += `        layer.outPoint = ${enabledFrameCount} / fps;\n`;
    jsx += '      }\n';
    jsx += '      \n';
    jsx += '      // タイムリマップの値をマーカーで追加\n';
    jsx += '      if (markerCheck.value && remapEnable && times.length > 0) {\n';
    jsx += '        var markers = layer.property("Marker");\n';
    jsx += '        if (markers) {\n';
    jsx += '          // 既存のマーカーをすべて削除\n';
    jsx += '          while (markers.numKeys > 0) {\n';
    jsx += '            markers.removeKey(1);\n';
    jsx += '          }\n';
    jsx += '          for (var m = 0; m < times.length; m++) {\n';
    jsx += '            var cellValue = Math.round(values[m] * fps + 1);\n';
    jsx += `            var markerDuration = (m < times.length - 1) ? (times[m + 1] - times[m]) : (${sheet.frames} / fps - times[m]);\n`;
    jsx += '            var markerValue = new MarkerValue(String(cellValue));\n';
    jsx += '            markerValue.duration = markerDuration;\n';
    jsx += '            markers.setValueAtTime(times[m], markerValue);\n';
    jsx += '          }\n';
    jsx += '        }\n';
    jsx += '      }\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    // レイヤーの選択状態を復元\n';
    jsx += '    for (var i = 1; i <= comp.numLayers; i++) {\n';
    jsx += '      comp.layer(i).selected = false;\n';
    jsx += '    }\n';
    jsx += '    for (var i = 0; i < sortedLayers.length; i++) {\n';
    jsx += '      sortedLayers[i].selected = savedSelection[i];\n';
    jsx += '    }\n';
    jsx += '    \n';
    jsx += '    app.endUndoGroup();\n';
    jsx += '  };\n';
    jsx += '  \n';
    jsx += '  cancelBtn.onClick = function() {\n';
    jsx += '    tsWin.close();\n';
    jsx += '  };\n';
    jsx += '  \n';
    jsx += '  tsWin.center();\n';
    jsx += '  tsWin.show();\n';
    jsx += '})();\n';
    
    return jsx;
}


/**
 * テキストファイルをダウンロード
 * @param {string} content - ファイル内容
 * @param {string} filename - ファイル名
 */
function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * AEからタイムリマップ情報を取得
 */
async function getTimeremapFromAE() {
    const currentLang = getCurrentLanguage();
    
    try {
        if (!window.TauriAPI || !window.TauriAPI.getTimeremapFromAE) {
            alert(i18n[currentLang].error.aeDesktopOnly);
            return;
        }
        
        updateStatusBar('AEからタイムリマップを取得中...');
        debugLog('ファイル', 'AEタイムリマップ取得開始');
        
        const result = await window.TauriAPI.getTimeremapFromAE();
        debugLog('ファイル', 'AEタイムリマップ取得結果', result);
        
        if (!result || !result.layers || result.layers.length === 0) {
            if (window.__TAURI__ && window.__TAURI__.dialog) {
                await window.__TAURI__.dialog.message(
                    'タイムリマップ付きレイヤーが選択されていません。\nAEでタイムリマップが有効なレイヤーを選択してください。',
                    { title: '情報', type: 'info' }
                );
            } else {
                alert('タイムリマップ付きレイヤーが選択されていません。');
            }
            updateStatusBar('取得するレイヤーがありませんでした');
            return;
        }
        
        // データを変換してシートに追加
        await importTimeremapData(result);
        
    } catch (error) {
        console.error('AEタイムリマップ取得エラー:', error);
        updateStatusBar('AEからの取得に失敗しました');
        
        let errorMessage = String(error);
        if (errorMessage.includes('timeout')) {
            errorMessage = 'AEからの応答がタイムアウトしました。\nAEが起動していて、タイムリマップ付きレイヤーが選択されているか確認してください。';
        } else if (errorMessage.includes('After Effects')) {
            errorMessage = 'After Effectsが見つかりません。\nAEが起動しているか確認してください。';
        }
        
        if (window.__TAURI__ && window.__TAURI__.dialog) {
            await window.__TAURI__.dialog.message(errorMessage, { 
                title: i18n[currentLang].dialogTitle.warning, 
                type: 'warning' 
            });
        } else {
            alert(errorMessage);
        }
    }
}

/**
 * タイムリマップデータをシートにインポート
 * @param {Object} data - AEから取得したデータ
 */
async function importTimeremapData(data) {
    const fps = (Number.isFinite(data.fps) && data.fps > 0) ? data.fps : 24;
    const totalFrames = Math.ceil(data.duration * fps);
    
    // 確認ダイアログ
    const layerNames = data.layers.map(l => l.layerName).join(', ');
    const confirmMsg = `以下のレイヤーのタイムリマップをインポートします:\n${layerNames}\n\nFPS: ${fps}\nコンポ: ${data.compName}\nフレーム数: ${totalFrames}\n\n新しいシートとして追加しますか？`;
    
    let confirmed = true;
    if (window.__TAURI__ && window.__TAURI__.dialog) {
        confirmed = await window.__TAURI__.dialog.confirm(confirmMsg, { 
            title: 'タイムリマップインポート', 
            type: 'info' 
        });
    } else {
        confirmed = confirm(confirmMsg);
    }
    
    if (!confirmed) {
        updateStatusBar('インポートをキャンセルしました');
        return;
    }
    
    // 新しいシートを作成
    const newSheet = createNewSheet(data.compName);
    newSheet.frames = totalFrames;
    newSheet.visibleRows = totalFrames;
    newSheet.fps = fps;
    
    // レイヤー数を調整（最低26列、インポートするレイヤー数がそれ以上ならその数）
    const minColumns = 26;
    const layerCount = Math.max(data.layers.length, minColumns);
    newSheet.layers = [];
    for (let i = 0; i < layerCount; i++) {
        if (i < data.layers.length) {
            newSheet.layers.push({
                id: `L${i + 1}`,
                name: data.layers[i].layerName
            });
        } else {
            // 残りはA-Zの標準レイヤー名
            newSheet.layers.push({
                id: `L${i + 1}`,
                name: getLayerName(i)
            });
        }
    }
    
    // データを初期化
    newSheet.data = {};
    for (let i = 1; i <= totalFrames; i++) {
        newSheet.data[i] = {};
        newSheet.layers.forEach(layer => {
            newSheet.data[i][layer.id] = '';
        });
    }
    
    // 各レイヤーのキーフレームデータを設定
    // タイムリマップはHOLD補間なので、次のキーフレームまで同じ値が続く
    for (let layerIdx = 0; layerIdx < data.layers.length; layerIdx++) {
        const layer = data.layers[layerIdx];
        const layerId = `L${layerIdx + 1}`;
        
        if (layer.keyframes && layer.keyframes.length > 0) {
            // キーフレームを時間順にソート
            const keyframes = [...layer.keyframes].sort((a, b) => a.time - b.time);
            
            for (let i = 0; i < keyframes.length; i++) {
                const kf = keyframes[i];
                const nextKf = keyframes[i + 1];
                
                // このキーフレームの開始フレーム
                const startFrame = Math.round(kf.time * fps) + 1;
                // 次のキーフレームの開始フレーム（なければ最終フレーム）
                const endFrame = nextKf ? Math.round(nextKf.time * fps) : totalFrames;
                
                // タイムリマップ値が範囲外（duration以上）の場合は空セル（ブラインド）
                const isBlind = kf.value >= data.duration;
                
                // セル値（タイムリマップ値をフレームに変換、0秒=コマ1）
                const cellValue = isBlind ? '' : (Math.round(kf.value * fps) + 1).toString();
                
                // 開始フレームから次のキーフレームの直前まで値を設定
                for (let frame = startFrame; frame <= endFrame && frame <= totalFrames; frame++) {
                    if (frame >= 1) {
                        if (!newSheet.data[frame]) {
                            newSheet.data[frame] = {};
                        }
                        
                        if (frame === startFrame) {
                            // キーフレーム位置には実際の値を設定
                            newSheet.data[frame][layerId] = cellValue;
                        } else {
                            // 継続フレームには「-」を設定（空セルは空のまま）
                            newSheet.data[frame][layerId] = isBlind ? '' : '-';
                        }
                    }
                }
            }
        }
    }
    
    // 新しいシートに切り替え
    AppState.currentSheetIndex = AppState.sheets.length - 1;
    
    // 表示を更新
    renderTabs();
    renderSpreadsheet();
    updateWindowTitle(); // ウィンドウタイトルを更新
    updateStatusBar(`${data.layers.length}個のレイヤーを新しいシート「${data.compName}」としてインポートしました`);
    debugLog('ファイル', 'タイムリマップインポート完了', { layerCount: data.layers.length, sheetName: data.compName });
}

/**
 * 指定レイヤーのキーフレームデータをAE形式でクリップボードにコピー
 * 列ヘッダーの右ダブルクリックで呼び出す
 * @param {string} layerId - レイヤーID ("L1"など)
 */
async function copyColumnKeyframeData(layerId) {
    const sheet = getCurrentSheet();
    const fps = (Number.isFinite(sheet.fps) && sheet.fps > 0) ? sheet.fps : 24;
    const aeVersion = AppState.aeKeyframeVersion || '9.0';
    const aeVersionNum = parseFloat(aeVersion) || 9.0;
    const layer = sheet.layers.find(l => l.id === layerId);
    const layerName = layer ? layer.name : layerId;
    const maxFrames = Number.isFinite(sheet.frames) ? sheet.frames : 144;

    // 全フレームの状態を解決（前フレームと同値はホールド扱い）
    // 注: sheet.dataの"-"はレンダリング時の表示のみで、実際のデータは数値が入っている
    const resolved = [];
    let prevCelNum = null;
    for (let frame = 1; frame <= maxFrames; frame++) {
        const value = sheet.data[frame]?.[layerId];
        if (value !== undefined && value !== null && value !== '') {
            const parsed = parseInt(value);
            if (!isNaN(parsed)) {
                if (parsed === prevCelNum) {
                    // 前フレームと同値 = ホールド（"-"表示に相当）→ empty扱い
                    resolved.push({ celNum: parsed, state: 'hold' });
                } else {
                    resolved.push({ celNum: parsed, state: 'number' });
                    prevCelNum = parsed;
                }
            } else {
                resolved.push({ celNum: null, state: 'empty' });
                prevCelNum = null;
            }
        } else {
            resolved.push({ celNum: null, state: 'empty' });
            prevCelNum = null;
        }
    }

    // データ範囲を特定
    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < resolved.length; i++) {
        if (resolved[i].state === 'number' || resolved[i].state === 'hold') {
            if (firstIdx < 0) firstIdx = i;
            lastIdx = i;
        }
    }

    if (firstIdx < 0) {
        showErrorToast('コピーするキーフレームデータがありません', ErrorLevel.WARNING, 3000);
        return;
    }

    // 末尾の空きフレームを1つ含める（ブラインド閉じ用）
    let endIdx = lastIdx;
    if (lastIdx + 1 < resolved.length && resolved[lastIdx + 1].state === 'empty') {
        endIdx = lastIdx + 1;
    }

    // ブラインドが必要か判定（データ範囲内に空きコマがあるか）
    let needsBlind = false;
    for (let i = firstIdx; i <= endIdx; i++) {
        if (resolved[i].state === 'empty') {
            needsBlind = true;
            break;
        }
    }

    // Time Remap キーフレーム（モードに応じて出力）
    const allFrames = (AppState.copyKeyframeMode || 'sparse') === 'all-frames';
    const timeRemapKFs = [];
    for (let i = firstIdx; i <= endIdx; i++) {
        const r = resolved[i];
        if (allFrames) {
            // 全フレーム出力（holdも含む）
            if (r.state === 'number' || r.state === 'hold') {
                const seconds = (r.celNum > 0) ? (r.celNum - 1) / fps : 0;
                timeRemapKFs.push({ aeFrame: i, seconds });
            } else {
                timeRemapKFs.push({ aeFrame: i, seconds: 0 });
            }
        } else {
            // 変化点のみ出力（state:'number'のみ、ブラインド閉じ用emptyも含む）
            if (r.state === 'number') {
                const seconds = (r.celNum > 0) ? (r.celNum - 1) / fps : 0;
                timeRemapKFs.push({ aeFrame: i, seconds });
            } else if (r.state === 'empty' && i === endIdx) {
                // ブラインド閉じ用に拡張した末尾emptyフレームもTime Remapキーを出力
                timeRemapKFs.push({ aeFrame: i, seconds: 0 });
            }
        }
    }

    // ブラインドキーフレーム（ホールド補間のため変化前フレームに同値を重複出力）
    const blindKFs = [];
    if (needsBlind) {
        // まず変化点リストを作成
        const blindChanges = [];
        let isBlind = null;
        for (let i = firstIdx; i <= endIdx; i++) {
            const isEmpty = resolved[i].state === 'empty';
            if (isBlind === null || isEmpty !== isBlind) {
                blindChanges.push({ aeFrame: i, value: isEmpty ? 100 : 0 });
                isBlind = isEmpty;
            }
        }
        // 各変化点の直前に同値を挿入してAEのホールド補間を実現
        for (let j = 0; j < blindChanges.length; j++) {
            if (j > 0 && blindChanges[j].aeFrame - 1 > blindChanges[j - 1].aeFrame) {
                blindKFs.push({ aeFrame: blindChanges[j].aeFrame - 1, value: blindChanges[j - 1].value });
            }
            blindKFs.push(blindChanges[j]);
        }
    }

    const fmtSec = (s) => {
        if (s === 0) return '0';
        return s.toFixed(7).replace(/\.?0+$/, '');
    };

    // 出力組み立て
    const lines = [
        `Adobe After Effects ${aeVersion} Keyframe Data`,
        '',
        `\tUnits Per Second\t${fps}`,
        '\tSource Width\t1280',
        '\tSource Height\t720',
        '\tSource Pixel Aspect Ratio\t1',
        '\tComp Pixel Aspect Ratio\t1',
        '',
    ];

    // 9.0以上では Layer 行を追加
    if (aeVersionNum >= 9.0) {
        lines.push('Layer');
    }

    lines.push('Time Remap');
    lines.push('\tFrame\tseconds\t');
    timeRemapKFs.forEach(kf => {
        lines.push(`\t${kf.aeFrame}\t${fmtSec(kf.seconds)}\t`);
    });
    lines.push('');

    // 空きコマがある場合はブラインドエフェクトを追加
    if (needsBlind && blindKFs.length > 0) {
        lines.push('Effects\tブラインド #1\t変換終了 #2\t');
        lines.push('\tFrame\tパーセント');
        blindKFs.forEach(kf => {
            lines.push(`\t${kf.aeFrame}\t${kf.value}\t`);
        });
        lines.push('');
    }

    lines.push('End of Keyframe Data');
    lines.push('');

    try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showErrorToast(`「${layerName}」のキーフレームデータをコピーしました`, ErrorLevel.INFO, 3000);
    } catch (err) {
        showErrorToast('クリップボードへのコピーに失敗しました', ErrorLevel.ERROR, 3000);
    }
}
