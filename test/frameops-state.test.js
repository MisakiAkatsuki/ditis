import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * フレーム操作・状態管理のテスト
 * frameOps.js / stateManager.js の主要関数
 */

// ========================================
// グローバルモック
// ========================================

const ErrorLevel = { INFO: 'info', WARNING: 'warning', ERROR: 'error' };

let AppState;
let renderCalls, clearCalls, selectCalls, toastMessages, statusMessages, historySaves;

function resetState() {
    AppState = {
        sheets: [{
            name: 'Sheet1',
            layers: [
                { id: 'L1', name: 'A' },
                { id: 'L2', name: 'B' },
                { id: 'L3', name: 'C' }
            ],
            frames: 24,
            visibleRows: 24,
            data: {},
            disabledFrames: [],
            insertedFrames: [],
            insertedFrameMap: {}
        }],
        currentSheetIndex: 0,
        fps: 24,
        selectedCells: [],
        clipboard: null,
        history: [],
        historyIndex: -1,
        debugMode: false,
        specialDisplayCache: new Map()
    };
    for (let f = 1; f <= 24; f++) {
        AppState.sheets[0].data[f] = { L1: '', L2: '', L3: '' };
    }
    renderCalls = 0;
    clearCalls = 0;
    selectCalls = [];
    toastMessages = [];
    statusMessages = [];
    historySaves = 0;
}

function getCurrentSheet() { return AppState.sheets[AppState.currentSheetIndex]; }
function getMaxVisibleRows(sheet) { return sheet.frames; }
function validateFrame(frame, max) { return frame >= 1 && frame <= max; }
function validateLayerId(layerId, layers) { return layers.some(l => l.id === layerId); }
function renderSpreadsheet() { renderCalls++; }
function clearSelection() { clearCalls++; AppState.selectedCells = []; }
function selectCell(cell, frame, layerId) {
    selectCalls.push({ frame, layerId });
    AppState.selectedCells.push({ cell, frame, layerId });
}
function saveHistory() { historySaves++; }
function saveToLocalStorage() {}
function showErrorToast(msg, level) { toastMessages.push({ message: msg, level }); }
function updateStatusBar(msg) { if (msg) statusMessages.push(msg); }
function calculateSpecialDisplayCache() {}
function scrollToSelectionIfEnabled() {}
function debugLog() {}

globalThis.document = {
    getElementById: () => null,
    querySelector: (sel) => {
        const match = sel.match(/data-frame="(\d+)".*data-layer="(\w+)"/);
        if (match) {
            return { dataset: { frame: match[1], layer: match[2] } };
        }
        return null;
    }
};

// ========================================
// copySelection
// ========================================
function copySelection() {
    if (AppState.selectedCells.length === 0) return;
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    AppState.clipboard = AppState.selectedCells.map(s => {
        if (!validateFrame(s.frame, maxRows)) return null;
        if (!validateLayerId(s.layerId, sheet.layers)) return null;
        const value = sheet.data[s.frame][s.layerId];
        return { frame: s.frame, layerId: s.layerId, value: value };
    }).filter(item => item !== null);
    updateStatusBar(`${AppState.clipboard.length} セルをコピーしました`);
}

function cutSelection() {
    copySelection();
    deleteSelection();
}

// ========================================
// deleteSelection
// ========================================
function deleteSelection() {
    if (AppState.selectedCells.length === 0) return;
    saveHistory();
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    const selectedCellsBackup = AppState.selectedCells.map(s => ({ frame: s.frame, layerId: s.layerId }));
    selectedCellsBackup.forEach(s => {
        if (!validateFrame(s.frame, maxRows)) return;
        if (!validateLayerId(s.layerId, sheet.layers)) return;
        const oldValue = sheet.data[s.frame][s.layerId];
        sheet.data[s.frame][s.layerId] = '';
        if (oldValue !== '') {
            const nextFrame = s.frame + 1;
            if (nextFrame <= maxRows && sheet.data[nextFrame] && sheet.data[nextFrame][s.layerId] === '-') {
                let actualValue = '';
                for (let f = s.frame - 1; f >= 1; f--) {
                    const val = (sheet.data[f] && sheet.data[f][s.layerId]) || '';
                    if (val !== '' && val !== '-') { actualValue = val; break; }
                }
                if (actualValue !== '') {
                    sheet.data[nextFrame][s.layerId] = actualValue;
                }
            }
        }
    });
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet();
    clearSelection();
    selectedCellsBackup.forEach(s => {
        const cell = document.querySelector(`td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`);
        if (cell) selectCell(cell, s.frame, s.layerId);
    });
    updateStatusBar(`${selectedCellsBackup.length} セルを削除しました`);
}

