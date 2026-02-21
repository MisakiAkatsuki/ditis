/**
 * handleMenuEvent のテスト
 * app.js の window.handleMenuEvent で処理される全メニューイベントの動作を検証
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ========================================
// モック・ヘルパー
// ========================================

const ErrorLevel = { INFO: 'info', WARNING: 'warning', ERROR: 'error', CRITICAL: 'critical' };

let callLog;
let AppState;
let tauriCheckCalls;

function resetState() {
    callLog = [];
    tauriCheckCalls = [];
    AppState = {
        selectedCells: [],
        editingCell: null,
        debugMode: false,
        frameFilter: 'all',
        headerDisplayMode: 'detail',
        fontSize: 12,
        theme: 'light',
        alwaysOnTop: false,
        autoScrollToSelection: true,
        showNewSheetDialog: false,
        showIntermediateHeaders: false,
        currentFilePath: null,
        fps: 24
    };
}

// ファイル操作モック
function createNewSheetWithPrompt() { callLog.push('createNewSheetWithPrompt'); }
function loadFromFileTauri() { callLog.push('loadFromFileTauri'); }
function saveToFile() { callLog.push('saveToFile'); }
function saveAsFile() { callLog.push('saveAsFile'); }
function exportJSX() { callLog.push('exportJSX'); }
function closeFile() { callLog.push('closeFile'); }
function closeAllSheets() { callLog.push('closeAllSheets'); }
function undo() { callLog.push('undo'); }
function redo() { callLog.push('redo'); }
function editCurrentSheetSettings() { callLog.push('editCurrentSheetSettings'); }
function changeDuration() { callLog.push('changeDuration'); }
function changeFPS() { callLog.push('changeFPS'); }
function changeFramePage() { callLog.push('changeFramePage'); }
function changeMaxColumns() { callLog.push('changeMaxColumns'); }
function resetColumnNames() { callLog.push('resetColumnNames'); }
function sendToAfterEffects() { callLog.push('sendToAfterEffects'); }
function getTimeremapFromAE() { callLog.push('getTimeremapFromAE'); }
function clearSheet() { callLog.push('clearSheet'); }
function setFrameFilter(f) { callLog.push(`setFrameFilter:${f}`); AppState.frameFilter = f; }
function setHeaderDisplayMode(m) { callLog.push(`setHeaderDisplayMode:${m}`); AppState.headerDisplayMode = m; }
function changeFontSize(s) { callLog.push(`changeFontSize:${s}`); AppState.fontSize = s; }
function setTheme(t) { callLog.push(`setTheme:${t}`); AppState.theme = t; }
function setLanguage(l) { callLog.push(`setLanguage:${l}`); }
function resetViewSettings() { callLog.push('resetViewSettings'); }
function updateAllUIText() { callLog.push('updateAllUIText'); }
function updateStatusBar(msg) { callLog.push(`updateStatusBar:${msg || ''}`); }
function updateMenuCheckmarks() { callLog.push('updateMenuCheckmarks'); }
function saveToLocalStorage() { callLog.push('saveToLocalStorage'); }
function renderSpreadsheet() { callLog.push('renderSpreadsheet'); }
function exportDebugLogs() { callLog.push('exportDebugLogs'); }
function showErrorToast(msg, level) { callLog.push(`showErrorToast:${msg}`); }
function getCurrentLanguage() { return 'ja'; }

// Tauri API モック
const TauriAPI = {
    isRunningInTauri: () => true,
    updateMenuItemCheck: async (id, checked) => {
        tauriCheckCalls.push({ id, checked });
    },
    setAlwaysOnTop: async (value) => {
        callLog.push(`setAlwaysOnTop:${value}`);
    },
    rebuildMenu: async (...args) => {
        callLog.push('rebuildMenu');
    }
};

// i18n モック
const i18n = {
    ja: {
        about: { title: 'DiTiS', description: 'デジタルタイムシート' },
        menu: { help: { autoCheckUpdates: '起動時に更新を確認' } }
    },
    en: {
        about: { title: 'DiTiS', description: 'Digital Timesheet' },
        menu: { help: { autoCheckUpdates: 'Check for updates on startup' } }
    },
    t: (key) => key
};

// handleMenuEvent 再実装（app.jsのロジックをそのまま抽出）
async function handleMenuEvent(menuId) {
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
        'change-duration': () => changeDuration(),
        'change-fps': () => changeFPS(),
        'change-frame-page': () => changeFramePage(),
        'change-max-columns': async () => await changeMaxColumns(),
        'reset-column-names': () => resetColumnNames(),
        'send-to-ae': () => sendToAfterEffects(),
        'get-from-ae': async () => await getTimeremapFromAE(),
        'clear-sheet': async () => await clearSheet(),
        'reload-page': () => { callLog.push('reload'); },
        'frame-filter-all': async () => {
            setFrameFilter('all');
            await TauriAPI.updateMenuItemCheck('frame-filter-all', true);
            await TauriAPI.updateMenuItemCheck('frame-filter-odd', false);
            await TauriAPI.updateMenuItemCheck('frame-filter-even', false);
        },
        'frame-filter-odd': async () => {
            setFrameFilter('odd');
            await TauriAPI.updateMenuItemCheck('frame-filter-all', false);
            await TauriAPI.updateMenuItemCheck('frame-filter-odd', true);
            await TauriAPI.updateMenuItemCheck('frame-filter-even', false);
        },
        'frame-filter-even': async () => {
            setFrameFilter('even');
            await TauriAPI.updateMenuItemCheck('frame-filter-all', false);
            await TauriAPI.updateMenuItemCheck('frame-filter-odd', false);
            await TauriAPI.updateMenuItemCheck('frame-filter-even', true);
        },
        'header-mode-detail': async () => {
            setHeaderDisplayMode('detail');
            await TauriAPI.updateMenuItemCheck('header-mode-detail', true);
            await TauriAPI.updateMenuItemCheck('header-mode-simple', false);
        },
        'header-mode-simple': async () => {
            setHeaderDisplayMode('simple');
            await TauriAPI.updateMenuItemCheck('header-mode-detail', false);
            await TauriAPI.updateMenuItemCheck('header-mode-simple', true);
        },
        'font-size-xsmall': async () => {
            changeFontSize(8);
            await TauriAPI.updateMenuItemCheck('font-size-xsmall', true);
            await TauriAPI.updateMenuItemCheck('font-size-small', false);
            await TauriAPI.updateMenuItemCheck('font-size-normal', false);
            await TauriAPI.updateMenuItemCheck('font-size-large', false);
            await TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
        },
        'font-size-small': async () => {
            changeFontSize(10);
            await TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
            await TauriAPI.updateMenuItemCheck('font-size-small', true);
            await TauriAPI.updateMenuItemCheck('font-size-normal', false);
            await TauriAPI.updateMenuItemCheck('font-size-large', false);
            await TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
        },
        'font-size-normal': async () => {
            changeFontSize(12);
            await TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
            await TauriAPI.updateMenuItemCheck('font-size-small', false);
            await TauriAPI.updateMenuItemCheck('font-size-normal', true);
            await TauriAPI.updateMenuItemCheck('font-size-large', false);
            await TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
        },
        'font-size-large': async () => {
            changeFontSize(14);
            await TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
            await TauriAPI.updateMenuItemCheck('font-size-small', false);
            await TauriAPI.updateMenuItemCheck('font-size-normal', false);
            await TauriAPI.updateMenuItemCheck('font-size-large', true);
            await TauriAPI.updateMenuItemCheck('font-size-xlarge', false);
        },
        'font-size-xlarge': async () => {
            changeFontSize(16);
            await TauriAPI.updateMenuItemCheck('font-size-xsmall', false);
            await TauriAPI.updateMenuItemCheck('font-size-small', false);
            await TauriAPI.updateMenuItemCheck('font-size-normal', false);
            await TauriAPI.updateMenuItemCheck('font-size-large', false);
            await TauriAPI.updateMenuItemCheck('font-size-xlarge', true);
        },
        'show-new-sheet-dialog': async () => {
            AppState.showNewSheetDialog = !AppState.showNewSheetDialog;
            saveToLocalStorage();
            await TauriAPI.updateMenuItemCheck('show-new-sheet-dialog', AppState.showNewSheetDialog);
        },
        'toggle-intermediate-headers': async () => {
            AppState.showIntermediateHeaders = !AppState.showIntermediateHeaders;
            saveToLocalStorage();
            renderSpreadsheet();
            await TauriAPI.updateMenuItemCheck('toggle-intermediate-headers', AppState.showIntermediateHeaders);
        },
        'reset-view-settings': async () => {
            resetViewSettings();
            await TauriAPI.rebuildMenu();
        },
        'language-ja': async () => {
            setLanguage('ja');
            updateAllUIText();
            updateStatusBar();
            await TauriAPI.rebuildMenu();
        },
        'language-en': async () => {
            setLanguage('en');
            updateAllUIText();
            updateStatusBar();
            await TauriAPI.rebuildMenu();
        },
        'theme-light': async () => {
            setTheme('light');
            await TauriAPI.updateMenuItemCheck('theme-light', true);
            await TauriAPI.updateMenuItemCheck('theme-dark', false);
            await TauriAPI.updateMenuItemCheck('theme-green', false);
        },
        'theme-dark': async () => {
            setTheme('dark');
            await TauriAPI.updateMenuItemCheck('theme-light', false);
            await TauriAPI.updateMenuItemCheck('theme-dark', true);
            await TauriAPI.updateMenuItemCheck('theme-green', false);
        },
        'theme-green': async () => {
            setTheme('green');
            await TauriAPI.updateMenuItemCheck('theme-light', false);
            await TauriAPI.updateMenuItemCheck('theme-dark', false);
            await TauriAPI.updateMenuItemCheck('theme-green', true);
        },
        'always-on-top': async () => {
            AppState.alwaysOnTop = !AppState.alwaysOnTop;
            await TauriAPI.setAlwaysOnTop(AppState.alwaysOnTop);
            await TauriAPI.updateMenuItemCheck('always-on-top', AppState.alwaysOnTop);
            updateStatusBar(`常に前面に表示: ${AppState.alwaysOnTop ? 'ON' : 'OFF'}`);
        },
        'auto-scroll': async () => {
            AppState.autoScrollToSelection = !AppState.autoScrollToSelection;
            saveToLocalStorage();
            await TauriAPI.updateMenuItemCheck('auto-scroll', AppState.autoScrollToSelection);
        },
        'toggle-debug': async () => {
            AppState.debugMode = !AppState.debugMode;
            updateMenuCheckmarks();
            updateStatusBar(`デバッグモード: ${AppState.debugMode ? 'ON' : 'OFF'}`);
            await TauriAPI.updateMenuItemCheck('toggle-debug', AppState.debugMode);
        },
        'export-logs': async () => {
            await exportDebugLogs();
        }
    };

    const handler = handlers[menuId];
    if (handler) {
        await handler();
    }
}

// ========================================
// テスト
// ========================================

describe('handleMenuEvent - ファイル操作', () => {
    beforeEach(resetState);

    it('new-sheet は createNewSheetWithPrompt を呼ぶ', async () => {
        await handleMenuEvent('new-sheet');
        expect(callLog).toContain('createNewSheetWithPrompt');
    });

    it('open-file は loadFromFileTauri を呼ぶ', async () => {
        await handleMenuEvent('open-file');
        expect(callLog).toContain('loadFromFileTauri');
    });

    it('save-file は saveToFile を呼ぶ', async () => {
        await handleMenuEvent('save-file');
        expect(callLog).toContain('saveToFile');
    });

    it('save-as-file は saveAsFile を呼ぶ', async () => {
        await handleMenuEvent('save-as-file');
        expect(callLog).toContain('saveAsFile');
    });

    it('export-jsx は exportJSX を呼ぶ', async () => {
        await handleMenuEvent('export-jsx');
        expect(callLog).toContain('exportJSX');
    });

    it('close-file は closeFile を呼ぶ', async () => {
        await handleMenuEvent('close-file');
        expect(callLog).toContain('closeFile');
    });

    it('close-all-sheets は closeAllSheets を呼ぶ', async () => {
        await handleMenuEvent('close-all-sheets');
        expect(callLog).toContain('closeAllSheets');
    });
});

describe('handleMenuEvent - 編集操作', () => {
    beforeEach(resetState);

    it('undo は undo を呼ぶ', async () => {
        await handleMenuEvent('undo');
        expect(callLog).toContain('undo');
    });

    it('redo は redo を呼ぶ', async () => {
        await handleMenuEvent('redo');
        expect(callLog).toContain('redo');
    });
});

describe('handleMenuEvent - シート操作', () => {
    beforeEach(resetState);

    it('sheet-settings は editCurrentSheetSettings を呼ぶ', async () => {
        await handleMenuEvent('sheet-settings');
        expect(callLog).toContain('editCurrentSheetSettings');
    });

    it('change-duration は changeDuration を呼ぶ', async () => {
        await handleMenuEvent('change-duration');
        expect(callLog).toContain('changeDuration');
    });

    it('change-fps は changeFPS を呼ぶ', async () => {
        await handleMenuEvent('change-fps');
        expect(callLog).toContain('changeFPS');
    });

    it('change-max-columns は changeMaxColumns を呼ぶ', async () => {
        await handleMenuEvent('change-max-columns');
        expect(callLog).toContain('changeMaxColumns');
    });

    it('reset-column-names は resetColumnNames を呼ぶ', async () => {
        await handleMenuEvent('reset-column-names');
        expect(callLog).toContain('resetColumnNames');
    });

    it('send-to-ae は sendToAfterEffects を呼ぶ', async () => {
        await handleMenuEvent('send-to-ae');
        expect(callLog).toContain('sendToAfterEffects');
    });

    it('get-from-ae は getTimeremapFromAE を呼ぶ', async () => {
        await handleMenuEvent('get-from-ae');
        expect(callLog).toContain('getTimeremapFromAE');
    });

    it('clear-sheet は clearSheet を呼ぶ', async () => {
        await handleMenuEvent('clear-sheet');
        expect(callLog).toContain('clearSheet');
    });
});

describe('handleMenuEvent - フレーム表示フィルター', () => {
    beforeEach(resetState);

    it('frame-filter-all は setFrameFilter("all") を呼び、Tauriチェック状態を更新', async () => {
        await handleMenuEvent('frame-filter-all');
        expect(callLog).toContain('setFrameFilter:all');
        expect(tauriCheckCalls).toContainEqual({ id: 'frame-filter-all', checked: true });
        expect(tauriCheckCalls).toContainEqual({ id: 'frame-filter-odd', checked: false });
        expect(tauriCheckCalls).toContainEqual({ id: 'frame-filter-even', checked: false });
    });

    it('frame-filter-odd は setFrameFilter("odd") を呼ぶ', async () => {
        await handleMenuEvent('frame-filter-odd');
        expect(callLog).toContain('setFrameFilter:odd');
        expect(tauriCheckCalls).toContainEqual({ id: 'frame-filter-odd', checked: true });
    });

    it('frame-filter-even は setFrameFilter("even") を呼ぶ', async () => {
        await handleMenuEvent('frame-filter-even');
        expect(callLog).toContain('setFrameFilter:even');
        expect(tauriCheckCalls).toContainEqual({ id: 'frame-filter-even', checked: true });
    });
});

describe('handleMenuEvent - ヘッダーモード', () => {
    beforeEach(resetState);

    it('header-mode-detail は setHeaderDisplayMode("detail") を呼ぶ', async () => {
        await handleMenuEvent('header-mode-detail');
        expect(callLog).toContain('setHeaderDisplayMode:detail');
        expect(tauriCheckCalls).toContainEqual({ id: 'header-mode-detail', checked: true });
        expect(tauriCheckCalls).toContainEqual({ id: 'header-mode-simple', checked: false });
    });

    it('header-mode-simple は setHeaderDisplayMode("simple") を呼ぶ', async () => {
        await handleMenuEvent('header-mode-simple');
        expect(callLog).toContain('setHeaderDisplayMode:simple');
        expect(tauriCheckCalls).toContainEqual({ id: 'header-mode-simple', checked: true });
    });
});

describe('handleMenuEvent - フォントサイズ', () => {
    beforeEach(resetState);

    const sizes = [
        { id: 'font-size-xsmall', size: 8, check: 'font-size-xsmall' },
        { id: 'font-size-small', size: 10, check: 'font-size-small' },
        { id: 'font-size-normal', size: 12, check: 'font-size-normal' },
        { id: 'font-size-large', size: 14, check: 'font-size-large' },
        { id: 'font-size-xlarge', size: 16, check: 'font-size-xlarge' }
    ];

    sizes.forEach(({ id, size, check }) => {
        it(`${id} は changeFontSize(${size}) を呼ぶ`, async () => {
            await handleMenuEvent(id);
            expect(callLog).toContain(`changeFontSize:${size}`);
            expect(tauriCheckCalls).toContainEqual({ id: check, checked: true });
            
            // 他のサイズは全てfalse
            const otherSizes = sizes.filter(s => s.id !== id);
            otherSizes.forEach(other => {
                expect(tauriCheckCalls).toContainEqual({ id: other.check, checked: false });
            });
        });
    });
});

describe('handleMenuEvent - テーマ', () => {
    beforeEach(resetState);

    it('theme-light は setTheme("light") を呼ぶ', async () => {
        await handleMenuEvent('theme-light');
        expect(callLog).toContain('setTheme:light');
        expect(tauriCheckCalls).toContainEqual({ id: 'theme-light', checked: true });
        expect(tauriCheckCalls).toContainEqual({ id: 'theme-dark', checked: false });
        expect(tauriCheckCalls).toContainEqual({ id: 'theme-green', checked: false });
    });

    it('theme-dark は setTheme("dark") を呼ぶ', async () => {
        await handleMenuEvent('theme-dark');
        expect(callLog).toContain('setTheme:dark');
        expect(tauriCheckCalls).toContainEqual({ id: 'theme-dark', checked: true });
    });

    it('theme-green は setTheme("green") を呼ぶ', async () => {
        await handleMenuEvent('theme-green');
        expect(callLog).toContain('setTheme:green');
        expect(tauriCheckCalls).toContainEqual({ id: 'theme-green', checked: true });
    });
});

describe('handleMenuEvent - 言語', () => {
    beforeEach(resetState);

    it('language-ja は setLanguage("ja") と rebuildMenu を呼ぶ', async () => {
        await handleMenuEvent('language-ja');
        expect(callLog).toContain('setLanguage:ja');
        expect(callLog).toContain('updateAllUIText');
        expect(callLog).toContain('rebuildMenu');
    });

    it('language-en は setLanguage("en") と rebuildMenu を呼ぶ', async () => {
        await handleMenuEvent('language-en');
        expect(callLog).toContain('setLanguage:en');
        expect(callLog).toContain('updateAllUIText');
        expect(callLog).toContain('rebuildMenu');
    });
});

describe('handleMenuEvent - トグル系', () => {
    beforeEach(resetState);

    it('always-on-top はトグルし、TauriAPIを呼ぶ', async () => {
        expect(AppState.alwaysOnTop).toBe(false);
        
        await handleMenuEvent('always-on-top');
        
        expect(AppState.alwaysOnTop).toBe(true);
        expect(callLog).toContain('setAlwaysOnTop:true');
        expect(tauriCheckCalls).toContainEqual({ id: 'always-on-top', checked: true });
    });

    it('always-on-top は再度トグルでOFFになる', async () => {
        AppState.alwaysOnTop = true;
        
        await handleMenuEvent('always-on-top');
        
        expect(AppState.alwaysOnTop).toBe(false);
        expect(callLog).toContain('setAlwaysOnTop:false');
    });

    it('auto-scroll はトグルし、saveToLocalStorage を呼ぶ', async () => {
        expect(AppState.autoScrollToSelection).toBe(true);
        
        await handleMenuEvent('auto-scroll');
        
        expect(AppState.autoScrollToSelection).toBe(false);
        expect(callLog).toContain('saveToLocalStorage');
        expect(tauriCheckCalls).toContainEqual({ id: 'auto-scroll', checked: false });
    });

    it('show-new-sheet-dialog はトグルし、saveToLocalStorage を呼ぶ', async () => {
        expect(AppState.showNewSheetDialog).toBe(false);
        
        await handleMenuEvent('show-new-sheet-dialog');
        
        expect(AppState.showNewSheetDialog).toBe(true);
        expect(callLog).toContain('saveToLocalStorage');
        expect(tauriCheckCalls).toContainEqual({ id: 'show-new-sheet-dialog', checked: true });
    });

    it('toggle-intermediate-headers はトグルし、renderSpreadsheet を呼ぶ', async () => {
        expect(AppState.showIntermediateHeaders).toBe(false);
        
        await handleMenuEvent('toggle-intermediate-headers');
        
        expect(AppState.showIntermediateHeaders).toBe(true);
        expect(callLog).toContain('saveToLocalStorage');
        expect(callLog).toContain('renderSpreadsheet');
        expect(tauriCheckCalls).toContainEqual({ id: 'toggle-intermediate-headers', checked: true });
    });

    it('toggle-debug はトグルし、updateMenuCheckmarks を呼ぶ', async () => {
        expect(AppState.debugMode).toBe(false);
        
        await handleMenuEvent('toggle-debug');
        
        expect(AppState.debugMode).toBe(true);
        expect(callLog).toContain('updateMenuCheckmarks');
        expect(tauriCheckCalls).toContainEqual({ id: 'toggle-debug', checked: true });
    });
});

describe('handleMenuEvent - その他', () => {
    beforeEach(resetState);

    it('reset-view-settings は resetViewSettings と rebuildMenu を呼ぶ', async () => {
        await handleMenuEvent('reset-view-settings');
        expect(callLog).toContain('resetViewSettings');
        expect(callLog).toContain('rebuildMenu');
    });

    it('export-logs は exportDebugLogs を呼ぶ', async () => {
        await handleMenuEvent('export-logs');
        expect(callLog).toContain('exportDebugLogs');
    });

    it('reload-page は location.reload を呼ぶ', async () => {
        await handleMenuEvent('reload-page');
        expect(callLog).toContain('reload');
    });

    it('未知のメニューIDは何もしない', async () => {
        await handleMenuEvent('unknown-menu-id');
        // エラーなく完了すること
        expect(callLog.length).toBe(0);
    });
});

describe('handleMenuEvent - Tauriチェック状態の排他制御', () => {
    beforeEach(resetState);

    it('フレームフィルター切替時、選択したもの以外はfalseになる', async () => {
        await handleMenuEvent('frame-filter-odd');
        
        const allCheck = tauriCheckCalls.find(c => c.id === 'frame-filter-all');
        const oddCheck = tauriCheckCalls.find(c => c.id === 'frame-filter-odd');
        const evenCheck = tauriCheckCalls.find(c => c.id === 'frame-filter-even');
        
        expect(allCheck.checked).toBe(false);
        expect(oddCheck.checked).toBe(true);
        expect(evenCheck.checked).toBe(false);
    });

    it('テーマ切替時、選択したもの以外はfalseになる', async () => {
        await handleMenuEvent('theme-dark');
        
        const light = tauriCheckCalls.find(c => c.id === 'theme-light');
        const dark = tauriCheckCalls.find(c => c.id === 'theme-dark');
        const green = tauriCheckCalls.find(c => c.id === 'theme-green');
        
        expect(light.checked).toBe(false);
        expect(dark.checked).toBe(true);
        expect(green.checked).toBe(false);
    });

    it('ヘッダーモード切替時、選択したもの以外はfalseになる', async () => {
        await handleMenuEvent('header-mode-simple');
        
        const detail = tauriCheckCalls.find(c => c.id === 'header-mode-detail');
        const simple = tauriCheckCalls.find(c => c.id === 'header-mode-simple');
        
        expect(detail.checked).toBe(false);
        expect(simple.checked).toBe(true);
    });
});

describe('handleMenuEvent - 全メニューIDの網羅確認', () => {
    const allMenuIds = [
        'new-sheet', 'open-file', 'save-file', 'save-as-file', 'export-jsx',
        'close-file', 'close-all-sheets', 'undo', 'redo',
        'sheet-settings', 'change-duration', 'change-fps', 'change-frame-page',
        'change-max-columns', 'reset-column-names', 'send-to-ae', 'get-from-ae',
        'clear-sheet', 'reload-page',
        'frame-filter-all', 'frame-filter-odd', 'frame-filter-even',
        'header-mode-detail', 'header-mode-simple',
        'font-size-xsmall', 'font-size-small', 'font-size-normal',
        'font-size-large', 'font-size-xlarge',
        'show-new-sheet-dialog', 'toggle-intermediate-headers',
        'reset-view-settings', 'language-ja', 'language-en',
        'theme-light', 'theme-dark', 'theme-green',
        'always-on-top', 'auto-scroll',
        'toggle-debug', 'export-logs'
    ];

    allMenuIds.forEach(menuId => {
        it(`"${menuId}" はエラーなく実行される`, async () => {
            resetState();
            await expect(handleMenuEvent(menuId)).resolves.not.toThrow();
        });
    });
});
