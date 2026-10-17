/** Optional external importers. The host has no AI provider or API-key dependency. */
let importPluginRunning = false;
let importPluginPageActive = true;

function preparePluginSheets(documentData) {
    // Native code also validates the contract; validate before touching AppState.
    if (!documentData || documentData.version !== '1.0' ||
        !Array.isArray(documentData.sheets) || documentData.sheets.length < 1 || documentData.sheets.length > 32) {
        throw new Error('Invalid plugin document');
    }
    let cells = 0;
    const validText = (value, max) => typeof value === 'string' &&
        [...value].length <= max && !/[\x00-\x1f\x7f-\x9f]/.test(value);
    return documentData.sheets.map(sheet => {
        if (!sheet || !validText(sheet.name, 256) || !sheet.name.trim() ||
            !Number.isFinite(sheet.fps) || sheet.fps < 1 || sheet.fps > 240 ||
            !Number.isInteger(sheet.frames) || sheet.frames < 1 || sheet.frames > 20000 ||
            !Number.isInteger(sheet.framePageSize) || sheet.framePageSize < 1 || sheet.framePageSize > 20000 ||
            !Array.isArray(sheet.layers) || sheet.layers.length < 1 || sheet.layers.length > 128 ||
            sheet.layers.some(name => !validText(name, 128) || !name.trim()) ||
            !Array.isArray(sheet.data) || sheet.data.length > sheet.layers.length ||
            sheet.data.some(column => !Array.isArray(column) || column.length > sheet.frames ||
                column.some(value => !validText(value, 128)))) {
            throw new Error('Invalid plugin sheet');
        }
        cells += sheet.frames * sheet.layers.length;
        if (cells > 1000000) throw new Error('Plugin import is too large');
        const result = {
            name: sheet.name, fps: sheet.fps, frames: sheet.frames,
            framePageSize: sheet.framePageSize, layers: [...sheet.layers],
            data: sheet.data.map(column => [...column]), insertedFrames: [], disabledFrames: [],
            visibleRows: sheet.frames, filePath: null
        };
        loadSheetData(result);
        return result;
    });
}

async function handleImportPluginMenu(menuId) {
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    const ja = typeof getCurrentLanguage !== 'function' || getCurrentLanguage() === 'ja';
    if (menuId === 'open-import-plugin-folder') {
        try { await invoke('open_import_plugin_folder'); }
        catch (error) { showErrorToast(String(error), ErrorLevel.ERROR, 5000); }
        return true;
    }
    if (menuId === 'reload-import-plugins') {
        try {
            const result = await invoke('reload_import_plugins');
            await triggerMenuRebuild();
            if (result.errors.length) throw new Error(result.errors.join('\n'));
            showErrorToast(ja ? result.count + '個のプラグインを読み込みました' :
                'Loaded ' + result.count + ' plugin(s)', ErrorLevel.INFO, 3000);
        } catch (error) { showErrorToast(String(error), ErrorLevel.ERROR, 8000); }
        return true;
    }
    if (!menuId.startsWith('import-plugin:')) return false;
    if (importPluginRunning) return true;
    importPluginRunning = true;
    updateStatusBar(ja ? '読み込みプラグインを実行中…' : 'Import plugin is running…');
    try {
        const documentData = await invoke('run_import_plugin', { pluginId: menuId.slice('import-plugin:'.length) });
        if (!documentData || !importPluginPageActive) return true;
        const sheets = preparePluginSheets(documentData); // All-or-nothing validation.
        if (typeof finishEditing === 'function') finishEditing(true, true);
        const first = AppState.sheets.length;
        AppState.sheets.push(...sheets);
        AppState.currentSheetIndex = first;
        saveHistory(ja ? 'プラグインから読み込み' : 'Import with plugin');
        renderTabs();
        renderSpreadsheet(true);
        selectA1();
        saveToLocalStorage();
        await updateWindowTitle();
        showErrorToast(ja ? sheets.length + '個のシートを取り込みました' :
            'Imported ' + sheets.length + ' sheet(s)', ErrorLevel.INFO, 3000);
    } catch (error) {
        showErrorToast((ja ? '読み込みに失敗しました: ' : 'Import failed: ') + String(error), ErrorLevel.ERROR, 8000);
    } finally {
        importPluginRunning = false;
        updateStatusBar();
    }
    return true;
}

window.addEventListener('pagehide', () => {
    importPluginPageActive = false;
    if (importPluginRunning) window.__TAURI_INTERNALS__?.invoke('cancel_import_plugin').catch(() => {});
});