// ========================================
// pasteSelection
// ========================================
function pasteSelection() {
    if (!AppState.clipboard || AppState.selectedCells.length === 0) return;
    saveHistory();
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    const anchor = AppState.selectedCells[0];
    if (!validateFrame(anchor.frame, maxRows)) return;
    if (!validateLayerId(anchor.layerId, sheet.layers)) return;

    const clipboardFrames = [...new Set(AppState.clipboard.map(c => c.frame))];
    const clipboardLayers = [...new Set(AppState.clipboard.map(c => c.layerId))];
    const isRowCopy = clipboardLayers.length > 1 && clipboardFrames.length === 1;
    const isColumnCopy = clipboardLayers.length === 1 && clipboardFrames.length > 1;

    const selectedFrames = [...new Set(AppState.selectedCells.map(s => s.frame))];
    const selectedLayers = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    const isRowPaste = selectedLayers.length > 1 && selectedFrames.length === 1;
    const isColumnPaste = selectedLayers.length === 1 && selectedFrames.length > 1;

    if (isRowCopy && isColumnPaste) {
        showErrorToast('行の値を列にペーストすることはできません。', ErrorLevel.WARNING);
        return;
    }
    if (isColumnCopy && isRowPaste) {
        showErrorToast('列の値を行にペーストすることはできません。', ErrorLevel.WARNING);
        return;
    }

    let pastedCount = 0;
    const clipLayerIdx = sheet.layers.findIndex(l => l.id === AppState.clipboard[0].layerId);
    const anchorLayerIdx = sheet.layers.findIndex(l => l.id === anchor.layerId);
    AppState.clipboard.forEach(item => {
        const targetFrame = anchor.frame + (item.frame - AppState.clipboard[0].frame);
        const itemLayerIdx = sheet.layers.findIndex(l => l.id === item.layerId);
        const targetLayerIdx = anchorLayerIdx + (itemLayerIdx - clipLayerIdx);
        if (targetLayerIdx < 0 || targetLayerIdx >= sheet.layers.length) return;
        const targetLayerId = sheet.layers[targetLayerIdx].id;
        if (!validateFrame(targetFrame, maxRows)) return;
        if (!validateLayerId(targetLayerId, sheet.layers)) return;
        if (item.value === '' || item.value === undefined) return;
        if (sheet.data[targetFrame] && sheet.data[targetFrame][targetLayerId] !== undefined) {
            sheet.data[targetFrame][targetLayerId] = item.value;
            pastedCount++;
        }
    });
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet();
    updateStatusBar(`${pastedCount} セルを貼り付けました`);
}

// ========================================
// fillDashToEnd
// ========================================
function fillDashToEnd() {
    if (AppState.selectedCells.length === 0) return;
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    const sortedCells = [...AppState.selectedCells].sort((a, b) => {
        if (a.frame !== b.frame) return a.frame - b.frame;
        return String(a.layerId).localeCompare(String(b.layerId));
    });
    let needFill = false;
    sortedCells.forEach(s => {
        const frame = s.frame;
        const layerId = s.layerId;
        if (!validateFrame(frame, maxRows)) return;
        if (!validateLayerId(layerId, sheet.layers)) return;
        const currentValue = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
        if (currentValue !== '') {
            needFill = true;
            for (let f = frame + 1; f <= maxRows; f++) {
                if (!sheet.data[f]) sheet.data[f] = {};
                sheet.data[f][layerId] = currentValue;
            }
            return;
        }
        const prevFrame = frame - 1;
        const prevValue = prevFrame >= 1 ? ((sheet.data[prevFrame] && sheet.data[prevFrame][layerId]) || '') : '';
        const prevValueStr = String(prevValue);
        if (prevValue !== '' && /^\d+$/.test(prevValueStr)) {
            needFill = true;
            for (let f = frame; f <= maxRows; f++) {
                if (!sheet.data[f]) sheet.data[f] = {};
                sheet.data[f][layerId] = prevValue;
            }
        }
    });
    if (needFill) {
        saveHistory();
        calculateSpecialDisplayCache(sheet);
        renderSpreadsheet();
    }
}

