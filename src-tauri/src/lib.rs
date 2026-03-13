use tauri::menu::{MenuBuilder, SubmenuBuilder, MenuItemBuilder, PredefinedMenuItem, CheckMenuItemBuilder, CheckMenuItem};
use tauri::{Manager, Runtime, Emitter};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// メニューテキスト定義
struct MenuTexts {
    file: String,
    file_new: String,
    file_open: String,
    file_save: String,
    file_save_as: String,
    file_export_jsx: String,
    file_close: String,
    file_close_all: String,
    file_print: String,
    file_quit: String,
    file_recent: String,
    file_recent_empty: String,
    file_clear_recent: String,
    edit: String,
    edit_undo: String,
    edit_redo: String,
    sheet: String,
    sheet_settings: String,
    sheet_change_duration: String,
    sheet_change_fps: String,
    sheet_change_frame_page: String,
    sheet_change_columns: String,
    sheet_reset_column_names: String,
    sheet_send_to_ae: String,
    sheet_get_from_ae: String,
    sheet_clear: String,
    view: String,
    view_reload: String,
    view_frame_display: String,
    view_frame_all: String,
    view_frame_odd: String,
    view_frame_even: String,
    view_header_mode: String,
    view_header_detail: String,
    view_header_simple: String,
    view_display_size: String,
    view_size_xsmall: String,
    view_size_small: String,
    view_size_normal: String,
    view_size_large: String,
    view_size_xlarge: String,
    view_language: String,
    view_language_ja: String,
    view_language_en: String,
    view_reset: String,
    view_theme: String,
    view_theme_light: String,
    view_theme_dark: String,
    view_theme_green: String,
    view_always_on_top: String,
    view_auto_scroll: String,
    sheet_new_sheet_dialog: String,
    edit_reopen_last_file: String,
    edit_ae_keyframe_version_change: String,
    view_intermediate_headers: String,
    edit_numeric_key_mode: String,
    edit_numeric_key_auto: String,
    edit_numeric_key_column: String,
    edit_numeric_key_input: String,
    edit_copy_keyframe_mode: String,
    edit_copy_keyframe_sparse: String,
    edit_copy_keyframe_all_frames: String,
    edit_empty_cell_mode: String,
    view_empty_cell_mode: String,
    sheet_ae_multi_instance_mode: String,
    #[allow(dead_code)]
    edit_ae_settings: String,
    #[allow(dead_code)]
    edit_ae_empty_blind: String,
    #[allow(dead_code)]
    edit_ae_empty_timeremap: String,
    help: String,
    help_show: String,
    help_check_updates: String,
    help_auto_check_updates: String,
    help_about: String,
    help_website: String,
    help_github: String,
    help_releases: String,
    #[allow(dead_code)]
    debug: String,
    #[allow(dead_code)]
    debug_mode: String,
    #[allow(dead_code)]
    debug_export_logs: String,
}

impl MenuTexts {
    fn new(lang: &str) -> Self {
        if lang == "en" {
            Self {
                file: "File".to_string(),
                file_new: "New".to_string(),
                file_open: "Open".to_string(),
                file_save: "Save".to_string(),
                file_save_as: "Save As...".to_string(),
                file_export_jsx: "Export as ExtendScript".to_string(),
                file_close: "Close".to_string(),
                file_close_all: "Close All Sheets".to_string(),
                file_print: "Print...".to_string(),
                file_quit: "Quit".to_string(),
                file_recent: "Open Recent Files".to_string(),
                file_recent_empty: "No Recent Files".to_string(),
                file_clear_recent: "Clear Recent Files".to_string(),
                edit: "Edit".to_string(),
                edit_undo: "Undo".to_string(),
                edit_redo: "Redo".to_string(),
                sheet: "Sheet".to_string(),
                sheet_settings: "Sheet Settings".to_string(),
                sheet_change_duration: "Change Duration".to_string(),
                sheet_change_fps: "Change Frame Rate".to_string(),
                sheet_change_frame_page: "Change Frames per Page".to_string(),
                sheet_change_columns: "Change Column Count".to_string(),
                sheet_reset_column_names: "Reset Column Names".to_string(),
                sheet_send_to_ae: "Send to After Effects".to_string(),
                sheet_get_from_ae: "Get Time Remap from AE".to_string(),
                sheet_clear: "Clear Sheet".to_string(),
                view: "View".to_string(),
                view_reload: "Reload Page".to_string(),
                view_frame_display: "Row Header: Frames".to_string(),
                view_frame_all: "All Frames".to_string(),
                view_frame_odd: "Odd Frames Only".to_string(),
                view_frame_even: "Even Frames Only".to_string(),
                view_header_mode: "Row Header: Format".to_string(),
                view_header_detail: "Timesheet Mode".to_string(),
                view_header_simple: "Sequential Mode".to_string(),
                view_display_size: "Display Size".to_string(),
                view_size_xsmall: "Extra Small".to_string(),
                view_size_small: "Small".to_string(),
                view_size_normal: "Normal".to_string(),
                view_size_large: "Large".to_string(),
                view_size_xlarge: "Extra Large".to_string(),
                view_language: "Language".to_string(),
                view_language_ja: "日本語".to_string(),
                view_language_en: "English".to_string(),
                view_reset: "Reset View Settings".to_string(),
                view_theme: "Theme".to_string(),
                view_theme_light: "Light Theme".to_string(),
                view_theme_dark: "Dark Theme".to_string(),
                view_theme_green: "Green Theme".to_string(),
                view_always_on_top: "Always on Top".to_string(),
                view_auto_scroll: "Center Selection on Scroll".to_string(),
                sheet_new_sheet_dialog: "Show Dialog on New Sheet".to_string(),
                edit_reopen_last_file: "Restore Previous Session on Startup".to_string(),
                edit_ae_keyframe_version_change: "Change Keyframe Data Version for Copy".to_string(),
                view_intermediate_headers: "Show Frame Headers Between Columns".to_string(),
                edit_numeric_key_mode: "Number Key Behavior".to_string(),
                edit_numeric_key_auto: "Auto (NumLock-linked)".to_string(),
                edit_numeric_key_column: "Column Select".to_string(),
                edit_numeric_key_input: "Number Input".to_string(),
                edit_copy_keyframe_mode: "Copy Keyframe Output".to_string(),
                edit_copy_keyframe_sparse: "Changes Only".to_string(),
                edit_copy_keyframe_all_frames: "All Frames".to_string(),
                edit_empty_cell_mode: String::new(),
                view_empty_cell_mode: "Insert × Mark for Empty Cells".to_string(),
                sheet_ae_multi_instance_mode: "Support Multiple AE Instances (Launch with -m)".to_string(),
                edit_ae_settings: "AE Export Settings".to_string(),
                edit_ae_empty_blind: "Empty Cell: Venetian Blinds".to_string(),
                edit_ae_empty_timeremap: "Empty Cell: Time Remap".to_string(),
                help: "Help".to_string(),
                help_show: "Help".to_string(),
                help_check_updates: "Check for Updates".to_string(),
                help_auto_check_updates: "Check for updates on startup".to_string(),
                help_about: "About".to_string(),
                help_website: "Official Website".to_string(),
                help_github: "GitHub".to_string(),
                help_releases: "Download Previous Versions".to_string(),
                debug: "Debug".to_string(),
                debug_mode: "Debug Mode".to_string(),
                debug_export_logs: "Export Logs".to_string(),
            }
        } else {
            // 日本語（デフォルト）
            Self {
                file: "ファイル".to_string(),
                file_new: "新規作成".to_string(),
                file_open: "開く".to_string(),
                file_save: "保存".to_string(),
                file_save_as: "名前を付けて保存...".to_string(),
                file_export_jsx: "ExtendScriptとして出力".to_string(),
                file_close: "閉じる".to_string(),
                file_close_all: "すべてのシートを閉じる".to_string(),
                file_print: "印刷...".to_string(),
                file_quit: "終了".to_string(),
                file_recent: "最近使用したファイルを開く".to_string(),
                file_recent_empty: "最近使用したファイルはありません".to_string(),
                file_clear_recent: "履歴をクリア".to_string(),
                edit: "編集".to_string(),
                edit_undo: "元に戻す".to_string(),
                edit_redo: "やり直し".to_string(),
                sheet: "シート".to_string(),
                sheet_settings: "シート設定".to_string(),
                sheet_change_duration: "尺を変更".to_string(),
                sheet_change_fps: "フレームレートを変更".to_string(),
                sheet_change_frame_page: "ページ辺りのコマ数を変更".to_string(),
                sheet_change_columns: "列数を変更".to_string(),
                sheet_reset_column_names: "列名を初期化".to_string(),
                sheet_send_to_ae: "After Effectsに送信".to_string(),
                sheet_get_from_ae: "After Effectsからタイムリマップを取得".to_string(),
                sheet_clear: "シートを初期化".to_string(),
                view: "表示".to_string(),
                view_reload: "ページを再読み込み".to_string(),
                view_frame_display: "行ヘッダー：表示するコマ".to_string(),
                view_frame_all: "すべてのコマ".to_string(),
                view_frame_odd: "奇数コマのみ".to_string(),
                view_frame_even: "偶数コマのみ".to_string(),
                view_header_mode: "行ヘッダー：表示形式".to_string(),
                view_header_detail: "タイムシート式".to_string(),
                view_header_simple: "通し番号式".to_string(),
                view_display_size: "表示サイズ".to_string(),
                view_size_xsmall: "極小".to_string(),
                view_size_small: "小".to_string(),
                view_size_normal: "標準".to_string(),
                view_size_large: "大".to_string(),
                view_size_xlarge: "特大".to_string(),
                view_language: "言語 / Language".to_string(),
                view_language_ja: "日本語".to_string(),
                view_language_en: "English".to_string(),
                view_reset: "表示設定をリセット".to_string(),
                view_theme: "テーマ".to_string(),
                view_theme_light: "ライトテーマ".to_string(),
                view_theme_dark: "ダークテーマ".to_string(),
                view_theme_green: "グリーンテーマ".to_string(),
                view_always_on_top: "常に前面に表示".to_string(),
                view_auto_scroll: "スクロール時に選択を中央表示".to_string(),
                sheet_new_sheet_dialog: "新規シート作成時にダイアログを表示".to_string(),
                edit_reopen_last_file: "起動時に前回のシート状態を復元する".to_string(),
                edit_ae_keyframe_version_change: "コピーするキーフレームデータのバージョンを変更".to_string(),
                view_intermediate_headers: "列間にコマヘッダーを表示".to_string(),
                edit_numeric_key_mode: "数字キーの動作".to_string(),
                edit_numeric_key_auto: "自動（NumLock連動）".to_string(),
                edit_numeric_key_column: "列選択".to_string(),
                edit_numeric_key_input: "数値入力".to_string(),
                edit_copy_keyframe_mode: "コピーキーフレームの出力".to_string(),
                edit_copy_keyframe_sparse: "変化点のみ".to_string(),
                edit_copy_keyframe_all_frames: "全フレーム".to_string(),
                edit_empty_cell_mode: String::new(),
                view_empty_cell_mode: "空セルに×マークを表示".to_string(),
                sheet_ae_multi_instance_mode: "複数インスタンス起動に対応する".to_string(),
                edit_ae_settings: "AE送信設定".to_string(),
                edit_ae_empty_blind: "空セル: ブラインドエフェクト".to_string(),
                edit_ae_empty_timeremap: "空セル: タイムリマップ".to_string(),
                help: "ヘルプ".to_string(),
                help_show: "ヘルプ".to_string(),
                help_check_updates: "更新を確認".to_string(),
                help_auto_check_updates: "起動時に更新を確認".to_string(),
                help_about: "このソフトについて".to_string(),
                help_website: "公式サイト".to_string(),
                help_github: "GitHub".to_string(),
                help_releases: "過去バージョンをダウンロード".to_string(),
                debug: "デバッグ".to_string(),
                debug_mode: "デバッグモード".to_string(),
                debug_export_logs: "ログを出力".to_string(),
            }
        }
    }
}

