/** theme.js - テーマ・表示設定モジュール */

// ========================================
// テーマ切り替え機能
// ========================================

/**
 * テーマを初期化
 * システム設定または保存された設定を適用
 */
function initializeTheme() {
    // 保存されたテーマ設定があればそれを使用
    let theme = AppState.theme;
    
        
    // 保存されたテーマがない、または無効な値の場合はシステム設定に従う
    if (!theme || !['light', 'dark', 'green'].includes(theme)) {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'green';
            }
    
    // テーマを適用
        document.documentElement.setAttribute('data-theme', theme);
    AppState.theme = theme;
    
        
    // SVGを動的に更新
    updateSVGColors();
    
    debugLog('初期化', `テーマを初期化: ${theme}`);
}

/**
 * テーマを設定
 */
function setTheme(theme) {
        
    if (!['light', 'dark', 'green'].includes(theme)) {
        console.warn('[setTheme] 無効なテーマ:', theme, '→ lightに設定');
        theme = 'light';
    }
    
        document.documentElement.setAttribute('data-theme', theme);
    AppState.theme = theme;
    
        
    // CSSの再計算を強制（小さい遅延で確実に反映）
    setTimeout(() => {
        // SVGを動的に更新
        updateSVGColors();
        
        // 表を再描画（SVG更新を反映）
        renderSpreadsheet(true);
        
            }, 10);
    
    // 設定を保存
    saveToLocalStorage();
    
    // ステータスバー更新
    const themeNames = {
        'light': getCurrentLanguage() === 'ja' ? 'ライトテーマ' : 'Light Theme',
        'dark': getCurrentLanguage() === 'ja' ? 'ダークテーマ' : 'Dark Theme',
        'green': getCurrentLanguage() === 'ja' ? 'グリーンテーマ' : 'Green Theme'
    };
    updateStatusBar(`${getCurrentLanguage() === 'ja' ? 'テーマ' : 'Theme'}: ${themeNames[theme]}`);
    
    debugLog('操作', `テーマを変更: ${theme}`);
    }



/**
 * SVGの色とサイズを現在のテーマとセルサイズに合わせて更新
 * CSS変数の値を取得してSVGに適用
 */
function updateSVGColors() {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const lineColor = computedStyle.getPropertyValue('--line-color').trim();
    const cellHeightStr = computedStyle.getPropertyValue('--cell-height').trim();
    const cellHeight = parseInt(cellHeightStr);
    
    // 波線SVGを動的に生成（セルの高さに合わせる）
    const waveHeight = cellHeight * 3; // 3セル分の高さ
    const waveWidth = 24;
    
    // 4波で完結する周期（各波が中央から中央へ）
    const quarterHeight = Math.round(waveHeight / 4); // 各波の高さ
    const eighthHeight = Math.round(quarterHeight / 2); // 波の中間点
    
    // 波線のパスを生成（4波、各波が中央から中央へ）
    let wavePath = `M 12 0`;
    for (let i = 0; i < 4; i++) {
        const y1 = quarterHeight * i;
        const y2 = y1 + eighthHeight;
        const y3 = (i === 3) ? waveHeight : quarterHeight * (i + 1); // 最後は必ずwaveHeightに
        // 左右交互に揺れる
        const x2 = (i % 2 === 0) ? 0 : 24;
        wavePath += ` Q ${x2} ${y2}, 12 ${y3}`;
    }
    
    // 実際のSVG高さは必要な高さに合わせる
    const actualWaveHeight = waveHeight;
    
    const waveSVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${waveWidth}" height="${actualWaveHeight}" viewBox="0 0 ${waveWidth} ${actualWaveHeight}"><path d="${wavePath}" fill="none" stroke="${encodeURIComponent(lineColor)}" stroke-width="1.5" shape-rendering="geometricPrecision"/></svg>`;
    
    // CSS変数として設定
    root.style.setProperty('--wave-svg-url', `url('${waveSVG}')`);
    root.style.setProperty('--wave-svg-height', actualWaveHeight + 'px');
    
    debugLog('表示', `SVGを更新: 色=${lineColor}, 波線高さ=${actualWaveHeight}px`);
}