// ========================================
// toggleDisableFrames
// ========================================
function toggleDisableFrames() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('無効化する行を選択してください。', ErrorLevel.WARNING);
        return;
    }
    saveHistory();
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    if (!sheet.disabledFrames) sheet.disabledFrames = [];
    const frames = [...new Set(AppState.selectedCells.map(s => s.frame))];
    for (const frame of frames) {
        if (!validateFrame(frame, maxRows)) return;
    }
    const allDisabled = frames.every(f => sheet.disabledFrames.includes(f));
    if (allDisabled) {
        frames.forEach(f => {
            const index = sheet.disabledFrames.indexOf(f);
            if (index > -1) sheet.disabledFrames.splice(index, 1);
        });
        updateStatusBar(`${frames.length}行を有効化しました`);
    } else {
        frames.forEach(f => {
            if (!sheet.disabledFrames.includes(f)) sheet.disabledFrames.push(f);
        });
        updateStatusBar(`${frames.length}行を無効化しました`);
    }
    renderSpreadsheet();
}

// ========================================
// swapColumnWithLeft / swapColumnWithRight
// ========================================
function swapColumnWithLeft() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('入れ替える列を選択してください。', ErrorLevel.WARNING);
        return;
    }
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    if (layerIds.length !== 1) {
        showErrorToast('1つの列を選択してください。', ErrorLevel.WARNING);
        return;
    }
    const sheet = getCurrentSheet();
    const layerIndex = sheet.layers.findIndex(l => l.id === layerIds[0]);
    if (layerIndex === 0) {
        showErrorToast('最初の列は左に移動できません。', ErrorLevel.WARNING);
        return;
    }
    saveHistory();
    const temp = sheet.layers[layerIndex];
    sheet.layers[layerIndex] = sheet.layers[layerIndex - 1];
    sheet.layers[layerIndex - 1] = temp;
    renderSpreadsheet();
}

function swapColumnWithRight() {
    if (AppState.selectedCells.length === 0) {
        showErrorToast('入れ替える列を選択してください。', ErrorLevel.WARNING);
        return;
    }
    const layerIds = [...new Set(AppState.selectedCells.map(s => s.layerId))];
    if (layerIds.length !== 1) {
        showErrorToast('1つの列を選択してください。', ErrorLevel.WARNING);
        return;
    }
    const sheet = getCurrentSheet();
    const layerIndex = sheet.layers.findIndex(l => l.id === layerIds[0]);
    if (layerIndex === sheet.layers.length - 1) {
        showErrorToast('最後の列は右に移動できません。', ErrorLevel.WARNING);
        return;
    }
    saveHistory();
    const temp = sheet.layers[layerIndex];
    sheet.layers[layerIndex] = sheet.layers[layerIndex + 1];
    sheet.layers[layerIndex + 1] = temp;
    renderSpreadsheet();
}

