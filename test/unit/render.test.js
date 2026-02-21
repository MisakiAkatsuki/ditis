import { describe, it, expect, beforeEach, vi } from 'vitest';

// グローバルオブジェクトのセットアップ
let AppState = {
    specialDisplayCache: new Map(),
    viewport: {
        startRow: 1,
        endRow: 30,
        startCol: 1,
        endCol: 26,
        rowBuffer: 5,
        colBuffer: 2
    },
    fps: 24
};

let CONSTANTS = {
    CELL_HEIGHT: 28,
    CELL_WIDTH: 40
};

let debugLog = vi.fn();

// calculateSpecialDisplayCache関数
function calculateSpecialDisplayCache(sheet) {
    const cache = new Map();
    const maxRows = sheet.visibleRows || 288;
    
    sheet.layers.forEach(layer => {
        const layerId = layer.id;
        const layerCache = {
            firstNumberFrame: -1,
            verticalLineRanges: []
        };
        
        // 最初に数字が出現するフレームを探す
        for (let f = 1; f <= maxRows; f++) {
            const value = (sheet.data[f] && sheet.data[f][layerId]) || '';
            if (value !== '' && value !== '-') {
                layerCache.firstNumberFrame = f;
                break;
            }
        }
        
        // 縦線範囲を計算（"-"が最後まで続く範囲）
        for (let f = 1; f <= maxRows; f++) {
            const value = (sheet.data[f] && sheet.data[f][layerId]) || '';
            
            if (value === '-') {
                // 直前に数字があるかチェック
                const prevValue = f > 1 ? ((sheet.data[f-1] && sheet.data[f-1][layerId]) || '') : '';
                const hasPrevNumber = prevValue !== '' && prevValue !== '-';
                
                if (hasPrevNumber) {
                    // この位置から最後まで"-"が続くかチェック
                    let continueToEnd = true;
                    for (let checkF = f; checkF <= maxRows; checkF++) {
                        const checkValue = (sheet.data[checkF] && sheet.data[checkF][layerId]) || '';
                        if (checkValue !== '-') {
                            continueToEnd = false;
                            break;
                        }
                    }
                    
                    if (continueToEnd) {
                        layerCache.verticalLineRanges.push({
                            start: f,
                            end: maxRows
                        });
                    }
                }
            }
        }
        
        cache.set(layerId, layerCache);
    });
    
    AppState.specialDisplayCache = cache;
    debugLog('表示', '特殊表示キャッシュ更新', {
        layers: sheet.layers.length,
        cacheSize: cache.size
    });
}

// getSpecialDisplayInfo関数
function getSpecialDisplayInfo(layerId, frame) {
    const cache = AppState.specialDisplayCache.get(layerId);
    if (!cache) {
        return {isCrossMark: false, isWaveLine: false, isVerticalLine: false};
    }
    
    const result = {
        isCrossMark: false,
        isWaveLine: false,
        isVerticalLine: false
    };
    
    // ×印判定
    if (cache.firstNumberFrame > 1 && frame === 1) {
        result.isCrossMark = true;
    }
    
    // 波線判定
    if (cache.firstNumberFrame > 1 && frame > 1 && frame < cache.firstNumberFrame) {
        result.isWaveLine = true;
    }
    
    // 縦線判定
    for (const range of cache.verticalLineRanges) {
        if (frame >= range.start && frame <= range.end) {
            result.isVerticalLine = true;
            break;
        }
    }
    
    return result;
}

// calculateViewport関数
function calculateViewport() {
    const rowHeight = CONSTANTS.CELL_HEIGHT;
    const colWidth = CONSTANTS.CELL_WIDTH;
    const buffer = AppState.viewport.rowBuffer;
    const colBuffer = AppState.viewport.colBuffer;
    
    // モックとして固定値を使用
    const scrollTop = AppState.viewport.scrollTop || 0;
    const scrollLeft = AppState.viewport.scrollLeft || 0;
    const viewportHeight = AppState.viewport.height || 600;
    const viewportWidth = AppState.viewport.width || 800;
    
    // 表示範囲の開始・終了行を計算
    const startRow = Math.max(1, Math.floor(scrollTop / rowHeight) - buffer);
    const endRow = Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer;
    
    // 表示範囲の開始・終了列を計算
    const startCol = Math.max(1, Math.floor(scrollLeft / colWidth) - colBuffer);
    const endCol = Math.ceil((scrollLeft + viewportWidth) / colWidth) + colBuffer;
    
    AppState.viewport.startRow = startRow;
    AppState.viewport.endRow = endRow;
    AppState.viewport.startCol = startCol;
    AppState.viewport.endCol = Math.min(endCol, 26); // 最大26列
    
    debugLog('表示', '表示範囲計算', {
        rows: `${startRow}-${endRow}`,
        cols: `${startCol}-${endCol}`
    });
}

