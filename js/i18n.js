/**
 * 多言語対応テキスト定義
 * Multilingual text definitions
 */

const i18n = {
    ja: {
        // アプリケーション
        app: {
            title: 'DiTiS',
            version: 'v2026.02.22',
            newSheet: '新規シート'
        },
        
        // メニュー
        menu: {
            // ファイルメニュー
            file: {
                title: 'ファイル',
                new: '新規作成 (Ctrl+N)',
                open: '開く (Ctrl+O)',
                loadSts: '.stsを読み込む',
                loadTdts: '.tdtsを読み込む',
                save: '保存 (Ctrl+S)',
                saveAs: '名前を付けて保存 (Ctrl+Shift+S)',
                saveSts: '.stsとして保存',
                exportJsx: 'ExtendScriptとして出力 (Ctrl+Shift+E)',
                close: '閉じる (Ctrl+W)',
                closeAll: 'すべてのシートを閉じる'
            },
            // 編集メニュー
            edit: {
                title: '編集',
                undo: '元に戻す (Ctrl+Z)',
                redo: 'やり直し (Ctrl+Y)',
                reopenLastFile: '起動時に前回のシート状態を復元する',
                aeKeyframeVersionChange: 'コピーするキーフレームデータのバージョンを変更',
                aeKeyframeVersionLabel: 'AEバージョン',
                aeKeyframeVersionHint: '現在: {0}（例: 9.0）',
                aeKeyframeVersionPrompt: 'バージョンを入力してください（例: 9.0）\n現在: {0}',
                aeKeyframeVersionInvalid: 'バージョン番号は数値（例: 9.0）で入力してください',
                aeKeyframeVersionChanged: 'キーフレームデータバージョンを {0} に変更しました'
            },
            // シートメニュー
            sheet: {
                title: 'シート',
                sheetSettings: 'シート設定',
                changeDuration: '尺を変更',
                changeFps: 'フレームレートを変更',
                changeColumns: '列数を変更',
                resetColumnNames: '列名を初期化',
                sendToAE: 'After Effectsに送信 (Ctrl+E)',
                clearSheet: 'シートを初期化',
                showNewSheetDialog: '新規シート作成時にダイアログを表示'
            },
            // 表示メニュー
            view: {
                title: '表示',
                frameDisplay: '行ヘッダー：表示するコマ',
                frameAll: '全コマ表示',
                frameOdd: '奇数コマのみ',
                frameEven: '偶数コマのみ',
                headerMode: '行ヘッダー：表示形式',
                headerModeDetail: 'タイムシート式',
                headerModeSimple: '通し番号式',
                displaySize: '表示サイズ',
                sizeXSmall: '極小',
                sizeSmall: '小',
                sizeNormal: '標準',
                sizeLarge: '大',
                sizeXLarge: '特大',
                language: '言語',
                languageJa: '日本語',
                languageEn: 'English',
                theme: 'テーマ',
                themeLight: 'ライトテーマ',
                themeDark: 'ダークテーマ',
                themeGreen: 'グリーンテーマ',
                alwaysOnTop: '常に前面に表示',
                alwaysOnTopOn: '常に前面に表示: ON',
                alwaysOnTopOff: '常に前面に表示: OFF',
                resetView: '表示設定をリセット',
                intermediateHeaders: '列間にコマヘッダーを表示: OFF'
            },
            // ヘルプメニュー
            help: {
                title: 'ヘルプ',
                showHelp: 'ヘルプ',
                checkUpdates: '更新を確認',
                autoCheckUpdates: '起動時に更新を確認',
                about: 'このソフトについて',
                website: '公式サイト',
                github: 'GitHub'
            },
            // デバッグメニュー
            debug: {
                title: 'デバッグ',
                debugMode: 'デバッグモード',
                debugModeOn: 'デバッグモード: ON',
                debugModeOff: 'デバッグモード: OFF',
                exportLogs: 'ログを出力'
            },
            exportExtendScript: 'ExtendScriptを出力',
            exportToAE: 'After Effectsに送信'
        },
        
        // 更新機能
        updater: {
            title: '更新の確認',
            available: 'が使用できます。',
            currentVersion: '現在のバージョン',
            releaseDate: 'リリース日',
            downloadPrompt: 'アップデートをダウンロードしてインストールしますか？',
            downloadNow: '今すぐダウンロード',
            remindLater: '後で通知',
            ignoreTitle: 'この更新を無視',
            ignorePrompt: 'バージョン {0} の更新通知を今後表示しませんか？',
            ignoreVersion: 'この更新を無視',
            ignoreSuccess: 'この更新を無視リストに追加しました',
            checkFailed: '更新の確認に失敗しました',
            noRelease: 'リリースが見つかりません。このアプリはまだ公開リリースがない可能性があります。',
            installFailed: '更新のインストールに失敗しました',
            installSuccess: '更新をダウンロードしました',
            restartTitle: '再起動が必要です',
            restartPrompt: '更新を適用するにはアプリを再起動してください。',
            restartNow: '今すぐ再起動',
            restartLater: '後で再起動',
            noUpdates: '最新バージョンを使用しています',
            checking: '更新を確認中...',
            justUpdated: '{0} build {1} にアップデートしました'
        },
        
        // コンテキストメニュー
        contextMenu: {
            insertHere: 'この位置に挿入',
            deleteFrames: '行を削除',
            toggleDisableFrames: '行を無効化/有効化',
            shiftDownFromHere: 'コマをシフト',
            deleteContent: 'セル内容を削除',
            copy: 'コピー',
            cut: 'カット',
            paste: 'ペースト',
            loopSelection: 'この範囲をループ',
            renameSheet: '名前の変更',
            closeSheet: 'このシートを閉じる',
            closeAllSheets: 'すべてのシートを閉じる',
            insertColumn: '列を挿入',
            renameLayer: 'レイヤー名を変更',
            swapColumnLeft: '左の列と入れ替え',
            swapColumnRight: '右の列と入れ替え',
            deleteColumn: '列を削除',
            deleteColumnsAfter: 'この列以降を削除',
            copyRowValues: '行の値をコピー',
            cutRowValues: '行の値をカット',
            pasteRowValues: '行の値にペースト',
            copyColumnValues: '列の値をコピー',
            cutColumnValues: '列の値をカット',
            pasteColumnValues: '列の値にペースト'
        },
        
        // ダイアログ
        dialog: {
            title: 'タイムシート適用',
            selectLayer: '各レイヤーに適用する列を選択してください',
            frameInfo: '(シート最大コマ数/ソース枚数)',
            emptyCellMethod: '空セル処理方法',
            blindEffect: 'ブラインドエフェクト',
            timeRemap: 'タイムリマップ（コンポジションのみ）',
            addMarkers: 'タイムリマップの値をマーカーで追加する',
            markerOption: 'マーカーオプション',
            autoPrecompose: 'コンポジションに自動でプリコンポーズ',
            precomposeOption: 'プリコンポーズオプション',
            apply: '適用',
            cancel: 'キャンセル'
        },
        
        // エラーメッセージ
        error: {
            noLayers: 'コンポジションに適用できるレイヤーがありません',
            aeNotRunning: '起動中のAfter Effectsが見つかりませんでした',
            aeDesktopOnly: 'After EffectsとのAE連携機能はWindows版でのみ利用可能です。\nExtendScriptファイルとして保存し、After Effectsで手動実行してください。'
        },
        
        // ダイアログタイトル
        dialogTitle: {
            warning: '警告',
            error: 'エラー',
            info: '情報'
        },
        
        // 情報表示
        info: {
            hidden: '非表示',
            notApplicable: '適用なし',
            time: 'タイム',
            filePath: 'ファイル',
            cellInfo: 'セル情報',
            timeLabel: 'タイム:',
            ready: '準備完了',
            languageSwitching: '言語を日本語に切り替えました。ページをリロードします...',
            viewSettingsReset: '表示設定をデフォルトに戻しました'
        },
        
        // About & Credits
        about: {
            title: 'DiTiS - v2026.02.22',
            description: 'Digital Timesheet for Anime Production\nアニメ撮影向けのデジタルタイムシートアプリ\n\n開発: あかつきみさき (SUNRISE MOON)'
        },
        
        credits: {
            title: 'クレジット',
            description: 'あかつきみさき\nhttps://sunrisemoon.net/'
        },
        
        // ヘルプ
        help: {
            title: 'DiTiS - ヘルプ',
            numpad: {
                title: 'テンキー',
                keys: '1-9, 0',
                desc: '数字入力（自動で下に移動）'
            },
            editing: {
                title: '編集機能',
                enter: { key: 'Enter', desc: '確定して下に移動' },
                space: { key: 'Space', desc: '選択範囲を維持したままひとつ下に移動' },
                f2: { key: 'F2', desc: '選択セルの編集を開始' },
                dot: { key: '.（ドット）', desc: '最後のコマまで同じ値で埋める' },
                hyphen: { key: '-（ハイフン）', desc: 'ハイフンを入力' },
                plus: { key: '+（選択時）', desc: '直前の数値に+1した値を入力して下に移動' },
                minus: { key: '-（選択時）', desc: '直前の数値に-1した値を入力して上に移動' },
                asterisk: { key: '*（複数選択時）', desc: '選択範囲を1コマ下に伸ばす' },
                slash: { key: '/（複数選択時）', desc: '選択範囲を1コマ上に縮める' },
                wasd: { key: 'W/A/S/D（押下中）', desc: '選択範囲を上/左/下/右に調整' }
            },
            navigation: {
                title: 'ナビゲーション',
                arrows: { key: '矢印キー', desc: 'セル間を移動' },
                home: { key: 'Home', desc: '列の先頭に移動' },
                end: { key: 'End', desc: '列の末尾に移動' },
                escape: { key: 'Esc', desc: '選択範囲を解除して単一選択に戻す' }
            },
            selection: {
                title: '選択',
                shift: { key: 'Shift + 矢印', desc: '押下中: 選択範囲を上/左/下/右に拡張・縮小' },
                shiftHome: { key: 'Shift + Home', desc: '選択セルより上を全選択' },
                shiftEnd: { key: 'Shift + End', desc: '選択セルより下を全選択' },
                numbers: { key: '1-9, 0', desc: '該当列の1コマ目に移動' },
                ctrlEnter: { key: 'Ctrl + Enter', desc: '次の列の先頭に移動' }
            },
            fileOps: {
                title: 'ファイル操作',
                delete: { key: 'Delete', desc: '選択範囲のデータ削除' },
                undo: { key: 'Ctrl + Z', desc: '元に戻す (Undo)' },
                redo: { key: 'Ctrl + Y', desc: 'やり直し (Redo)' },
                new: { key: 'Ctrl + N', desc: '新規作成' },
                open: { key: 'Ctrl + O', desc: '開く' },
                save: { key: 'Ctrl + S', desc: '保存（現在のタブのみ）' },
                saveAs: { key: 'Ctrl + Shift + S', desc: '名前を付けて保存' },
                sendAE: { key: 'Ctrl + E', desc: 'After Effectsに送信' },
                exportJSX: { key: 'Ctrl + Shift + E', desc: 'ExtendScriptとして出力' },
                importAE: { key: 'Ctrl + I', desc: 'After Effectsからタイムリマップを取得' },
                close: { key: 'Ctrl + W', desc: '閉じる（現在のタブ）' }
            },
            display: {
                title: '表示',
                reload: { key: 'Ctrl + Shift + R', desc: 'ページを再読み込み' },
                help: { key: 'F1', desc: 'ヘルプを開く/閉じる' },
                escapeHelp: { key: 'Esc', desc: 'ヘルプを閉じる' }
            },
            mouse: {
                title: 'マウス操作',
                click: { key: 'クリック (セル)', desc: 'セルを選択' },
                doubleClick: { key: 'ダブルクリック (セル)', desc: '列全体を選択' },
                headerClick: { key: 'クリック (列ヘッダー)', desc: '列全体を選択' },
                headerDouble: { key: 'ダブルクリック (列ヘッダー)', desc: 'レイヤー名変更' },
                headerRight: { key: '右クリック (列ヘッダー)', desc: '列メニュー表示' },
                headerRightDouble: { key: '右ダブルクリック (列ヘッダー)', desc: 'AEキーフレームデータをクリップボードにコピー' },
                frameClick: { key: 'クリック (行ヘッダー)', desc: '行全体を選択' },
                frameDouble: { key: 'ダブルクリック (行ヘッダー)', desc: 'コマ番号ジャンプ' },
                frameRight: { key: '右クリック (行ヘッダー)', desc: '行メニュー表示' },
                tabDouble: { key: 'タブダブルクリック', desc: 'シート名変更' },
                tabDrag: { key: 'タブドラッグ', desc: 'タブ並び替え' },
                rightClick: { key: '右クリック', desc: 'コンテキストメニュー表示' }
            }
        },
        
        // ステータスバー
        status: {
            ready: '準備完了',
            time: 'タイム: {0}秒+{1}コマ ({2}f)',
            timeShort: 'タイム: {0}+{1} ({2}f)',
            cellSelected: '{0} | {1}セル選択中',
            cellsSelected: '{0}セル選択中',
            sheetInfo: '{0} | {1}レイヤー × {2}コマ | {3}fps'
        }
    },
    
    en: {
        // Application
        app: {
            title: 'DiTiS',
            version: 'v2026.02.22',
            newSheet: 'New Sheet'
        },
        menu: {
            // File menu
            file: {
                title: 'File',
                new: 'New (Ctrl+N)',
                open: 'Open (Ctrl+O)',
                loadSts: 'Load .sts',
                loadTdts: 'Load .tdts',
                save: 'Save (Ctrl+S)',
                saveAs: 'Save As (Ctrl+Shift+S)',
                saveSts: 'Save as .sts',
                exportJsx: 'Export as ExtendScript (Ctrl+Shift+E)',
                close: 'Close (Ctrl+W)',
                closeAll: 'Close All Sheets'
            },
            // Edit menu
            edit: {
                title: 'Edit',
                undo: 'Undo (Ctrl+Z)',
                redo: 'Redo (Ctrl+Y)',
                reopenLastFile: 'Restore Previous Session on Startup',
                aeKeyframeVersionChange: 'Change Keyframe Data Version for Copy',
                aeKeyframeVersionLabel: 'AE Version',
                aeKeyframeVersionHint: 'Current: {0} (e.g. 9.0)',
                aeKeyframeVersionPrompt: 'Enter version number (e.g. 9.0)\nCurrent: {0}',
                aeKeyframeVersionInvalid: 'Please enter a number (e.g. 9.0)',
                aeKeyframeVersionChanged: 'Keyframe data version changed to {0}'
            },
            // Sheet menu
            sheet: {
                title: 'Sheet',
                sheetSettings: 'Sheet Settings',
                changeDuration: 'Change Duration',
                changeFps: 'Change Frame Rate',
                changeColumns: 'Change Column Count',
                resetColumnNames: 'Reset Column Names',
                sendToAE: 'Send to After Effects (Ctrl+E)',
                clearSheet: 'Clear Sheet',
                showNewSheetDialog: 'Show Dialog on New Sheet'
            },
            // View menu
            view: {
                title: 'View',
                frameDisplay: 'Row Header: Show Frames',
                frameAll: 'Show All Frames',
                frameOdd: 'Odd Frames Only',
                frameEven: 'Even Frames Only',
                headerMode: 'Row Header: Format',
                headerModeDetail: 'Timesheet Style',
                headerModeSimple: 'Sequential Style',
                displaySize: 'Display Size',
                sizeXSmall: 'Extra Small',
                sizeSmall: 'Small',
                sizeNormal: 'Normal',
                sizeLarge: 'Large',
                sizeXLarge: 'Extra Large',
                language: 'Language',
                languageJa: '日本語',
                languageEn: 'English',
                theme: 'Theme',
                themeLight: 'Light Theme',
                themeDark: 'Dark Theme',
                themeGreen: 'Green Theme',
                alwaysOnTop: 'Always on Top',
                alwaysOnTopOn: 'Always on Top: ON',
                alwaysOnTopOff: 'Always on Top: OFF',
                resetView: 'Reset View Settings',
                intermediateHeaders: 'Show Frame Headers Between Columns: OFF'
            },
            // Help menu
            help: {
                title: 'Help',
                showHelp: 'Help',
                checkUpdates: 'Check for Updates',
                autoCheckUpdates: 'Check for updates on startup',
                about: 'About',
                website: 'Official Website',
                github: 'GitHub'
            },
            // Debug menu
            debug: {
                title: 'Debug',
                debugMode: 'Debug Mode',
                debugModeOn: 'Debug Mode: ON',
                debugModeOff: 'Debug Mode: OFF',
                exportLogs: 'Export Logs'
            },
            exportExtendScript: 'Export ExtendScript',
            exportToAE: 'Send to After Effects'
        },
        
        // Updater
        updater: {
            title: 'Update Available',
            available: 'is available.',
            currentVersion: 'Current version',
            releaseDate: 'Release date',
            downloadPrompt: 'Download and install this update?',
            downloadNow: 'Download Now',
            remindLater: 'Remind Later',
            ignoreTitle: 'Ignore This Update',
            ignorePrompt: 'Do you want to ignore version {0} updates?',
            ignoreVersion: 'Ignore This Update',
            ignoreSuccess: 'Added to ignore list',
            checkFailed: 'Failed to check for updates',
            noRelease: 'No releases found. This app may not have published releases yet.',
            installFailed: 'Failed to install update',
            installSuccess: 'Update downloaded successfully',
            restartTitle: 'Restart Required',
            restartPrompt: 'Please restart the app to apply the update.',
            restartNow: 'Restart Now',
            restartLater: 'Restart Later',
            noUpdates: 'You are using the latest version',
            checking: 'Checking for updates...',
            justUpdated: 'Updated to {0} build {1}'
        },
        
        // Context menu
        contextMenu: {
            insertHere: 'Insert Here',
            deleteFrames: 'Delete Row',
            toggleDisableFrames: 'Enable/Disable Row',
            shiftDownFromHere: 'Shift Frames Down',
            deleteContent: 'Delete Cell Content',
            copy: 'Copy',
            cut: 'Cut',
            paste: 'Paste',
            loopSelection: 'Loop This Selection',
            renameSheet: 'Rename',
            closeSheet: 'Close This Sheet',
            closeAllSheets: 'Close All Sheets',
            insertColumn: 'Insert Column',
            renameLayer: 'Rename Layer',
            swapColumnLeft: 'Swap with Left Column',
            swapColumnRight: 'Swap with Right Column',
            deleteColumn: 'Delete Column',
            deleteColumnsAfter: 'Delete This and Subsequent Columns',
            copyRowValues: 'Copy Row Values',
            cutRowValues: 'Cut Row Values',
            pasteRowValues: 'Paste Row Values',
            copyColumnValues: 'Copy Column Values',
            cutColumnValues: 'Cut Column Values',
            pasteColumnValues: 'Paste Column Values'
        },
        
        // Dialog
        dialog: {
            title: 'Apply Timesheet',
            selectLayer: 'Select column to apply for each layer',
            frameInfo: '(Sheet Max Frames/Source Frames)',
            emptyCellMethod: 'Empty Cell Processing',
            blindEffect: 'Venetian Blinds Effect',
            timeRemap: 'Time Remap (Compositions Only)',
            addMarkers: 'Add time remap values as markers',
            markerOption: 'Marker Option',
            autoPrecompose: 'Auto pre-compose into composition',
            precomposeOption: 'Pre-compose Option',
            apply: 'Apply',
            cancel: 'Cancel'
        },
        
        // Error messages
        error: {
            noLayers: 'No applicable layers in composition',
            aeNotRunning: 'No running After Effects found',
            aeDesktopOnly: 'After Effects integration is only available on Windows.\nPlease save as an ExtendScript file and run manually in After Effects.'
        },
        
        // Dialog titles
        dialogTitle: {
            warning: 'Warning',
            error: 'Error',
            info: 'Information'
        },
        
        // Info display
        info: {
            hidden: 'Hidden',
            notApplicable: 'Not Applicable',
            time: 'Time',
            filePath: 'File',
            cellInfo: 'Cell Info',
            timeLabel: 'Time:',
            ready: 'Ready',
            languageSwitching: 'Switching language to English. Reloading page...',
            viewSettingsReset: 'View settings have been reset to default'
        },
        
        // About & Credits
        about: {
            title: 'DiTiS - v2026.02.22',
            description: 'Digital Timesheet for Anime Production\nA digital timesheet app for anime production\n\nDeveloped by: Misaki Akatsuki (SUNRISE MOON)'
        },
        
        credits: {
            title: 'Credits',
            description: 'Misaki Akatsuki\nhttps://sunrisemoon.net/'
        },
        
        // Help
        help: {
            title: 'DiTiS - Help',
            numpad: {
                title: 'Numpad',
                keys: '1-9, 0',
                desc: 'Enter number (auto-move down)'
            },
            editing: {
                title: 'Editing',
                enter: { key: 'Enter', desc: 'Confirm and move down' },
                space: { key: 'Space', desc: 'Move down by one keeping selection' },
                f2: { key: 'F2', desc: 'Start editing selected cell' },
                dot: { key: '. (Dot)', desc: 'Fill same value to last frame' },
                hyphen: { key: '- (Hyphen)', desc: 'Enter hyphen' },
                plus: { key: '+ (When selected)', desc: 'Input previous value +1 and move down' },
                minus: { key: '- (When selected)', desc: 'Input previous value -1 and move up' },
                asterisk: { key: '* (Multi-selection)', desc: 'Extend selection down by 1 frame' },
                slash: { key: '/ (Multi-selection)', desc: 'Shrink selection up by 1 frame' },
                wasd: { key: 'W/A/S/D (While held)', desc: 'Adjust selection up/left/down/right' }
            },
            navigation: {
                title: 'Navigation',
                arrows: { key: 'Arrow Keys', desc: 'Move between cells' },
                home: { key: 'Home', desc: 'Move to top of column' },
                end: { key: 'End', desc: 'Move to bottom of column' },
                escape: { key: 'Esc', desc: 'Clear selection to single cell' }
            },
            selection: {
                title: 'Selection',
                shift: { key: 'Shift + Arrows', desc: 'While held: Extend/shrink selection' },
                shiftHome: { key: 'Shift + Home', desc: 'Select all above current cell' },
                shiftEnd: { key: 'Shift + End', desc: 'Select all below current cell' },
                numbers: { key: '1-9, 0', desc: 'Jump to frame 1 of column' },
                ctrlEnter: { key: 'Ctrl + Enter', desc: 'Move to top of next column' }
            },
            fileOps: {
                title: 'File Operations',
                delete: { key: 'Delete', desc: 'Delete selection' },
                undo: { key: 'Ctrl + Z', desc: 'Undo' },
                redo: { key: 'Ctrl + Y', desc: 'Redo' },
                new: { key: 'Ctrl + N', desc: 'New sheet' },
                open: { key: 'Ctrl + O', desc: 'Open' },
                save: { key: 'Ctrl + S', desc: 'Save (current tab)' },
                saveAs: { key: 'Ctrl + Shift + S', desc: 'Save As' },
                sendAE: { key: 'Ctrl + E', desc: 'Send to After Effects' },
                exportJSX: { key: 'Ctrl + Shift + E', desc: 'Export as ExtendScript' },
                importAE: { key: 'Ctrl + I', desc: 'Get timeremap from AE' },
                close: { key: 'Ctrl + W', desc: 'Close (current tab)' }
            },
            display: {
                title: 'Display',
                reload: { key: 'Ctrl + Shift + R', desc: 'Reload page' },
                help: { key: 'F1', desc: 'Open/Close help' },
                escapeHelp: { key: 'Esc', desc: 'Close help' }
            },
            mouse: {
                title: 'Mouse Operations',
                click: { key: 'Click (Cell)', desc: 'Select cell' },
                doubleClick: { key: 'Double-click (Cell)', desc: 'Select entire column' },
                headerClick: { key: 'Click (Column Header)', desc: 'Select entire column' },
                headerDouble: { key: 'Double-click (Column Header)', desc: 'Rename layer' },
                headerRight: { key: 'Right-click (Column Header)', desc: 'Show column menu' },
                headerRightDouble: { key: 'Right double-click (Column Header)', desc: 'Copy AE keyframe data to clipboard' },
                frameClick: { key: 'Click (Row Header)', desc: 'Select entire row' },
                frameDouble: { key: 'Double-click (Row Header)', desc: 'Jump to frame number' },
                frameRight: { key: 'Right-click (Row Header)', desc: 'Show row menu' },
                tabDouble: { key: 'Tab Double-click', desc: 'Rename sheet' },
                tabDrag: { key: 'Tab Drag', desc: 'Reorder tabs' },
                rightClick: { key: 'Right-click', desc: 'Show context menu' }
            }
        },
        
        // Status bar
        status: {
            ready: 'Ready',
            time: 'Time: {0}sec+{1}frames ({2}f)',
            timeShort: 'Time: {0}+{1} ({2}f)',
            cellSelected: '{0} | {1} cell(s) selected',
            cellsSelected: '{0} cell(s) selected',
            sheetInfo: '{0} | {1} layers × {2} frames | {3}fps'
        }
    }
};

