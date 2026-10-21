#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use ditis_import_protocol::{write_json, ImportResult, MAX_RESULT_BYTES};
use ditis_openai_import_core::{
    parse_response, prepare_source, request_body, to_document, Region, Review, Source,
};
use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

struct Session {
    result: Option<PathBuf>,
    completed: Mutex<bool>,
}

fn result_argument() -> Result<Option<PathBuf>, String> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.is_empty() {
        return Ok(None);
    }
    if args.len() != 2 || args[0] != "--ditis-result" {
        return Err("Invalid plugin arguments".into());
    }
    let path = PathBuf::from(&args[1]);
    if !path.is_absolute() || !path.parent().is_some_and(|p| p.is_dir()) {
        return Err("Invalid result path".into());
    }
    Ok(Some(path))
}

#[tauri::command]
fn integrated_mode(app: tauri::AppHandle) -> bool {
    app.state::<Session>().result.is_some()
}

#[tauri::command]
async fn choose_sources(app: tauri::AppHandle) -> Result<Vec<Source>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app
            .dialog()
            .file()
            .add_filter(
                "タイムシート画像・PDF",
                &["png", "jpg", "jpeg", "webp", "tga", "pdf"],
            )
            .blocking_pick_files();
        let Some(files) = selected else {
            return Ok(Vec::new());
        };
        if files.len() > 8 {
            return Err("ファイルは一度に8個まで選択できます".into());
        }
        let mut sources = Vec::new();
        let mut size = 0usize;
        for file in files {
            let path = file
                .into_path()
                .map_err(|_| "ファイルパスを取得できません")?;
            let source = prepare_source(&path)?;
            size += source.data_url.len();
            if size > 96 * 1024 * 1024 {
                return Err("ファイルの合計サイズが大きすぎます。分けて読み込んでください".into());
            }
            sources.push(source);
        }
        Ok(sources)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn recognize(
    api_key: String,
    model: String,
    fps: f64,
    regions: Vec<Region>,
) -> Result<Review, String> {
    let api_key = api_key.trim();
    if api_key.is_empty() || api_key.len() > 512 || api_key.chars().any(char::is_control) {
        return Err("OpenAI APIキーを入力してください".into());
    }
    // The body is built from cropped PNGs only. Never pass source paths or filenames.
    let body = request_body(&regions, fps, model.trim())?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|_| "通信の準備に失敗しました")?;
    let mut response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|_| "OpenAIに接続できませんでした。通信環境を確認してください")?;
    let status = response.status();
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "応答の読み込みに失敗しました")?
    {
        if bytes.len() + chunk.len() > 8 * 1024 * 1024 {
            return Err("APIの応答が大きすぎます".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let json: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "APIの応答が不正です")?;
    if !status.is_success() {
        let explanation = match status.as_u16() {
            401 | 403 => "APIキー・利用権限を確認してください",
            429 => "利用上限またはレート制限です。OpenAI側の利用状況を確認してください",
            400 | 404 => {
                "指定モデルの画像入力・Structured Outputs対応と、モデル名を確認してください"
            }
            _ => "時間をおいて再実行してください",
        };
        // Do not return raw HTTP errors that might contain credentials or source data.
        return Err(format!("OpenAI APIエラー ({status}): {explanation}"));
    }
    parse_response(&json, &regions, fps)
}

#[tauri::command]
fn finish_import(
    app: tauri::AppHandle,
    review: Review,
    fps: f64,
    name: String,
    frame_page_size: usize,
) -> Result<(), String> {
    let document = to_document(&review, fps, &name, frame_page_size)?;
    let session = app.state::<Session>();
    let mut completed = session
        .completed
        .lock()
        .map_err(|_| "読み込み状態を取得できません")?;
    if *completed {
        return Err("すでに読み込み済みです".into());
    }
    let path = session
        .result
        .as_ref()
        .ok_or("単独起動時はファイルに保存してください")?;
    let result = ImportResult::success(document);
    if serde_json::to_vec(&result)
        .map_err(|e| e.to_string())?
        .len() as u64
        > MAX_RESULT_BYTES
    {
        return Err("取り込み結果が8MBを超えます。範囲を減らして実行してください".into());
    }
    write_json(path, &result)?;
    *completed = true;
    drop(completed);
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn save_document(
    app: tauri::AppHandle,
    review: Review,
    fps: f64,
    name: String,
    frame_page_size: usize,
) -> Result<bool, String> {
    let document = to_document(&review, fps, &name, frame_page_size)?;
    tauri::async_runtime::spawn_blocking(move || {
        let path = app
            .dialog()
            .file()
            .set_file_name("imported.ditis")
            .add_filter("DiTiS", &["ditis"])
            .blocking_save_file();
        let Some(path) = path else {
            return Ok(false);
        };
        write_json(
            &path.into_path().map_err(|_| "保存先を取得できません")?,
            &document,
        )?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn main() {
    let result = match result_argument() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(2)
        }
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Session {
            result,
            completed: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            integrated_mode,
            choose_sources,
            recognize,
            finish_import,
            save_document
        ])
        .run(tauri::generate_context!())
        .expect("Could not start DiTiS AI Import");
}
