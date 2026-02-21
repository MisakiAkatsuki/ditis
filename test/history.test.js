import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Undo/Redo（履歴管理）のテスト
 * history.js の saveHistory, undo, redo, restoreHistory, updateUndoRedoButtons
 */

// ========================================
// グローバルモック
// ========================================

const CONSTANTS = { MAX_HISTORY: 50 };

let AppState;
let undoBtnMock, redoBtnMock;
let renderCalls, tabCalls, clearCalls, selectCalls, scrollCalls, statusMessages;

function resetAppState() {
    AppState = {
        sheets: [{
            name: 'Sheet1',
            layers: [{ id: 'L1', name: 'A' }, { id: 'L2', name: 'B' }],
            frames: 10,
            visibleRows: 10,
            data: {}
        }],
        currentSheetIndex: 0,
        fps: 24,
        selectedCells: [],
        history: [],
        historyIndex: -1,
        debugMode: false,
        originalSelectionSize: 0,
        specialDisplayCache: new Map()
    };
    // Initialize data
    for (let f = 1; f <= 10; f++) {
        AppState.sheets[0].data[f] = { L1: '', L2: '' };
    }
    renderCalls = 0;
    tabCalls = 0;
    clearCalls = 0;
    selectCalls = [];
    scrollCalls = 0;
    statusMessages = [];
    undoBtnMock = { disabled: false };
    redoBtnMock = { disabled: false };
}

function getCurrentSheet() {
    return AppState.sheets[AppState.currentSheetIndex];
}

function debugLog() {}
function renderSpreadsheet() { renderCalls++; }
function renderTabs() { tabCalls++; }
function clearSelection() { clearCalls++; }
function selectCell(cell, frame, layerId) {
    selectCalls.push({ frame, layerId });
    AppState.selectedCells.push({ cell, frame, layerId });
}
function scrollToSelectionIfEnabled() { scrollCalls++; }
function updateStatusBar(msg) { if (msg) statusMessages.push(msg); }

// Mock document
const mockElements = {};
const originalQuerySelector = globalThis.document?.querySelector;
globalThis.document = {
    getElementById: (id) => {
        if (id === 'undo-btn') return undoBtnMock;
        if (id === 'redo-btn') return redoBtnMock;
        if (id === 'fps-select') return { value: 24 };
        return null;
    },
    querySelector: (sel) => {
        const match = sel.match(/data-frame="(\d+)".*data-layer="(\w+)"/);
        if (match) {
            return { dataset: { frame: match[1], layer: match[2] } };
        }
        return null;
    }
};

// ========================================
// saveHistory
// ========================================
function saveHistory() {
    try {
        const state = JSON.stringify({
            sheets: AppState.sheets,
            currentSheetIndex: AppState.currentSheetIndex,
            fps: AppState.fps,
            selectedCells: AppState.selectedCells.map(s => ({ frame: s.frame, layerId: s.layerId }))
        });
        AppState.history = AppState.history.slice(0, AppState.historyIndex + 1);
        AppState.history.push(state);
        if (AppState.history.length > CONSTANTS.MAX_HISTORY) {
            AppState.history.shift();
        } else {
            AppState.historyIndex++;
        }
        updateUndoRedoButtons();
    } catch (error) {
        console.error('履歴保存エラー:', error);
    }
}

function undo() {
    if (AppState.historyIndex > 0) {
        AppState.historyIndex--;
        AppState.originalSelectionSize = 0;
        restoreHistory();
        const sheetName = getCurrentSheet()?.name || 'Sheet';
        updateStatusBar(`[${sheetName}] 元に戻しました`);
    }
}

function redo() {
    if (AppState.historyIndex < AppState.history.length - 1) {
        AppState.historyIndex++;
        AppState.originalSelectionSize = 0;
        restoreHistory();
        const sheetName = getCurrentSheet()?.name || 'Sheet';
        updateStatusBar(`[${sheetName}] やり直しました`);
    }
}