/**
 * 現在の言語を取得
 * @returns {string} 'ja' または 'en'
 */
function getCurrentLanguage() {
    const savedLang = localStorage.getItem('komas-language');
    
    if (savedLang && (savedLang === 'ja' || savedLang === 'en')) {
        return savedLang;
    }
    
    // ブラウザの言語設定から判定
    const browserLang = navigator.language || navigator.userLanguage;
    const detectedLang = browserLang.startsWith('ja') ? 'ja' : 'en';
    return detectedLang;
}

/**
 * 言語を設定
 * @param {string} lang 'ja' または 'en'
 */
function setLanguage(lang) {
    if (lang === 'ja' || lang === 'en') {
        localStorage.setItem('komas-language', lang);
        return true;
    }
    console.warn('[setLanguage] 無効な言語:', lang);
    return false;
}

/**
 * 翻訳テキストを取得
 * @param {string} key ドット区切りのキー（例: 'dialog.title'）
 * @param {...string} args 置換用の引数
 * @returns {string} 翻訳されたテキスト
 */
function t(key, ...args) {
    const lang = getCurrentLanguage();
    const keys = key.split('.');
    let text = i18n[lang];
    
    for (const k of keys) {
        if (text && typeof text === 'object') {
            text = text[k];
        } else {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }
    }
    
    if (typeof text !== 'string') {
        console.warn(`Translation value is not a string: ${key}`);
        return key;
    }
    
    // プレースホルダーを置換 {0}, {1}, etc.
    let result = text;
    args.forEach((arg, index) => {
        result = result.replace(new RegExp(`\\{${index}\\}`, 'g'), arg);
    });
    
    return result;
}

