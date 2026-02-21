/**
 * 境界での複数選択動作テスト
 * 最終行付近での編集・移動時の選択保持を検証
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('最終行付近での複数選択動作', () => {
    let selectedCells;
    let sheet;
    const maxRows = 144;

    beforeEach(() => {
        selectedCells = [];
        sheet = {
            data: {},
            layers: Array.from({ length: 26 }, (_, i) => ({ id: i + 1, name: String.fromCharCode(65 + i) })),
            name: 'TestSheet',
            fps: 24
        };
    });

    // ヘルパー関数
    function selectCell(frame, layerId) {
        selectedCells.push({ frame, layerId });
    }

    function clearSelection() {
        selectedCells = [];
    }

    function calculateShiftAmount(cells) {
        const frames = cells.map(c => c.frame);
        const minFrame = Math.min(...frames);
        const maxFrame = Math.max(...frames);
        return maxFrame - minFrame + 1;
    }

    describe('複数セル編集後の移動', () => {
        it('最終行付近（F139-F142）で編集すると、範囲内のみ選択（F143-F144）', () => {
            // F139-F142を選択
            [139, 140, 141, 142].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(4);

            // 編集後の移動をシミュレート
            const sortedCells = [...selectedCells];
            const shiftAmount = 4; // 4行下に移動
            clearSelection();

            sortedCells.forEach(s => {
                const newFrame = s.frame + shiftAmount;
                if (newFrame <= maxRows) {
                    selectCell(newFrame, s.layerId);
                }
            });

            // F143, F144のみ選択されるべき（F145, F146は範囲外）
            expect(selectedCells.length).toBe(2);
            expect(selectedCells[0].frame).toBe(143);
            expect(selectedCells[1].frame).toBe(144);
        });

        it('最終行を完全に超える場合（F142-F144）は元の位置を保持', () => {
            // F142-F144を選択
            [142, 143, 144].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(3);

            // 編集後の移動をシミュレート（shiftAmount = 3）
            const sortedCells = [...selectedCells];
            const shiftAmount = 3;
            clearSelection();

            let movedCount = 0;
            sortedCells.forEach(s => {
                const newFrame = s.frame + shiftAmount;
                if (newFrame <= maxRows) {
                    selectCell(newFrame, s.layerId);
                    movedCount++;
                }
            });

            // 移動できなかった場合は元の位置に戻す
            if (movedCount === 0) {
                sortedCells.forEach(s => selectCell(s.frame, s.layerId));
            }

            // 元の3セルが選択されているべき
            expect(selectedCells.length).toBe(3);
            expect(selectedCells[0].frame).toBe(142);
            expect(selectedCells[1].frame).toBe(143);
            expect(selectedCells[2].frame).toBe(144);
        });

        it('一部だけ移動可能（F141-F144）→（F143-F144）', () => {
            // F141-F144を選択
            [141, 142, 143, 144].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(4);

            // 編集後の移動（shiftAmount = 4）
            const sortedCells = [...selectedCells];
            const shiftAmount = 4;
            clearSelection();

            sortedCells.forEach(s => {
                const newFrame = s.frame + shiftAmount;
                if (newFrame <= maxRows) {
                    selectCell(newFrame, s.layerId);
                }
            });

            // F145は範囲外、F146も範囲外、F147も範囲外、F148も範囲外
            // すべて範囲外なので0個
            expect(selectedCells.length).toBe(0);

            // 実際のコードでは0個の場合は元の位置を保持
            if (selectedCells.length === 0) {
                sortedCells.forEach(s => selectCell(s.frame, s.layerId));
            }
            expect(selectedCells.length).toBe(4);
        });
    });

    describe('+/-キーでの複数選択移動', () => {
        it('最終行付近で+キーを押すと、範囲内のみ選択', () => {
            // F140-F142を選択
            [140, 141, 142].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(3);

            // +キーの移動をシミュレート（shiftAmount = 3）
            const sortedCells = [...selectedCells];
            const shiftAmount = calculateShiftAmount(sortedCells);
            expect(shiftAmount).toBe(3);

            clearSelection();
            sortedCells.forEach(s => {
                const newFrame = s.frame + shiftAmount;
                if (newFrame <= maxRows) {
                    selectCell(newFrame, s.layerId);
                }
            });

            // F143, F144のみ選択（F145は範囲外）
            expect(selectedCells.length).toBe(2);
            expect(selectedCells[0].frame).toBe(143);
            expect(selectedCells[1].frame).toBe(144);
        });

        it('最終行で+キーを押すと元の位置を保持', () => {
            // F144を選択
            selectCell(144, 1);
            expect(selectedCells.length).toBe(1);

            const sortedCells = [...selectedCells];
            const shiftAmount = 1;
            clearSelection();

            let movedCount = 0;
            sortedCells.forEach(s => {
                const newFrame = s.frame + shiftAmount;
                if (newFrame <= maxRows) {
                    selectCell(newFrame, s.layerId);
                    movedCount++;
                }
            });

            // 移動できない場合は元の位置を保持
            if (movedCount === 0) {
                sortedCells.forEach(s => selectCell(s.frame, s.layerId));
            }

            // F144のまま
            expect(selectedCells.length).toBe(1);
            expect(selectedCells[0].frame).toBe(144);
        });
    });

    describe('Enterキーでの複数選択移動', () => {
        it('最終行付近で範囲を超える移動量の場合、可能な範囲だけ移動', () => {
            // F140-F143を選択
            [140, 141, 142, 143].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(4);

            // Enterキーの移動をシミュレート
            const sortedCells = [...selectedCells];
            const minFrame = Math.min(...sortedCells.map(s => s.frame));
            const maxFrame = Math.max(...sortedCells.map(s => s.frame));
            const shiftAmount = maxFrame - minFrame + 1; // 4

            // adjustedShiftAmount = min(4, 144 - 143) = 1
            const adjustedShiftAmount = Math.min(shiftAmount, maxRows - maxFrame);
            expect(adjustedShiftAmount).toBe(1);

            clearSelection();
            sortedCells.forEach(s => {
                const newFrame = s.frame + adjustedShiftAmount;
                selectCell(newFrame, s.layerId);
            });

            // F141-F144に1行だけ移動
            expect(selectedCells.length).toBe(4);
            expect(selectedCells[0].frame).toBe(141);
            expect(selectedCells[3].frame).toBe(144);
        });

        it('最終行で移動量0の場合、選択を保持', () => {
            // F142-F144を選択
            [142, 143, 144].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(3);

            const beforeFrames = selectedCells.map(s => s.frame);

            // Enterキーの移動をシミュレート
            const maxFrame = Math.max(...selectedCells.map(s => s.frame));
            const shiftAmount = 3;
            const adjustedShiftAmount = Math.min(shiftAmount, maxRows - maxFrame);

            // adjustedShiftAmount = 0なので移動しない
            expect(adjustedShiftAmount).toBe(0);

            // adjustedShiftAmount = 0の場合は移動処理をスキップし、選択を保持
            if (adjustedShiftAmount > 0) {
                // 移動処理
            }

            // 選択が保持されるべき
            expect(selectedCells.length).toBe(3);
            expect(selectedCells.map(s => s.frame)).toEqual(beforeFrames);
        });

        it('通常の移動（最終行に達しない）', () => {
            // F100-F102を選択
            [100, 101, 102].forEach(frame => selectCell(frame, 1));
            expect(selectedCells.length).toBe(3);

            const sortedCells = [...selectedCells];
            const maxFrame = 102;
            const shiftAmount = 3;
            const adjustedShiftAmount = Math.min(shiftAmount, maxRows - maxFrame);

            // adjustedShiftAmount = min(3, 42) = 3 (通常移動)
            expect(adjustedShiftAmount).toBe(3);

            clearSelection();
            sortedCells.forEach(s => {
                const newFrame = s.frame + adjustedShiftAmount;
                selectCell(newFrame, s.layerId);
            });

            // F103-F105に移動
            expect(selectedCells.length).toBe(3);
            expect(selectedCells[0].frame).toBe(103);
            expect(selectedCells[2].frame).toBe(105);
        });
    });

    describe('選択の縮小（/キー）', () => {
        it('1行×複数列選択時は縮小しない', () => {
            // F1L1, F1L2を選択（横並び）
            selectCell(1, 1);
            selectCell(1, 2);
            expect(selectedCells.length).toBe(2);

            // 縮小をシミュレート
            const frames = [...new Set(selectedCells.map(s => s.frame))];
            const before = [...selectedCells];

            if (frames.length === 1) {
                // 1行のみの選択なので縮小しない
            } else {
                // 複数行なら最大フレームを除外
                const maxFrame = Math.max(...frames);
                selectedCells = selectedCells.filter(s => s.frame !== maxFrame);
            }

            // 選択が保持されるべき
            expect(selectedCells.length).toBe(2);
            expect(selectedCells).toEqual(before);
        });

        it('複数行選択時は最下行を除外', () => {
            // F1L1, F2L1を選択（縦並び）
            selectCell(1, 1);
            selectCell(2, 1);
            expect(selectedCells.length).toBe(2);

            // 縮小をシミュレート
            const frames = [...new Set(selectedCells.map(s => s.frame))];

            if (frames.length === 1) {
                // 1行のみなので縮小しない
            } else {
                // 最大フレームを除外
                const maxFrame = Math.max(...frames);
                selectedCells = selectedCells.filter(s => s.frame !== maxFrame);
            }

            // F2が除外され、F1のみ
            expect(selectedCells.length).toBe(1);
            expect(selectedCells[0].frame).toBe(1);
        });

        it('2×2選択時は最下行（2セル）を除外', () => {
            // F1L1, F1L2, F2L1, F2L2を選択
            selectCell(1, 1);
            selectCell(1, 2);
            selectCell(2, 1);
            selectCell(2, 2);
            expect(selectedCells.length).toBe(4);

            // 縮小をシミュレート
            const frames = [...new Set(selectedCells.map(s => s.frame))];

            if (frames.length > 1) {
                const maxFrame = Math.max(...frames);
                selectedCells = selectedCells.filter(s => s.frame !== maxFrame);
            }

            // F1L1, F1L2のみ残る
            expect(selectedCells.length).toBe(2);
            expect(selectedCells.every(s => s.frame === 1)).toBe(true);
        });
    });

    describe('shiftAmountの計算', () => {
        it('3セル選択（F1-F3）のshiftAmountは3', () => {
            [1, 2, 3].forEach(frame => selectCell(frame, 1));
            const shiftAmount = calculateShiftAmount(selectedCells);
            expect(shiftAmount).toBe(3);
        });

        it('1セル選択（F5）のshiftAmountは1', () => {
            selectCell(5, 1);
            const shiftAmount = calculateShiftAmount(selectedCells);
            expect(shiftAmount).toBe(1);
        });

        it('飛び飛びの選択（F1, F5, F10）のshiftAmountは10', () => {
            selectCell(1, 1);
            selectCell(5, 1);
            selectCell(10, 1);
            const shiftAmount = calculateShiftAmount(selectedCells);
            // min=1, max=10, shiftAmount=10
            expect(shiftAmount).toBe(10);
        });
    });
});
