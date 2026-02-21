import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Updater（自動アップデート）のテスト
 * updater.js のロジックテスト
 */

// ========================================
// LocalStorage モック
// ========================================

let storedData;

beforeEach(() => {
    storedData = {};
    globalThis.localStorage = {
        getItem: (key) => storedData[key] || null,
        setItem: (key, value) => { storedData[key] = value; },
        removeItem: (key) => { delete storedData[key]; }
    };
});

// ========================================
// updater.js のロジックを再実装（テスト用）
// ========================================

const UPDATE_STORAGE_KEY = 'update-settings';

function getUpdateSettings() {
    const defaults = {
        autoCheckUpdates: true,
        lastUpdateCheck: null,
        ignoredVersions: []
    };
    try {
        const stored = localStorage.getItem(UPDATE_STORAGE_KEY);
        if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
        }
    } catch (e) {}
    return defaults;
}

function saveUpdateSettings(settings) {
    try {
        localStorage.setItem(UPDATE_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {}
}

function shouldCheckUpdate(forceCheck = false) {
    if (forceCheck) return true;
    const settings = getUpdateSettings();
    if (!settings.autoCheckUpdates) return false;
    if (!settings.lastUpdateCheck) return true;
    const lastCheck = new Date(settings.lastUpdateCheck);
    const now = new Date();
    const hoursSinceLastCheck = (now - lastCheck) / (1000 * 60 * 60);
    return hoursSinceLastCheck >= 24;
}

function saveLastCheckTime() {
    const settings = getUpdateSettings();
    settings.lastUpdateCheck = new Date().toISOString();
    saveUpdateSettings(settings);
}

function getIgnoredVersions() {
    const settings = getUpdateSettings();
    return settings.ignoredVersions || [];
}

function addIgnoredVersion(version) {
    const settings = getUpdateSettings();
    if (!settings.ignoredVersions.includes(version)) {
        settings.ignoredVersions.push(version);
        saveUpdateSettings(settings);
    }
}

function toggleAutoCheckUpdates(enabled) {
    const settings = getUpdateSettings();
    settings.autoCheckUpdates = enabled;
    saveUpdateSettings(settings);
}

// ========================================
// テスト
// ========================================

describe('Updater 設定管理', () => {
    describe('getUpdateSettings', () => {
        it('初期状態でデフォルト値を返す', () => {
            const settings = getUpdateSettings();
            expect(settings.autoCheckUpdates).toBe(true);
            expect(settings.lastUpdateCheck).toBeNull();
            expect(settings.ignoredVersions).toEqual([]);
        });

        it('保存された値がある場合はマージして返す', () => {
            storedData[UPDATE_STORAGE_KEY] = JSON.stringify({
                autoCheckUpdates: false,
                ignoredVersions: ['v1.0.0']
            });
            const settings = getUpdateSettings();
            expect(settings.autoCheckUpdates).toBe(false);
            expect(settings.lastUpdateCheck).toBeNull(); // デフォルトから
            expect(settings.ignoredVersions).toEqual(['v1.0.0']);
        });

        it('破損したJSONでもデフォルト値を返す', () => {
            storedData[UPDATE_STORAGE_KEY] = 'invalid json{{{';
            const settings = getUpdateSettings();
            expect(settings.autoCheckUpdates).toBe(true);
        });
    });

    describe('saveUpdateSettings', () => {
        it('設定をLocalStorageに保存する', () => {
            const settings = { autoCheckUpdates: false, lastUpdateCheck: null, ignoredVersions: [] };
            saveUpdateSettings(settings);
            const stored = JSON.parse(storedData[UPDATE_STORAGE_KEY]);
            expect(stored.autoCheckUpdates).toBe(false);
        });
    });
});

describe('shouldCheckUpdate', () => {
    it('forceCheck=true で常にtrue', () => {
        toggleAutoCheckUpdates(false);
        expect(shouldCheckUpdate(true)).toBe(true);
    });

    it('自動チェックOFFでfalse', () => {
        toggleAutoCheckUpdates(false);
        expect(shouldCheckUpdate(false)).toBe(false);
    });

    it('最終チェックがnullでtrue', () => {
        expect(shouldCheckUpdate(false)).toBe(true);
    });

    it('24時間以内のチェックでfalse', () => {
        // 1時間前にチェック
        const settings = getUpdateSettings();
        settings.lastUpdateCheck = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        saveUpdateSettings(settings);
        expect(shouldCheckUpdate(false)).toBe(false);
    });

    it('24時間以上前のチェックでtrue', () => {
        const settings = getUpdateSettings();
        settings.lastUpdateCheck = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        saveUpdateSettings(settings);
        expect(shouldCheckUpdate(false)).toBe(true);
    });

    it('ちょうど24時間でtrue', () => {
        const settings = getUpdateSettings();
        settings.lastUpdateCheck = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        saveUpdateSettings(settings);
        expect(shouldCheckUpdate(false)).toBe(true);
    });
});

describe('saveLastCheckTime', () => {
    it('現在時刻を保存する', () => {
        const before = Date.now();
        saveLastCheckTime();
        const after = Date.now();
        
        const settings = getUpdateSettings();
        const savedTime = new Date(settings.lastUpdateCheck).getTime();
        expect(savedTime).toBeGreaterThanOrEqual(before);
        expect(savedTime).toBeLessThanOrEqual(after);
    });

    it('保存後は24h以内と判定される', () => {
        saveLastCheckTime();
        expect(shouldCheckUpdate(false)).toBe(false);
    });
});

describe('バージョン無視リスト', () => {
    it('初期状態で空', () => {
        expect(getIgnoredVersions()).toEqual([]);
    });

    it('バージョンを追加できる', () => {
        addIgnoredVersion('v1.0.0');
        expect(getIgnoredVersions()).toContain('v1.0.0');
    });

    it('同じバージョンを重複追加しない', () => {
        addIgnoredVersion('v1.0.0');
        addIgnoredVersion('v1.0.0');
        expect(getIgnoredVersions().filter(v => v === 'v1.0.0')).toHaveLength(1);
    });

    it('複数バージョンを追加できる', () => {
        addIgnoredVersion('v1.0.0');
        addIgnoredVersion('v2.0.0');
        addIgnoredVersion('v3.0.0');
        const versions = getIgnoredVersions();
        expect(versions).toHaveLength(3);
        expect(versions).toContain('v2.0.0');
    });
});

describe('toggleAutoCheckUpdates', () => {
    it('ONにできる', () => {
        toggleAutoCheckUpdates(false);
        expect(getUpdateSettings().autoCheckUpdates).toBe(false);
        toggleAutoCheckUpdates(true);
        expect(getUpdateSettings().autoCheckUpdates).toBe(true);
    });

    it('OFFにできる', () => {
        toggleAutoCheckUpdates(false);
        expect(getUpdateSettings().autoCheckUpdates).toBe(false);
    });

    it('他の設定に影響しない', () => {
        addIgnoredVersion('v1.0.0');
        saveLastCheckTime();
        toggleAutoCheckUpdates(false);
        const settings = getUpdateSettings();
        expect(settings.ignoredVersions).toContain('v1.0.0');
        expect(settings.lastUpdateCheck).not.toBeNull();
    });
});