function restoreHistory() {
    try {
        if (AppState.historyIndex < 0 || AppState.historyIndex >= AppState.history.length) {
            return;
        }
        const state = JSON.parse(AppState.history[AppState.historyIndex]);
        AppState.sheets = state.sheets;
        AppState.currentSheetIndex = state.currentSheetIndex;
        AppState.fps = state.fps;

        renderTabs();
        renderSpreadsheet();
        clearSelection();
        if (state.selectedCells && state.selectedCells.length > 0) {
            state.selectedCells.forEach(s => {
                const cell = document.querySelector(
                    `td[data-frame="${s.frame}"][data-layer="${s.layerId}"]`
                );
                if (cell) {
                    selectCell(cell, s.frame, s.layerId);
                }
            });
            if (AppState.selectedCells.length > 0) {
                scrollToSelectionIfEnabled(AppState.selectedCells[0].cell);
            }
        }
        updateUndoRedoButtons();
        updateStatusBar();
    } catch (error) {
        console.error('履歴復元エラー:', error);
    }
}

function updateUndoRedoButtons() {
    if (undoBtnMock) {
        undoBtnMock.disabled = AppState.historyIndex <= 0;
    }
    if (redoBtnMock) {
        redoBtnMock.disabled = AppState.historyIndex >= AppState.history.length - 1;
    }
}

// ========================================
// テスト
// ========================================