// グローバルなメニューアイテム参照を保存
struct MenuItems<R: Runtime> {
    items: Mutex<HashMap<String, CheckMenuItem<R>>>,
}

impl<R: Runtime> MenuItems<R> {
    fn new() -> Self {
        Self {
            items: Mutex::new(HashMap::new()),
        }
    }

    fn insert(&self, id: String, item: CheckMenuItem<R>) {
        self.items.lock().unwrap().insert(id, item);
    }

    fn get(&self, id: &str) -> Option<CheckMenuItem<R>> {
        self.items.lock().unwrap().get(id).cloned()
    }
}


/// ファイルパスの拡張子を検証（許可された拡張子のみ）
fn validate_file_path(path: &str) -> Result<(), String> {
    let allowed_extensions = [".ditis", ".json", ".sts", ".tdts", ".xdts", ".jsx"];
    let path_lower = path.to_lowercase();
    if !allowed_extensions.iter().any(|ext| path_lower.ends_with(ext)) {
        return Err(format!("許可されていないファイル形式です: {}", path));
    }
    // パストラバーサル防止（".." コンポーネントを含むパスを拒否）
    let p = std::path::Path::new(path);
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err("不正なパスが含まれています".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
async fn save_file(path: String, contents: String) -> Result<(), String> {
    validate_file_path(&path)?;
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_file(path: String) -> Result<String, String> {
    validate_file_path(&path)?;
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_binary_file(path: String) -> Result<Vec<u8>, String> {
    validate_file_path(&path)?;
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_binary_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    validate_file_path(&path)?;
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
async fn show_in_folder(path: String) -> Result<(), String> {
    // パスが空でないか、存在するかを検証
    if path.is_empty() {
        return Err("パスが空です".to_string());
    }
    let p = std::path::Path::new(&path);
    for component in p.components() {
        if let std::path::Component::ParentDir = component {
            return Err("不正なパスが含まれています".to_string());
        }
    }
    if !p.exists() {
        return Err(format!("パスが存在しません: {}", path));
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new(&path)))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn update_menu_item_check(app: tauri::AppHandle<tauri::Wry>, menu_id: String, checked: bool) -> Result<(), String> {
    // アプリの状態からメニューアイテムを取得（Arc<MenuItems>として登録されている）
    let menu_items = app.state::<Arc<MenuItems<tauri::Wry>>>();
    
    // 排他的チェック処理（ラジオボタン的な動作）
    // checkedがtrueの場合、同じグループの他のアイテムをfalseにする
    if checked {
        // フレームフィルターメニューの排他的チェック処理
        if menu_id.starts_with("frame-filter-") {
            if let Some(item) = menu_items.get("frame-filter-all") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("frame-filter-odd") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("frame-filter-even") {
                let _ = item.set_checked(false);
            }
        }
        
        // ヘッダーモードメニューの排他的チェック処理
        if menu_id.starts_with("header-mode-") {
            if let Some(item) = menu_items.get("header-mode-detail") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("header-mode-simple") {
                let _ = item.set_checked(false);
            }
        }
        
        // フォントサイズメニューの排他的チェック処理
        if menu_id.starts_with("font-size-") {
            if let Some(item) = menu_items.get("font-size-xsmall") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("font-size-small") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("font-size-normal") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("font-size-large") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("font-size-xlarge") {
                let _ = item.set_checked(false);
            }
        }
        
        // テーマメニューの排他的チェック処理
        if menu_id.starts_with("theme-") {
            if let Some(item) = menu_items.get("theme-light") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("theme-dark") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("theme-green") {
                let _ = item.set_checked(false);
            }
        }
        
        // 言語メニューの排他的チェック処理
        if menu_id.starts_with("language-") {
            if let Some(item) = menu_items.get("language-ja") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("language-en") {
                let _ = item.set_checked(false);
            }
        }
        
        // 数字キーモードメニューの排他的チェック処理
        if menu_id.starts_with("numeric-key-mode-") {
            if let Some(item) = menu_items.get("numeric-key-mode-auto") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("numeric-key-mode-column") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("numeric-key-mode-input") {
                let _ = item.set_checked(false);
            }
        }
        
        // コピーキーフレームモードメニューの排他的チェック処理
        if menu_id.starts_with("copy-keyframe-mode-") {
            if let Some(item) = menu_items.get("copy-keyframe-mode-sparse") {
                let _ = item.set_checked(false);
            }
            if let Some(item) = menu_items.get("copy-keyframe-mode-all-frames") {
                let _ = item.set_checked(false);
            }
        }
    }
    
    if let Some(item) = menu_items.get(&menu_id) {
        item.set_checked(checked).map_err(|e| e.to_string())?;
    } else {
        let err_msg = format!("Menu item not found: {}", menu_id);
        eprintln!("{}", err_msg);
        return Err(err_msg);
    }
    
    Ok(())
}

// Updater commands
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    use tauri_plugin_updater::UpdaterExt;
    
    match app.updater().map_err(|e| e.to_string())?.check().await {
        Ok(Some(update)) => {
            Ok(serde_json::json!({
                "available": true,
                "version": update.version,
                "date": update.date.map(|d| d.to_string()),
                "body": update.body
            }))
        },
        Ok(None) => {
            Ok(serde_json::json!({
                "available": false
            }))
        },
        Err(e) => Err(format!("Failed to check for updates: {}", e))
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    
    // Note: check() is called again here because the Update object cannot be
    // serialized across IPC. The window between check_for_updates and this call
    // is typically short, so version mismatch risk is minimal.
    match app.updater().map_err(|e| e.to_string())?.check().await {
        Ok(Some(update)) => {
            let app_clone = app.clone();
            update.download_and_install(move |chunk, total| {
                if let Err(e) = app_clone.emit("update-download-progress", serde_json::json!({
                    "downloaded": chunk,
                    "total": total
                })) {
                    eprintln!("[Updater] update-download-progress emit失敗: {}", e);
                }
            }, || {
                // Download completed
            })
            .await
            .map_err(|e| format!("Failed to install update: {}", e))?;
            
            Ok(())
        },
        Ok(None) => Err("No update available".to_string()),
        Err(e) => Err(format!("Failed to check for updates: {}", e))
    }
}

#[tauri::command]
fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn rebuild_menu(
    app: tauri::AppHandle<tauri::Wry>, 
    lang: String,
    theme: String,
    frame_filter: String,
    header_mode: String,
    font_size: u32,
    _debug_mode: bool,
    always_on_top: bool,
    auto_scroll: bool,
    show_new_sheet_dialog: bool,
    show_intermediate_headers: bool,
    reopen_last_file: bool,
    numeric_key_mode: String,
    copy_keyframe_mode: String,
    empty_cell_mode: bool,
    ae_multi_instance_mode: bool,
    recent_files: Vec<String>
) -> Result<(), String> {
    eprintln!("[rebuild_menu] 開始: lang={}, theme={}, frame_filter={}, header_mode={}, font_size={}, auto_scroll={}, show_new_sheet_dialog={}, show_intermediate_headers={}", 
        lang, theme, frame_filter, header_mode, font_size, auto_scroll, show_new_sheet_dialog, show_intermediate_headers);
    
    let texts = MenuTexts::new(&lang);
    let _window = app.get_webview_window("main").ok_or("Window not found")?;
    
    // MenuItemsへの参照を取得（Arc<MenuItems>として登録されている）
    let menu_items_state = app.try_state::<Arc<MenuItems<tauri::Wry>>>();
    
    eprintln!("[rebuild_menu] メニューを再構築（MenuItems: {}）", 
        if menu_items_state.is_some() { "更新あり" } else { "更新なし" });
    
    // CheckMenuItemを作成するヘルパークロージャ
    let create_check_item = |id: &str, label: &str, checked: bool| -> Result<CheckMenuItem<tauri::Wry>, String> {
        let item = CheckMenuItemBuilder::new(label).id(id).checked(checked).build(&app).map_err(|e| e.to_string())?;
        // MenuItemsが登録されていれば保存
        if let Some(ref menu_items) = menu_items_state {
            menu_items.insert(id.to_string(), item.clone());
            eprintln!("[rebuild_menu] メニューアイテム作成・保存: {} = {}", id, checked);
        } else {
            eprintln!("[rebuild_menu] メニューアイテム作成: {} = {}", id, checked);
        }
        Ok(item)
    };
    
    // 「最近使用したファイル」サブメニューを構築
    let recent_submenu = {
        let mut b = SubmenuBuilder::new(&app, &texts.file_recent);
        if recent_files.is_empty() {
            b = b.item(&MenuItemBuilder::new(&texts.file_recent_empty).id("recent-file-empty").build(&app).map_err(|e| e.to_string())?);
        } else {
            for (i, path) in recent_files.iter().enumerate().take(10) {
                let filename = path.split(['/', '\\']).last().unwrap_or(path.as_str()).to_string();
                let label = format!("{}. {}", i + 1, filename);
                let id = format!("recent-file-{}", i);
                b = b.item(&MenuItemBuilder::new(&label).id(&id).build(&app).map_err(|e| e.to_string())?);
            }
            b = b.separator().item(&MenuItemBuilder::new(&texts.file_clear_recent).id("clear-recent-files").build(&app).map_err(|e| e.to_string())?);
        }
        b.build().map_err(|e| e.to_string())?
    };

    // メニューを再構築
    let menu = MenuBuilder::new(&app)
        // ファイルメニュー
        .item(&SubmenuBuilder::new(&app, &texts.file)
          .item(&MenuItemBuilder::new(&texts.file_new).id("new-sheet").accelerator("Ctrl+N").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.file_open).id("open-file").accelerator("Ctrl+O").build(&app).map_err(|e| e.to_string())?)
          .item(&recent_submenu)
          .separator()
          .item(&MenuItemBuilder::new(&texts.file_save).id("save-file").accelerator("Ctrl+S").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.file_save_as).id("save-as-file").accelerator("Ctrl+Shift+S").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.file_export_jsx).id("export-jsx").accelerator("Ctrl+Shift+E").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.file_close).id("close-file").accelerator("Ctrl+W").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.file_close_all).id("close-all-sheets").accelerator("Ctrl+Shift+W").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.file_print).id("print-sheet").accelerator("Ctrl+P").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&PredefinedMenuItem::quit(&app, Some(&texts.file_quit)).map_err(|e| e.to_string())?)
          .build().map_err(|e| e.to_string())?)
        // 編集メニュー
        .item(&SubmenuBuilder::new(&app, &texts.edit)
          .item(&MenuItemBuilder::new(&texts.edit_undo).id("undo").accelerator("Ctrl+Z").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.edit_redo).id("redo").accelerator("Ctrl+Y").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&create_check_item("reopen-last-file", &texts.edit_reopen_last_file, reopen_last_file)?)
          .item(&MenuItemBuilder::new(&texts.edit_ae_keyframe_version_change).id("change-ae-keyframe-version").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&SubmenuBuilder::new(&app, &texts.edit_numeric_key_mode)
            .item(&create_check_item("numeric-key-mode-auto", &texts.edit_numeric_key_auto, numeric_key_mode == "auto")?)
            .item(&create_check_item("numeric-key-mode-column", &texts.edit_numeric_key_column, numeric_key_mode == "column-select")?)
            .item(&create_check_item("numeric-key-mode-input", &texts.edit_numeric_key_input, numeric_key_mode == "number-input")?)
            .build().map_err(|e| e.to_string())?)
          .item(&SubmenuBuilder::new(&app, &texts.edit_copy_keyframe_mode)
            .item(&create_check_item("copy-keyframe-mode-sparse", &texts.edit_copy_keyframe_sparse, copy_keyframe_mode == "sparse" || copy_keyframe_mode.is_empty())?)
            .item(&create_check_item("copy-keyframe-mode-all-frames", &texts.edit_copy_keyframe_all_frames, copy_keyframe_mode == "all-frames")?)
            .build().map_err(|e| e.to_string())?)
          .build().map_err(|e| e.to_string())?)
        // シートメニュー
        .item(&SubmenuBuilder::new(&app, &texts.sheet)
          .item(&MenuItemBuilder::new(&texts.sheet_send_to_ae).id("send-to-ae").accelerator("Ctrl+E").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.sheet_get_from_ae).id("get-from-ae").accelerator("Ctrl+I").build(&app).map_err(|e| e.to_string())?)
          .item(&create_check_item("ae-multi-instance-mode", &texts.sheet_ae_multi_instance_mode, ae_multi_instance_mode)?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.sheet_settings).id("sheet-settings").accelerator("Ctrl+,").build(&app).map_err(|e| e.to_string())?)
          .item(&create_check_item("show-new-sheet-dialog", &texts.sheet_new_sheet_dialog, show_new_sheet_dialog)?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.sheet_change_duration).id("change-duration").accelerator("Ctrl+Shift+D").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.sheet_change_fps).id("change-fps").accelerator("Ctrl+Shift+F").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.sheet_change_frame_page).id("change-frame-page").accelerator("Ctrl+Shift+P").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.sheet_change_columns).id("change-max-columns").accelerator("Ctrl+Shift+C").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.sheet_reset_column_names).id("reset-column-names").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.sheet_clear).id("clear-sheet").build(&app).map_err(|e| e.to_string())?)
          .build().map_err(|e| e.to_string())?)
        // 表示メニュー
        .item(&SubmenuBuilder::new(&app, &texts.view)
          .item(&create_check_item("auto-scroll", &texts.view_auto_scroll, auto_scroll)?)
          .item(&create_check_item("always-on-top", &texts.view_always_on_top, always_on_top)?)
          .separator()
          .item(&SubmenuBuilder::new(&app, &texts.view_frame_display)
            .item(&create_check_item("frame-filter-all", &texts.view_frame_all, frame_filter == "all")?)
            .item(&create_check_item("frame-filter-odd", &texts.view_frame_odd, frame_filter == "odd")?)
            .item(&create_check_item("frame-filter-even", &texts.view_frame_even, frame_filter == "even")?)
            .build().map_err(|e| e.to_string())?)
          .item(&SubmenuBuilder::new(&app, &texts.view_header_mode)
            .item(&create_check_item("header-mode-detail", &texts.view_header_detail, header_mode == "detail")?)
            .item(&create_check_item("header-mode-simple", &texts.view_header_simple, header_mode == "simple")?)
            .build().map_err(|e| e.to_string())?)
          .separator()
          .item(&create_check_item("toggle-intermediate-headers", &texts.view_intermediate_headers, show_intermediate_headers)?)
          .item(&create_check_item("empty-cell-mode", &texts.view_empty_cell_mode, empty_cell_mode)?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.view_reset).id("reset-view-settings").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&SubmenuBuilder::new(&app, &texts.view_display_size)
            .item(&create_check_item("font-size-xsmall", &texts.view_size_xsmall, font_size == 8)?)
            .item(&create_check_item("font-size-small", &texts.view_size_small, font_size == 10)?)
            .item(&create_check_item("font-size-normal", &texts.view_size_normal, font_size == 12)?)
            .item(&create_check_item("font-size-large", &texts.view_size_large, font_size == 14)?)
            .item(&create_check_item("font-size-xlarge", &texts.view_size_xlarge, font_size == 16)?)
            .build().map_err(|e| e.to_string())?)
          .item(&SubmenuBuilder::new(&app, &texts.view_theme)
            .item(&create_check_item("theme-light", &texts.view_theme_light, theme == "light")?)
            .item(&create_check_item("theme-dark", &texts.view_theme_dark, theme == "dark")?)
            .item(&create_check_item("theme-green", &texts.view_theme_green, theme == "green")?)
            .build().map_err(|e| e.to_string())?)
          .item(&SubmenuBuilder::new(&app, &texts.view_language)
            .item(&create_check_item("language-ja", &texts.view_language_ja, lang == "ja")?)
            .item(&create_check_item("language-en", &texts.view_language_en, lang == "en")?)
            .build().map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.view_reload).id("reload-page").accelerator("Ctrl+Shift+R").build(&app).map_err(|e| e.to_string())?)
          .build().map_err(|e| e.to_string())?)
        // ヘルプメニュー
        .item(&SubmenuBuilder::new(&app, &texts.help)
          .item(&MenuItemBuilder::new(&texts.help_show).id("show-help").accelerator("F1").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.help_check_updates).id("check-updates").build(&app).map_err(|e| e.to_string())?)
          .item(&create_check_item("auto-check-updates", &texts.help_auto_check_updates, true)?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.help_about).id("show-about").build(&app).map_err(|e| e.to_string())?)
          .separator()
          .item(&MenuItemBuilder::new(&texts.help_website).id("open-website").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.help_github).id("open-github").build(&app).map_err(|e| e.to_string())?)
          .item(&MenuItemBuilder::new(&texts.help_releases).id("open-releases").build(&app).map_err(|e| e.to_string())?)
          .build().map_err(|e| e.to_string())?);
    
    // デバッグメニュー（デバッグビルドのみ表示）
    #[cfg(debug_assertions)]
    let menu = menu.item(&SubmenuBuilder::new(&app, &texts.debug)
          .item(&create_check_item("toggle-debug", &texts.debug_mode, _debug_mode)?)
          .item(&MenuItemBuilder::new(&texts.debug_export_logs).id("export-logs").build(&app).map_err(|e| e.to_string())?)
          .build().map_err(|e| e.to_string())?);    
    let menu = menu.build().map_err(|e| e.to_string())?;
    
    // メニューを設定
    app.set_menu(menu).map_err(|e| e.to_string())?;
    
    eprintln!("[rebuild_menu] 完了");
    Ok(())
}