// ========================================
// フォントサイズ変更機能
// ========================================

/**
 * フォントサイズを変更
 * @param {number} size - フォントサイズ（10, 12, 14, 16）
 */
function changeFontSize(size) {
    const root = document.documentElement;
    
    // 5段階 × 5種類の固定値テーブル
    const fontTable = {
        8:  { cell: 15, header: 11, dash: 12, small: 7,  ui: 10 },
        10: { cell: 15, header: 12, dash: 14, small: 8,  ui: 12 },
        12: { cell: 15, header: 14, dash: 16, small: 10, ui: 14 },
        14: { cell: 16, header: 16, dash: 18, small: 12, ui: 16 },
        16: { cell: 18, header: 18, dash: 20, small: 14, ui: 18 },
    };
    
    const fonts = fontTable[size] || fontTable[12];
    
    // フォントサイズ適用
    root.style.setProperty('--cell-font-size', fonts.cell + 'px');
    root.style.setProperty('--header-font-size', fonts.header + 'px');
    root.style.setProperty('--dash-font-size', fonts.dash + 'px');
    root.style.setProperty('--fps-font-size', fonts.small + 'px');
    root.style.setProperty('--column-number-font-size', fonts.small + 'px');
    root.style.setProperty('--row-label-font-size', fonts.header + 'px');
    root.style.setProperty('--tab-font-size', fonts.ui + 'px');
    root.style.setProperty('--button-font-size', fonts.ui + 'px');
    root.style.setProperty('--menu-font-size', fonts.ui + 'px');
    root.style.setProperty('--modal-font-size', fonts.ui + 'px');
    root.style.setProperty('--toast-font-size', fonts.ui + 'px');
    root.style.setProperty('--help-font-size', fonts.ui + 'px');
    
    if (size === 8) {
        root.style.setProperty('--cell-width', '30px');
        root.style.setProperty('--cell-height', '8px');
        root.style.setProperty('--cell-padding', '0px 2px');
        root.style.setProperty('--header-cell-width', '30px');
        document.body.classList.add('size-xsmall');
    } else {
        document.body.classList.remove('size-xsmall');
        root.style.setProperty('--cell-padding', '2px 4px');
        const cellWidth = Math.round(size * 3.17);
        const cellHeight = Math.round(size * 2.33);
        const headerCellWidth = Math.round(size * 3.33);
        root.style.setProperty('--cell-width', cellWidth + 'px');
        root.style.setProperty('--cell-height', cellHeight + 'px');
        root.style.setProperty('--header-cell-width', headerCellWidth + 'px');
    }
    
    // line-heightをcell-heightに連動
    root.style.setProperty('--cell-line-height', (size === 8) ? '8px' : '14px');
    
    // CSS変数が更新されるのを待ってからSVGを更新
    setTimeout(() => {
        updateSVGColors();
    }, 10);
    
    // 状態を保存
    AppState.fontSize = size;
    saveToLocalStorage();
    
    // 表を再描画（インラインスタイルのフォントサイズを更新）
    renderSpreadsheet(true);
    
    debugLog('操作', `表示サイズを変更: ${size}px`);
}

/**
 * フォントサイズセレクトボックスを初期化
 */
function initializeFontSize() {
    const select = document.getElementById('font-size-select');
    if (select) {
        // 保存されたフォントサイズを適用
        select.value = AppState.fontSize;
        changeFontSize(AppState.fontSize);
    }
}

/**
 * 表示設定をデフォルトに戻す
 */
function resetViewSettings() {
    // デフォルト値に戻す
    setFrameFilter('all');
    setHeaderDisplayMode('detail');
    changeFontSize(12);
    
    updateMenuCheckmarks();
    
    updateStatusBar(t('info.viewSettingsReset') || '表示設定をデフォルトに戻しました');
    debugLog('操作', '表示設定をデフォルトに戻しました');
}

