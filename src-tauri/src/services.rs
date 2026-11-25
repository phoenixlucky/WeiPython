pub mod system_service;
pub mod storage_service;
pub mod process_service;
pub mod conda_service;
pub mod package_service;
pub mod venv_service;
pub mod setup_service;
pub mod task_service;
pub mod uv_service;
pub mod scan_service;

pub fn invalidate_inventory() {
    conda_service::invalidate_cache();
    venv_service::invalidate_cache();
    system_service::invalidate_cache();
}