#[tauri::command]
async fn set_always_on_top<R: Runtime>(app: tauri::AppHandle<R>, always_on_top: bool) -> Result<(), String> {
    println!("set_always_on_top called: {}", always_on_top);
    
    if let Some(window) = app.get_webview_window("main") {
        window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
        println!("Always on top set to: {}", always_on_top);
    }
    
    Ok(())
}

#[tauri::command]
async fn set_window_title<R: Runtime>(app: tauri::AppHandle<R>, title: String) -> Result<(), String> {
    println!("set_window_title called: {}", title);
    
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(&title).map_err(|e| e.to_string())?;
        println!("Window title set to: {}", title);
    }
    
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // 許可リスト: 指定ドメインのみ開く
    let allowed = ["https://sunrisemoon.net/", "https://github.com/MisakiAkatsuki/"];
    if !allowed.iter().any(|prefix| url.starts_with(prefix)) {
        return Err(format!("URL not allowed: {}", url));
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
async fn execute_after_effects_script(
    script_content: String,
    ae_multi_instance_mode: bool,
) -> Result<(), String> {
    // ユニークな一時ファイル名（PID + タイムスタンプ）で競合を防ぐ
    let temp_dir = std::env::temp_dir();
    let unique_id = format!("{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let temp_file = temp_dir.join(format!("DiTiS_temp_{}.jsx", unique_id));

    // スクリプトを一時ファイルに書き込み
    std::fs::write(&temp_file, script_content)
        .map_err(|e| format!("一時ファイル作成エラー: {}", e))?;

    // Windows以外は未対応
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::remove_file(&temp_file);
        return Err("このOS環境ではサポートされていません".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let ae_info = match find_active_after_effects() {
            Ok(info) => info,
            Err(e) => {
                let _ = std::fs::remove_file(&temp_file);
                return Err(e);
            }
        };
        println!("Using After Effects (PID: {}): {}", ae_info.pid, ae_info.exe_path);

        if ae_multi_instance_mode {
            // 複数インスタンス対応: メニュー自動化でスクリプトを実行
            if let Some(hwnd_isize) = ae_info.hwnd {
                match run_jsx_via_menu(hwnd_isize, ae_info.pid, &temp_file.to_string_lossy()) {
                    Ok(()) => {
                        // ファイルはAEがダイアログ経由で読み込むため即削除しない
                        return Ok(());
                    }
                    Err(e) => {
                        let _ = std::fs::remove_file(&temp_file);
                        return Err(format!(
                            "After Effectsへのスクリプト送信に失敗しました: {}\n\
                             AEの環境設定で「スクリプトによるファイルへのアクセスとネットワークアクセスを許可」が\
                             有効になっているか確認してください。",
                            e
                        ));
                    }
                }
            }
            let _ = std::fs::remove_file(&temp_file);
            Err("After EffectsのウィンドウHWNDが取得できませんでした。AEが完全に起動しているか確認してください。".to_string())
        } else {
            // 従来方式: -r フラグでスクリプトを渡す（単一インスタンス時のみ動作）
            match std::process::Command::new(&ae_info.exe_path)
                .arg("-r")
                .arg(&temp_file)
                .status()
            {
                Ok(_) => Ok(()),
                Err(e) => {
                    let _ = std::fs::remove_file(&temp_file);
                    Err(format!("After Effects起動エラー: {}", e))
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
struct AfterEffectsInfo {
    pid: u32,
    exe_path: String,
    /// WM_COPYDATA送信用のメインウィンドウハンドル
    hwnd: Option<isize>,
}

/// AEのメインウィンドウのメニューを走査して "Run Script File" コマンドIDを返す。
/// File > Scripts > Run Script File... の順に探す（ロケール対応）。
#[cfg(target_os = "windows")]
fn find_run_script_file_cmd_id(hwnd_isize: isize) -> Option<u32> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetMenu, GetSubMenu, GetMenuItemCount, GetMenuStringW, GetMenuItemID, MF_BYPOSITION,
    };

    let hwnd = HWND(hwnd_isize as *mut core::ffi::c_void);
    unsafe {
        let menu_bar = GetMenu(hwnd);
        if menu_bar.0.is_null() {
            println!("GetMenu returned null");
            return None;
        }

        // メニュー構造: File(ファイル) > Scripts(スクリプト) > Run Script File(スクリプトファイルを実行)
        // トップレベルを走査し、各メニューの中のサブメニューを再帰的に探す
        let top_count = GetMenuItemCount(menu_bar);
        for i in 0..top_count {
            let top_sub = GetSubMenu(menu_bar, i);
            if top_sub.0.is_null() { continue; }

            // この top_sub 内の各項目を走査 (ファイルメニュー等の中身)
            let item_count = GetMenuItemCount(top_sub);
            for j in 0..item_count {
                let mut name_buf = vec![0u16; 256];
                let len = GetMenuStringW(top_sub, j as u32, Some(&mut name_buf), MF_BYPOSITION);
                if len <= 0 { continue; }
                let item_name = String::from_utf16_lossy(&name_buf[..len as usize]);

                // "スクリプト" / "Script" というサブメニューを探す
                let is_scripts = item_name.contains("Script") || item_name.contains("\u{30b9}\u{30af}\u{30ea}\u{30d7}\u{30c8}");
                if !is_scripts { continue; }

                let scripts_menu = GetSubMenu(top_sub, j);
                if scripts_menu.0.is_null() { continue; }

                // Scripts サブメニュー内で "スクリプトファイルを実行" / "Run Script File" を探す
                let script_count = GetMenuItemCount(scripts_menu);
                for k in 0..script_count {
                    let mut entry_buf = vec![0u16; 256];
                    let len2 = GetMenuStringW(scripts_menu, k as u32, Some(&mut entry_buf), MF_BYPOSITION);
                    if len2 <= 0 { continue; }
                    let entry = String::from_utf16_lossy(&entry_buf[..len2 as usize]);

                    // 日本語: "スクリプトファイルを実行"  英語: "Run Script File"
                    let is_run = entry.contains("Run Script File")
                        || entry.contains("\u{30b9}\u{30af}\u{30ea}\u{30d7}\u{30c8}\u{30d5}\u{30a1}\u{30a4}\u{30eb}\u{3092}\u{5b9f}\u{884c}");
                    if is_run {
                        let cmd_id = GetMenuItemID(scripts_menu, k);
                        if cmd_id != u32::MAX {
                            println!("'Run Script File' command ID: {} (\"{}\")", cmd_id, entry);
                            return Some(cmd_id);
                        }
                    }
                }
            }
        }
        println!("'Run Script File' menu item not found");
        None
    }
}

/// 指定PIDプロセスが持つ #32770 ダイアログウィンドウの HWND 一覧を返す。
#[cfg(target_os = "windows")]
fn collect_dialog_hwnds(ae_pid: u32) -> Vec<isize> {
    use windows::Win32::Foundation::{HWND, LPARAM, BOOL};
    use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, GetClassNameW};

    struct Data { pid: u32, hwnds: Vec<isize> }

    extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut Data);
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
            if pid != data.pid { return BOOL(1); }
            let mut buf = [0u16; 64];
            let len = GetClassNameW(hwnd, &mut buf);
            if len > 0 {
                let cls = String::from_utf16_lossy(&buf[..len as usize]);
                if cls == "#32770" {
                    data.hwnds.push(hwnd.0 as isize);
                }
            }
            BOOL(1)
        }
    }

    unsafe {
        let mut data = Data { pid: ae_pid, hwnds: Vec::new() };
        let _ = EnumWindows(Some(callback), LPARAM(&mut data as *mut Data as isize));
        data.hwnds
    }
}

/// 既存リストにない新しい #32770 ダイアログが現れるまで待機する。
/// タイムアウト（ms）以内に見つからなければ None を返す。
#[cfg(target_os = "windows")]
fn wait_for_new_file_dialog(ae_pid: u32, before: &[isize], timeout_ms: u64) -> Option<isize> {
    let start = std::time::Instant::now();
    while start.elapsed().as_millis() < timeout_ms as u128 {
        let current = collect_dialog_hwnds(ae_pid);
        for h in &current {
            if !before.contains(h) {
                return Some(*h);
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    None
}

#[cfg(target_os = "windows")]
fn fill_and_confirm_file_dialog(dialog_hwnd_isize: isize, path: &str) {
    use windows::Win32::Foundation::{HWND, WPARAM, LPARAM, BOOL};
    use windows::Win32::UI::WindowsAndMessaging::{
        SendMessageW, PostMessageW, SetForegroundWindow,
        EnumChildWindows, GetClassNameW, GetDlgCtrlID,
        BM_CLICK, WM_COMMAND,
    };

    // EM_SETSEL / EM_REPLACESEL は standard Edit messages (winuser.h)
    const EM_SETSEL: u32     = 0x00B1;
    const EM_REPLACESEL: u32 = 0x00C2;

    let dialog_hwnd = HWND(dialog_hwnd_isize as *mut core::ffi::c_void);
    // null 終端 UTF-16 文字列（EM_REPLACESEL は LPWSTR を期待）
    let path_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();

    struct WalkData { edits: Vec<HWND>, ok_btn: Option<HWND> }
    extern "system" fn walk_cb(child: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut WalkData);
            let mut buf = [0u16; 64];
            let len = GetClassNameW(child, &mut buf);
            if len > 0 {
                let cls = String::from_utf16_lossy(&buf[..len as usize]);
                if cls == "Edit" {
                    data.edits.push(child);
                } else if cls == "Button" && data.ok_btn.is_none() {
                    if GetDlgCtrlID(child) == 1 { // IDOK
                        data.ok_btn = Some(child);
                    }
                }
            }
            BOOL(1)
        }
    }

    unsafe {
        let _ = SetForegroundWindow(dialog_hwnd);
        std::thread::sleep(std::time::Duration::from_millis(300));

        let mut data = WalkData { edits: Vec::new(), ok_btn: None };
        let _ = EnumChildWindows(dialog_hwnd, Some(walk_cb), LPARAM(&mut data as *mut WalkData as isize));

        println!("Edit count={}, ok_btn={}", data.edits.len(), data.ok_btn.is_some());

        if let Some(&edit) = data.edits.last() {
            // 全選択してから EM_REPLACESEL でフルパスを"入力"
            // → EN_CHANGE 通知が発生し IFileDialog が内部パスを更新する
            // wParam=1 で「元に戻せる操作」としてマーク（IFileDialog の変更検知に必要）
            SendMessageW(edit, EM_SETSEL, WPARAM(0), LPARAM(-1i32 as isize));
            SendMessageW(edit, EM_REPLACESEL, WPARAM(1), LPARAM(path_wide.as_ptr() as isize));
            println!("EM_REPLACESEL でフルパス設定: {}", path);
        } else {
            println!("警告: Edit コントロールが見つかりません");
        }

        // IFileDialog が内部パスを更新するのを十分待つ
        std::thread::sleep(std::time::Duration::from_millis(500));

        if let Some(ok_btn) = data.ok_btn {
            // SendMessageW で同期的にBM_CLICKを送る（PostMessageより確実）
            SendMessageW(ok_btn, BM_CLICK, WPARAM(0), LPARAM(0));
            println!("OK ボタン SendMessage BM_CLICK");
        } else {
            let _ = PostMessageW(dialog_hwnd, WM_COMMAND, WPARAM(1), LPARAM(0));
            println!("OK WM_COMMAND フォールバック");
        }
    }
}

/// AE のメニュー操作で JSX ファイルを実行させる。
/// File > Scripts > Run Script File... を起動し、ファイル選択ダイアログを自動操作する。
#[cfg(target_os = "windows")]
fn run_jsx_via_menu(ae_hwnd_isize: isize, ae_pid: u32, jsx_path: &str) -> Result<(), String> {
    use windows::Win32::Foundation::{HWND, WPARAM, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_COMMAND};

    // パスを絶対パスに正規化し \\?\ プレフィックスを除去
    let normalized_path = std::path::Path::new(jsx_path)
        .canonicalize()
        .map(|p| {
            let s = p.to_string_lossy().to_string();
            s.strip_prefix(r"\\?\").map(|s| s.to_string()).unwrap_or(s)
        })
        .unwrap_or_else(|_| jsx_path.to_string());
    let jsx_path = normalized_path.as_str();
    println!("run_jsx_via_menu: path={}", jsx_path);

    let cmd_id = find_run_script_file_cmd_id(ae_hwnd_isize)
        .ok_or_else(|| "AE メニューに 'Run Script File' が見つかりません".to_string())?;

    let before = collect_dialog_hwnds(ae_pid);

    let ae_hwnd = HWND(ae_hwnd_isize as *mut core::ffi::c_void);
    unsafe {
        let _ = PostMessageW(ae_hwnd, WM_COMMAND, WPARAM(cmd_id as usize), LPARAM(0));
    }

    let dialog_isize = wait_for_new_file_dialog(ae_pid, &before, 8000)
        .ok_or_else(|| "ファイル選択ダイアログが現れませんでした（8秒タイムアウト）".to_string())?;

    println!("ファイルダイアログを検出 (HWND: {:?})", dialog_isize);
    fill_and_confirm_file_dialog(dialog_isize, jsx_path);

    Ok(())
}

#[cfg(target_os = "windows")]
fn find_active_after_effects() -> Result<AfterEffectsInfo, String> {
    use windows::Win32::Foundation::{HWND, LPARAM, BOOL, HANDLE, CloseHandle};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, EnumWindows, GetWindowThreadProcessId, GetClassNameW,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    // AE_CApplication_* クラスを持つウィンドウをすべて列挙し、(hwnd, pid) の一覧を得る
    struct AeWindow {
        hwnd: isize,
        pid: u32,
    }
    struct EnumData {
        windows: Vec<AeWindow>,
    }

    extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let data = &mut *(lparam.0 as *mut EnumData);
            let mut class_buf = [0u16; 64];
            let len = GetClassNameW(hwnd, &mut class_buf);
            if len > 0 {
                let cls = String::from_utf16_lossy(&class_buf[..len as usize]);
                if cls.starts_with("AE_CApplication_") {
                    let mut pid: u32 = 0;
                    GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
                    if pid != 0 {
                        data.windows.push(AeWindow { hwnd: hwnd.0 as isize, pid });
                    }
                }
            }
            BOOL(1)
        }
    }

    let mut data = EnumData { windows: Vec::new() };
    unsafe {
        let _ = EnumWindows(Some(callback), LPARAM(&mut data as *mut EnumData as isize));
    }

    if data.windows.is_empty() {
        return Err("起動中のAfter Effectsが見つかりませんでした".to_string());
    }

    // PIDからexeパスを取得するヘルパー
    let get_exe_path = |pid: u32| -> Option<String> {
        unsafe {
            let handle: HANDLE = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buf = vec![0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, windows::core::PWSTR(buf.as_mut_ptr()), &mut len);
            let _ = CloseHandle(handle);
            if ok.is_ok() {
                Some(String::from_utf16_lossy(&buf[..len as usize]).to_string())
            } else {
                None
            }
        }
    };

    println!("Found {} AE_CApplication_* window(s)", data.windows.len());
    for w in &data.windows {
        println!("  HWND={} PID={}", w.hwnd, w.pid);
    }

    // 単一インスタンスの場合
    if data.windows.len() == 1 {
        let w = &data.windows[0];
        let exe_path = get_exe_path(w.pid)
            .unwrap_or_else(|| "AfterFX.exe".to_string());
        println!("Using single AE instance (PID: {}): {}", w.pid, exe_path);
        return Ok(AfterEffectsInfo { pid: w.pid, exe_path, hwnd: Some(w.hwnd) });
    }

    // 複数インスタンス: フォアグラウンドウィンドウがAEなら優先
    let fg_pid = unsafe {
        let fg = GetForegroundWindow();
        if !fg.is_invalid() {
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(fg, Some(&mut pid as *mut u32));
            pid
        } else {
            0
        }
    };

    // フォアグラウンドのAEウィンドウがあればそれを使用
    for w in &data.windows {
        if w.pid == fg_pid {
            let exe_path = get_exe_path(w.pid)
                .unwrap_or_else(|| "AfterFX.exe".to_string());
            println!("Foreground AE instance (PID: {}): {}", w.pid, exe_path);
            return Ok(AfterEffectsInfo { pid: w.pid, exe_path, hwnd: Some(w.hwnd) });
        }
    }

    // フォアグラウンドがAEでなければ EnumWindows の列挙順（Z-order上位）の最初を使用
    let w = &data.windows[0];
    let exe_path = get_exe_path(w.pid)
        .unwrap_or_else(|| "AfterFX.exe".to_string());
    println!("Using topmost AE instance (PID: {}): {}", w.pid, exe_path);
    Ok(AfterEffectsInfo { pid: w.pid, exe_path, hwnd: Some(w.hwnd) })
}

/// AEからタイムリマップデータを取得する
/// 1. TCPサーバーを起動
/// 2. JSXを生成してAEで実行
/// 3. AEからのSocket接続を待機してデータを受信
#[tauri::command]
#[allow(unused_variables)]
async fn get_timeremap_from_ae(ae_multi_instance_mode: bool) -> Result<String, String> {
    use std::net::TcpListener;

    const PORT: u16 = 31715;  // DiTiS = 31715
    
    eprintln!("[get_timeremap_from_ae] 開始");
    
    // 1. TCPサーバーを起動
    let listener = TcpListener::bind(format!("127.0.0.1:{}", PORT))
        .map_err(|e| format!("サーバー起動エラー: {}", e))?;
    
    // タイムアウト設定（30秒）
    listener.set_nonblocking(false).ok();
    
    eprintln!("[get_timeremap_from_ae] TCPサーバー起動: port {}", PORT);
    
    // 2. JSXを生成
    let jsx = generate_get_timeremap_jsx(PORT);
    
    // 3. 一時ファイルに保存（ユニーク名で競合を防ぐ）
    let temp_dir = std::env::temp_dir();
    let unique_id = format!("{}_{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    );
    let temp_file = temp_dir.join(format!("ditis_get_timeremap_{}.jsx", unique_id));
    std::fs::write(&temp_file, &jsx)
        .map_err(|e| format!("一時ファイル作成エラー: {}", e))?;

    eprintln!("[get_timeremap_from_ae] JSX生成完了: {:?}", temp_file);

    // 4. After Effectsを検出してJSXを実行 / 接続待機 / データ受信（Windows専用）
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::remove_file(&temp_file);
        return Err("このOS環境ではサポートされていません".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::io::Read;
        use std::time::Duration;
        let ae_info = match find_active_after_effects() {
            Ok(info) => info,
            Err(e) => {
                let _ = std::fs::remove_file(&temp_file);
                return Err(e);
            }
        };
        eprintln!("[get_timeremap_from_ae] AE実行: {} (PID: {})", ae_info.exe_path, ae_info.pid);

        if ae_multi_instance_mode {
            // 複数インスタンス対応: メニュー自動化でスクリプトを実行
            if let Some(hwnd_isize) = ae_info.hwnd {
                if let Err(e) = run_jsx_via_menu(hwnd_isize, ae_info.pid, &temp_file.to_string_lossy()) {
                    let _ = std::fs::remove_file(&temp_file);
                    return Err(format!(
                        "After Effectsへのスクリプト送信に失敗しました: {}\n\
                         AEの環境設定で「スクリプトによるファイルへのアクセスとネットワークアクセスを許可」が\
                         有効になっているか確認してください。",
                        e
                    ));
                }
                eprintln!("[get_timeremap_from_ae] メニュー自動化でJSX実行");
            } else {
                let _ = std::fs::remove_file(&temp_file);
                return Err("After EffectsのウィンドウHWNDが取得できませんでした。AEが完全に起動しているか確認してください。".to_string());
            }
        } else {
            // 従来方式: -r フラグでスクリプトを渡す（単一インスタンス時のみ動作）
            match std::process::Command::new(&ae_info.exe_path)
                .arg("-r")
                .arg(&temp_file)
                .status()
            {
                Ok(_) => eprintln!("[get_timeremap_from_ae] -r フラグでJSX実行"),
                Err(e) => {
                    let _ = std::fs::remove_file(&temp_file);
                    return Err(format!("After Effects起動エラー: {}", e));
                }
            }
        }

        // 5. 接続待機（タイムアウト付き）
        let accept_result = std::thread::spawn(move || {
            listener.set_nonblocking(false).ok();
            let start = std::time::Instant::now();
            let timeout = Duration::from_secs(30);
            loop {
                listener.set_nonblocking(true).ok();
                match listener.accept() {
                    Ok((stream, _)) => return Ok(stream),
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        if start.elapsed() > timeout {
                            return Err("接続タイムアウト: After Effectsからの応答がありませんでした".to_string());
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    Err(e) => return Err(format!("接続エラー: {}", e)),
                }
            }
        }).join().map_err(|_| "スレッドエラー".to_string());

        let accept_result = match accept_result {
            Ok(r) => match r {
                Ok(s) => s,
                Err(e) => {
                    let _ = std::fs::remove_file(&temp_file);
                    return Err(e);
                }
            },
            Err(e) => {
                let _ = std::fs::remove_file(&temp_file);
                return Err(e);
            }
        };

        let mut stream = accept_result;
        eprintln!("[get_timeremap_from_ae] AEから接続を受信");

        // 6. データ受信
        stream.set_read_timeout(Some(Duration::from_secs(10))).ok();
        let mut response = Vec::new();
        let mut buf = [0u8; 4096];
        loop {
            match stream.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => response.extend_from_slice(&buf[..n]),
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => break,
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => break,
                Err(e) => {
                    let _ = std::fs::remove_file(&temp_file);
                    return Err(format!("データ受信エラー: {}", e));
                }
            }
        }

        let response = String::from_utf8(response)
            .map_err(|e| {
                let _ = std::fs::remove_file(&temp_file);
                format!("UTF-8変換エラー: {}", e)
            })?;
        let _ = std::fs::remove_file(&temp_file);
        eprintln!("[get_timeremap_from_ae] データ受信完了: {} bytes", response.len());
        Ok(response)
    }
}

/// タイムリマップ取得用のJSXを生成
fn generate_get_timeremap_jsx(port: u16) -> String {
    format!(r#"(function() {{
    var DITIS_PORT = {};
    
    // 文字列をエスケープ（JSON用）
    function escapeString(str) {{
        if (str == null) return "";
        str = String(str);
        return str.replace(/\\/g, "\\\\")
                  .replace(/"/g, '\\"')
                  .replace(/\n/g, "\\n")
                  .replace(/\r/g, "\\r")
                  .replace(/\t/g, "\\t");
    }}
    
    // エラー送信
    function sendError(message) {{
        var socket = new Socket();
        socket.encoding = "UTF-8";
        if (socket.open("127.0.0.1:" + DITIS_PORT)) {{
            socket.write('{{"error":"' + escapeString(message) + '"}}');
            socket.close();
        }} else {{
            alert("DiTiSに接続できませんでした: " + message);
        }}
    }}
    
    // データ送信（手動JSON生成）
    function sendData(fps, duration, compName, layers) {{
        var json = '{{';
        json += '"fps":' + fps + ',';
        json += '"duration":' + duration + ',';
        json += '"compName":"' + escapeString(compName) + '",';
        json += '"layers":[';
        
        for (var i = 0; i < layers.length; i++) {{
            if (i > 0) json += ',';
            var layer = layers[i];
            json += '{{';
            json += '"layerName":"' + escapeString(layer.name) + '",';
            json += '"layerIndex":' + layer.index + ',';
            json += '"keyframes":[';
            
            for (var k = 0; k < layer.keyframes.length; k++) {{
                if (k > 0) json += ',';
                var kf = layer.keyframes[k];
                json += '{{"time":' + kf.time + ',"value":' + kf.value + '}}';
            }}
            
            json += ']}}';
        }}
        
        json += ']}}';
        
        var socket = new Socket();
        socket.encoding = "UTF-8";
        if (socket.open("127.0.0.1:" + DITIS_PORT)) {{
            socket.write(json);
            socket.close();
        }} else {{
            alert("DiTiSに接続できませんでした");
        }}
    }}
    
    try {{
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {{
            sendError("コンポジションを選択してください");
            return;
        }}
        
        var layers = comp.selectedLayers;
        if (layers.length === 0) {{
            sendError("レイヤーを選択してください");
            return;
        }}
        
        var result = [];
        var hasTimeRemap = false;
        
        for (var i = 0; i < layers.length; i++) {{
            var layer = layers[i];
            var timeRemap = layer.property("ADBE Time Remapping");
            
            if (!timeRemap || timeRemap.numKeys === 0) {{
                continue;  // タイムリマップなし
            }}
            
            hasTimeRemap = true;
            var keyframes = [];
            
            for (var k = 1; k <= timeRemap.numKeys; k++) {{
                keyframes.push({{
                    time: timeRemap.keyTime(k),
                    value: timeRemap.keyValue(k)
                }});
            }}
            
            result.push({{
                name: layer.name,
                index: layer.index,
                keyframes: keyframes
            }});
        }}
        
        if (!hasTimeRemap) {{
            sendError("選択したレイヤーにタイムリマップが設定されていません");
            return;
        }}
        
        sendData(comp.frameRate, comp.duration, comp.name, result);
        
    }} catch (e) {{
        sendError("エラー: " + e.toString());
    }}
}})();
"#, port)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // メニューアイテム参照を保存するための構造体を初期化（setup前に登録）
  let menu_items: Arc<MenuItems<tauri::Wry>> = Arc::new(MenuItems::new());
  let menu_items_for_setup = menu_items.clone();
  
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(menu_items)
    .invoke_handler(tauri::generate_handler![
        save_file,
        load_file,
        load_binary_file,
        save_binary_file,
        show_in_folder,
        update_menu_item_check,
        rebuild_menu,
        set_always_on_top,
        set_window_title,
        execute_after_effects_script,
        get_timeremap_from_ae,
        check_for_updates,
        install_update,
        get_current_version,
        open_url
    ])
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // menu_items_for_setupを使用（Builderで既にmanage済み）
      let menu_items_for_closure = menu_items_for_setup.clone();

      // CheckMenuItemを作成して保存するヘルパー関数
      let create_check_item = |id: &str, label: &str, checked: bool| -> Result<_, tauri::Error> {
        let item = CheckMenuItemBuilder::new(label).id(id).checked(checked).build(app)?;
        menu_items_for_closure.insert(id.to_string(), item.clone());
        Ok(item)
      };

      // ネイティブメニューバーの構築
      let menu = MenuBuilder::new(app)
        // ファイルメニュー
        .item(&SubmenuBuilder::new(app, "ファイル")
          .item(&MenuItemBuilder::new("新規作成").id("new-sheet").accelerator("Ctrl+N").build(app)?)
          .item(&MenuItemBuilder::new("開く").id("open-file").accelerator("Ctrl+O").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("保存").id("save-file").accelerator("Ctrl+S").build(app)?)
          .item(&MenuItemBuilder::new("名前を付けて保存...").id("save-as-file").accelerator("Ctrl+Shift+S").build(app)?)
          .item(&MenuItemBuilder::new("ExtendScriptとして出力").id("export-jsx").accelerator("Ctrl+Shift+E").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("閉じる").id("close-file").accelerator("Ctrl+W").build(app)?)
          .item(&MenuItemBuilder::new("すべてのシートを閉じる").id("close-all-sheets").accelerator("Ctrl+Shift+W").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("印刷...").id("print-sheet").accelerator("Ctrl+P").build(app)?)
          .separator()
          .item(&PredefinedMenuItem::quit(app, Some("終了"))?)
          .build()?)
        // 編集メニュー
        .item(&SubmenuBuilder::new(app, "編集")
          .item(&MenuItemBuilder::new("元に戻す").id("undo").accelerator("Ctrl+Z").build(app)?)
          .item(&MenuItemBuilder::new("やり直し").id("redo").accelerator("Ctrl+Y").build(app)?)
          .separator()
          .item(&create_check_item("reopen-last-file", "起動時に前回のシート状態を復元する", false)?)
          .separator()
          .item(&SubmenuBuilder::new(app, "数字キーの動作")
            .item(&create_check_item("numeric-key-mode-auto", "自動（NumLock連動）", false)?)
            .item(&create_check_item("numeric-key-mode-column", "列選択", false)?)
            .item(&create_check_item("numeric-key-mode-input", "数値入力", false)?)
            .build()?)
          .item(&SubmenuBuilder::new(app, "コピーキーフレームの出力")
            .item(&create_check_item("copy-keyframe-mode-sparse", "変化点のみ", false)?)
            .item(&create_check_item("copy-keyframe-mode-all-frames", "全フレーム", false)?)
            .build()?)
          .build()?)
        // シートメニュー
        .item(&SubmenuBuilder::new(app, "シート")
          .item(&MenuItemBuilder::new("After Effectsに送信").id("send-to-ae").accelerator("Ctrl+E").build(app)?)
          .item(&MenuItemBuilder::new("After Effectsからタイムリマップを取得").id("get-from-ae").accelerator("Ctrl+I").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("シート設定").id("sheet-settings").accelerator("Ctrl+,").build(app)?)
          .item(&create_check_item("show-new-sheet-dialog", "新規シート作成時にダイアログを表示", true)?)
          .separator()
          .item(&MenuItemBuilder::new("尺を変更").id("change-duration").accelerator("Ctrl+Shift+D").build(app)?)
          .item(&MenuItemBuilder::new("フレームレートを変更").id("change-fps").accelerator("Ctrl+Shift+F").build(app)?)
          .item(&MenuItemBuilder::new("ページ辺りのコマ数を変更").id("change-frame-page").accelerator("Ctrl+Shift+P").build(app)?)
          .item(&MenuItemBuilder::new("列数を変更").id("change-max-columns").accelerator("Ctrl+Shift+C").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("列名を初期化").id("reset-column-names").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("シートを初期化").id("clear-sheet").build(app)?)
          .build()?)
        // 表示メニュー
        .item(&SubmenuBuilder::new(app, "表示")
          .item(&create_check_item("auto-scroll", "スクロール時に選択を中央表示", true)?)
          .item(&create_check_item("always-on-top", "常に前面に表示", false)?)
          .separator()
          .item(&SubmenuBuilder::new(app, "行ヘッダー：表示するコマ")
            .item(&create_check_item("frame-filter-all", "すべてのコマ", true)?)
            .item(&create_check_item("frame-filter-odd", "奇数コマのみ", false)?)
            .item(&create_check_item("frame-filter-even", "偶数コマのみ", false)?)
            .build()?)
          .item(&SubmenuBuilder::new(app, "行ヘッダー：表示形式")
            .item(&create_check_item("header-mode-detail", "タイムシート式", true)?)
            .item(&create_check_item("header-mode-simple", "通し番号式", false)?)
            .build()?)
          .separator()
          .item(&create_check_item("toggle-intermediate-headers", "列間にコマヘッダーを表示", false)?)
          .separator()
          .item(&MenuItemBuilder::new("表示設定をリセット").id("reset-view-settings").build(app)?)
          .separator()
          .item(&SubmenuBuilder::new(app, "表示サイズ")
            .item(&create_check_item("font-size-xsmall", "極小", false)?)
            .item(&create_check_item("font-size-small", "小", false)?)
            .item(&create_check_item("font-size-normal", "標準", true)?)
            .item(&create_check_item("font-size-large", "大", false)?)
            .item(&create_check_item("font-size-xlarge", "特大", false)?)
            .build()?)
          .item(&SubmenuBuilder::new(app, "テーマ")
            .item(&create_check_item("theme-light", "ライトテーマ", true)?)
            .item(&create_check_item("theme-dark", "ダークテーマ", false)?)
            .item(&create_check_item("theme-green", "グリーンテーマ", false)?)
            .build()?)
          .item(&SubmenuBuilder::new(app, "言語 / Language")
            .item(&create_check_item("language-ja", "日本語", true)?)
            .item(&create_check_item("language-en", "English", false)?)
            .build()?)
          .separator()
          .item(&MenuItemBuilder::new("ページを再読み込み").id("reload-page").accelerator("Ctrl+Shift+R").build(app)?)
          .build()?)
        // ヘルプメニュー
        .item(&SubmenuBuilder::new(app, "ヘルプ")
          .item(&MenuItemBuilder::new("ヘルプ").id("show-help").accelerator("F1").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("更新を確認").id("check-updates").build(app)?)
          .item(&create_check_item("auto-check-updates", "起動時に更新を確認", true)?)
          .separator()
          .item(&MenuItemBuilder::new("このソフトについて").id("show-about").build(app)?)
          .separator()
          .item(&MenuItemBuilder::new("公式サイト").id("open-website").build(app)?)
          .item(&MenuItemBuilder::new("GitHub").id("open-github").build(app)?)
          .item(&MenuItemBuilder::new("過去バージョンをダウンロード").id("open-releases").build(app)?)
          .build()?);
      
      // デバッグメニュー（デバッグビルドのみ表示）
      #[cfg(debug_assertions)]
      let menu = menu.item(&SubmenuBuilder::new(app, "デバッグ")
          .item(&create_check_item("toggle-debug", "デバッグモード", false)?)
          .item(&MenuItemBuilder::new("ログを出力").id("export-logs").build(app)?)
          .build()?);
      
      let menu = menu.build()?;

      app.set_menu(menu)?;

      // コマンドライン引数からファイルパスを取得（ファイル関連付け / CSP連携からの起動時）
      let args: Vec<String> = std::env::args().collect();
      if args.len() > 1 {
        let file_path = args[1].clone();
        if validate_file_path(&file_path).is_ok() {
          eprintln!("[起動] ファイル関連付けからの起動: {}", file_path);
          // ウィンドウの準備ができたらイベントでファイルパスを送信
          let app_handle = app.handle().clone();
          std::thread::spawn(move || {
            // メインウィンドウ生成を待つ（最大5秒、100ms間隔でポーリング）
            for _ in 0..50 {
              if app_handle.get_webview_window("main").is_some() {
                // JSリスナー登録完了を待つ（ウィンドウ生成後もスクリプト読み込みに時間がかかる）
                std::thread::sleep(std::time::Duration::from_millis(500));
                if let Err(e) = app_handle.emit("open-file", file_path.clone()) {
                  eprintln!("[起動] open-file emit失敗: {}", e);
                }
                // CSP連携モード: CLI引数でXDTSファイルが渡された場合、自動保存モードを有効化
                if file_path.to_lowercase().ends_with(".xdts") {
                  eprintln!("[起動] CSP連携モード: 自動保存を有効化");
                  if let Err(e) = app_handle.emit("csp-sync-mode", file_path.clone()) {
                    eprintln!("[起動] csp-sync-mode emit失敗: {}", e);
                  }
                }
                return;
              }
              std::thread::sleep(std::time::Duration::from_millis(100));
            }
            eprintln!("[起動] open-file emit タイムアウト");
          });
        } else {
          eprintln!("[起動] 不正なファイルパスを拒否: {}", file_path);
        }
      }

      // メニューイベントハンドラ
      app.on_menu_event(move |app, event| {
        let menu_id = event.id().as_ref();
        
        // 最新のMenuItemsを取得（Arc<MenuItems>として登録されている）
        let menu_items_state = app.state::<Arc<MenuItems<tauri::Wry>>>();
        
        // フレームフィルターメニューの排他的チェック処理
        if menu_id.starts_with("frame-filter-") {
          // すべてのフレームフィルターをfalseに
          if let Some(item) = menu_items_state.get("frame-filter-all") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("frame-filter-odd") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("frame-filter-even") {
            let _ = item.set_checked(false);
          }
          
          // クリックされた項目だけtrueに
          if let Some(item) = menu_items_state.get(menu_id) {
            let _ = item.set_checked(true);
          }
        }
        
        // ヘッダーモードメニューの排他的チェック処理
        if menu_id.starts_with("header-mode-") {
          if let Some(item) = menu_items_state.get("header-mode-detail") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("header-mode-simple") {
            let _ = item.set_checked(false);
          }
          
          if let Some(item) = menu_items_state.get(menu_id) {
            let _ = item.set_checked(true);
          }
        }
        
        // フォントサイズメニューの排他的チェック処理
        if menu_id.starts_with("font-size-") {
          if let Some(item) = menu_items_state.get("font-size-xsmall") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("font-size-small") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("font-size-normal") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("font-size-large") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("font-size-xlarge") {
            let _ = item.set_checked(false);
          }
          
          if let Some(item) = menu_items_state.get(menu_id) {
            let _ = item.set_checked(true);
          }
        }
        
        // テーマメニューの排他的チェック処理
        if menu_id.starts_with("theme-") {
          eprintln!("[Rust] テーマメニュー処理開始: {}", menu_id);
          if let Some(item) = menu_items_state.get("theme-light") {
            eprintln!("[Rust] theme-light: false");
            match item.set_checked(false) {
              Ok(_) => eprintln!("[Rust] theme-light チェック解除成功"),
              Err(e) => eprintln!("[Rust] theme-light チェック解除失敗: {}", e),
            }
          } else {
            eprintln!("[Rust] theme-light が MenuItems に存在しません");
          }
          if let Some(item) = menu_items_state.get("theme-dark") {
            eprintln!("[Rust] theme-dark: false");
            match item.set_checked(false) {
              Ok(_) => eprintln!("[Rust] theme-dark チェック解除成功"),
              Err(e) => eprintln!("[Rust] theme-dark チェック解除失敗: {}", e),
            }
          } else {
            eprintln!("[Rust] theme-dark が MenuItems に存在しません");
          }
          if let Some(item) = menu_items_state.get("theme-green") {
            eprintln!("[Rust] theme-green: false");
            match item.set_checked(false) {
              Ok(_) => eprintln!("[Rust] theme-green チェック解除成功"),
              Err(e) => eprintln!("[Rust] theme-green チェック解除失敗: {}", e),
            }
          } else {
            eprintln!("[Rust] theme-green が MenuItems に存在しません");
          }
          
          if let Some(item) = menu_items_state.get(menu_id) {
            eprintln!("[Rust] {}: true", menu_id);
            match item.set_checked(true) {
              Ok(_) => eprintln!("[Rust] {} チェック設定成功", menu_id),
              Err(e) => eprintln!("[Rust] {} チェック設定失敗: {}", menu_id, e),
            }
          } else {
            eprintln!("[Rust] {} が MenuItems に存在しません", menu_id);
          }
          eprintln!("[Rust] テーマメニュー処理完了");
        }
        
        // 言語メニューの排他的チェック処理
        if menu_id.starts_with("language-") {
          eprintln!("[Rust] 言語メニュー処理開始: {}", menu_id);
          if let Some(item) = menu_items_state.get("language-ja") {
            match item.set_checked(false) {
              Ok(_) => eprintln!("[Rust] language-ja チェック解除成功"),
              Err(e) => eprintln!("[Rust] language-ja チェック解除失敗: {}", e),
            }
          }
          if let Some(item) = menu_items_state.get("language-en") {
            match item.set_checked(false) {
              Ok(_) => eprintln!("[Rust] language-en チェック解除成功"),
              Err(e) => eprintln!("[Rust] language-en チェック解除失敗: {}", e),
            }
          }
          
          if let Some(item) = menu_items_state.get(menu_id) {
            match item.set_checked(true) {
              Ok(_) => eprintln!("[Rust] {} チェック設定成功", menu_id),
              Err(e) => eprintln!("[Rust] {} チェック設定失敗: {}", menu_id, e),
            }
          }
          eprintln!("[Rust] 言語メニュー処理完了");
        }
        
        // 数字キーモードメニューの排他的チェック処理
        if menu_id.starts_with("numeric-key-mode-") {
          if let Some(item) = menu_items_state.get("numeric-key-mode-auto") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("numeric-key-mode-column") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("numeric-key-mode-input") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get(menu_id) {
            let _ = item.set_checked(true);
          }
        }
        
        // コピーキーフレームモードメニューの排他的チェック処理
        if menu_id.starts_with("copy-keyframe-mode-") {
          if let Some(item) = menu_items_state.get("copy-keyframe-mode-sparse") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get("copy-keyframe-mode-all-frames") {
            let _ = item.set_checked(false);
          }
          if let Some(item) = menu_items_state.get(menu_id) {
            let _ = item.set_checked(true);
          }
        }
        
        if let Some(window) = app.get_webview_window("main") {
        
        // JavaScriptにメニューIDを送信（JSONエスケープしてインジェクション防止）
        eprintln!("[Rust] JavaScriptを呼び出し: {}", menu_id);
        
        // コンテキストメニューを即座に閉じてから、メニューアクションを実行
        let menu_id_json = serde_json::to_string(menu_id).unwrap_or_else(|_| format!("\"{}\"", menu_id));
        let script = format!(
          "if (typeof closeAllContextMenus === 'function') {{ closeAllContextMenus(); }} setTimeout(function() {{ if (window.handleMenuEvent) {{ window.handleMenuEvent({}); }} }}, 0);",
          menu_id_json
        );
        
        match window.eval(&script) {
          Ok(_) => eprintln!("[Rust] JavaScript呼び出し成功"),
          Err(e) => eprintln!("[Rust] JavaScript呼び出しエラー: {:?}", e),
        }
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
