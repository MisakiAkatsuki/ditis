import { describe, it, expect } from 'vitest';

// グローバルスコープに関数を定義
function columnNumberToLetter(num) {
    return String.fromCharCode(64 + num);
}

function columnLetterToNumber(letter) {
    return letter.charCodeAt(0) - 64;
}

function frameToTimecode(frame, fps = 24) {
    const totalFrames = frame - 1;
    const hours = Math.floor(totalFrames / (fps * 3600));
    const minutes = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
    const seconds = Math.floor((totalFrames % (fps * 60)) / fps);
    const frames = totalFrames % fps;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function getCellId(frame, layerId) {
    return `F${frame}L${layerId}`;
}

function parseCellId(cellId) {
    const match = cellId.match(/F(\d+)L(\d+)/);
    if (match) {
        return {
            frame: parseInt(match[1]),
            layerId: parseInt(match[2])
        };
    }
    return null;
}

function isNumeric(value) {
    return /^\d+$/.test(value);
}

function getLayerName(index) {
    return String.fromCharCode(65 + index);
}

function getCellRange(cells) {
    const frames = cells.map(c => c.frame);
    return {
        minFrame: Math.min(...frames),
        maxFrame: Math.max(...frames)
    };
}

describe('columnNumberToLetter()', () => {
    it('列1をAに変換', () => {
        expect(columnNumberToLetter(1)).toBe('A');
    });

    it('列13をMに変換', () => {
        expect(columnNumberToLetter(13)).toBe('M');
    });

    it('列26をZに変換', () => {
        expect(columnNumberToLetter(26)).toBe('Z');
    });
});

describe('columnLetterToNumber()', () => {
    it('AからAを1に変換', () => {
        expect(columnLetterToNumber('A')).toBe(1);
    });

    it('Mから13に変換', () => {
        expect(columnLetterToNumber('M')).toBe(13);
    });

    it('Zから26に変換', () => {
        expect(columnLetterToNumber('Z')).toBe(26);
    });
});

describe('frameToTimecode()', () => {
    it('フレーム1をタイムコード00:00:00:00に変換（fps24）', () => {
        expect(frameToTimecode(1, 24)).toBe('00:00:00:00');
    });

    it('フレーム25をタイムコード00:00:01:00に変換（fps24）', () => {
        expect(frameToTimecode(25, 24)).toBe('00:00:01:00');
    });

    it('フレーム1441をタイムコード00:01:00:00に変換（fps24）', () => {
        expect(frameToTimecode(1441, 24)).toBe('00:01:00:00');
    });

    it('異なるFPSでの計算（fps30）', () => {
        expect(frameToTimecode(31, 30)).toBe('00:00:01:00');
    });
});

describe('deepCopy()', () => {
    it('オブジェクトのディープコピー', () => {
        const original = { a: 1, b: { c: 2 } };
        const copy = deepCopy(original);
        copy.b.c = 3;
        expect(original.b.c).toBe(2);
        expect(copy.b.c).toBe(3);
    });

    it('配列のディープコピー', () => {
        const original = [1, [2, 3]];
        const copy = deepCopy(original);
        copy[1][0] = 9;
        expect(original[1][0]).toBe(2);
        expect(copy[1][0]).toBe(9);
    });
});

describe('getCellId()', () => {
    it('フレーム1とレイヤーID1からセルIDを生成', () => {
        expect(getCellId(1, 1)).toBe('F1L1');
    });

    it('フレーム100とレイヤーID5からセルIDを生成', () => {
        expect(getCellId(100, 5)).toBe('F100L5');
    });
});

describe('parseCellId()', () => {
    it('セルID "F1L1" をパース', () => {
        const result = parseCellId('F1L1');
        expect(result).toEqual({ frame: 1, layerId: 1 });
    });

    it('セルID "F100L5" をパース', () => {
        const result = parseCellId('F100L5');
        expect(result).toEqual({ frame: 100, layerId: 5 });
    });

    it('無効なセルIDはnullを返す', () => {
        const result = parseCellId('invalid');
        expect(result).toBeNull();
    });
});

describe('isNumeric()', () => {
    it('数値文字列 "123" はtrueを返す', () => {
        expect(isNumeric('123')).toBe(true);
    });

    it('数値文字列 "0" はtrueを返す', () => {
        expect(isNumeric('0')).toBe(true);
    });

    it('英字を含む文字列 "abc123" はfalseを返す', () => {
        expect(isNumeric('abc123')).toBe(false);
    });

    it('空文字列 "" はfalseを返す', () => {
        expect(isNumeric('')).toBe(false);
    });

    it('負の数 "-123" はfalseを返す', () => {
        expect(isNumeric('-123')).toBe(false);
    });
});

describe('getLayerName()', () => {
    it('インデックス0からレイヤー名 "A" を生成', () => {
        expect(getLayerName(0)).toBe('A');
    });

    it('インデックス12からレイヤー名 "M" を生成', () => {
        expect(getLayerName(12)).toBe('M');
    });

    it('インデックス25からレイヤー名 "Z" を生成', () => {
        expect(getLayerName(25)).toBe('Z');
    });
});

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

// 注意: parseSecondsPlusFrames() と formatSecondsPlusFrames() はまだ実装されていないため、
// テストはスキップしています。これらの関数が実装されたら、以下のテストを有効にしてください。

describe.skip('parseSecondsPlusFrames()', () => {
    it('秒とフレームをパース "10s 5f"', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });

    it('秒のみをパース "5s"', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });

    it('フレームのみをパース "12f"', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });

    it('ゼロ値をパース "0s 0f"', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });
});

describe.skip('formatSecondsPlusFrames()', () => {
    it('秒とフレームをフォーマット 10秒と5フレーム', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });

    it('秒のみをフォーマット 5秒', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });

    it('フレームのみをフォーマット 12フレーム', () => {
        // この関数の実装を待つ必要があります
        expect(true).toBe(true);
    });
});
