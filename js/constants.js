// 定数定義
const CONSTANTS = {
    // セルサイズ
    CELL_WIDTH: 38,
    CELL_HEIGHT: 28,
    
    // デフォルト値
    DEFAULT_FPS: 24,
    DEFAULT_ROWS: 144,  // 12秒 @ 24fps
    DEFAULT_COLUMNS: 26, // A-Z
    MAX_VISIBLE_ROWS: 288, // 最大表示行数（デフォルト値）
    
    // 表示設定
    BOLD_ROW_INTERVAL: 6, // 6行ごとに太線
    VERTICAL_LINE_WIDTH: 1.5,
    WAVE_LINE_WIDTH: 1.5,
    CROSS_MARK_WIDTH: 1.5,
    
    // 履歴設定
    MAX_HISTORY: 100,
    MAX_DEBUG_LOGS: 1000,
    
    // 空セルマーカー
    NULL_CELL: '\u00D7', // ×（空セルを明示するマーカー）

    // 入力制限
    MAX_CELL_INPUT_LENGTH: 10,
    
    // カラー
    COLORS: {
        SELECTED_CELL: '#b3d9ff',
        DISABLED_ROW: '#d0d0d0',
        INSERTED_FRAME: '#e74c3c',
        BORDER_NORMAL: '#333',
        BORDER_BOLD: '#666',
        DASH_TEXT: '#000',
        VERTICAL_LINE: '#000',
        WAVE_LINE: '#666',
        CROSS_MARK: '#000'
    },
    
    // キーコード
    KEYS: {
        ENTER: 'Enter',
        ESCAPE: 'Escape',
        DELETE: 'Delete',
        BACKSPACE: 'Backspace',
        TAB: 'Tab',
        ARROW_UP: 'ArrowUp',
        ARROW_DOWN: 'ArrowDown',
        ARROW_LEFT: 'ArrowLeft',
        ARROW_RIGHT: 'ArrowRight',
        HOME: 'Home',
        END: 'End',
        F2: 'F2'
    }
};

// エクスポート（モジュールとして使用する場合）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