describe('Undo/Redo 履歴管理', () => {
    beforeEach(() => {
        resetAppState();
    });

    describe('saveHistory', () => {
        it('最初の保存で historyIndex が 0 になる', () => {
            saveHistory();
            expect(AppState.historyIndex).toBe(0);
            expect(AppState.history.length).toBe(1);
        });

        it('複数回保存で historyIndex が増加する', () => {
            saveHistory();
            saveHistory();
            saveHistory();
            expect(AppState.historyIndex).toBe(2);
            expect(AppState.history.length).toBe(3);
        });

        it('シートデータが正しくJSONシリアライズされる', () => {
            AppState.sheets[0].data[1].L1 = '5';
            saveHistory();
            const saved = JSON.parse(AppState.history[0]);
            expect(saved.sheets[0].data[1].L1).toBe('5');
            expect(saved.fps).toBe(24);
            expect(saved.currentSheetIndex).toBe(0);
        });

        it('選択範囲が保存される', () => {
            AppState.selectedCells = [
                { cell: {}, frame: 1, layerId: 'L1' },
                { cell: {}, frame: 2, layerId: 'L1' }
            ];
            saveHistory();
            const saved = JSON.parse(AppState.history[0]);
            expect(saved.selectedCells).toHaveLength(2);
            expect(saved.selectedCells[0]).toEqual({ frame: 1, layerId: 'L1' });
        });

        it('MAX_HISTORY を超えると古い履歴が削除される', () => {
            for (let i = 0; i < CONSTANTS.MAX_HISTORY + 10; i++) {
                AppState.sheets[0].data[1].L1 = String(i);
                saveHistory();
            }
            expect(AppState.history.length).toBe(CONSTANTS.MAX_HISTORY);
            // 最新の値が最後に保存されている
            const lastState = JSON.parse(AppState.history[AppState.history.length - 1]);
            expect(lastState.sheets[0].data[1].L1).toBe(String(CONSTANTS.MAX_HISTORY + 9));
        });

        it('undo後に新しい保存をすると、redo履歴が削除される', () => {
            saveHistory(); // index 0
            AppState.sheets[0].data[1].L1 = 'first';
            saveHistory(); // index 1
            AppState.sheets[0].data[1].L1 = 'second';
            saveHistory(); // index 2

            // undo で index 1 に戻る
            undo();
            expect(AppState.historyIndex).toBe(1);

            // 新しい変更を保存
            AppState.sheets[0].data[1].L1 = 'branch';
            saveHistory();

            // redo履歴（index 2 の 'second'）は消えている
            expect(AppState.history.length).toBe(3);
            const last = JSON.parse(AppState.history[2]);
            expect(last.sheets[0].data[1].L1).toBe('branch');
        });
    });

    describe('undo', () => {
        it('historyIndex が 0 のとき何もしない', () => {
            saveHistory();
            expect(AppState.historyIndex).toBe(0);
            undo();
            expect(AppState.historyIndex).toBe(0);
        });

        it('前の状態に戻る', () => {
            AppState.sheets[0].data[1].L1 = 'before';
            saveHistory();
            AppState.sheets[0].data[1].L1 = 'after';
            saveHistory();

            undo();
            expect(AppState.sheets[0].data[1].L1).toBe('before');
            expect(AppState.historyIndex).toBe(0);
        });

        it('複数回undoできる', () => {
            saveHistory(); // state 0: empty
            AppState.sheets[0].data[1].L1 = 'v1';
            saveHistory(); // state 1: v1
            AppState.sheets[0].data[1].L1 = 'v2';
            saveHistory(); // state 2: v2

            undo(); // → state 1
            expect(AppState.sheets[0].data[1].L1).toBe('v1');
            undo(); // → state 0
            expect(AppState.sheets[0].data[1].L1).toBe('');
        });

        it('ステータスバーに「元に戻しました」が表示される', () => {
            saveHistory();
            saveHistory();
            undo();
            expect(statusMessages.some(m => m.includes('元に戻しました'))).toBe(true);
        });

        it('originalSelectionSize がクリアされる', () => {
            saveHistory();
            saveHistory();
            AppState.originalSelectionSize = 5;
            undo();
            expect(AppState.originalSelectionSize).toBe(0);
        });
    });

    describe('redo', () => {
        it('最後の履歴のとき何もしない', () => {
            saveHistory();
            const idx = AppState.historyIndex;
            redo();
            expect(AppState.historyIndex).toBe(idx);
        });

        it('undo後にredoで元に戻る', () => {
            AppState.sheets[0].data[1].L1 = 'before';
            saveHistory();
            AppState.sheets[0].data[1].L1 = 'after';
            saveHistory();

            undo();
            expect(AppState.sheets[0].data[1].L1).toBe('before');
            redo();
            expect(AppState.sheets[0].data[1].L1).toBe('after');
        });

        it('複数回のundo→redoで正しく遷移する', () => {
            saveHistory(); // 0
            AppState.sheets[0].data[1].L1 = 'v1';
            saveHistory(); // 1
            AppState.sheets[0].data[1].L1 = 'v2';
            saveHistory(); // 2

            undo(); // → 1
            undo(); // → 0
            redo(); // → 1
            expect(AppState.sheets[0].data[1].L1).toBe('v1');
            redo(); // → 2
            expect(AppState.sheets[0].data[1].L1).toBe('v2');
        });

        it('ステータスバーに「やり直しました」が表示される', () => {
            saveHistory();
            saveHistory();
            undo();
            redo();
            expect(statusMessages.some(m => m.includes('やり直しました'))).toBe(true);
        });
    });

    describe('restoreHistory', () => {
        it('FPS が復元される', () => {
            AppState.fps = 24;
            saveHistory();
            AppState.fps = 30;
            saveHistory();

            undo();
            expect(AppState.fps).toBe(24);
        });

        it('currentSheetIndex が復元される', () => {
            AppState.sheets.push({
                name: 'Sheet2', layers: [{ id: 'L1', name: 'A' }],
                frames: 10, visibleRows: 10,
                data: { 1: { L1: '' } }
            });
            AppState.currentSheetIndex = 0;
            saveHistory();
            AppState.currentSheetIndex = 1;
            saveHistory();

            undo();
            expect(AppState.currentSheetIndex).toBe(0);
        });

        it('renderSpreadsheet と renderTabs が呼ばれる', () => {
            saveHistory();
            saveHistory();
            const beforeRender = renderCalls;
            const beforeTabs = tabCalls;
            undo();
            expect(renderCalls).toBeGreaterThan(beforeRender);
            expect(tabCalls).toBeGreaterThan(beforeTabs);
        });

        it('選択範囲が復元される', () => {
            AppState.selectedCells = [{ cell: {}, frame: 3, layerId: 'L2' }];
            saveHistory();
            AppState.selectedCells = [];
            saveHistory();

            undo();
            // restoreHistoryでselectCellが呼ばれた
            expect(selectCalls.some(c => c.frame === 3 && c.layerId === 'L2')).toBe(true);
        });

        it('不正な historyIndex では何もしない', () => {
            AppState.historyIndex = -1;
            const beforeRender = renderCalls;
            restoreHistory();
            expect(renderCalls).toBe(beforeRender);
        });
    });

    describe('updateUndoRedoButtons', () => {
        it('historyIndex <= 0 で undo ボタンが無効', () => {
            saveHistory();
            updateUndoRedoButtons();
            expect(undoBtnMock.disabled).toBe(true);
        });

        it('historyIndex > 0 で undo ボタンが有効', () => {
            saveHistory();
            saveHistory();
            updateUndoRedoButtons();
            expect(undoBtnMock.disabled).toBe(false);
        });

        it('最後の履歴で redo ボタンが無効', () => {
            saveHistory();
            saveHistory();
            updateUndoRedoButtons();
            expect(redoBtnMock.disabled).toBe(true);
        });

        it('undo後は redo ボタンが有効', () => {
            saveHistory();
            saveHistory();
            undo();
            expect(redoBtnMock.disabled).toBe(false);
        });
    });

    describe('統合テスト', () => {
        it('編集→undo→別の編集→redoできない', () => {
            saveHistory(); // 0: empty
            AppState.sheets[0].data[1].L1 = 'A';
            saveHistory(); // 1: A
            AppState.sheets[0].data[1].L1 = 'B';
            saveHistory(); // 2: B

            undo(); // → 1: A
            AppState.sheets[0].data[1].L1 = 'C';
            saveHistory(); // 2: C (Bは消える)

            redo(); // 最後なので何も起こらない
            expect(AppState.sheets[0].data[1].L1).toBe('C');
            expect(AppState.historyIndex).toBe(2);
        });

        it('MAX_HISTORY到達後もundo/redoが正しく動作する', () => {
            for (let i = 0; i < CONSTANTS.MAX_HISTORY + 5; i++) {
                AppState.sheets[0].data[1].L1 = String(i);
                saveHistory();
            }
            expect(AppState.history.length).toBe(CONSTANTS.MAX_HISTORY);
            
            // 最新の値を確認
            const latest = JSON.parse(AppState.history[AppState.historyIndex]);
            expect(latest.sheets[0].data[1].L1).toBe(String(CONSTANTS.MAX_HISTORY + 4));

            // undoで前の値に戻る
            undo();
            const prev = JSON.parse(AppState.history[AppState.historyIndex]);
            expect(prev.sheets[0].data[1].L1).toBe(String(CONSTANTS.MAX_HISTORY + 3));
        });

        it('複数シートのundo/redoが正しく動作する', () => {
            AppState.sheets.push({
                name: 'Sheet2',
                layers: [{ id: 'L1', name: 'A' }],
                frames: 10, visibleRows: 10,
                data: {}
            });
            for (let f = 1; f <= 10; f++) {
                AppState.sheets[1].data[f] = { L1: '' };
            }

            AppState.currentSheetIndex = 0;
            AppState.sheets[0].data[1].L1 = 'Sheet1Data';
            saveHistory();

            AppState.currentSheetIndex = 1;
            AppState.sheets[1].data[1].L1 = 'Sheet2Data';
            saveHistory();

            undo();
            expect(AppState.currentSheetIndex).toBe(0);
            expect(AppState.sheets[0].data[1].L1).toBe('Sheet1Data');
        });
    });
});
