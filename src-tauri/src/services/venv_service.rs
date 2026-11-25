use crate::domain::models::{OperationResult, VirtualEnvironment};
use crate::services::process_service::{failure, resolve_program, run};
use std::path::{Path, PathBuf};
use crate::services::scan_service::{ScanCache, SCAN_TTL, bounded_map};

static INVENTORY: ScanCache<Vec<VirtualEnvironment>> = ScanCache::new(SCAN_TTL);
pub fn invalidate_cache() { INVENTORY.invalidate(); }

fn home_dir() -> PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

pub fn default_directory() -> String { home_dir().join("venvs").to_string_lossy().to_string() }

fn python_executable(path: &Path) -> PathBuf { if cfg!(windows) { path.join("Scripts").join("python.exe") } else { path.join("bin").join("python") } }

async fn python_version(path: &Path) -> String {
    let executable = python_executable(path);
    let result = run(executable.to_string_lossy().as_ref(), &["--version".into()], None).await;
    result.stdout.lines().chain(result.stderr.lines()).next().unwrap_or("未知").replace("Python ", "")
}

async fn inspect(path: &Path) -> Option<VirtualEnvironment> {
    if !path.is_dir() || !python_executable(path).is_file() || !path.join("pyvenv.cfg").is_file() { return None; }
    let name = path.file_name()?.to_string_lossy().to_string();
    let manager = match tokio::fs::read_to_string(path.join(".weipython-env.json")).await {
        Ok(content) if serde_json::from_str::<serde_json::Value>(&content).ok().and_then(|value| value.get("manager").and_then(|v| v.as_str()).map(str::to_owned)).as_deref() == Some("uv") => "uv",
        _ => "venv",
    };
    Some(VirtualEnvironment { name, path: path.to_string_lossy().to_string(), manager: manager.into(), python_version: python_version(path).await })
}

pub async fn list(last_directory: Option<String>) -> Vec<VirtualEnvironment> {
    let key = last_directory.clone().unwrap_or_default();
    INVENTORY.get(&key, || async { Ok(list_uncached(last_directory).await) }).await.unwrap_or_default()
}

async fn list_uncached(last_directory: Option<String>) -> Vec<VirtualEnvironment> {
    let mut roots = vec![home_dir().join("venvs"), home_dir().join("envs"), home_dir().join("Envs")];
    if let Ok(content) = tokio::fs::read_to_string(registry_path()).await {
        if let Ok(saved) = serde_json::from_str::<Vec<PathBuf>>(&content) { roots.extend(saved); }
    }
    if let Some(path) = last_directory { roots.push(PathBuf::from(path)); }
    roots.sort();
    roots.dedup();
    let mut candidates = Vec::new();
    for root in roots {
        if root.join("pyvenv.cfg").is_file() {
            candidates.push(root);
            continue;
        }
        let Ok(mut entries) = tokio::fs::read_dir(root).await else { continue };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.join("pyvenv.cfg").is_file() { candidates.push(path); }
        }
    }
    let mut seen = std::collections::HashSet::new();
    candidates.retain(|path| {
        let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.clone()).to_string_lossy().to_string();
        seen.insert(if cfg!(windows) { canonical.to_lowercase() } else { canonical })
    });
    let mut result: Vec<_> = bounded_map(candidates, |path| async move { inspect(&path).await }).await.into_iter().flatten().collect();
    result.sort_by(|left, right| left.name.cmp(&right.name));
    result
}

