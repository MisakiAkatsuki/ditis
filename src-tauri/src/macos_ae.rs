use std::path::Path;
use std::process::Command;

/// Use AE's scripting dictionary, without UI automation or a hard-coded version.
pub fn run_script(path: &Path) -> Result<(), String> {
    let output = Command::new("/usr/bin/osascript")
        .args(["-l", "JavaScript", "-e", include_str!("ae-macos.js"), "--"])
        .arg(path)
        .output()
        .map_err(|e| format!("After Effectsへのスクリプト送信エラー: {e}"))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(format!(
            "After Effectsへのスクリプト送信に失敗しました: {}\n\
             macOSの「システム設定 > プライバシーとセキュリティ > オートメーション」で\
             DiTiSによるAfter Effectsの制御を許可してください。\n\
             AEの「スクリプトによるファイルへのアクセスとネットワークアクセスを許可」も確認してください。",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}
