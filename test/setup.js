// Vitest セットアップファイル
import { vi } from 'vitest';

// グローバルモックの設定
global.alert = vi.fn();
global.confirm = vi.fn(() => true);
global.prompt = vi.fn();

// LocalStorage モック
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
global.localStorage = localStorageMock;

// console.log を抑制（テスト出力をクリーンに保つ）
global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
};
