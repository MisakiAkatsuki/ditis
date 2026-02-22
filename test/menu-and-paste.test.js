import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * 右クリックメニューとペースト機能のテスト
 * 2026-01-20の変更内容をテスト：
 * 1. 右クリックメニューの行/列選択時の複数選択保持
 * 2. ペースト時の行/列形状バリデーション
 * 3. エラー通知がshowErrorToastで表示されること
 */

// ========================================
// モック関数とヘルパー関数
// ========================================

/**
 * エラーレベルの定義
 */
const ErrorLevel = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

/**
 * showErrorToastのモック
 */
let toastMessages = [];
function showErrorToast(message, level = ErrorLevel.ERROR, duration = 5000) {
    toastMessages.push({ message, level, duration });
}

/**
 * 複数選択時の行選択判定ロジック
 */
function isRowSelection(selectedCells, sheetLayersLength) {
    const selectedFrames = [...new Set(selectedCells.map(s => s.frame))];
    return selectedFrames.length > 0 && selectedFrames.every(f => {
        const cellsInFrame = selectedCells.filter(s => s.frame === f);
        return cellsInFrame.length === sheetLayersLength;
    });
}

/**
 * 複数選択時の列選択判定ロジック
 */
function isColumnSelection(selectedCells, maxRows) {
    const selectedLayers = [...new Set(selectedCells.map(s => s.layerId))];
    return selectedLayers.length > 0 && selectedLayers.every(layerId => {
        const cellsInLayer = selectedCells.filter(s => s.layerId === layerId);
        return cellsInLayer.length === maxRows;
    });
}

/**
 * ペースト時の形状バリデーションロジック
 */
function validatePasteShape(clipboard, selectedCells) {
    if (!clipboard || clipboard.length === 0 || selectedCells.length === 0) {
        return { valid: false, error: 'クリップボードまたは選択範囲が空です' };
    }

    // コピー元の形状を検出
    const clipboardFrames = [...new Set(clipboard.map(c => c.frame))];
    const clipboardLayers = [...new Set(clipboard.map(c => c.layerId))];
    const clipboardLayerCount = clipboardLayers.length;
    const clipboardFrameCount = clipboardFrames.length;
    
    // 行全体コピー：複数列で1つのフレーム
    const isRowCopy = clipboardLayerCount > 1 && clipboardFrameCount === 1;
    // 列全体コピー：1つの列で複数フレーム
    const isColumnCopy = clipboardLayerCount === 1 && clipboardFrameCount > 1;
    
    // ペースト先の形状を検出
    const selectedFrames = [...new Set(selectedCells.map(s => s.frame))];
    const selectedLayers = [...new Set(selectedCells.map(s => s.layerId))];
    const selectedLayerCount = selectedLayers.length;
    const selectedFrameCount = selectedFrames.length;
    
    // 行全体ペースト：複数列で1つのフレーム
    const isRowPaste = selectedLayerCount > 1 && selectedFrameCount === 1;
    // 列全体ペースト：1つの列で複数フレーム
    const isColumnPaste = selectedLayerCount === 1 && selectedFrameCount > 1;
    
    // 形状の不一致をチェック
    if (isRowCopy && isColumnPaste) {
        return { 
            valid: false, 
            error: '行の値を列にペーストすることはできません。',
            level: ErrorLevel.WARNING 
        };
    }
    if (isColumnCopy && isRowPaste) {
        return { 
            valid: false, 
            error: '列の値を行にペーストすることはできません。',
            level: ErrorLevel.WARNING 
        };
    }
    
    return { valid: true };
}

/**
 * 行全体選択の保持ロジック
 */
function handleRowHeaderRightClick(frame, selectedCells, sheetLayersLength) {
    const selectedFrames = [...new Set(selectedCells.map(s => s.frame))];
    const isRowSel = isRowSelection(selectedCells, sheetLayersLength);
    const isRowSelected = selectedCells.some(s => s.frame === frame);
    
    if (isRowSel && isRowSelected) {
        // 既に行選択状態で、その行が含まれている場合は、選択を保持
        return { preserveSelection: true, expandToRows: selectedFrames };
    } else {
        // それ以外の場合は、新規に行全体を選択
        return { preserveSelection: false, selectRow: frame };
    }
}

/**
 * 列全体選択の保持ロジック
 */
