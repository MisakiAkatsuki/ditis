import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, it, expect, vi } from 'vitest';

describe('AE error reporting', () => {
    it.each(['sendToAfterEffects', 'getTimeremapFromAE'])('%s preserves actionable backend errors', async action => {
        const detail = 'After Effectsへの送信に失敗しました: AppleEventがタイムアウトしました。 (-1712)\nオートメーションの設定を確認してください。';
        const message = vi.fn();
        const fail = vi.fn().mockRejectedValue(new Error(detail));
        const ctx = vm.createContext({
            window: {
                TauriAPI: { executeAfterEffectsScript: fail, getTimeremapFromAE: fail },
                __TAURI__: { dialog: { message } },
            },
            console: { error: vi.fn() }, debugLog: vi.fn(), updateStatusBar: vi.fn(),
            getCurrentLanguage: () => 'ja',
            i18n: { ja: { error: { aeNotRunning: 'AEが見つかりません' }, dialogTitle: { warning: '警告' } } },
        });
        vm.runInContext(readFileSync(new URL('../js/export.js', import.meta.url), 'utf8'), ctx);
        ctx.generateJSXSingleComp = () => '// test script';
        await ctx[action]();
        expect(fail).toHaveBeenCalledOnce();
        expect(message).toHaveBeenCalledExactlyOnceWith(detail, { title: '警告', type: 'warning' });
    });
});