// ========================================
// loopSelection
// ========================================
function loopSelection() {
    if (AppState.selectedCells.length === 0) return;
    saveHistory();
    const sheet = getCurrentSheet();
    const maxRows = getMaxVisibleRows(sheet);
    const selectedFrames = [...new Set(AppState.selectedCells.map(s => s.frame))].sort((a, b) => a - b);
    const selectedLayers = [...new Set(AppState.selectedCells.map(s => s.layerId))].sort();
    const minFrame = Math.min(...selectedFrames);
    const maxFrame = Math.max(...selectedFrames);
    const patternHeight = maxFrame - minFrame + 1;
    const pattern = [];
    for (let frame = minFrame; frame <= maxFrame; frame++) {
        for (const layerId of selectedLayers) {
            const cell = AppState.selectedCells.find(s => s.frame === frame && s.layerId === layerId);
            if (cell) {
                const value = sheet.data[frame][layerId];
                pattern.push({ frameOffset: frame - minFrame, layerId, value });
            }
        }
    }
    let pastedCount = 0;
    let currentFrame = maxFrame + 1;
    while (currentFrame <= maxRows) {
        for (const item of pattern) {
            const targetFrame = currentFrame + item.frameOffset;
            if (targetFrame > maxRows) break;
            if (!validateFrame(targetFrame, maxRows)) continue;
            if (!validateLayerId(item.layerId, sheet.layers)) continue;
            if (item.value === '' || item.value === undefined) continue;
            if (sheet.data[targetFrame] && sheet.data[targetFrame][item.layerId] !== undefined) {
                sheet.data[targetFrame][item.layerId] = item.value;
                pastedCount++;
            }
        }
        currentFrame += patternHeight;
    }
    calculateSpecialDisplayCache(sheet);
    renderSpreadsheet();
    updateStatusBar(`${pastedCount} セルにパターンをループしました`);
}

// ========================================
// テスト
// ========================================

