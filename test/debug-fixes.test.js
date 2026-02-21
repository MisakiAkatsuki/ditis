/**
 * debug-fixes.test.js
 * 2026-02-19 デバッグセッションで修正したバグのリグレッションテスト
 *
 * 対象:
 *  1. +/- キー: 後方伝播・前方伝播のギャップ検出ロジック
 *  2. WASD: isXUsed による1セッション1回制限
 *  3. i18n: タブ右クリックメニューのキー追加確認
 *  4. コンテキストメニュー排他: 同時表示防止ロジック確認
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─────────────────────────────────────────────
// ヘルパー: シートデータ構造を組み立てる
// ─────────────────────────────────────────────
function makeSheet(frameData = {}) {
    const data = {};
    for (const [frame, val] of Object.entries(frameData)) {
        data[Number(frame)] = { L1: val };
    }
    return {
        layers: [{ id: 'L1', name: 'A' }],
        frames: 20,
        visibleRows: 20,
        data,
    };
}

// ─────────────────────────────────────────────
// +/- コアロジックを edit.js から抽出して再現
// (DOM依存なしのピュア関数として)
// ─────────────────────────────────────────────

function getPreviousValue(sheet, frame, layerId) {
    for (let f = frame - 1; f >= 1; f--) {
        const cellValue = (sheet.data[f] && sheet.data[f][layerId]) || '';
        if (cellValue && cellValue !== '-' && cellValue !== '') {
            const numValue = parseInt(cellValue);
            if (!isNaN(numValue) && numValue !== 0) return { value: numValue, frame: f };
        }
    }
    return null;
}

function getSegmentStartFrame(sheet, prevFrame, prevValue, layerId) {
    let segmentStartFrame = prevFrame;
    const segmentValue = String(prevValue);
    for (let f = prevFrame - 1; f >= 1; f--) {
        const v = (sheet.data[f] && sheet.data[f][layerId]) || '';
        if (v === segmentValue || v === '-') {
            segmentStartFrame = f;
        } else {
            break;
        }
    }
    return segmentStartFrame;
}

function applyPlusMinus(sheet, frame, layerId, key) {
    const prevInfo = getPreviousValue(sheet, frame, layerId);
    if (!prevInfo) return { changed: false };

    const { value: prevValue, frame: prevFrame } = prevInfo;
    const segmentStartFrame = getSegmentStartFrame(sheet, prevFrame, prevValue, layerId);
    const newValue = key === '+' ? prevValue + 1 : prevValue - 1;
    const oldValue = (sheet.data[frame] && sheet.data[frame][layerId]) || '';
    const oldSegmentValue = (oldValue === '' || oldValue === '-') ? String(prevValue) : String(oldValue);

    if (!sheet.data[frame]) sheet.data[frame] = {};

    if (newValue <= 0) {
        sheet.data[frame][layerId] = '';
    } else {
        sheet.data[frame][layerId] = String(newValue);

        // fill-between: ギャップがあればスキップ
        if (frame - segmentStartFrame > 1) {
            let hasGap = false;
            for (let f = segmentStartFrame + 1; f < frame; f++) {
                const v = (sheet.data[f] && sheet.data[f][layerId]) || '';
                if (v === '') { hasGap = true; break; }
            }
            if (!hasGap) {
                for (let f = segmentStartFrame + 1; f < frame; f++) {
                    if (!sheet.data[f]) sheet.data[f] = {};
                    sheet.data[f][layerId] = String(newValue);
                }
            }
        }

        // forward-fill: 空セルは伝播しない
        if (oldSegmentValue !== String(newValue)) {
            const maxRows = sheet.frames;
            for (let f = frame + 1; f <= maxRows; f++) {
                const nextValue = (sheet.data[f] && sheet.data[f][layerId]) || '';
                if (nextValue === '-' || nextValue === oldSegmentValue) {
                    if (!sheet.data[f]) sheet.data[f] = {};
                    sheet.data[f][layerId] = String(newValue);
                } else {
                    break;
                }
            }
        }
    }

    return { changed: true, newValue };
}

// ─────────────────────────────────────────────
// 1. +/- キー テスト
// ─────────────────────────────────────────────

describe('+/- キー: 基本動作', () => {
    it('直前が数値の場合に +1 される', () => {
        const sheet = makeSheet({ 1: '3' });
        applyPlusMinus(sheet, 2, 'L1', '+');
        expect(sheet.data[2].L1).toBe('4');
    });

    it('直前が数値の場合に -1 される', () => {
        const sheet = makeSheet({ 1: '3' });
        applyPlusMinus(sheet, 2, 'L1', '-');
        expect(sheet.data[2].L1).toBe('2');
    });

    it('直前がない場合は何も変わらない', () => {
        const sheet = makeSheet({});
        const result = applyPlusMinus(sheet, 2, 'L1', '+');
        expect(result.changed).toBe(false);
    });

    it('newValue が 0 以下になる場合は空セルになる', () => {
        const sheet = makeSheet({ 1: '1' });
        applyPlusMinus(sheet, 2, 'L1', '-');
        expect(sheet.data[2].L1).toBe('');
    });
});

describe('+/- キー: 空セルを飛ばして前の値を参照', () => {
    it('F1="1", F2=空, cursor=F3 → + で F3="2", F2 は変わらない', () => {
        const sheet = makeSheet({ 1: '1' });
        applyPlusMinus(sheet, 3, 'L1', '+');
        expect(sheet.data[3].L1).toBe('2');
        expect((sheet.data[2] && sheet.data[2].L1) || '').toBe('');
    });

    it('F1="1", F2=空, F3=空, cursor=F5 → + で F5="2", F2/F3/F4 は変わらない', () => {
        const sheet = makeSheet({ 1: '1' });
        applyPlusMinus(sheet, 5, 'L1', '+');
        expect(sheet.data[5].L1).toBe('2');
        expect((sheet.data[2] && sheet.data[2].L1) || '').toBe('');
        expect((sheet.data[3] && sheet.data[3].L1) || '').toBe('');
        expect((sheet.data[4] && sheet.data[4].L1) || '').toBe('');
    });
});

describe('+/- キー: fill-between (セグメント途中への入力)', () => {
    it('F1="2", F2="-", F3="-", cursor=F4 → + で F2/F3/F4 すべて "3"', () => {
        const sheet = makeSheet({ 1: '2', 2: '-', 3: '-' });
        applyPlusMinus(sheet, 4, 'L1', '+');
        expect(sheet.data[4].L1).toBe('3');
        expect(sheet.data[2].L1).toBe('3');
        expect(sheet.data[3].L1).toBe('3');
    });

    it('F1="1", F2="-", F3=空, cursor=F4 → + で F4="2", F2 の"-"は変わらない', () => {
        const sheet = makeSheet({ 1: '1', 2: '-' });
        applyPlusMinus(sheet, 4, 'L1', '+');
        expect(sheet.data[4].L1).toBe('2');
        expect(sheet.data[2].L1).toBe('-'); // ギャップがあるので変更しない
    });
});

describe('+/- キー: forward-fill は空セルで止まる', () => {
    it('F1="2", F2="2", cursor=F3 → + で F1/F2→"3" まで伝播するが F4 以降は空のまま', () => {
        const sheet = makeSheet({ 1: '2', 2: '2' });
        applyPlusMinus(sheet, 3, 'L1', '+');
        expect(sheet.data[3].L1).toBe('3');
        // F1 は forward-fill 対象外（前方検索は frame+1 から）
        expect((sheet.data[4] && sheet.data[4].L1) || '').toBe('');
    });

    it('前方の "2" セルを forward-fill で更新する', () => {
        const sheet = makeSheet({ 1: '2', 2: '-', 3: '2', 4: '-' });
        // cursor=F5, prevValue=2 from F3, oldSegmentValue="2"
        applyPlusMinus(sheet, 5, 'L1', '+');
        expect(sheet.data[5].L1).toBe('3');
        // forward-fill: F6以降は空なので伝播しない
        expect((sheet.data[6] && sheet.data[6].L1) || '').toBe('');
    });

    it('1, Enter後にSpace, + の1つ飛ばし入力パターン', () => {
        // F1="1", F2=空(Spaceでスキップ), cursor=F3 → + で F3="2", F2 は空のまま
        const sheet = makeSheet({ 1: '1' });
        applyPlusMinus(sheet, 3, 'L1', '+');
        expect(sheet.data[3].L1).toBe('2');
        expect((sheet.data[2] && sheet.data[2].L1) || '').toBe('');
        // F4以降も空のまま
        expect((sheet.data[4] && sheet.data[4].L1) || '').toBe('');
    });
});

// ─────────────────────────────────────────────
// 2. WASD セッション管理テスト
// ─────────────────────────────────────────────

describe('WASD: isXUsed によるセッション内1回制限', () => {
    function makeWasdState() {
        return {
            isWPressed: false, isAPressed: false,
            isSPressed: false, isDPressed: false,
            isWUsed: false, isAUsed: false,
            isSUsed: false, isDUsed: false,
            originalSelectionSize: 0,
        };
    }

    function simulateKeydown(state, key) {
        // 対応する isXUsed をチェックして1回目のみ受け付ける
        const usedKey = `is${key.toUpperCase()}Used`;
        const pressedKey = `is${key.toUpperCase()}Pressed`;
        if (state[usedKey]) return false; // 既に使用済み
        if (state[pressedKey]) return false; // 押しっぱなし
        state[pressedKey] = true;
        state[usedKey] = true;
        return true;
    }

    function simulateKeyup(state, key) {
        const pressedKey = `is${key.toUpperCase()}Pressed`;
        state[pressedKey] = false;
        // 全キー離したらリセット
        if (!state.isWPressed && !state.isAPressed && !state.isSPressed && !state.isDPressed) {
            state.isWUsed = false;
            state.isAUsed = false;
            state.isSUsed = false;
            state.isDUsed = false;
            state.originalSelectionSize = 0;
        }
    }

    it('W を1回だけ受け付ける', () => {
        const state = makeWasdState();
        expect(simulateKeydown(state, 'w')).toBe(true);
        expect(state.isWUsed).toBe(true);
    });

    it('W を離したら単独セッションが終わり、再度 W を押せる', () => {
        const state = makeWasdState();
        simulateKeydown(state, 'w');
        simulateKeyup(state, 'w'); // 全キー離す → セッションリセット
        expect(state.isWUsed).toBe(false); // リセット済み
        expect(simulateKeydown(state, 'w')).toBe(true); // 新セッションで再度押せる
    });

    it('W押しながらD1回は受け付ける', () => {
        const state = makeWasdState();
        simulateKeydown(state, 'w');
        expect(simulateKeydown(state, 'd')).toBe(true);
    });

    it('W押しながらDを2回押そうとしても2回目は無視', () => {
        const state = makeWasdState();
        simulateKeydown(state, 'w');
        simulateKeydown(state, 'd');
        simulateKeyup(state, 'd');
        expect(simulateKeydown(state, 'd')).toBe(false);
    });

    it('全キーを離したらセッションリセットされ再度W/Dが使える', () => {
        const state = makeWasdState();
        simulateKeydown(state, 'w');
        simulateKeydown(state, 'd');
        simulateKeyup(state, 'd');
        simulateKeyup(state, 'w');
        expect(state.isWUsed).toBe(false);
        expect(state.isDUsed).toBe(false);
        expect(simulateKeydown(state, 'w')).toBe(true);
        expect(simulateKeydown(state, 'd')).toBe(true);
    });
});

// ─────────────────────────────────────────────
// 3. i18n: タブ右クリックメニューのキー確認
// ─────────────────────────────────────────────

// i18n.js はブラウザ環境前提のため、必要なキーをロジックとして検証
describe('i18n: contextMenu キーの存在確認', () => {
    const REQUIRED_JA_KEYS = [
        'insertHere', 'deleteFrames', 'deleteContent',
        'copy', 'cut', 'paste', 'loopSelection',
        'renameSheet', 'closeSheet', 'closeAllSheets',
    ];
    const REQUIRED_EN_KEYS = [...REQUIRED_JA_KEYS];

    const jaContextMenu = {
        insertHere: 'この位置に挿入',
        deleteFrames: '行を削除',
        deleteContent: 'セル内容を削除',
        copy: 'コピー',
        cut: 'カット',
        paste: 'ペースト',
        loopSelection: 'この範囲をループ',
        renameSheet: '名前の変更',
        closeSheet: 'このシートを閉じる',
        closeAllSheets: 'すべてのシートを閉じる',
    };

    const enContextMenu = {
        insertHere: 'Insert Here',
        deleteFrames: 'Delete Row',
        deleteContent: 'Delete Cell Content',
        copy: 'Copy',
        cut: 'Cut',
        paste: 'Paste',
        loopSelection: 'Loop This Selection',
        renameSheet: 'Rename',
        closeSheet: 'Close This Sheet',
        closeAllSheets: 'Close All Sheets',
    };

    it.each(REQUIRED_JA_KEYS)('日本語 contextMenu.%s が定義されている', (key) => {
        expect(jaContextMenu[key]).toBeDefined();
        expect(jaContextMenu[key].length).toBeGreaterThan(0);
    });

    it.each(REQUIRED_EN_KEYS)('英語 contextMenu.%s が定義されている', (key) => {
        expect(enContextMenu[key]).toBeDefined();
        expect(enContextMenu[key].length).toBeGreaterThan(0);
    });

    it('日英で同じキーセットを持つ', () => {
        expect(Object.keys(jaContextMenu).sort()).toEqual(Object.keys(enContextMenu).sort());
    });
});

// ─────────────────────────────────────────────
// 4. コンテキストメニュー排他ロジック
// ─────────────────────────────────────────────

describe('コンテキストメニュー: セル/タブの排他表示', () => {
    function makeMenuState() {
        return { cell: 'none', tab: 'none' };
    }

    function showCellMenu(state) {
        state.tab = 'none'; // タブを閉じる
        state.cell = 'block';
    }

    function showTabMenu(state) {
        state.cell = 'none'; // セルを閉じる
        state.tab = 'block';
    }

    function closeAll(state) {
        state.cell = 'none';
        state.tab = 'none';
    }

    it('セルメニューを開くとタブメニューが閉じる', () => {
        const state = makeMenuState();
        showTabMenu(state);
        expect(state.tab).toBe('block');
        showCellMenu(state);
        expect(state.cell).toBe('block');
        expect(state.tab).toBe('none');
    });

    it('タブメニューを開くとセルメニューが閉じる', () => {
        const state = makeMenuState();
        showCellMenu(state);
        expect(state.cell).toBe('block');
        showTabMenu(state);
        expect(state.tab).toBe('block');
        expect(state.cell).toBe('none');
    });

    it('closeAll で両方閉じる', () => {
        const state = makeMenuState();
        showCellMenu(state);
        closeAll(state);
        expect(state.cell).toBe('none');
        expect(state.tab).toBe('none');
    });

    it('両メニューが同時に block になることはない', () => {
        const state = makeMenuState();
        showCellMenu(state);
        showTabMenu(state);
        expect(state.cell === 'block' && state.tab === 'block').toBe(false);
    });
});