/**
 * A1セルを選択
 * 初期化時や表のリセット時に使用
 */


/**
 * Tauriメニューのチェックマークを更新
 * 再起動時などに保存された設定を反映
 */
async function updateTauriMenuCheckmarks() {
    if (!window.TauriAPI || !window.TauriAPI.updateMenuItemCheck) {
                return; // Tauriでない場合は何もしない
    }
    
    try {
                                
        // フレームフィルター
        await window.TauriAPI.updateMenuItemCheck('frame-filter-all', AppState.frameFilter === 'all');
        await window.TauriAPI.updateMenuItemCheck('frame-filter-odd', AppState.frameFilter === 'odd');
        await window.TauriAPI.updateMenuItemCheck('frame-filter-even', AppState.frameFilter === 'even');
                
        // ヘッダー表示モード
        await window.TauriAPI.updateMenuItemCheck('header-mode-detail', AppState.headerDisplayMode === 'detail');
        await window.TauriAPI.updateMenuItemCheck('header-mode-simple', AppState.headerDisplayMode === 'simple');
                
        // フォントサイズ
        await window.TauriAPI.updateMenuItemCheck('font-size-xsmall', AppState.fontSize === 8);
        await window.TauriAPI.updateMenuItemCheck('font-size-small', AppState.fontSize === 10);
        await window.TauriAPI.updateMenuItemCheck('font-size-normal', AppState.fontSize === 12);
        await window.TauriAPI.updateMenuItemCheck('font-size-large', AppState.fontSize === 14);
        await window.TauriAPI.updateMenuItemCheck('font-size-xlarge', AppState.fontSize === 16);
                
        // テーマ
        await window.TauriAPI.updateMenuItemCheck('theme-light', AppState.theme === 'light');
        await window.TauriAPI.updateMenuItemCheck('theme-dark', AppState.theme === 'dark');
        await window.TauriAPI.updateMenuItemCheck('theme-green', AppState.theme === 'green');
                
        // 言語（メニュー再構築後に設定）
        const currentLang = getCurrentLanguage();
        await window.TauriAPI.updateMenuItemCheck('language-ja', currentLang === 'ja');
        await window.TauriAPI.updateMenuItemCheck('language-en', currentLang === 'en');
                
        // デバッグモード
        await window.TauriAPI.updateMenuItemCheck('toggle-debug', AppState.debugMode);
                
        // 常に前面に表示
        await window.TauriAPI.updateMenuItemCheck('always-on-top', AppState.alwaysOnTop);
                
            } catch (error) {
        console.error('[updateTauriMenuCheckmarks] エラー:', error);
    }
}

// メニューのチェックマークを更新（Tauriメニュー）
function updateMenuCheckmarks() {
    // Tauriネイティブメニューのチェック状態を更新
    if (window.TauriAPI && window.TauriAPI.updateMenuItemCheck) {
        const currentLang = getCurrentLanguage();
        window.TauriAPI.updateMenuItemCheck('toggle-debug', AppState.debugMode).catch(err => {});
        window.TauriAPI.updateMenuItemCheck('theme-light', AppState.theme === 'light').catch(err => {});
        window.TauriAPI.updateMenuItemCheck('theme-dark', AppState.theme === 'dark').catch(err => {});
        window.TauriAPI.updateMenuItemCheck('theme-green', AppState.theme === 'green').catch(err => {});
        window.TauriAPI.updateMenuItemCheck('always-on-top', AppState.alwaysOnTop).catch(err => {});
        window.TauriAPI.updateMenuItemCheck('show-new-sheet-dialog', AppState.showNewSheetDialog).catch(err => {});
        window.TauriAPI.updateMenuItemCheck('reopen-last-file', AppState.reopenLastFile).catch(err => {});
        window.TauriAPI.updateMenuItemCheck('language-ja', currentLang === 'ja').catch(err => {});
        window.TauriAPI.updateMenuItemCheck('language-en', currentLang === 'en').catch(err => {});
    }
}