/**
 * ExtendScript用の多言語テキストを生成
 * @param {string} lang 言語コード
 * @returns {string} ExtendScript用のJavaScriptコード
 */
function generateExtendScriptI18n(lang = 'ja') {
    const allTexts = i18n[lang] || i18n.ja;
    
    // ExtendScriptで実際に使用されるキーだけを抽出
    const texts = {
        dialog: allTexts.dialog,
        info: {
            hidden: allTexts.info.hidden,
            notApplicable: allTexts.info.notApplicable
        },
        error: allTexts.error
    };
    
    let code = '  // 多言語テキスト定義\n';
    code += `  var i18n = ${JSON.stringify(texts, null, 2).replace(/^/gm, '  ')};\n`;
    code += '  \n';
    return code;
}

/**
 * ヘルプダイアログのHTMLを生成
 * @returns {string} ヘルプダイアログのHTML
 */
function generateHelpHTML() {
    const lang = getCurrentLanguage();
    const help = i18n[lang].help;
    
    let html = `
        <h2>${help.title}</h2>
        
        <div class="help-section">
            <h3>${help.numpad.title}</h3>
            <div class="shortcut-list">
                <div class="shortcut-item">
                    <span class="shortcut-key">${help.numpad.keys}</span>
                    <span class="shortcut-desc">${help.numpad.desc}</span>
                </div>
            </div>
        </div>
        
        <div class="help-section">
            <h3>${help.editing.title}</h3>
            <div class="shortcut-list">
                ${Object.entries(help.editing).filter(([k]) => k !== 'title').map(([_, v]) => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${v.key}</span>
                        <span class="shortcut-desc">${v.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="help-section">
            <h3>${help.navigation.title}</h3>
            <div class="shortcut-list">
                ${Object.entries(help.navigation).filter(([k]) => k !== 'title').map(([_, v]) => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${v.key}</span>
                        <span class="shortcut-desc">${v.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="help-section">
            <h3>${help.selection.title}</h3>
            <div class="shortcut-list">
                ${Object.entries(help.selection).filter(([k]) => k !== 'title').map(([_, v]) => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${v.key}</span>
                        <span class="shortcut-desc">${v.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="help-section">
            <h3>${help.fileOps.title}</h3>
            <div class="shortcut-list">
                ${Object.entries(help.fileOps).filter(([k]) => k !== 'title').map(([_, v]) => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${v.key}</span>
                        <span class="shortcut-desc">${v.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="help-section">
            <h3>${help.display.title}</h3>
            <div class="shortcut-list">
                ${Object.entries(help.display).filter(([k]) => k !== 'title').map(([_, v]) => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${v.key}</span>
                        <span class="shortcut-desc">${v.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="help-section">
            <h3>${help.mouse.title}</h3>
            <div class="shortcut-list">
                ${Object.entries(help.mouse).filter(([k]) => k !== 'title').map(([_, v]) => `
                    <div class="shortcut-item">
                        <span class="shortcut-key">${v.key}</span>
                        <span class="shortcut-desc">${v.desc}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    return html;
}

/**
 * ページ内のすべてのテキストを現在の言語で更新
 * data-i18n属性を持つ要素を検索して翻訳を適用
 */
function updateAllUIText() {
    const currentLang = getCurrentLanguage();
    
    const elements = document.querySelectorAll('[data-i18n]');
    
    let updateCount = 0;
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        
        // 最初の3つの要素だけログ出力
        if (AppState.debugMode && updateCount < 3) {
            console.log(`[updateAllUIText] 要素 ${updateCount + 1}: key="${key}", text="${text}", element:`, el);
        }
        
        // テキストノードを更新（チェックマークなどを保持）
        if (el.hasAttribute('data-i18n-text')) {
            el.textContent = text;
        } else {
            // 子要素がある場合は最初のテキストノードのみ更新
            const textNode = Array.from(el.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = text;
            } else {
                el.textContent = text;
            }
        }
        updateCount++;
    });
    
    
    // title属性の更新
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.title = t(key);
    });
    
    // placeholder属性の更新
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { i18n, getCurrentLanguage, setLanguage, t, generateExtendScriptI18n, generateHelpHTML, updateAllUIText };
}

// ブラウザ環境でwindow.i18nとして公開
window.i18n = { t };
