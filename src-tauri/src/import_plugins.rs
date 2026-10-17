use ditis_import_protocol::{discover, load_plugin, Document, ImportRuntime};
use std::{path::PathBuf, sync::Arc};
use tauri::{
    menu::{MenuItemBuilder, Submenu, SubmenuBuilder},
    Manager,
};

pub fn plugin_folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let folder = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    Ok(folder)
}

pub fn submenu(app: &tauri::AppHandle, lang: &str) -> tauri::Result<Submenu<tauri::Wry>> {
    let ja = lang == "ja";
    let mut menu = SubmenuBuilder::new(
        app,
        if ja {
            "プラグインから読み込み"
        } else {
            "Import with plugin"
        },
    );
    let plugins = plugin_folder(app)
        .map(|p| discover(&p).0)
        .unwrap_or_default();
    if plugins.is_empty() {
        menu = menu.item(
            &MenuItemBuilder::new(if ja {
                "プラグイン未導入"
            } else {
                "No import plugins installed"
            })
            .id("import-plugin-none")
            .enabled(false)
            .build(app)?,
        );
    }
    for plugin in plugins {
        let label = plugin
            .manifest
            .menu_label
            .get(lang)
            .or_else(|| plugin.manifest.menu_label.get("en"))
            .unwrap_or(&plugin.manifest.name);
        menu = menu.item(
            &MenuItemBuilder::new(label.replace('&', "&&"))
                .id(format!("import-plugin:{}", plugin.manifest.id))
                .build(app)?,
        );
    }
    menu.separator()
        .item(
            &MenuItemBuilder::new(if ja {
                "プラグインフォルダーを開く"
            } else {
                "Open plugin folder"
            })
            .id("open-import-plugin-folder")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::new(if ja {
                "プラグインを再読み込み"
            } else {
                "Reload plugins"
            })
            .id("reload-import-plugins")
            .build(app)?,
        )
        .build()
}

#[tauri::command]
pub async fn run_import_plugin(
    app: tauri::AppHandle,
    plugin_id: String,
) -> Result<Option<Document>, String> {
    let plugin = load_plugin(&plugin_folder(&app)?, &plugin_id)?;
    let runtime = app.state::<Arc<ImportRuntime>>().inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.run(&plugin))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn cancel_import_plugin(app: tauri::AppHandle) {
    app.state::<Arc<ImportRuntime>>().cancel();
}

#[tauri::command]
pub fn reload_import_plugins(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let (plugins, errors) = discover(&plugin_folder(&app)?);
    Ok(serde_json::json!({ "count": plugins.len(), "errors": errors }))
}

#[tauri::command]
pub fn open_import_plugin_folder(app: tauri::AppHandle) -> Result<(), String> {
    let folder = plugin_folder(&app)?;
    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");
    command.arg(folder).spawn().map_err(|e| e.to_string())?;
    Ok(())
}