describe('クリップボード操作', () => {
    beforeEach(() => resetState());

    describe('copySelection', () => {
        it('選択なしでは何もしない', () => {
            copySelection();
            expect(AppState.clipboard).toBeNull();
        });

        it('単一セルをコピーする', () => {
            AppState.sheets[0].data[1].L1 = '5';
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
            copySelection();
            expect(AppState.clipboard).toHaveLength(1);
            expect(AppState.clipboard[0]).toEqual({ frame: 1, layerId: 'L1', value: '5' });
        });

        it('複数セルをコピーする', () => {
            AppState.sheets[0].data[1].L1 = '1';
            AppState.sheets[0].data[2].L1 = '2';
            AppState.sheets[0].data[3].L1 = '3';
            AppState.selectedCells = [
                { cell: {}, frame: 1, layerId: 'L1' },
                { cell: {}, frame: 2, layerId: 'L1' },
                { cell: {}, frame: 3, layerId: 'L1' }
            ];
            copySelection();
            expect(AppState.clipboard).toHaveLength(3);
            expect(AppState.clipboard.map(c => c.value)).toEqual(['1', '2', '3']);
        });

        it('空セルもコピーされる（value: ""）', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
            copySelection();
            expect(AppState.clipboard[0].value).toBe('');
        });

        it('無効なlayerIdのセルはスキップされる', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'INVALID' }];
            copySelection();
            expect(AppState.clipboard).toHaveLength(0);
        });
    });

    describe('cutSelection', () => {
        it('コピーして削除する', () => {
            AppState.sheets[0].data[1].L1 = '5';
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
            cutSelection();
            expect(AppState.clipboard).toHaveLength(1);
            expect(AppState.clipboard[0].value).toBe('5');
            expect(AppState.sheets[0].data[1].L1).toBe('');
        });
    });

    describe('deleteSelection', () => {
        it('選択なしでは何もしない', () => {
            deleteSelection();
            expect(historySaves).toBe(0);
        });

        it('セルの値を空にする', () => {
            AppState.sheets[0].data[3].L2 = '10';
            AppState.selectedCells = [{ cell: {}, frame: 3, layerId: 'L2' }];
            deleteSelection();
            expect(AppState.sheets[0].data[3].L2).toBe('');
        });

        it('削除後、直後の"-"が上方向の数字に展開される', () => {
            AppState.sheets[0].data[1].L1 = '1';
            AppState.sheets[0].data[2].L1 = '2';
            AppState.sheets[0].data[3].L1 = '-';
            AppState.selectedCells = [{ cell: {}, frame: 2, layerId: 'L1' }];
            deleteSelection();
            expect(AppState.sheets[0].data[2].L1).toBe('');
            // frame 3 の "-" は frame 1 の "1" に展開される
            expect(AppState.sheets[0].data[3].L1).toBe('1');
        });

        it('saveHistory が呼ばれる', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
            deleteSelection();
            expect(historySaves).toBe(1);
        });
    });

    describe('pasteSelection', () => {
        it('クリップボードが空では何もしない', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
            pasteSelection();
            expect(historySaves).toBe(0);
        });

        it('選択なしでは何もしない', () => {
            AppState.clipboard = [{ frame: 1, layerId: 'L1', value: '5' }];
            pasteSelection();
            expect(historySaves).toBe(0);
        });

        it('単一セルを正しくペーストする', () => {
            AppState.clipboard = [{ frame: 1, layerId: 'L1', value: '5' }];
            AppState.selectedCells = [{ cell: {}, frame: 3, layerId: 'L1' }];
            pasteSelection();
            expect(AppState.sheets[0].data[3].L1).toBe('5');
        });

        it('空値はペーストされない', () => {
            AppState.sheets[0].data[5].L2 = 'existing';
            AppState.clipboard = [{ frame: 1, layerId: 'L1', value: '' }];
            AppState.selectedCells = [{ cell: {}, frame: 5, layerId: 'L2' }];
            pasteSelection();
            // 空値はスキップされるので既存値が残る
            expect(AppState.sheets[0].data[5].L2).toBe('existing');
        });

        it('行→列のペーストはエラーになる', () => {
            // 行コピー（複数列、1フレーム）
            AppState.clipboard = [
                { frame: 1, layerId: 'L1', value: '1' },
                { frame: 1, layerId: 'L2', value: '2' }
            ];
            // 列選択（1列、複数フレーム）
            AppState.selectedCells = [
                { cell: {}, frame: 1, layerId: 'L1' },
                { cell: {}, frame: 2, layerId: 'L1' }
            ];
            pasteSelection();
            expect(toastMessages.some(t => t.message.includes('行の値を列に'))).toBe(true);
        });

        it('列→行のペーストはエラーになる', () => {
            // 列コピー（1列、複数フレーム）
            AppState.clipboard = [
                { frame: 1, layerId: 'L1', value: '1' },
                { frame: 2, layerId: 'L1', value: '2' }
            ];
            // 行選択（複数列、1フレーム）
            AppState.selectedCells = [
                { cell: {}, frame: 1, layerId: 'L1' },
                { cell: {}, frame: 1, layerId: 'L2' }
            ];
            pasteSelection();
            expect(toastMessages.some(t => t.message.includes('列の値を行に'))).toBe(true);
        });

        it('相対位置で正しくペーストされる', () => {
            AppState.clipboard = [
                { frame: 1, layerId: 'L1', value: 'A' },
                { frame: 2, layerId: 'L1', value: 'B' }
            ];
            // frame 5 からペースト
            AppState.selectedCells = [{ cell: {}, frame: 5, layerId: 'L1' }];
            pasteSelection();
            expect(AppState.sheets[0].data[5].L1).toBe('A');
            expect(AppState.sheets[0].data[6].L1).toBe('B');
        });
    });
});

describe('fillDashToEnd', () => {
    beforeEach(() => resetState());

    it('選択なしでは何もしない', () => {
        fillDashToEnd();
        expect(historySaves).toBe(0);
    });

    it('数字があるセルから最後まで同じ値で埋める', () => {
        AppState.sheets[0].data[3].L1 = '5';
        AppState.selectedCells = [{ cell: {}, frame: 3, layerId: 'L1' }];
        fillDashToEnd();
        // frame 4以降が全て'5'で埋まる
        for (let f = 4; f <= 24; f++) {
            expect(AppState.sheets[0].data[f].L1).toBe('5');
        }
    });

    it('空セルでも前のフレームに数字があれば埋める', () => {
        AppState.sheets[0].data[3].L1 = '7';
        // frame 4 は空
        AppState.selectedCells = [{ cell: {}, frame: 4, layerId: 'L1' }];
        fillDashToEnd();
        for (let f = 4; f <= 24; f++) {
            expect(AppState.sheets[0].data[f].L1).toBe('7');
        }
    });

    it('前に数字がない場合は何もしない', () => {
        AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
        fillDashToEnd();
        expect(historySaves).toBe(0);
    });

    it('saveHistory が呼ばれる', () => {
        AppState.sheets[0].data[1].L1 = '1';
        AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
        fillDashToEnd();
        expect(historySaves).toBe(1);
    });
});

