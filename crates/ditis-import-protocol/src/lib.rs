//! Versioned, file-based import contract. No UI, AI provider or network dependency.
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};

pub const API_VERSION: u32 = 1;
pub const MAX_RESULT_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_CELLS: usize = 1_000_000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Sheet {
    pub name: String,
    pub fps: f64,
    pub frames: usize,
    pub frame_page_size: usize,
    pub layers: Vec<String>,
    pub data: Vec<Vec<String>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Document {
    pub version: String,
    pub sheets: Vec<Sheet>,
}

fn text_valid(value: &str, max: usize) -> bool {
    value.chars().count() <= max && !value.chars().any(char::is_control)
}

impl Document {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != "1.0" || self.sheets.is_empty() || self.sheets.len() > 32 {
            return Err("Unsupported document version or sheet count".into());
        }
        let mut cells = 0usize;
        for s in &self.sheets {
            if s.name.trim().is_empty()
                || !text_valid(&s.name, 256)
                || !s.fps.is_finite()
                || !(1.0..=240.0).contains(&s.fps)
                || !(1..=20_000).contains(&s.frames)
                || !(1..=20_000).contains(&s.frame_page_size)
                || s.layers.is_empty()
                || s.layers.len() > 128
                || s.layers
                    .iter()
                    .any(|n| n.trim().is_empty() || !text_valid(n, 128))
                || s.data.len() > s.layers.len()
                || s.data
                    .iter()
                    .any(|col| col.len() > s.frames || col.iter().any(|v| !text_valid(v, 128)))
            {
                return Err("Invalid sheet dimensions, names or cell values".into());
            }
            cells += s.frames * s.layers.len();
            if cells > MAX_CELLS {
                return Err("Import exceeds 1,000,000 cells".into());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImportResult {
    pub api_version: u32,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document: Option<Document>,
}

impl ImportResult {
    pub fn success(document: Document) -> Self {
        Self {
            api_version: API_VERSION,
            status: "ok".into(),
            document: Some(document),
        }
    }
    pub fn cancelled() -> Self {
        Self {
            api_version: API_VERSION,
            status: "cancelled".into(),
            document: None,
        }
    }
    pub fn into_document(self) -> Result<Option<Document>, String> {
        if self.api_version != API_VERSION {
            return Err("Unsupported plugin API version".into());
        }
        match (self.status.as_str(), self.document) {
            ("cancelled", None) => Ok(None),
            ("ok", Some(document)) => {
                document.validate()?;
                Ok(Some(document))
            }
            _ => Err("Invalid plugin result".into()),
        }
    }
}

pub fn read_limited(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > limit {
        return Err("File exceeds size limit".into());
    }
    Ok(bytes)
}

/// Write atomically so a crash cannot expose half a JSON document to the host.
pub fn write_json(path: &Path, value: &impl Serialize) -> Result<(), String> {
    use std::io::Write;
    let mut file =
        tempfile::NamedTempFile::new_in(path.parent().ok_or("Missing parent directory")?)
            .map_err(|e| e.to_string())?;
    serde_json::to_writer(&mut file, value).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    file.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PluginManifest {
    pub api_version: u32,
    pub id: String,
    pub name: String,
    pub menu_label: std::collections::BTreeMap<String, String>,
    pub executable: String,
}

#[derive(Clone, Debug)]
pub struct InstalledPlugin {
    pub manifest: PluginManifest,
    pub executable: PathBuf,
    pub directory: PathBuf,
}

pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

pub fn load_plugin(root: &Path, id: &str) -> Result<InstalledPlugin, String> {
    if !valid_id(id) {
        return Err("Invalid plugin ID".into());
    }
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let directory = root.join(id).canonicalize().map_err(|e| e.to_string())?;
    if !directory.starts_with(&root) {
        return Err("Plugin directory is outside plugin folder".into());
    }
    let bytes = read_limited(&directory.join("plugin.json"), 16 * 1024)?;
    let manifest: PluginManifest = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    if manifest.api_version != API_VERSION
        || manifest.id != id
        || manifest.name.trim().is_empty()
        || !text_valid(&manifest.name, 128)
        || manifest.menu_label.is_empty()
        || manifest
            .menu_label
            .values()
            .any(|label| label.trim().is_empty() || !text_valid(label, 128))
    {
        return Err("Invalid manifest or unsupported plugin API version".into());
    }
    let relative = Path::new(&manifest.executable);
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("Executable must be a relative path within the plugin".into());
    }
    let executable = directory
        .join(relative)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !executable.starts_with(&directory) || !executable.is_file() {
        return Err("Executable is outside the plugin directory or missing".into());
    }
    Ok(InstalledPlugin {
        manifest,
        executable,
        directory,
    })
}

pub fn discover(root: &Path) -> (Vec<InstalledPlugin>, Vec<String>) {
    let mut plugins = Vec::new();
    let mut errors = Vec::new();
    let Ok(entries) = fs::read_dir(root) else {
        return (plugins, errors);
    };
    for entry in entries.flatten().take(128) {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let id = entry.file_name().to_string_lossy().into_owned();
        match load_plugin(root, &id) {
            Ok(plugin) => plugins.push(plugin),
            Err(error) => errors.push(format!("{id}: {error}")),
        }
    }
    plugins.sort_by(|a, b| a.manifest.id.cmp(&b.manifest.id));
    (plugins, errors)
}

#[derive(Default)]
pub struct ImportRuntime {
    busy: AtomicBool,
    cancelled: AtomicBool,
    child: Mutex<Option<std::process::Child>>,
}

impl ImportRuntime {
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
        if let Ok(mut slot) = self.child.lock() {
            if let Some(child) = slot.as_mut() {
                let _ = child.kill();
            }
        }
    }

    pub fn run(&self, plugin: &InstalledPlugin) -> Result<Option<Document>, String> {
        if self.busy.swap(true, Ordering::SeqCst) {
            return Err("Another import plugin is already running".into());
        }
        struct BusyGuard<'a>(&'a AtomicBool);
        impl Drop for BusyGuard<'_> {
            fn drop(&mut self) {
                self.0.store(false, Ordering::SeqCst);
            }
        }
        let _busy = BusyGuard(&self.busy);
        self.cancelled.store(false, Ordering::SeqCst);
        let session = tempfile::Builder::new()
            .prefix("ditis-import-")
            .tempdir()
            .map_err(|e| e.to_string())?;
        let result_path = session.path().join("result.json");
        // Serialize spawn with cancel so application shutdown can kill immediately.
        let mut slot = self
            .child
            .lock()
            .map_err(|_| "Plugin process state is unavailable")?;
        if self.cancelled.load(Ordering::SeqCst) {
            return Ok(None);
        }
        let child = Command::new(&plugin.executable)
            .current_dir(&plugin.directory)
            .arg("--ditis-result")
            .arg(&result_path)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Cannot start plugin: {e}"))?;
        *slot = Some(child);
        drop(slot);
        struct ChildGuard<'a>(&'a Mutex<Option<std::process::Child>>);
        impl Drop for ChildGuard<'_> {
            fn drop(&mut self) {
                if let Some(mut child) = self.0.lock().unwrap_or_else(|e| e.into_inner()).take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
        let _child = ChildGuard(&self.child);
        let status = loop {
            if self.cancelled.load(Ordering::SeqCst) {
                return Ok(None);
            }
            let status = self
                .child
                .lock()
                .map_err(|_| "Plugin process state is unavailable")?
                .as_mut()
                .ok_or("Plugin process disappeared")?
                .try_wait()
                .map_err(|e| e.to_string())?;
            if let Some(status) = status {
                break status;
            }
            thread::sleep(Duration::from_millis(100));
        };
        if !status.success() {
            return Err(format!("Plugin exited unsuccessfully ({status})"));
        }
        if !result_path.exists() {
            return Ok(None);
        } // Closing the plugin cancels the import.
        let bytes = read_limited(&result_path, MAX_RESULT_BYTES)?;
        let result: ImportResult =
            serde_json::from_slice(&bytes).map_err(|e| format!("Invalid plugin result: {e}"))?;
        result.into_document()
    }
}
