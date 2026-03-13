import { describe, it, expect, vi, beforeEach } from 'vitest';

// CSP自動保存のロジックテスト

describe('CSP自動保存', () => {
    let cspAutoSaveTimer = null;
    let cspAutoSaveInProgress = false;
    const CSP_AUTOSAVE_DEBOUNCE_MS = 300;
    let mockSaveXdts;
    let mockSaveTdts;
    let mockSaveFile;
    let AppState;

    beforeEach(() => {
        vi.useFakeTimers();
        cspAutoSaveTimer = null;
        cspAutoSaveInProgress = false;
        mockSaveXdts = vi.fn().mockResolvedValue(undefined);
        mockSaveTdts = vi.fn().mockResolvedValue(undefined);
        mockSaveFile = vi.fn().mockResolvedValue(undefined);
        AppState = {
            cspSyncMode: false,
            cspSyncFilePath: null,
            sheets: [{ name: 'Test', layers: [{ id: 'L1', name: 'A' }], frames: 24, data: {} }],
            currentSheetIndex: 0,
        };
    });

    function getCurrentSheet() {
        return AppState.sheets[AppState.currentSheetIndex];
    }

    function triggerCspAutoSave() {
        if (!AppState.cspSyncMode || !AppState.cspSyncFilePath) return;
        if (cspAutoSaveTimer) {
            clearTimeout(cspAutoSaveTimer);
        }
        cspAutoSaveTimer = setTimeout(async () => {
            await executeCspAutoSave();
        }, CSP_AUTOSAVE_DEBOUNCE_MS);
    }

    async function executeCspAutoSave() {
        if (cspAutoSaveInProgress) return;
        cspAutoSaveInProgress = true;
        try {
            const currentSheet = getCurrentSheet();
            if (!currentSheet) return;
            const filePath = AppState.cspSyncFilePath;
            const ext = filePath.toLowerCase();
            if (ext.endsWith('.xdts')) {
                await mockSaveXdts(filePath, currentSheet);
            } else if (ext.endsWith('.tdts')) {
                await mockSaveTdts(filePath, currentSheet);
            } else {
                await mockSaveFile(filePath, '{}');
            }
        } finally {
            cspAutoSaveInProgress = false;
        }
    }

    it('CSPモードが無効のときは自動保存しない', () => {
        AppState.cspSyncMode = false;
        AppState.cspSyncFilePath = '/tmp/test.xdts';
        triggerCspAutoSave();
        vi.advanceTimersByTime(500);
        expect(mockSaveXdts).not.toHaveBeenCalled();
    });

    it('CSPモードが有効でXDTSファイルの場合、デバウンス後に保存する', async () => {
        AppState.cspSyncMode = true;
        AppState.cspSyncFilePath = '/tmp/test.xdts';
        triggerCspAutoSave();

        // 300ms前は保存されない
        vi.advanceTimersByTime(200);
        expect(mockSaveXdts).not.toHaveBeenCalled();

        // 300ms後に保存される
        vi.advanceTimersByTime(100);
        await vi.runAllTimersAsync();
        expect(mockSaveXdts).toHaveBeenCalledOnce();
        expect(mockSaveXdts).toHaveBeenCalledWith('/tmp/test.xdts', expect.any(Object));
    });

    it('連続編集ではデバウンスで最後の1回だけ保存する', async () => {
        AppState.cspSyncMode = true;
        AppState.cspSyncFilePath = '/tmp/test.xdts';

        // 3回連続でトリガー（100ms間隔）
        triggerCspAutoSave();
        vi.advanceTimersByTime(100);
        triggerCspAutoSave();
        vi.advanceTimersByTime(100);
        triggerCspAutoSave();

        // 最後のトリガーから300ms経過
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();

        // 1回だけ保存される
        expect(mockSaveXdts).toHaveBeenCalledOnce();
    });

    it('TDTSファイルの場合はTDTS形式で保存する', async () => {
        AppState.cspSyncMode = true;
        AppState.cspSyncFilePath = '/tmp/test.tdts';
        triggerCspAutoSave();
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
        expect(mockSaveTdts).toHaveBeenCalledOnce();
        expect(mockSaveXdts).not.toHaveBeenCalled();
    });

    it('cspSyncFilePathがnullの場合は保存しない', () => {
        AppState.cspSyncMode = true;
        AppState.cspSyncFilePath = null;
        triggerCspAutoSave();
        vi.advanceTimersByTime(500);
        expect(mockSaveXdts).not.toHaveBeenCalled();
        expect(mockSaveTdts).not.toHaveBeenCalled();
        expect(mockSaveFile).not.toHaveBeenCalled();
    });
});