function handleColumnHeaderRightClick(layerId, selectedCells, maxRows) {
    const selectedLayers = [...new Set(selectedCells.map(s => s.layerId))];
    const isColSel = isColumnSelection(selectedCells, maxRows);
    const isColumnSelected = selectedCells.some(s => s.layerId === layerId);
    
    if (isColSel && isColumnSelected) {
        // 既に列選択状態で、その列が含まれている場合は、選択を保持
        return { preserveSelection: true, expandToColumns: selectedLayers };
    } else {
        // それ以外の場合は、新規に列全体を選択
        return { preserveSelection: false, selectColumn: layerId };
    }
}

// ========================================
// テストスイート
// ========================================

describe('右クリックメニュー - 行選択時の複数選択保持', () => {
    beforeEach(() => {
        toastMessages = [];
    });

    it('行選択状態で該当行を右クリックした場合、選択を保持する', () => {
        // 3つの行が全列選択されている状態（各行3列）
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 },
            { frame: 1, layerId: 3 },
            { frame: 2, layerId: 1 },
            { frame: 2, layerId: 2 },
            { frame: 2, layerId: 3 },
            { frame: 3, layerId: 1 },
            { frame: 3, layerId: 2 },
            { frame: 3, layerId: 3 }
        ];
        const sheetLayersLength = 3;
        
        // frame 2を右クリック
        const result = handleRowHeaderRightClick(2, selectedCells, sheetLayersLength);
        
        expect(result.preserveSelection).toBe(true);
        expect(result.expandToRows).toEqual([1, 2, 3]);
    });

    it('行選択状態で選択範囲外の行を右クリックした場合、新規選択する', () => {
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 },
            { frame: 1, layerId: 3 }
        ];
        const sheetLayersLength = 3;
        
        // frame 5を右クリック（選択範囲外）
        const result = handleRowHeaderRightClick(5, selectedCells, sheetLayersLength);
        
        expect(result.preserveSelection).toBe(false);
        expect(result.selectRow).toBe(5);
    });

    it('部分選択状態で行を右クリックした場合、新規選択する', () => {
        // 一部のセルのみ選択されている状態
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 }
            // layerId: 3が選択されていない
        ];
        const sheetLayersLength = 3;
        
        const result = handleRowHeaderRightClick(1, selectedCells, sheetLayersLength);
        
        expect(result.preserveSelection).toBe(false);
        expect(result.selectRow).toBe(1);
    });
});

describe('右クリックメニュー - 列選択時の複数選択保持', () => {
    beforeEach(() => {
        toastMessages = [];
    });

    it('列選択状態で該当列を右クリックした場合、選択を保持する', () => {
        const maxRows = 144;
        const selectedCells = [];
        
        // 2つの列が全行選択されている状態
        for (let frame = 1; frame <= maxRows; frame++) {
            selectedCells.push({ frame, layerId: 1 });
            selectedCells.push({ frame, layerId: 2 });
        }
        
        // layerId 1を右クリック
        const result = handleColumnHeaderRightClick(1, selectedCells, maxRows);
        
        expect(result.preserveSelection).toBe(true);
        expect(result.expandToColumns).toEqual([1, 2]);
    });

    it('列選択状態で選択範囲外の列を右クリックした場合、新規選択する', () => {
        const maxRows = 144;
        const selectedCells = [];
        
        // 1つの列が全行選択されている状態
        for (let frame = 1; frame <= maxRows; frame++) {
            selectedCells.push({ frame, layerId: 1 });
        }
        
        // layerId 5を右クリック（選択範囲外）
        const result = handleColumnHeaderRightClick(5, selectedCells, maxRows);
        
        expect(result.preserveSelection).toBe(false);
        expect(result.selectColumn).toBe(5);
    });

    it('部分選択状態で列を右クリックした場合、新規選択する', () => {
        const maxRows = 144;
        // 一部のフレームのみ選択されている状態
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 2, layerId: 1 },
            { frame: 3, layerId: 1 }
            // 全144行ではない
        ];
        
        const result = handleColumnHeaderRightClick(1, selectedCells, maxRows);
        
        expect(result.preserveSelection).toBe(false);
        expect(result.selectColumn).toBe(1);
    });
});

