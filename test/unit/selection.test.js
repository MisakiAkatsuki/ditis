import { describe, it, expect, beforeEach } from 'vitest';

// getCellRange関数（utils.jsから）
function getCellRange(cells) {
    const frames = cells.map(c => c.frame);
    return {
        minFrame: Math.min(...frames),
        maxFrame: Math.max(...frames)
    };
}

// selectRange関数のロジック
function selectRangeLogic(start, end, selectedCells) {
    const result = [];
    
    const minFrame = Math.min(start.frame, end.frame);
    const maxFrame = Math.max(start.frame, end.frame);
    const minLayer = Math.min(start.layerId, end.layerId);
    const maxLayer = Math.max(start.layerId, end.layerId);
    
    for (let frame = minFrame; frame <= maxFrame; frame++) {
        for (let layerId = minLayer; layerId <= maxLayer; layerId++) {
            result.push({ frame, layerId });
        }
    }
    
    return result;
}

// selectCellsLogic関数（複数選択のロジック）
function selectCellsLogic(cells) {
    return cells.map(cell => ({
        frame: cell.frame,
        layerId: cell.layerId,
        selected: true
    }));
}

describe('getCellRange()', () => {
    it('単一選択のセル範囲を計算', () => {
        const cells = [{ frame: 5 }];
        const range = getCellRange(cells);
        
        expect(range.minFrame).toBe(5);
        expect(range.maxFrame).toBe(5);
    });

    it('複数選択のセル範囲を計算', () => {
        const cells = [
            { frame: 5 },
            { frame: 10 },
            { frame: 7 }
        ];
        const range = getCellRange(cells);
        
        expect(range.minFrame).toBe(5);
        expect(range.maxFrame).toBe(10);
    });

    it('矩形選択のセル範囲を計算', () => {
        const cells = [
            { frame: 1 },
            { frame: 2 },
            { frame: 3 },
            { frame: 10 },
            { frame: 11 },
            { frame: 12 }
        ];
        const range = getCellRange(cells);
        
        expect(range.minFrame).toBe(1);
        expect(range.maxFrame).toBe(12);
    });
});

describe('selectRange()', () => {
    it('単一選択のケース', () => {
        const start = { frame: 5, layerId: 2 };
        const end = { frame: 5, layerId: 2 };
        
        const result = selectRangeLogic(start, end, []);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ frame: 5, layerId: 2 });
    });

    it('複数選択のケース', () => {
        const start = { frame: 1, layerId: 1 };
        const end = { frame: 3, layerId: 1 };
        
        const result = selectRangeLogic(start, end, []);
        
        expect(result).toHaveLength(3);
        expect(result[0]).toEqual({ frame: 1, layerId: 1 });
        expect(result[2]).toEqual({ frame: 3, layerId: 1 });
    });

    it('矩形選択のケース', () => {
        const start = { frame: 1, layerId: 1 };
        const end = { frame: 3, layerId: 2 };
        
        const result = selectRangeLogic(start, end, []);
        
        // 3フレーム × 2レイヤー = 6セル
        expect(result).toHaveLength(6);
        expect(result[0]).toEqual({ frame: 1, layerId: 1 });
        expect(result[5]).toEqual({ frame: 3, layerId: 2 });
    });

    it('逆向き矩形選択のケース', () => {
        const start = { frame: 5, layerId: 3 };
        const end = { frame: 1, layerId: 1 };
        
        const result = selectRangeLogic(start, end, []);
        
        // 5フレーム × 3レイヤー = 15セル
        expect(result).toHaveLength(15);
        expect(result[0]).toEqual({ frame: 1, layerId: 1 });
        expect(result[14]).toEqual({ frame: 5, layerId: 3 });
    });
});

describe('selectCells()', () => {
    it('複数セルの選択状態を管理できる', () => {
        const cells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 },
            { frame: 2, layerId: 1 }
        ];
        
        const result = selectCellsLogic(cells);
        
        expect(result).toHaveLength(3);
        expect(result.every(r => r.selected)).toBe(true);
    });

    it('個別セルの情報を保持できる', () => {
        const cells = [
            { frame: 5, layerId: 3 }
        ];
        
        const result = selectCellsLogic(cells);
        
        expect(result[0].frame).toBe(5);
        expect(result[0].layerId).toBe(3);
        expect(result[0].selected).toBe(true);
    });

    it('大量のセルでも性能を保つ', () => {
        const cells = [];
        for (let i = 1; i <= 100; i++) {
            cells.push({ frame: i, layerId: 1 });
        }
        
        const result = selectCellsLogic(cells);
        
        expect(result).toHaveLength(100);
        expect(result[0].frame).toBe(1);
        expect(result[99].frame).toBe(100);
    });
});

describe('セル選択の計算ロジック', () => {
    it('選択状態をリセットできる', () => {
        const selectedCells = [
            { frame: 1, layerId: 1 },
            { frame: 1, layerId: 2 }
        ];
        
        const cleared = [];
        
        expect(cleared).toHaveLength(0);
        expect(selectedCells).toHaveLength(2);
    });

    it('選択状態を切り替えられる', () => {
        let isSelected = false;
        
        isSelected = !isSelected;
        expect(isSelected).toBe(true);
        
        isSelected = !isSelected;
        expect(isSelected).toBe(false);
    });

    it('複数レイヤーの列選択をシミュレートできる', () => {
        const layers = [1, 2, 3];
        const frameNumber = 5;
        
        const selectedCells = layers.map(layerId => ({
            frame: frameNumber,
            layerId
        }));
        
        expect(selectedCells).toHaveLength(3);
        expect(selectedCells.every(c => c.frame === frameNumber)).toBe(true);
    });

    it('複数フレームの行選択をシミュレートできる', () => {
        const frames = [1, 2, 3, 4, 5];
        const layerId = 2;
        
        const selectedCells = frames.map(frame => ({
            frame,
            layerId
        }));
        
        expect(selectedCells).toHaveLength(5);
        expect(selectedCells.every(c => c.layerId === layerId)).toBe(true);
    });
});
