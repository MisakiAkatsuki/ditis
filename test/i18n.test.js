import { describe, it, expect, beforeEach } from 'vitest';

/**
 * i18n（多言語対応）のテスト
 * 翻訳キー検索、言語切替、フォールバックのロジック
 */

// ========================================
// i18n ロジックの最小再現
// ========================================

const i18n = {
    ja: {
        app: { title: 'DiTiS', version: 'v20260211', newSheet: '新規シート' },
        menu: {
            file: { title: 'ファイル', new: '新規作成 (Ctrl+N)', open: '開く (Ctrl+O)' },
            edit: { title: '編集', undo: '元に戻す (Ctrl+Z)', redo: 'やり直し (Ctrl+Y)' },
            sheet: { title: 'シート', sendToAE: 'After Effectsに送信 (Ctrl+E)' },
            view: { title: '表示' },
            help: { title: 'ヘルプ' }
        },
        status: {
            ready: '準備完了',
            cellSelected: '{0} ({1}セル選択中)',
            cellsSelected: '{0}セル選択中',
            sheetInfo: '{0}: {1}列 × {2}フレーム ({3}fps)',
            time: '{0}秒+{1}コマ (全{2}コマ)',
            timeShort: '{0}+{1} ({2})'
        },
        dialog: {
            ok: 'OK',
            cancel: 'キャンセル',
            yes: 'はい',
            no: 'いいえ'
        },
        updater: {
            updateAvailable: 'アップデートがあります',
            noUpdates: '最新バージョンです',
            checkFailed: 'アップデートの確認に失敗しました',
            noRelease: 'リリースが見つかりません'
        }
    },
    en: {
        app: { title: 'DiTiS', version: 'v20260211', newSheet: 'New Sheet' },
        menu: {
            file: { title: 'File', new: 'New (Ctrl+N)', open: 'Open (Ctrl+O)' },
            edit: { title: 'Edit', undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)' },
            sheet: { title: 'Sheet', sendToAE: 'Send to After Effects (Ctrl+E)' },
            view: { title: 'View' },
            help: { title: 'Help' }
        },
        status: {
            ready: 'Ready',
            cellSelected: '{0} ({1} cells selected)',
            cellsSelected: '{0} cells selected',
            sheetInfo: '{0}: {1} columns × {2} frames ({3}fps)',
            time: '{0}s+{1}f ({2} total)',
            timeShort: '{0}+{1} ({2})'
        },
        dialog: {
            ok: 'OK',
            cancel: 'Cancel',
            yes: 'Yes',
            no: 'No'
        },
        updater: {
            updateAvailable: 'Update available',
            noUpdates: 'You are on the latest version',
            checkFailed: 'Failed to check for updates',
            noRelease: 'No releases found'
        }
    }
};

let currentLanguage = 'ja';

function getCurrentLanguage() {
    return currentLanguage;
}

function setLanguage(lang) {
    if (i18n[lang]) {
        currentLanguage = lang;
    }
}

/**
 * 翻訳キーからテキストを取得
 * @param {string} key - ドット区切りのキー（例: 'menu.file.title'）
 * @param {...any} args - プレースホルダーの置換引数
 */
function t(key, ...args) {
    const keys = key.split('.');
    let value = i18n[currentLanguage];
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            // フォールバック: 英語→キーそのまま
            let fallback = i18n['en'];
            for (const fk of keys) {
                if (fallback && typeof fallback === 'object' && fk in fallback) {
                    fallback = fallback[fk];
                } else {
                    return key; // キーをそのまま返す
                }
            }
            value = fallback;
            break;
        }
    }
    
    if (typeof value !== 'string') return key;
    
    // プレースホルダー置換: {0}, {1}, ...
    return value.replace(/\{(\d+)\}/g, (match, index) => {
        const idx = parseInt(index);
        return idx < args.length ? args[idx] : match;
    });
}

// ========================================
// テスト
// ========================================