pub async fn create(name: String, target_path: String, python_path: Option<String>, manager: Option<String>) -> Result<OperationResult, String> {
    crate::services::task_service::set_stage("检查虚拟环境目录和 Python 解释器");
    if name.trim().is_empty() || target_path.trim().is_empty() { return Err("环境名称和目标目录不能为空".into()); }
    if name == "." || name == ".." || name.contains(['/', '\\', ':']) { return Err("环境名称不能包含路径分隔符".into()); }
    let root = PathBuf::from(target_path);
    tokio::fs::create_dir_all(&root).await.map_err(|error| format!("创建目标目录失败: {error}"))?;
    let path = root.join(&name);
    if path.exists() { return Err("目标目录已存在，请选择新的环境名称".into()); }
    let use_uv = manager.as_deref() == Some("uv");
    let (program, args) = if use_uv {
        let uv = resolve_program("uv").await.ok_or("未检测到 uv。请切换为“Python venv”，或先安装 uv 后再选择 uv")?;
        let mut uv_args = vec!["venv".into()];
        if let Some(python) = python_path.filter(|value| !value.trim().is_empty()) {
            uv_args.extend(["--python".into(), python]);
        }
        uv_args.push(path.to_string_lossy().to_string());
        (uv, uv_args)
    } else {
        let python = if let Some(value) = python_path.filter(|value| !value.trim().is_empty()) {
            value
        } else {
            resolve_program(if cfg!(windows) { "python" } else { "python3" }).await.ok_or("未检测到 Python，请填写可执行文件的完整路径")?
        };
        (python, vec!["-m".into(), "venv".into(), path.to_string_lossy().to_string()])
    };
    if crate::services::task_service::is_cancelled() { return Err("任务已取消".into()); }
    // Reserve the destination so failure cleanup can only remove this operation's directory.
    tokio::fs::create_dir(&path).await.map_err(|error| format!("无法创建新的环境目录，目标可能已存在: {error}"))?;
    crate::services::task_service::set_stage("正在创建虚拟环境");
    let result = run(&program, &args, None).await;
    if !result.ok || crate::services::task_service::is_cancelled() {
        let detail = failure(&result, "创建虚拟环境失败或任务已取消");
        if let Err(error) = tokio::fs::remove_dir_all(&path).await {
            if error.kind() != std::io::ErrorKind::NotFound { return Err(format!("{detail}\n清理未完成的环境失败: {error}，残留目录: {}", path.display())); }
        }
        return Err(detail);
    }
    crate::services::task_service::set_stage("保存并登记虚拟环境");
    let metadata = format!("{{\"manager\":\"{}\"}}", if use_uv { "uv" } else { "venv" });
    if let Err(error) = tokio::fs::write(path.join(".weipython-env.json"), metadata).await {
        let _ = tokio::fs::remove_dir_all(&path).await;
        return Err(format!("写入环境元数据失败，已清理创建的环境: {error}"));
    }
    let mut roots = tokio::fs::read_to_string(registry_path()).await.ok().and_then(|v| serde_json::from_str::<Vec<PathBuf>>(&v).ok()).unwrap_or_default();
    if let Some(parent) = path.parent() { roots.push(parent.to_path_buf()); }
    roots.sort(); roots.dedup();
    let registry = registry_path();
    let temporary = registry.with_extension("json.tmp");
    let content = serde_json::to_vec(&roots).map_err(|e| e.to_string())?;
    if let Err(error) = tokio::fs::write(&temporary, content).await.and_then(|_| std::fs::rename(&temporary, &registry).map_err(std::io::Error::from)) {
        let _ = tokio::fs::remove_file(&temporary).await;
        let _ = tokio::fs::remove_dir_all(&path).await;
        return Err(format!("登记环境失败，已清理创建的环境: {error}"));
    }
    Ok(OperationResult { ok: true, message: format!("虚拟环境 {name} 创建完成"), command: result.command, output: result.stdout })
}

pub async fn export_uv(path: String, file_path: String) -> Result<OperationResult, String> {
    let environment = PathBuf::from(path.trim());
    let output = PathBuf::from(file_path.trim());
    let python = python_executable(&environment);
    if !python.is_file() { return Err("选中的 uv 环境无有效 Python 解释器".into()); }
    if output.as_os_str().is_empty() { return Err("缺少导出文件路径".into()); }
    let uv = resolve_program("uv").await.ok_or("未检测到 uv，请先安装 uv")?;
    let args = vec!["pip".into(), "freeze".into(), "--python".into(), python.to_string_lossy().to_string()];
    let result = run(&uv, &args, None).await;
    if !result.ok { return Err(failure(&result, "导出 uv 环境失败")); }
    tokio::fs::write(&output, &result.stdout).await.map_err(|error| format!("写入导出文件失败: {error}"))?;
    Ok(OperationResult { ok: true, message: "uv 环境依赖导出完成".into(), command: result.command, output: output.to_string_lossy().to_string() })
}