describe('toggleDisableFrames', () => {
    beforeEach(() => resetState());

    it('選択なしでエラーメッセージが出る', () => {
        toggleDisableFrames();
        expect(toastMessages.some(t => t.message.includes('無効化する行を選択'))).toBe(true);
    });

    it('有効なフレームを無効化する', () => {
        AppState.selectedCells = [
            { cell: {}, frame: 5, layerId: 'L1' },
            { cell: {}, frame: 6, layerId: 'L1' }
        ];
        toggleDisableFrames();
        expect(getCurrentSheet().disabledFrames).toContain(5);
        expect(getCurrentSheet().disabledFrames).toContain(6);
    });

    it('すべて無効化されている場合は有効化する', () => {
        const sheet = getCurrentSheet();
        sheet.disabledFrames = [5, 6];
        AppState.selectedCells = [
            { cell: {}, frame: 5, layerId: 'L1' },
            { cell: {}, frame: 6, layerId: 'L1' }
        ];
        toggleDisableFrames();
        expect(sheet.disabledFrames).not.toContain(5);
        expect(sheet.disabledFrames).not.toContain(6);
    });

    it('一部のみ無効化されている場合は全て無効化する', () => {
        const sheet = getCurrentSheet();
        sheet.disabledFrames = [5]; // 5だけ無効化済み
        AppState.selectedCells = [
            { cell: {}, frame: 5, layerId: 'L1' },
            { cell: {}, frame: 6, layerId: 'L1' }
        ];
        toggleDisableFrames();
        expect(sheet.disabledFrames).toContain(5);
        expect(sheet.disabledFrames).toContain(6);
    });

    it('重複して無効化しない', () => {
        const sheet = getCurrentSheet();
        sheet.disabledFrames = [5];
        AppState.selectedCells = [
            { cell: {}, frame: 5, layerId: 'L1' },
            { cell: {}, frame: 6, layerId: 'L1' }
        ];
        toggleDisableFrames();
        const count5 = sheet.disabledFrames.filter(f => f === 5).length;
        expect(count5).toBe(1);
    });
});

describe('swapColumn', () => {
    beforeEach(() => resetState());

    describe('swapColumnWithLeft', () => {
        it('選択なしでエラー', () => {
            swapColumnWithLeft();
            expect(toastMessages.length).toBeGreaterThan(0);
        });

        it('最初の列は左に移動できない', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L1' }];
            swapColumnWithLeft();
            expect(toastMessages.some(t => t.message.includes('最初の列'))).toBe(true);
        });

        it('列を左に入れ替える', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L2' }];
            const sheet = getCurrentSheet();
            expect(sheet.layers[0].id).toBe('L1');
            expect(sheet.layers[1].id).toBe('L2');
            swapColumnWithLeft();
            expect(sheet.layers[0].id).toBe('L2');
            expect(sheet.layers[1].id).toBe('L1');
        });

        it('複数列選択ではエラー', () => {
            AppState.selectedCells = [
                { cell: {}, frame: 1, layerId: 'L1' },
                { cell: {}, frame: 1, layerId: 'L2' }
            ];
            swapColumnWithLeft();
            expect(toastMessages.some(t => t.message.includes('1つの列'))).toBe(true);
        });
    });

    describe('swapColumnWithRight', () => {
        it('最後の列は右に移動できない', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L3' }];
            swapColumnWithRight();
            expect(toastMessages.some(t => t.message.includes('最後の列'))).toBe(true);
        });

        it('列を右に入れ替える', () => {
            AppState.selectedCells = [{ cell: {}, frame: 1, layerId: 'L2' }];
            const sheet = getCurrentSheet();
            swapColumnWithRight();
            expect(sheet.layers[1].id).toBe('L3');
            expect(sheet.layers[2].id).toBe('L2');
        });
    });
});

