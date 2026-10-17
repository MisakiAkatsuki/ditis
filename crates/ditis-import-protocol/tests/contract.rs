use ditis_import_protocol::*;
use std::fs;

fn document() -> Document {
    Document {
        version: "1.0".into(),
        sheets: vec![Sheet {
            name: "cut".into(),
            fps: 24.0,
            frames: 3,
            frame_page_size: 144,
            layers: vec!["A".into()],
            data: vec![vec!["001".into(), "001".into(), "×".into()]],
        }],
    }
}

#[test]
fn data_contract_preserves_cel_strings_and_rejects_partial_invalid_documents() {
    let result = ImportResult::success(document());
    let bytes = serde_json::to_vec(&result).unwrap();
    let parsed: ImportResult = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        parsed.into_document().unwrap().unwrap().sheets[0].data[0][0],
        "001"
    );
    let mut bad = document();
    let mut second = bad.sheets[0].clone();
    second.data[0].push("4".into());
    bad.sheets.push(second);
    assert!(ImportResult::success(bad).into_document().is_err());
    let mut bad = document();
    bad.sheets[0].fps = f64::NAN;
    assert!(bad.validate().is_err());
    let injected = br#"{"version":"1.0","sheets":[],"filePath":"/secret"}"#;
    assert!(serde_json::from_slice::<Document>(injected).is_err());
}

#[test]
fn incompatible_protocol_and_oversized_results_are_rejected() {
    let mut result = ImportResult::cancelled();
    result.api_version = 99;
    assert!(result.into_document().is_err());
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("large");
    fs::write(&path, b"123456").unwrap();
    assert!(read_limited(&path, 5).is_err());
    assert!(ImportResult {
        api_version: 1,
        status: "cancelled".into(),
        document: Some(document())
    }
    .into_document()
    .is_err());
}

fn manifest(root: &std::path::Path, executable: &str) {
    fs::create_dir_all(root.join("test-plugin")).unwrap();
    fs::write(root.join("test-plugin/plugin.json"),serde_json::to_vec(&serde_json::json!({
        "apiVersion":1,"id":"test-plugin","name":"Test","menuLabel":{"ja":"読み込み","en":"Import"},"executable":executable
    })).unwrap()).unwrap();
}

#[test]
fn executable_paths_cannot_escape_plugin_directory() {
    let dir = tempfile::tempdir().unwrap();
    manifest(dir.path(), "../outside");
    fs::write(dir.path().join("outside"), "").unwrap();
    assert!(load_plugin(dir.path(), "test-plugin").is_err());
    assert!(load_plugin(dir.path(), "../test-plugin").is_err());
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(
            dir.path().join("outside"),
            dir.path().join("test-plugin/link"),
        )
        .unwrap();
        manifest(dir.path(), "link");
        assert!(load_plugin(dir.path(), "test-plugin").is_err());
    }
    manifest(dir.path(), "missing");
    let (plugins, errors) = discover(dir.path());
    assert!(plugins.is_empty());
    assert_eq!(errors.len(), 1);
}

#[cfg(unix)]
fn executable(root: &std::path::Path, body: &str) -> InstalledPlugin {
    use std::os::unix::fs::PermissionsExt;
    manifest(root, "importer");
    let path = root.join("test-plugin/importer");
    fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o700)).unwrap();
    load_plugin(root, "test-plugin").unwrap()
}

#[test]
#[cfg(unix)]
fn runs_a_real_external_process_and_handles_success_cancel_crash() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = ImportRuntime::default();
    let json = serde_json::to_string(&ImportResult::success(document())).unwrap();
    let plugin = executable(dir.path(), &format!("printf '%s' '{json}' > \"$2\""));
    assert_eq!(
        runtime.run(&plugin).unwrap().unwrap().sheets[0].data[0][2],
        "×"
    );
    let plugin = executable(dir.path(), "exit 0");
    assert!(runtime.run(&plugin).unwrap().is_none());
    let plugin = executable(dir.path(), "exit 7");
    assert!(runtime.run(&plugin).is_err());
    let plugin = executable(dir.path(), "printf 'invalid' > \"$2\"");
    assert!(runtime.run(&plugin).is_err());
    let plugin = executable(dir.path(), "exit 0");
    assert!(runtime.run(&plugin).is_ok()); // Busy guard was released.
}

#[test]
#[cfg(unix)]
fn cancels_external_process_without_returning_a_document() {
    use std::{
        sync::Arc,
        time::{Duration, Instant},
    };
    let dir = tempfile::tempdir().unwrap();
    let plugin = executable(dir.path(), "touch started\nwhile :; do :; done");
    let marker = plugin.directory.join("started");
    let runtime = Arc::new(ImportRuntime::default());
    let worker = runtime.clone();
    let thread = std::thread::spawn(move || worker.run(&plugin));
    let deadline = Instant::now() + Duration::from_secs(5);
    while !marker.exists() {
        assert!(Instant::now() < deadline);
        std::thread::sleep(Duration::from_millis(10));
    }
    runtime.cancel();
    assert!(thread.join().unwrap().unwrap().is_none());
}