pub async fn import_uv(path: String, file_path: String) -> Result<OperationResult, String> {
    let environment = PathBuf::from(path.trim());
    let requirements = PathBuf::from(file_path.trim());
    let python = python_executable(&environment);
    if !python.is_file() { return Err("选中的 uv 环境无有效 Python 解释器".into()); }
    if !requirements.is_file() { return Err("依赖文件不存在".into()); }
    let uv = resolve_program("uv").await.ok_or("未检测到 uv，请先安装 uv")?;
    let args = vec![
        "pip".into(), "install".into(),
        "--python".into(), python.to_string_lossy().to_string(),
        "--requirement".into(), requirements.to_string_lossy().to_string(),
    ];
    let result = run(&uv, &args, None).await;
    if !result.ok { return Err(failure(&result, "导入 uv 环境依赖失败")); }
    Ok(OperationResult { ok: true, message: "uv 环境依赖导入完成".into(), command: result.command, output: result.stdout })
}

fn registry_path() -> PathBuf { home_dir().join(".wj-python-venv-roots.json") }

pub async fn remove(path: String) -> Result<OperationResult, String> {
    if path.trim().is_empty() { return Err("缺少虚拟环境路径".into()); }
    let target = PathBuf::from(&path);
    if !target.exists() { return Err("虚拟环境不存在".into()); }
    if !target.join("pyvenv.cfg").is_file() || !python_executable(&target).is_file() { return Err("该目录不是有效虚拟环境，拒绝删除".into()); }
    let target_key = std::fs::canonicalize(&target).unwrap_or_else(|_| target.clone()).to_string_lossy().to_ascii_lowercase();
    let registered = list(None).await.into_iter().any(|environment| {
        let environment_path = PathBuf::from(environment.path);
        std::fs::canonicalize(&environment_path).unwrap_or(environment_path).to_string_lossy().to_ascii_lowercase() == target_key
    });
    let owned_metadata = target.join(".weipython-env.json").is_file();
    if !registered && !owned_metadata { return Err("该虚拟环境未被本程序登记，拒绝删除；请先从已发现环境中选择".into()); }
    tokio::fs::remove_dir_all(&target).await.map_err(|error| format!("删除虚拟环境失败: {error}"))?;
    Ok(OperationResult { ok: true, message: "虚拟环境已删除".into(), command: "filesystem.remove_dir_all".into(), output: path })
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    async fn creation_fixture(slow: bool) -> (PathBuf, String) {
        let unique = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root = std::env::temp_dir().join(format!("wj-venv-test-{}-{unique}", std::process::id()));
        tokio::fs::create_dir_all(&root).await.unwrap();
        let script = root.join("fake-python.cmd");
        let delay = if slow { "ping -n 30 127.0.0.1 >nul\r\n" } else { "" };
        tokio::fs::write(&script, format!("@echo off\r\nmkdir \"%~3\\Scripts\"\r\necho fake>\"%~3\\Scripts\\python.exe\"\r\necho home=fake>\"%~3\\pyvenv.cfg\"\r\n{delay}exit /b 1\r\n")).await.unwrap();
        (root, script.to_string_lossy().into_owned())
    }

    #[tokio::test]
    async fn failed_creation_removes_only_the_directory_created_by_the_operation() {
        let (root, script) = creation_fixture(false).await;
        let result = create("new".into(), root.to_string_lossy().into_owned(), Some(script), None).await;
        assert!(result.is_err());
        assert!(!root.join("new").exists(), "partial environment must not block a retry");
        assert!(root.join("fake-python.cmd").exists());
        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        tokio::fs::remove_dir_all(root).await.unwrap();
    }

    #[tokio::test]
    async fn cancelled_creation_cleans_the_partial_environment() {
        let (root, script) = creation_fixture(true).await;
        let target_root = root.to_string_lossy().into_owned();
        let task = crate::services::task_service::start("venv-create-test", "starting", async move { create("new".into(), target_root, Some(script), None).await });
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            while !root.join("new").join("pyvenv.cfg").exists() { tokio::time::sleep(std::time::Duration::from_millis(10)).await; }
        }).await.unwrap();
        crate::services::task_service::cancel(&task.task_id).unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(5), async {
            while crate::services::task_service::snapshot(&task.task_id).unwrap().status == "running" { tokio::time::sleep(std::time::Duration::from_millis(10)).await; }
        }).await.unwrap();
        assert!(!root.join("new").exists(), "cancelled creation must remove its partial files");
        assert_eq!(root.parent(), Some(std::env::temp_dir().as_path()));
        tokio::fs::remove_dir_all(root).await.unwrap();
    }
}
