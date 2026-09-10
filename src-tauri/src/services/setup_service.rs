use crate::domain::models::{OperationResult, SetupStatus};
use crate::services::conda_service;
use crate::services::process_service::{failure, resolve_program, run};
use std::path::PathBuf;

const MINICONDA_URL: &str = "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe";

fn home_dir() -> PathBuf { std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from).unwrap_or_else(|| PathBuf::from(".")) }
fn default_install_path() -> String { if cfg!(windows) { "D:\\ProgramData\\miniconda3".into() } else { home_dir().join("miniconda3").to_string_lossy().to_string() } }

pub async fn status() -> SetupStatus {
    let conda_path = resolve_program("conda").await;
    let environment_count = if conda_path.is_some() { conda_service::list().await.map(|items| items.len()).unwrap_or_default() } else { 0 };
    let (conda_version, base_python_version, root_prefix) = if let Some(path) = conda_path.as_deref() {
        let conda_version = {
            let result = run(path, &["--version".into()], None).await;
            result.stdout.lines().chain(result.stderr.lines()).find(|line| !line.trim().is_empty()).map(|line| line.trim().trim_start_matches("conda ").to_string())
        };
        let root_prefix = std::path::Path::new(path).parent().and_then(|parent| parent.parent()).map(|root| root.to_string_lossy().to_string());
        let base_python_version = root_prefix.as_deref().map(|root| {
            if cfg!(windows) { std::path::PathBuf::from(root).join("python.exe") } else { std::path::PathBuf::from(root).join("bin").join("python") }
        }).filter(|python| python.is_file());
        let base_python_version = if let Some(python) = base_python_version {
            let result = run(python.to_string_lossy().as_ref(), &["--version".into()], None).await;
            result.stdout.lines().chain(result.stderr.lines()).find(|line| !line.trim().is_empty()).map(|line| line.trim().trim_start_matches("Python ").to_string())
        } else { None };
        (conda_version, base_python_version, root_prefix)
    } else { (None, None, None) };
    SetupStatus { conda_available: conda_path.is_some(), conda_path, recommended_install_path: default_install_path(), environment_count, platform_supported: cfg!(windows) && cfg!(target_arch = "x86_64"), conda_version, base_python_version, root_prefix }
}

async fn install_miniconda(path: &str) -> Result<OperationResult, String> {
    if !cfg!(windows) { return Err("Miniconda 自动安装当前仅支持 Windows x64".into()); }
    let escaped_path = path.replace('\'', "''");
    let script = format!("$ErrorActionPreference='Stop'; $installer=Join-Path $env:TEMP 'WJ-Python-Miniconda3.exe'; Invoke-WebRequest -UseBasicParsing -Uri '{MINICONDA_URL}' -OutFile $installer; $p=Start-Process -FilePath $installer -ArgumentList @('/InstallationType=JustMe','/RegisterPython=0','/AddToPath=0','/S','/D={escaped_path}') -Wait -PassThru; Remove-Item $installer -Force; if ($p.ExitCode -ne 0) {{ exit $p.ExitCode }}");
    let result = run("powershell.exe", &["-NoProfile".into(), "-ExecutionPolicy".into(), "Bypass".into(), "-Command".into(), script], None).await;
    if !result.ok { return Err(failure(&result, "Miniconda 安装失败")); }
    Ok(OperationResult { ok: true, message: "Miniconda 安装完成".into(), command: result.command, output: result.stdout })
}

pub async fn initialize(install_path: String) -> Result<OperationResult, String> {
    let install_path = install_path.trim();
    if install_path.is_empty() { return Err("Miniconda 安装目录不能为空".into()); }
    if let Some(path) = resolve_program("conda").await {
        return Ok(OperationResult { ok: true, message: "已检测到 Conda，无需重复安装".into(), command: path, output: "Conda 已可用".into() });
    }

    let result = install_miniconda(install_path).await?;
    let executable = PathBuf::from(install_path).join("Scripts").join("conda.exe");
    if !executable.is_file() { return Err("安装结束但未找到 conda.exe".into()); }
    let mut settings = crate::services::storage_service::read_settings().await?;
    settings.conda_path = Some(executable.to_string_lossy().to_string());
    crate::services::storage_service::write_settings(&settings).await?;
    Ok(result)
}