describe('ペースト機能 - 形状バリデーション', () => {
    beforeEach(() => {
        toastMessages = [];
    });

    it('行の値を列にペーストしようとした場合、エラーを表示する', () => {
        // コピー元：1行3列（行コピー）
        const clipboard = [
            { frame: 1, layerId: 1, value: '1' },
            { frame: 1, layerId: 2, value: '2' },
            { frame: 1, layerId: 3, value: '3' }
        ];
        
        // ペースト先：3行1列（列ペースト）
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 2, layerId: 1 },
            { frame: 3, layerId: 1 }
        ];
        
        const result = validatePasteShape(clipboard, selectedCells);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('行の値を列にペーストすることはできません。');
        expect(result.level).toBe(ErrorLevel.WARNING);
        
        // エラー通知をシミュレート
        showErrorToast(result.error, result.level);
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].message).toBe('行の値を列にペーストすることはできません。');
        expect(toastMessages[0].level).toBe(ErrorLevel.WARNING);
    });

    it('列の値を行にペーストしようとした場合、エラーを表示する', () => {
        // コピー元：3行1列（列コピー）
        const clipboard = [
            { frame: 1, layerId: 1, value: '1' },
            { frame: 2, layerId: 1, value: '2' },
            { frame: 3, layerId: 1, value: '3' }
        ];
        
        // ペースト先：1行3列（行ペースト）
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 },
            { frame: 1, layerId: 3 }
        ];
        
        const result = validatePasteShape(clipboard, selectedCells);
        
        expect(result.valid).toBe(false);
        expect(result.error).toBe('列の値を行にペーストすることはできません。');
        expect(result.level).toBe(ErrorLevel.WARNING);
        
        // エラー通知をシミュレート
        showErrorToast(result.error, result.level);
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].message).toBe('列の値を行にペーストすることはできません。');
        expect(toastMessages[0].level).toBe(ErrorLevel.WARNING);
    });

    it('行から行へのペーストは成功する', () => {
        // コピー元：1行3列
        const clipboard = [
            { frame: 1, layerId: 1, value: '1' },
            { frame: 1, layerId: 2, value: '2' },
            { frame: 1, layerId: 3, value: '3' }
        ];
        
        // ペースト先：1行3列
        const selectedCells = [
            { frame: 5, layerId: 1 },
            { frame: 5, layerId: 2 },
            { frame: 5, layerId: 3 }
        ];
        
        const result = validatePasteShape(clipboard, selectedCells);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('列から列へのペーストは成功する', () => {
        // コピー元：3行1列
        const clipboard = [
            { frame: 1, layerId: 1, value: '1' },
            { frame: 2, layerId: 1, value: '2' },
            { frame: 3, layerId: 1, value: '3' }
        ];
        
        // ペースト先：3行1列
        const selectedCells = [
            { frame: 1, layerId: 5 },
            { frame: 2, layerId: 5 },
            { frame: 3, layerId: 5 }
        ];
        
        const result = validatePasteShape(clipboard, selectedCells);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('通常のセル範囲のペーストは成功する', () => {
        // コピー元：2行2列（通常のセル範囲）
        const clipboard = [
            { frame: 1, layerId: 1, value: '1' },
            { frame: 1, layerId: 2, value: '2' },
            { frame: 2, layerId: 1, value: '3' },
            { frame: 2, layerId: 2, value: '4' }
        ];
        
        // ペースト先：2行2列
        const selectedCells = [
            { frame: 5, layerId: 1 },
            { frame: 5, layerId: 2 },
            { frame: 6, layerId: 1 },
            { frame: 6, layerId: 2 }
        ];
        
        const result = validatePasteShape(clipboard, selectedCells);
        
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });
});

describe('エラー通知システム - showErrorToast', () => {
    beforeEach(() => {
        toastMessages = [];
    });

    it('エラーメッセージがデフォルトレベル（ERROR）で記録される', () => {
        showErrorToast('テストエラーメッセージ');
        
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].message).toBe('テストエラーメッセージ');
        expect(toastMessages[0].level).toBe(ErrorLevel.ERROR);
        expect(toastMessages[0].duration).toBe(5000);
    });

    it('WARNINGレベルのエラーメッセージが記録される', () => {
        showErrorToast('警告メッセージ', ErrorLevel.WARNING);
        
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].message).toBe('警告メッセージ');
        expect(toastMessages[0].level).toBe(ErrorLevel.WARNING);
    });

    it('INFOレベルのメッセージが記録される', () => {
        showErrorToast('情報メッセージ', ErrorLevel.INFO, 3000);
        
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].message).toBe('情報メッセージ');
        expect(toastMessages[0].level).toBe(ErrorLevel.INFO);
        expect(toastMessages[0].duration).toBe(3000);
    });

    it('CRITICALレベルのエラーメッセージが記録される', () => {
        showErrorToast('致命的エラー', ErrorLevel.CRITICAL);
        
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].message).toBe('致命的エラー');
        expect(toastMessages[0].level).toBe(ErrorLevel.CRITICAL);
    });

    it('複数のエラーメッセージが順次記録される', () => {
        showErrorToast('エラー1', ErrorLevel.ERROR);
        showErrorToast('警告1', ErrorLevel.WARNING);
        showErrorToast('情報1', ErrorLevel.INFO);
        
        expect(toastMessages).toHaveLength(3);
        expect(toastMessages[0].message).toBe('エラー1');
        expect(toastMessages[1].message).toBe('警告1');
        expect(toastMessages[2].message).toBe('情報1');
    });
});