describe('loopSelection', () => {
    beforeEach(() => resetState());

    it('選択なしでは何もしない', () => {
        loopSelection();
        expect(historySaves).toBe(0);
    });

    it('パターンを最後まで繰り返す', () => {
        // 2フレームのパターン: 1, 2
        AppState.sheets[0].data[1].L1 = '1';
        AppState.sheets[0].data[2].L1 = '2';
        AppState.selectedCells = [
            { cell: {}, frame: 1, layerId: 'L1' },
            { cell: {}, frame: 2, layerId: 'L1' }
        ];
        loopSelection();
        // frame 3-4: 1,2 / frame 5-6: 1,2 / ...
        expect(AppState.sheets[0].data[3].L1).toBe('1');
        expect(AppState.sheets[0].data[4].L1).toBe('2');
        expect(AppState.sheets[0].data[5].L1).toBe('1');
        expect(AppState.sheets[0].data[6].L1).toBe('2');
    });

    it('空セルはスキップされる', () => {
        AppState.sheets[0].data[1].L1 = '1';
        AppState.sheets[0].data[2].L1 = '';
        AppState.selectedCells = [
            { cell: {}, frame: 1, layerId: 'L1' },
            { cell: {}, frame: 2, layerId: 'L1' }
        ];
        loopSelection();
        expect(AppState.sheets[0].data[3].L1).toBe('1');
        expect(AppState.sheets[0].data[4].L1).toBe('');
    });

    it('範囲外にはペーストされない', () => {
        // frames=24, パターンサイズ=24
        for (let f = 1; f <= 24; f++) {
            AppState.sheets[0].data[f].L1 = String(f);
            AppState.selectedCells.push({ cell: {}, frame: f, layerId: 'L1' });
        }
        loopSelection();
        // 24+1=25 > 24 → ループは1回も実行されない
        expect(statusMessages.some(m => m.includes('0 セルにパターン'))).toBe(true);
    });
});

describe('LocalStorage 操作', () => {
    let storedData;

    beforeEach(() => {
        resetState();
        storedData = {};
        globalThis.localStorage = {
            getItem: (key) => storedData[key] || null,
            setItem: (key, value) => { storedData[key] = value; }
        };
    });

    // saveToLocalStorage / loadFromLocalStorage テスト
    function saveToLocalStorage() {
        const data = {
            sheets: AppState.sheets,
            currentSheetIndex: AppState.currentSheetIndex,
            fps: AppState.fps,
            theme: AppState.theme || 'light',
            fontSize: AppState.fontSize || 12,
            frameFilter: AppState.frameFilter || 'all',
            headerDisplayMode: AppState.headerDisplayMode || 'detail',
            showIntermediateHeaders: AppState.showIntermediateHeaders || false,
            autoScrollToSelection: AppState.autoScrollToSelection !== false,
            showNewSheetDialog: AppState.showNewSheetDialog || false
        };
        try {
            localStorage.setItem('timesheet-data', JSON.stringify(data));
        } catch (error) {}
    }

    function loadFromLocalStorage() {
        const saved = localStorage.getItem('timesheet-data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                AppState.sheets = data.sheets;
                AppState.currentSheetIndex = data.currentSheetIndex;
                AppState.fps = data.fps;
                AppState.theme = data.theme || 'light';
                AppState.fontSize = data.fontSize || 12;
            } catch (error) {}
        }
    }

    it('保存したデータが読み込める', () => {
        AppState.sheets[0].data[1].L1 = 'test';
        AppState.fps = 30;
        saveToLocalStorage();

        // 状態をリセット
        AppState.sheets[0].data[1].L1 = '';
        AppState.fps = 24;

        loadFromLocalStorage();
        expect(AppState.sheets[0].data[1].L1).toBe('test');
        expect(AppState.fps).toBe(30);
    });

    it('テーマが保存・復元される', () => {
        AppState.theme = 'dark';
        saveToLocalStorage();
        AppState.theme = 'light';
        loadFromLocalStorage();
        expect(AppState.theme).toBe('dark');
    });

    it('データがない場合はデフォルト値が使われる', () => {
        loadFromLocalStorage();
        // 何もクラッシュしない
        expect(AppState.fps).toBe(24);
    });
});
