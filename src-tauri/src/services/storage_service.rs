use crate::domain::models::AppSettings;
use std::path::{Path, PathBuf};
use serde_json::Value;

static SETTINGS_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn settings_path() -> Result<PathBuf, String> {
    let base = dirs_path().ok_or_else(|| "无法定位应用数据目录".to_string())?;
    Ok(base.join("WJ Python Manager").join("settings.json"))
}

fn legacy_settings_path() -> Result<PathBuf, String> {
    let base = dirs_path().ok_or_else(|| "无法定位应用数据目录".to_string())?;
    Ok(base.join("WeiPython").join("settings.json"))
}

fn dirs_path() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else {
        std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).or_else(|| {
            std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config"))
        })
    }
}

pub async fn read_settings() -> Result<AppSettings, String> {
    let _guard = SETTINGS_LOCK.lock().await;
    read_settings_at(&settings_path()?, &legacy_settings_path()?).await
}

async fn read_settings_at(path: &Path, legacy_path: &Path) -> Result<AppSettings, String> {
    match tokio::fs::read_to_string(path).await {
        Ok(content) => serde_json::from_str(&content).map_err(|error| format!("设置文件损坏: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            match tokio::fs::read_to_string(legacy_path).await {
                Ok(content) => serde_json::from_str(&content).map_err(|error| format!("设置文件损坏: {error}")),
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(AppSettings::default()),
                Err(error) => Err(format!("读取旧设置失败: {error}")),
            }
        }
        Err(error) => Err(format!("读取设置失败: {error}")),
    }
}

pub async fn update_settings(patch: Value) -> Result<AppSettings, String> {
    let changed_conda = patch.get("condaPath").is_some();
    let settings = update_settings_at(&settings_path()?, &legacy_settings_path()?, patch).await?;
    if changed_conda { crate::services::invalidate_inventory(); }
    Ok(settings)
}

async fn update_settings_at(path: &Path, legacy_path: &Path, patch: Value) -> Result<AppSettings, String> {
    let _guard = SETTINGS_LOCK.lock().await;
    let changes = patch.as_object().ok_or("设置更新必须是对象")?;
    let mut current = serde_json::to_value(read_settings_at(path, legacy_path).await?).map_err(|error| error.to_string())?;
    let fields = current.as_object_mut().ok_or("无效的设置格式")?;
    for (key, value) in changes {
        if !fields.contains_key(key) { return Err(format!("不支持的设置字段: {key}")); }
        fields.insert(key.clone(), value.clone());
    }
    let settings: AppSettings = serde_json::from_value(current).map_err(|error| format!("设置格式无效: {error}"))?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|error| format!("创建设置目录失败: {error}"))?;
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|error| format!("序列化设置失败: {error}"))?;
    let temporary_path = path.with_extension("json.tmp");
    tokio::fs::write(&temporary_path, content).await.map_err(|error| format!("写入设置失败: {error}"))?;
    tokio::fs::rename(temporary_path, path).await.map_err(|error| format!("保存设置失败: {error}"))?;
    Ok(settings)
}

fn wallpaper_directory() -> Result<PathBuf, String> {
    Ok(settings_path()?.parent().ok_or("无法定位壁纸目录")?.join("wallpapers"))
}

fn image_extension(bytes: &[u8]) -> Result<&'static str, String> {
    if bytes.len() > 10 * 1024 * 1024 { return Err("压缩后的壁纸仍超过 10MB".into()); }
    if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") { Ok("webp") }
    else if bytes.starts_with(&[0xff, 0xd8, 0xff]) { Ok("jpg") }
    else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { Ok("png") }
    else { Err("壁纸必须是有效的 WebP、JPEG 或 PNG 图片".into()) }
}

pub async fn save_wallpaper(bytes: Vec<u8>) -> Result<String, String> { save_wallpaper_at(&wallpaper_directory()?, &bytes).await }

async fn save_wallpaper_at(directory: &Path, bytes: &[u8]) -> Result<String, String> {
    let extension = image_extension(bytes)?;
    tokio::fs::create_dir_all(directory).await.map_err(|error| format!("创建壁纸目录失败: {error}"))?;
    let unique = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let path = directory.join(format!("wallpaper-{}-{unique}.{extension}", std::process::id()));
    tokio::fs::write(&path, bytes).await.map_err(|error| format!("保存壁纸失败: {error}"))?;
    Ok(path.to_string_lossy().into_owned())
}