describe('calculateSpecialDisplayCache()', () => {
    beforeEach(() => {
        AppState.specialDisplayCache = new Map();
    });

    it('空データのキャッシュを計算', () => {
        const sheet = {
            visibleRows: 100,
            layers: [
                { id: 1, name: 'Layer A' },
                { id: 2, name: 'Layer B' }
            ],
            data: {}
        };

        calculateSpecialDisplayCache(sheet);

        expect(AppState.specialDisplayCache.size).toBe(2);
        expect(AppState.specialDisplayCache.get(1)).toEqual({
            firstNumberFrame: -1,
            verticalLineRanges: []
        });
    });

    it('縦線がある場合のキャッシュを計算', () => {
        const sheet = {
            visibleRows: 5,
            layers: [{ id: 1, name: 'Layer A' }],
            data: {
                1: { 1: '5' },
                2: { 1: '-' },
                3: { 1: '-' },
                4: { 1: '-' },
                5: { 1: '-' }
            }
        };

        calculateSpecialDisplayCache(sheet);

        const cache = AppState.specialDisplayCache.get(1);
        expect(cache.firstNumberFrame).toBe(1);
        expect(cache.verticalLineRanges.length).toBeGreaterThan(0);
        expect(cache.verticalLineRanges[0]).toEqual({
            start: 2,
            end: 5
        });
    });

    it('波線がある場合のキャッシュを計算', () => {
        const sheet = {
            visibleRows: 100,
            layers: [{ id: 1, name: 'Layer A' }],
            data: {
                1: { 1: '' },
                2: { 1: '' },
                3: { 1: '5' }
            }
        };

        calculateSpecialDisplayCache(sheet);

        const cache = AppState.specialDisplayCache.get(1);
        expect(cache.firstNumberFrame).toBe(3);
    });
});

describe('getSpecialDisplayInfo()', () => {
    beforeEach(() => {
        AppState.specialDisplayCache = new Map();
    });

    it('キャッシュヒットの場合は正しい情報を返す', () => {
        const cacheData = {
            firstNumberFrame: 5,
            verticalLineRanges: [
                { start: 6, end: 10 }
            ]
        };
        AppState.specialDisplayCache.set(1, cacheData);

        // ×印判定（frame=1で、firstNumberFrame>1）
        const result1 = getSpecialDisplayInfo(1, 1);
        expect(result1.isCrossMark).toBe(true);
        expect(result1.isWaveLine).toBe(false);
        expect(result1.isVerticalLine).toBe(false);

        // 波線判定（1 < frame < firstNumberFrame）
        const result2 = getSpecialDisplayInfo(1, 2);
        expect(result2.isCrossMark).toBe(false);
        expect(result2.isWaveLine).toBe(true);
        expect(result2.isVerticalLine).toBe(false);

        // 縦線判定（verticalLineRangesに含まれる）
        const result3 = getSpecialDisplayInfo(1, 8);
        expect(result3.isCrossMark).toBe(false);
        expect(result3.isWaveLine).toBe(false);
        expect(result3.isVerticalLine).toBe(true);
    });

    it('キャッシュミスの場合はデフォルト値を返す', () => {
        const result = getSpecialDisplayInfo(999, 1);
        expect(result).toEqual({
            isCrossMark: false,
            isWaveLine: false,
            isVerticalLine: false
        });
    });
});

describe('calculateViewport()', () => {
    beforeEach(() => {
        AppState.viewport = {
            startRow: 1,
            endRow: 30,
            startCol: 1,
            endCol: 26,
            rowBuffer: 5,
            colBuffer: 2,
            scrollTop: 0,
            scrollLeft: 0,
            height: 600,
            width: 800
        };
    });

    it('スクロール位置0で表示範囲を計算', () => {
        AppState.viewport.scrollTop = 0;
        AppState.viewport.scrollLeft = 0;

        calculateViewport();

        expect(AppState.viewport.startRow).toBeGreaterThanOrEqual(1);
        expect(AppState.viewport.endRow).toBeGreaterThan(AppState.viewport.startRow);
        expect(AppState.viewport.startCol).toBeGreaterThanOrEqual(1);
        expect(AppState.viewport.endCol).toBeLessThanOrEqual(26);
    });

    it('スクロール位置が変わると表示範囲が更新される', () => {
        AppState.viewport.scrollTop = 280; // 10行分スクロール（28px × 10）

        calculateViewport();

        const viewportAfterScroll = AppState.viewport.startRow;
        expect(viewportAfterScroll).toBeGreaterThan(1);
    });

    it('最大値を超えないスクロール計算', () => {
        AppState.viewport.scrollTop = 5600; // 大きなスクロール値

        calculateViewport();

        expect(AppState.viewport.endCol).toBeLessThanOrEqual(26);
    });
});