describe('i18n 多言語対応', () => {
    beforeEach(() => {
        currentLanguage = 'ja';
    });

    describe('getCurrentLanguage / setLanguage', () => {
        it('デフォルトは日本語', () => {
            expect(getCurrentLanguage()).toBe('ja');
        });

        it('英語に切り替えられる', () => {
            setLanguage('en');
            expect(getCurrentLanguage()).toBe('en');
        });

        it('無効な言語では変わらない', () => {
            setLanguage('fr');
            expect(getCurrentLanguage()).toBe('ja');
        });
    });

    describe('t() - 翻訳キー検索', () => {
        it('日本語の翻訳を取得する', () => {
            expect(t('app.title')).toBe('DiTiS');
            expect(t('menu.file.title')).toBe('ファイル');
            expect(t('status.ready')).toBe('準備完了');
        });

        it('英語の翻訳を取得する', () => {
            setLanguage('en');
            expect(t('menu.file.title')).toBe('File');
            expect(t('status.ready')).toBe('Ready');
        });

        it('存在しないキーはキーそのものを返す', () => {
            expect(t('nonexistent.key')).toBe('nonexistent.key');
        });

        it('プレースホルダーを置換する', () => {
            const result = t('status.time', 5, 12, 132);
            expect(result).toBe('5秒+12コマ (全132コマ)');
        });

        it('英語でもプレースホルダーを置換する', () => {
            setLanguage('en');
            const result = t('status.time', 5, 12, 132);
            expect(result).toBe('5s+12f (132 total)');
        });

        it('引数が足りない場合はプレースホルダーが残る', () => {
            const result = t('status.time', 5);
            expect(result).toContain('5秒');
            expect(result).toContain('{1}');
        });

        it('ネストされたキーに正しくアクセスする', () => {
            expect(t('menu.edit.undo')).toBe('元に戻す (Ctrl+Z)');
            expect(t('dialog.ok')).toBe('OK');
        });

        it('updater のキーが存在する', () => {
            expect(t('updater.updateAvailable')).toBe('アップデートがあります');
            setLanguage('en');
            expect(t('updater.updateAvailable')).toBe('Update available');
        });
    });

    describe('翻訳の一貫性チェック', () => {
        it('日本語と英語で同じキー構造を持つ', () => {
            function getKeys(obj, prefix = '') {
                const keys = [];
                for (const key in obj) {
                    const fullKey = prefix ? `${prefix}.${key}` : key;
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        keys.push(...getKeys(obj[key], fullKey));
                    } else {
                        keys.push(fullKey);
                    }
                }
                return keys;
            }
            const jaKeys = getKeys(i18n.ja);
            const enKeys = getKeys(i18n.en);
            
            // 日本語のキーは全て英語にも存在する
            jaKeys.forEach(key => {
                expect(enKeys).toContain(key);
            });
        });

        it('プレースホルダーの数が日英で一致する', () => {
            function countPlaceholders(str) {
                const matches = str.match(/\{\d+\}/g);
                return matches ? matches.length : 0;
            }

            function getAllStrings(obj) {
                const result = {};
                function traverse(o, prefix = '') {
                    for (const key in o) {
                        const fullKey = prefix ? `${prefix}.${key}` : key;
                        if (typeof o[key] === 'object') {
                            traverse(o[key], fullKey);
                        } else if (typeof o[key] === 'string') {
                            result[fullKey] = o[key];
                        }
                    }
                }
                traverse(obj);
                return result;
            }

            const jaStrings = getAllStrings(i18n.ja);
            const enStrings = getAllStrings(i18n.en);

            for (const key in jaStrings) {
                if (enStrings[key]) {
                    const jaCount = countPlaceholders(jaStrings[key]);
                    const enCount = countPlaceholders(enStrings[key]);
                    expect(jaCount).toBe(enCount);
                }
            }
        });
    });

    describe('ステータスバー表示テスト', () => {
        it('セル選択情報を正しくフォーマットする', () => {
            const result = t('status.cellSelected', 'A3', 5);
            expect(result).toBe('A3 (5セル選択中)');
        });

        it('シート情報を正しくフォーマットする', () => {
            const result = t('status.sheetInfo', 'Sheet1', 3, 144, 24);
            expect(result).toBe('Sheet1: 3列 × 144フレーム (24fps)');
        });

        it('尺表示（短縮形）を正しくフォーマットする', () => {
            const result = t('status.timeShort', 6, 0, 144);
            expect(result).toBe('6+0 (144)');
        });
    });
});

describe('尺計算のロジック', () => {
    it('24fpsで144フレームは6秒0コマ', () => {
        const fps = 24;
        const frames = 144;
        const seconds = Math.floor(frames / fps);
        const remaining = frames % fps;
        expect(seconds).toBe(6);
        expect(remaining).toBe(0);
    });

    it('24fpsで150フレームは6秒6コマ', () => {
        const fps = 24;
        const frames = 150;
        const seconds = Math.floor(frames / fps);
        const remaining = frames % fps;
        expect(seconds).toBe(6);
        expect(remaining).toBe(6);
    });

    it('30fpsで90フレームは3秒0コマ', () => {
        const fps = 30;
        const frames = 90;
        expect(Math.floor(frames / fps)).toBe(3);
        expect(frames % fps).toBe(0);
    });

    it('無効化フレームを除いた実効フレーム数', () => {
        const totalFrames = 144;
        const disabledCount = 10;
        const effectiveFrames = totalFrames - disabledCount;
        const fps = 24;
        const seconds = Math.floor(effectiveFrames / fps);
        const remaining = effectiveFrames % fps;
        expect(effectiveFrames).toBe(134);
        expect(seconds).toBe(5);
        expect(remaining).toBe(14);
    });
});