pub async fn read_wallpaper(path: String) -> Result<Vec<u8>, String> { read_wallpaper_at(&wallpaper_directory()?, Path::new(&path)).await }

async fn read_wallpaper_at(directory: &Path, path: &Path) -> Result<Vec<u8>, String> {
    let directory = tokio::fs::canonicalize(directory).await.map_err(|error| format!("壁纸目录不存在: {error}"))?;
    let path = tokio::fs::canonicalize(path).await.map_err(|error| format!("壁纸文件不存在: {error}"))?;
    if path.parent() != Some(directory.as_path()) { return Err("只能读取应用壁纸目录中的文件".into()); }
    let metadata = tokio::fs::metadata(&path).await.map_err(|error| error.to_string())?;
    if metadata.len() > 10 * 1024 * 1024 { return Err("壁纸文件超过 10MB".into()); }
    let bytes = tokio::fs::read(path).await.map_err(|error| format!("读取壁纸失败: {error}"))?;
    image_extension(&bytes)?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_directory() -> PathBuf {
        let unique = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("wj-settings-test-{}-{unique}", std::process::id()))
    }

    #[tokio::test]
    async fn concurrent_patches_preserve_tool_paths_and_other_fields() {
        let root = test_directory();
        let path = root.join("settings.json");
        let legacy = root.join("legacy.json");
        let (first, second) = tokio::join!(
            update_settings_at(&path, &legacy, json!({"uvPath": "Z:/tools/uv.exe"})),
            update_settings_at(&path, &legacy, json!({"primary": "#123456", "compactMode": false}))
        );
        first.unwrap(); second.unwrap();
        let value = read_settings_at(&path, &legacy).await.unwrap();
        assert_eq!(value.uv_path.as_deref(), Some("Z:/tools/uv.exe"));
        assert_eq!(value.primary.as_deref(), Some("#123456"));
        assert_eq!(value.compact_mode, Some(false));
        update_settings_at(&path, &legacy, json!({"uvPath": null})).await.unwrap();
        assert!(read_settings_at(&path, &legacy).await.unwrap().uv_path.is_none());
        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn legacy_settings_are_merged_and_invalid_patches_do_not_destroy_them() {
        let root = test_directory();
        tokio::fs::create_dir_all(&root).await.unwrap();
        let path = root.join("settings.json");
        let legacy = root.join("legacy.json");
        tokio::fs::write(&legacy, r##"{"condaPath":"Z:/conda.exe","primary":"#abcdef"}"##).await.unwrap();
        let merged = update_settings_at(&path, &legacy, json!({"tagline":"hello"})).await.unwrap();
        assert_eq!(merged.conda_path.as_deref(), Some("Z:/conda.exe"));
        let original = tokio::fs::read(&path).await.unwrap();
        assert!(update_settings_at(&path, &legacy, json!({"compactMode":"wrong type"})).await.is_err());
        assert_eq!(tokio::fs::read(&path).await.unwrap(), original);
        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn wallpapers_are_separate_files_and_reads_cannot_escape_the_directory() {
        let root = test_directory();
        let directory = root.join("wallpapers");
        let bytes = b"RIFF\x08\x00\x00\x00WEBPtest";
        let path = save_wallpaper_at(&directory, bytes).await.unwrap();
        assert_eq!(read_wallpaper_at(&directory, Path::new(&path)).await.unwrap(), bytes);
        let settings = update_settings_at(&root.join("settings.json"), &root.join("legacy.json"), json!({"wallpaper": path})).await.unwrap();
        assert!(!settings.wallpaper.unwrap().starts_with("data:"));
        assert!(tokio::fs::metadata(root.join("settings.json")).await.unwrap().len() < 1024);
        let outside = root.join("outside.webp");
        tokio::fs::write(&outside, bytes).await.unwrap();
        assert!(read_wallpaper_at(&directory, &outside).await.is_err());
        assert!(save_wallpaper_at(&directory, b"not an image").await.is_err());
        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        std::fs::remove_dir_all(root).unwrap();
    }
}
