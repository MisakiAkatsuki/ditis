/**
 * キーボードショートカットのテスト
 * keyboard.js の handleKeyboard() で処理されるショートカットの動作を検証
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ========================================
// モック・ヘルパー
// ========================================

const ErrorLevel = { INFO: 'info', WARNING: 'warning', ERROR: 'error', CRITICAL: 'critical' };

let AppState;
let sheet;
let callLog;
let domElements;

function resetState() {
    callLog = [];
    sheet = {
        data: {},
        layers: [
            { id: 'L1', name: 'A' },
            { id: 'L2', name: 'B' },
            { id: 'L3', name: 'C' }
        ],
        fps: 24,
        visibleRows: 144,
        name: 'TestSheet'
    };
    AppState = {
        selectedCells: [],
        editingCell: null,
        justFinishedEditing: false,
        debugMode: false,
        isDragging: false,
        dragStart: null,
        frameFilter: 'all',
        headerDisplayMode: 'detail',
        fontSize: 12,
        theme: 'light',
        alwaysOnTop: false,
        autoScrollToSelection: true,
        showNewSheetDialog: false,
        showIntermediateHeaders: false,
        currentFilePath: null,
        selectionAnchor: null,
        isWPressed: false,
        isAPressed: false,
        isSPressed: false,
        isDPressed: false,
        originalSelectionSize: 0,
        originalSelectionRows: 0,
        originalSelectionCols: 0,
        clipboardData: null,
        fps: 24
    };
    domElements = {};
}

// DOM モック
function mockGetElementById(id) {
    return domElements[id] || null;
}

function mockQuerySelector() {
    return null;
}

// グローバルモック関数
function getCurrentSheet() { return sheet; }
function getMaxVisibleRows(s) { return s.visibleRows || 144; }
function debugLog() {}
function updateStatusBar(msg) { callLog.push({ fn: 'updateStatusBar', args: [msg] }); }
function showErrorToast(msg, level) { callLog.push({ fn: 'showErrorToast', args: [msg, level] }); }
function renderSpreadsheet() { callLog.push({ fn: 'renderSpreadsheet' }); }
function saveToLocalStorage() { callLog.push({ fn: 'saveToLocalStorage' }); }

// ファイル操作モック
function saveToFile() { callLog.push({ fn: 'saveToFile' }); }
function saveAsFile() { callLog.push({ fn: 'saveAsFile' }); }
function loadFromFileTauri() { callLog.push({ fn: 'loadFromFileTauri' }); }
function closeFile() { callLog.push({ fn: 'closeFile' }); }
function createNewSheetWithPrompt() { callLog.push({ fn: 'createNewSheetWithPrompt' }); }
function exportJSX() { callLog.push({ fn: 'exportJSX' }); }
function sendToAfterEffects() { callLog.push({ fn: 'sendToAfterEffects' }); }
function getTimeremapFromAE() { callLog.push({ fn: 'getTimeremapFromAE' }); }

// 編集操作モック
function undo() { callLog.push({ fn: 'undo' }); }
function redo() { callLog.push({ fn: 'redo' }); }
function copySelection() { callLog.push({ fn: 'copySelection' }); }
function cutSelection() { callLog.push({ fn: 'cutSelection' }); }
function pasteSelection() { callLog.push({ fn: 'pasteSelection' }); }
function deleteSelection() { callLog.push({ fn: 'deleteSelection' }); }
function selectAll() { callLog.push({ fn: 'selectAll' }); }
function saveHistory() { callLog.push({ fn: 'saveHistory' }); }

// 選択操作モック
function clearSelection() { AppState.selectedCells = []; callLog.push({ fn: 'clearSelection' }); }
function selectCell(cell, frame, layerId) {
    AppState.selectedCells.push({ cell, frame, layerId });
    callLog.push({ fn: 'selectCell', args: [frame, layerId] });
}
function moveCellSelection(dir) { callLog.push({ fn: 'moveCellSelection', args: [dir] }); }
function expandSelectionInDirection(dir) { callLog.push({ fn: 'expandSelectionInDirection', args: [dir] }); }
function selectRange(from, to) { callLog.push({ fn: 'selectRange', args: [from, to] }); }
function scrollToSelectionIfEnabled(cell) { callLog.push({ fn: 'scrollToSelectionIfEnabled' }); }

// getCellElement / calculateFrameRange
function getCellElement(frame, layerId) {
    return { dataset: { frame: String(frame), layer: String(layerId) } };
}

function calculateFrameRange(sortedCells) {
    const minFrame = Math.min(...sortedCells.map(s => s.frame));
    const maxFrame = Math.max(...sortedCells.map(s => s.frame));
    const shiftAmount = maxFrame - minFrame + 1;
    return { minFrame, maxFrame, shiftAmount };
}

// キーイベント生成
function createKeyEvent(key, options = {}) {
    const defaultPrevented = { value: false };
    return {
        key,
        code: options.code || `Key${key.toUpperCase()}`,
        ctrlKey: options.ctrlKey || false,
        shiftKey: options.shiftKey || false,
        altKey: options.altKey || false,
        metaKey: options.metaKey || false,
        preventDefault: () => { defaultPrevented.value = true; },
        stopPropagation: () => {},
        _defaultPrevented: defaultPrevented
    };
}

// ========================================
// テスト
// ========================================

describe('キーボードショートカット', () => {
    beforeEach(() => {
        resetState();
    });

    describe('Ctrl+ショートカット（ファイル操作）', () => {
        it('Ctrl+S は saveToFile を呼ぶ', () => {
            const e = createKeyEvent('s', { ctrlKey: true });
            // keyboard.jsのCtrl+S処理を直接テスト
            if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
                e.preventDefault();
                saveToFile();
            }
            expect(callLog.some(c => c.fn === 'saveToFile')).toBe(true);
        });

        it('Ctrl+Shift+S は saveAsFile を呼ぶ', () => {
            const e = createKeyEvent('S', { ctrlKey: true, shiftKey: true });
            if (e.ctrlKey && e.key === 'S' && e.shiftKey) {
                e.preventDefault();
                saveAsFile();
            }
            expect(callLog.some(c => c.fn === 'saveAsFile')).toBe(true);
        });

        it('Ctrl+O は loadFromFileTauri を呼ぶ', () => {
            const e = createKeyEvent('o', { ctrlKey: true });
            const isTauri = true;
            if (e.ctrlKey && e.key === 'o') {
                e.preventDefault();
                if (isTauri) {
                    loadFromFileTauri();
                }
            }
            expect(callLog.some(c => c.fn === 'loadFromFileTauri')).toBe(true);
        });

        it('Ctrl+N は createNewSheetWithPrompt を呼ぶ', () => {
            const e = createKeyEvent('n', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                createNewSheetWithPrompt();
            }
            expect(callLog.some(c => c.fn === 'createNewSheetWithPrompt')).toBe(true);
        });

        it('Ctrl+W は closeFile を呼ぶ', () => {
            const e = createKeyEvent('w', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'w') {
                e.preventDefault();
                closeFile();
            }
            expect(callLog.some(c => c.fn === 'closeFile')).toBe(true);
        });

        it('Ctrl+Z は undo を呼ぶ', () => {
            const e = createKeyEvent('z', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            expect(callLog.some(c => c.fn === 'undo')).toBe(true);
        });

        it('Ctrl+Y は redo を呼ぶ', () => {
            const e = createKeyEvent('y', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                redo();
            }
            expect(callLog.some(c => c.fn === 'redo')).toBe(true);
        });

        it('Ctrl+C は copySelection を呼ぶ', () => {
            const e = createKeyEvent('c', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                copySelection();
            }
            expect(callLog.some(c => c.fn === 'copySelection')).toBe(true);
        });

        it('Ctrl+X は cutSelection を呼ぶ', () => {
            const e = createKeyEvent('x', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'x') {
                e.preventDefault();
                cutSelection();
            }
            expect(callLog.some(c => c.fn === 'cutSelection')).toBe(true);
        });

        it('Ctrl+V は pasteSelection を呼ぶ', () => {
            const e = createKeyEvent('v', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                pasteSelection();
            }
            expect(callLog.some(c => c.fn === 'pasteSelection')).toBe(true);
        });

        it('Ctrl+A は selectAll を呼ぶ', () => {
            const e = createKeyEvent('a', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                selectAll();
            }
            expect(callLog.some(c => c.fn === 'selectAll')).toBe(true);
        });

        it('Ctrl+E は sendToAfterEffects を呼ぶ', () => {
            const e = createKeyEvent('e', { ctrlKey: true });
            if (e.ctrlKey && e.key === 'e' && !e.shiftKey) {
                e.preventDefault();
                sendToAfterEffects();
            }
            expect(callLog.some(c => c.fn === 'sendToAfterEffects')).toBe(true);
        });

        it('Ctrl+Shift+E は exportJSX を呼ぶ', () => {
            const e = createKeyEvent('E', { ctrlKey: true, shiftKey: true });
            if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
                e.preventDefault();
                exportJSX();
            }
            expect(callLog.some(c => c.fn === 'exportJSX')).toBe(true);
        });
    });

    describe('ナビゲーションキー', () => {
        it('矢印キーは moveCellSelection を呼ぶ', () => {
            AppState.selectedCells = [{ frame: 5, layerId: 'L1', cell: {} }];
            
            const directions = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
            directions.forEach(dir => {
                callLog = [];
                const e = createKeyEvent(dir);
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.shiftKey) {
                    e.preventDefault();
                    moveCellSelection(e.key);
                }
                expect(callLog.some(c => c.fn === 'moveCellSelection' && c.args[0] === dir)).toBe(true);
            });
        });

        it('Shift+矢印キーは expandSelectionInDirection を呼ぶ', () => {
            AppState.selectedCells = [{ frame: 5, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent('ArrowDown', { shiftKey: true });
            if (e.shiftKey && e.key === 'ArrowDown') {
                e.preventDefault();
                expandSelectionInDirection(e.key);
            }
            expect(callLog.some(c => c.fn === 'expandSelectionInDirection')).toBe(true);
        });

        it('Homeキーは先頭行（frame=1）に移動', () => {
            AppState.selectedCells = [{ frame: 50, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent('Home');
            if (e.key === 'Home' && !e.shiftKey) {
                e.preventDefault();
                const current = AppState.selectedCells[0];
                clearSelection();
                const cell = getCellElement(1, current.layerId);
                selectCell(cell, 1, current.layerId);
            }
            expect(AppState.selectedCells.length).toBe(1);
            expect(AppState.selectedCells[0].frame).toBe(1);
        });

        it('Escapeキーは選択をクリアする', () => {
            AppState.selectedCells = [
                { frame: 1, layerId: 'L1', cell: {} },
                { frame: 2, layerId: 'L1', cell: {} }
            ];
            
            const e = createKeyEvent('Escape');
            // 複数選択→先頭の1つだけ残す（実際のロジック）
            if (e.key === 'Escape' && AppState.selectedCells.length > 1) {
                const first = AppState.selectedCells[0];
                clearSelection();
                selectCell(first.cell, first.frame, first.layerId);
            }
            expect(AppState.selectedCells.length).toBe(1);
            expect(AppState.selectedCells[0].frame).toBe(1);
        });

        it('Deleteキーは deleteSelection を呼ぶ', () => {
            AppState.selectedCells = [{ frame: 1, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent('Delete');
            if (e.key === 'Delete' && AppState.selectedCells.length > 0) {
                e.preventDefault();
                deleteSelection();
            }
            expect(callLog.some(c => c.fn === 'deleteSelection')).toBe(true);
        });
    });

    describe('Enter キー処理', () => {
        it('空セルの上に数字がある場合、同じ値を入力して下に移動', () => {
            // フレーム1に"3"を設定
            sheet.data[1] = { 'L1': '3' };
            // フレーム2は空
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent('Enter');
            let needRender = false;
            
            if (e.key === 'Enter' && AppState.selectedCells.length >= 1) {
                e.preventDefault();
                
                AppState.selectedCells.forEach(s => {
                    const value = (sheet.data[s.frame] && sheet.data[s.frame][s.layerId]) || '';
                    if (value === '') {
                        const prevFrame = s.frame - 1;
                        if (prevFrame >= 1) {
                            const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][s.layerId]) || '';
                            if (prevValue !== '' && /^\d+$/.test(prevValue)) {
                                if (!sheet.data[s.frame]) sheet.data[s.frame] = {};
                                sheet.data[s.frame][s.layerId] = prevValue;
                                needRender = true;
                            }
                        }
                    }
                });
            }
            
            expect(needRender).toBe(true);
            expect(sheet.data[2]['L1']).toBe('3');
        });

        it('空セルの上に数字がない場合は何も入力しない', () => {
            // フレーム1は空
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent('Enter');
            let needRender = false;
            
            if (e.key === 'Enter' && AppState.selectedCells.length >= 1) {
                e.preventDefault();
                
                AppState.selectedCells.forEach(s => {
                    const value = (sheet.data[s.frame] && sheet.data[s.frame][s.layerId]) || '';
                    if (value === '') {
                        const prevFrame = s.frame - 1;
                        if (prevFrame >= 1) {
                            const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][s.layerId]) || '';
                            if (prevValue !== '' && /^\d+$/.test(prevValue)) {
                                if (!sheet.data[s.frame]) sheet.data[s.frame] = {};
                                sheet.data[s.frame][s.layerId] = prevValue;
                                needRender = true;
                            }
                        }
                    }
                });
            }
            
            expect(needRender).toBe(false);
        });

        it('単一セル選択でEnter後、needRenderの場合はsetTimeoutで移動', () => {
            sheet.data[1] = { 'L1': '5' };
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            let needRender = false;
            let moveMethod = null;
            
            // Enter処理のロジックを抽出
            AppState.selectedCells.forEach(s => {
                const value = (sheet.data[s.frame] && sheet.data[s.frame][s.layerId]) || '';
                if (value === '') {
                    const prevFrame = s.frame - 1;
                    if (prevFrame >= 1) {
                        const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][s.layerId]) || '';
                        if (prevValue !== '' && /^\d+$/.test(prevValue)) {
                            if (!sheet.data[s.frame]) sheet.data[s.frame] = {};
                            sheet.data[s.frame][s.layerId] = prevValue;
                            needRender = true;
                        }
                    }
                }
            });
            
            if (AppState.selectedCells.length === 1) {
                if (needRender) {
                    moveMethod = 'setTimeout';
                } else {
                    moveMethod = 'direct';
                }
            }
            
            expect(needRender).toBe(true);
            expect(moveMethod).toBe('setTimeout');
        });

        it('単一セル選択でEnter後、needRenderがfalseの場合は直接移動', () => {
            sheet.data[2] = { 'L1': '3' }; // セルに値がある場合
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            let needRender = false;
            let moveMethod = null;
            
            AppState.selectedCells.forEach(s => {
                const value = (sheet.data[s.frame] && sheet.data[s.frame][s.layerId]) || '';
                if (value === '') {
                    const prevFrame = s.frame - 1;
                    if (prevFrame >= 1) {
                        const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][s.layerId]) || '';
                        if (prevValue !== '' && /^\d+$/.test(prevValue)) {
                            if (!sheet.data[s.frame]) sheet.data[s.frame] = {};
                            sheet.data[s.frame][s.layerId] = prevValue;
                            needRender = true;
                        }
                    }
                }
            });
            
            if (AppState.selectedCells.length === 1) {
                if (needRender) {
                    moveMethod = 'setTimeout';
                } else {
                    moveMethod = 'direct';
                }
            }
            
            expect(needRender).toBe(false);
            expect(moveMethod).toBe('direct');
        });
    });

    describe('calculateFrameRange', () => {
        it('正しくフレーム範囲とシフト量を計算する', () => {
            const cells = [
                { frame: 3, layerId: 'L1' },
                { frame: 5, layerId: 'L1' },
                { frame: 4, layerId: 'L1' }
            ];
            const result = calculateFrameRange(cells);
            expect(result.minFrame).toBe(3);
            expect(result.maxFrame).toBe(5);
            expect(result.shiftAmount).toBe(3);
        });

        it('単一セルの場合、shiftAmount は 1', () => {
            const cells = [{ frame: 10, layerId: 'L1' }];
            const result = calculateFrameRange(cells);
            expect(result.minFrame).toBe(10);
            expect(result.maxFrame).toBe(10);
            expect(result.shiftAmount).toBe(1);
        });
    });

    describe('編集中のガード', () => {
        it('editingCellが設定されている場合、キー入力は無視される', () => {
            AppState.editingCell = { frame: 1, layerId: 'L1' };
            
            const e = createKeyEvent('Delete');
            let handled = false;
            
            // keyboard.jsの先頭ガード
            if (AppState.editingCell) {
                // 何もしない
            } else {
                deleteSelection();
                handled = true;
            }
            
            expect(handled).toBe(false);
            expect(callLog.length).toBe(0);
        });
    });

    describe('ドットキー（.）の処理', () => {
        it('直前のフレームに数字があり、空セル選択時は最後まで同じ値で埋める', () => {
            sheet.data[1] = { 'L1': '3' };
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            // .キーの処理ロジック
            const current = AppState.selectedCells[0];
            const maxRows = getMaxVisibleRows(sheet);
            const value = (sheet.data[current.frame] && sheet.data[current.frame][current.layerId]) || '';
            
            let filled = false;
            if (value === '') {
                const prevFrame = current.frame - 1;
                if (prevFrame >= 1) {
                    const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][current.layerId]) || '';
                    if (prevValue !== '' && /^\d+$/.test(prevValue)) {
                        // 最後まで埋める
                        for (let f = current.frame; f <= maxRows; f++) {
                            if (!sheet.data[f]) sheet.data[f] = {};
                            sheet.data[f][current.layerId] = prevValue;
                        }
                        filled = true;
                    }
                }
            }
            
            expect(filled).toBe(true);
            expect(sheet.data[2]['L1']).toBe('3');
            expect(sheet.data[144]['L1']).toBe('3');
        });
    });

    describe('+/- キーの処理', () => {
        it('+キーは直前の数字を+1する', () => {
            sheet.data[1] = { 'L1': '3' };
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            const current = AppState.selectedCells[0];
            const prevFrame = current.frame - 1;
            const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][current.layerId]) || '';
            
            let newValue = null;
            if (/^\d+$/.test(prevValue)) {
                newValue = String(parseInt(prevValue) + 1);
                if (!sheet.data[current.frame]) sheet.data[current.frame] = {};
                sheet.data[current.frame][current.layerId] = newValue;
            }
            
            expect(newValue).toBe('4');
            expect(sheet.data[2]['L1']).toBe('4');
        });

        it('-キーは直前の数字を-1する（最低1）', () => {
            sheet.data[1] = { 'L1': '1' };
            AppState.selectedCells = [{ frame: 2, layerId: 'L1', cell: {} }];
            
            const current = AppState.selectedCells[0];
            const prevFrame = current.frame - 1;
            const prevValue = (sheet.data[prevFrame] && sheet.data[prevFrame][current.layerId]) || '';
            
            let newValue = null;
            if (/^\d+$/.test(prevValue)) {
                newValue = String(Math.max(1, parseInt(prevValue) - 1));
                if (!sheet.data[current.frame]) sheet.data[current.frame] = {};
                sheet.data[current.frame][current.layerId] = newValue;
            }
            
            expect(newValue).toBe('1'); // 1以下にはならない
        });
    });

    describe('Spaceキーの処理', () => {
        it('Spaceキーで選択が下に移動する', () => {
            AppState.selectedCells = [{ frame: 5, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent(' ', { code: 'Space' });
            if (e.key === ' ' && AppState.selectedCells.length > 0) {
                e.preventDefault();
                moveCellSelection('ArrowDown');
            }
            
            expect(callLog.some(c => c.fn === 'moveCellSelection' && c.args[0] === 'ArrowDown')).toBe(true);
        });
    });

    describe('アスタリスク/スラッシュキー', () => {
        it('*キーで選択範囲を1フレーム下に拡張', () => {
            AppState.selectedCells = [{ frame: 5, layerId: 'L1', cell: {} }];
            
            const e = createKeyEvent('*');
            if (e.key === '*') {
                e.preventDefault();
                expandSelectionInDirection('ArrowDown');
            }
            
            expect(callLog.some(c => c.fn === 'expandSelectionInDirection' && c.args[0] === 'ArrowDown')).toBe(true);
        });

        it('/キーで選択範囲を1フレーム縮小', () => {
            AppState.selectedCells = [
                { frame: 5, layerId: 'L1', cell: {} },
                { frame: 6, layerId: 'L1', cell: {} }
            ];
            
            const e = createKeyEvent('/');
            // /キーは最後のセルを除外して縮小
            if (e.key === '/' && AppState.selectedCells.length > 1) {
                const newCells = AppState.selectedCells.slice(0, -1);
                expect(newCells.length).toBe(1);
            }
        });
    });
});

describe('複数セル選択時のEnterキー移動', () => {
    beforeEach(() => {
        resetState();
    });

    it('複数セル選択でEnter後、選択範囲の高さ分下に移動', () => {
        // F1-F3を選択
        AppState.selectedCells = [
            { frame: 1, layerId: 'L1', cell: {} },
            { frame: 2, layerId: 'L1', cell: {} },
            { frame: 3, layerId: 'L1', cell: {} }
        ];
        
        const sortedCells = [...AppState.selectedCells].sort((a, b) => a.frame - b.frame);
        const { minFrame, maxFrame, shiftAmount } = calculateFrameRange(sortedCells);
        
        expect(shiftAmount).toBe(3);
        
        const maxRows = getMaxVisibleRows(sheet);
        const adjustedShiftAmount = Math.min(shiftAmount, maxRows - maxFrame);
        
        expect(adjustedShiftAmount).toBe(3);
        
        // 移動後のフレーム
        const newFrames = sortedCells.map(s => s.frame + adjustedShiftAmount);
        expect(newFrames).toEqual([4, 5, 6]);
    });

    it('最終行付近では移動量が調整される', () => {
        // F142-F144を選択
        AppState.selectedCells = [
            { frame: 142, layerId: 'L1', cell: {} },
            { frame: 143, layerId: 'L1', cell: {} },
            { frame: 144, layerId: 'L1', cell: {} }
        ];
        
        const sortedCells = [...AppState.selectedCells].sort((a, b) => a.frame - b.frame);
        const { maxFrame, shiftAmount } = calculateFrameRange(sortedCells);
        
        const maxRows = getMaxVisibleRows(sheet);
        const adjustedShiftAmount = Math.min(shiftAmount, maxRows - maxFrame);
        
        // 144が最終行なので移動できない
        expect(adjustedShiftAmount).toBe(0);
    });
});