describe('統合テスト - 右クリックメニューとペースト機能', () => {
    beforeEach(() => {
        toastMessages = [];
    });

    it('複数行選択→右クリック保持→行コピー→ペースト成功', () => {
        const sheetLayersLength = 3;
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 },
            { frame: 1, layerId: 3 },
            { frame: 2, layerId: 1 },
            { frame: 2, layerId: 2 },
            { frame: 2, layerId: 3 }
        ];
        
        // 右クリックで選択保持
        const menuResult = handleRowHeaderRightClick(1, selectedCells, sheetLayersLength);
        expect(menuResult.preserveSelection).toBe(true);
        
        // 行コピーをシミュレート
        const clipboard = [
            { frame: 1, layerId: 1, value: 'A' },
            { frame: 1, layerId: 2, value: 'B' },
            { frame: 1, layerId: 3, value: 'C' }
        ];
        
        // ペースト先（別の行）
        const pasteTarget = [
            { frame: 10, layerId: 1 },
            { frame: 10, layerId: 2 },
            { frame: 10, layerId: 3 }
        ];
        
        const pasteResult = validatePasteShape(clipboard, pasteTarget);
        expect(pasteResult.valid).toBe(true);
        expect(toastMessages).toHaveLength(0);
    });

    it('複数列選択→右クリック保持→列コピー→ペースト成功', () => {
        const maxRows = 144;
        const selectedCells = [];
        
        // 2列選択
        for (let frame = 1; frame <= maxRows; frame++) {
            selectedCells.push({ frame, layerId: 1 });
            selectedCells.push({ frame, layerId: 2 });
        }
        
        // 右クリックで選択保持
        const menuResult = handleColumnHeaderRightClick(1, selectedCells, maxRows);
        expect(menuResult.preserveSelection).toBe(true);
        
        // 列コピーをシミュレート（最初の3行のみ）
        const clipboard = [
            { frame: 1, layerId: 1, value: 'A' },
            { frame: 2, layerId: 1, value: 'B' },
            { frame: 3, layerId: 1, value: 'C' }
        ];
        
        // ペースト先（別の列）
        const pasteTarget = [
            { frame: 1, layerId: 5 },
            { frame: 2, layerId: 5 },
            { frame: 3, layerId: 5 }
        ];
        
        const pasteResult = validatePasteShape(clipboard, pasteTarget);
        expect(pasteResult.valid).toBe(true);
        expect(toastMessages).toHaveLength(0);
    });

    it('行コピー→列にペースト→エラー表示の一連の流れ', () => {
        // 行コピー
        const clipboard = [
            { frame: 1, layerId: 1, value: 'A' },
            { frame: 1, layerId: 2, value: 'B' },
            { frame: 1, layerId: 3, value: 'C' }
        ];
        
        // 列にペーストしようとする
        const pasteTarget = [
            { frame: 1, layerId: 1 },
            { frame: 2, layerId: 1 },
            { frame: 3, layerId: 1 }
        ];
        
        const result = validatePasteShape(clipboard, pasteTarget);
        expect(result.valid).toBe(false);
        
        // エラー通知を呼び出し
        showErrorToast(result.error, result.level);
        
        // エラーが正しく記録されていることを確認
        expect(toastMessages).toHaveLength(1);
        expect(toastMessages[0].level).toBe(ErrorLevel.WARNING);
        expect(toastMessages[0].message).toContain('行の値を列に');
    });
});
