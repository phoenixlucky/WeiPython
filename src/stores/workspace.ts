import { computed, reactive, ref } from "vue";
import { defineStore } from "pinia";
import { describeError, invokeCommand, isTauri } from "@/lib/tauri";
import type { ActiveProcess, CondaEnvironment, EnvironmentTarget, OperationResult, PackageInfo, TaskSnapshot, VirtualEnvironment } from "@/types";

export const useWorkspaceStore = defineStore("workspace", () => {
  const conda = ref<CondaEnvironment[]>([]);
  const venvs = ref<VirtualEnvironment[]>([]);
  const packages = ref<PackageInfo[]>([]);
  const selectedTarget = ref<EnvironmentTarget | null>(null);
  const pythonVersions = ref<string[]>([]);
  const condaPythonVersions = ref<string[]>([]);
  const condaPythonSearchStatus = ref("");
  const condaPythonSearchKey = ref("");
  const condaPythonForm = reactive({ major: "3.15", channel: "conda-forge", environment: "", version: "" });
  const pending = ref(0);
  const busy = computed(() => pending.value > 0 || currentTask.value?.status === "running");
  const message = ref("");
  const error = ref("");
  const output = ref("");
  const activeProcesses = ref<ActiveProcess[]>([]);
  const currentTask = ref<TaskSnapshot | null>(null);
  const taskConnectionLost = ref(false);
  const batchRunning = ref(false);
  let batchCancelled = false;
  let taskInFlight = false;
  const inventoryGeneration = ref(0);
  const condaRevision = ref(0);
  const scanRequests = new Map<string, Promise<void>>();
  const scanTimes = new Map<string, number>();
  let packageRequest = 0;
  let lastVenvDirectory = "";
  const targets = computed<EnvironmentTarget[]>(() => [
    ...conda.value.map((item) => ({ targetType: "conda", name: item.name, path: item.prefix })),
    ...venvs.value.map((item) => ({ targetType: "venv", name: item.name, path: item.path, manager: item.manager })),
  ]);

  async function run<T>(action: () => Promise<T>, clearError = true): Promise<T | undefined> {
    pending.value++;
    if (clearError) error.value = "";
    try { return await action(); }
    catch (cause) { if (clearError || !error.value) error.value = describeError(cause); }
    finally { pending.value--; }
  }

  function showResult(result: OperationResult) {
    message.value = result.message;
    output.value = [result.command, result.output].filter(Boolean).join("\n\n");
  }

  function beginCondaRequest() { return ++condaRevision.value; }
  function setConda(value: CondaEnvironment[]) { conda.value = value; scanTimes.set("conda", Date.now()); }
  function invalidateScans() { inventoryGeneration.value++; scanTimes.clear(); }
  async function scan<T>(key: string, command: string, args: Record<string, unknown>, apply: (value: T) => void, force: boolean) {
    if (!isTauri) return;
    const running = scanRequests.get(key);
    if (running) { await running; if (force) return scan(key, command, args, apply, true); return; }
    if (!force && Date.now() - (scanTimes.get(key) || 0) < 15_000) return;
    const generation = inventoryGeneration.value;
    const revision = key === "conda" ? beginCondaRequest() : 0;
    const request = (async () => {
      const value = await run(() => invokeCommand<T>(command, { ...args, forceRefresh: force }), false);
      if (value !== undefined && generation === inventoryGeneration.value && (key !== "conda" || revision === condaRevision.value)) { apply(value); scanTimes.set(key, Date.now()); }
    })();
    scanRequests.set(key, request);
    try { await request; } finally { scanRequests.delete(key); }
  }
  async function loadConda(force = false) { await scan<CondaEnvironment[]>("conda", "list_conda_environments", {}, setConda, force); }
  async function loadVenvs(lastDirectory = lastVenvDirectory, force = false) {
    lastVenvDirectory = lastDirectory.trim();
    const directory = lastVenvDirectory;
    await scan<VirtualEnvironment[]>(`venv:${directory}`, "list_virtual_environments", { lastDirectory: directory || null }, (value) => { if (lastVenvDirectory === directory) venvs.value = value; }, force);
  }
  async function loadPythonVersions(force = false) { await scan<string[]>("python", "discover_python_versions", {}, (value) => { pythonVersions.value = value; }, force); }
  async function uninstallPython(path: string) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_uninstall_python", { path })); if (task?.status === "completed") await refreshAll(); }
  async function startSystemPythonUpgrade(path: string) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_upgrade_python", { path })); if (task?.status === "completed") await loadPythonVersions(true); }
  async function createConda(payload: Record<string, unknown>) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_create_conda_environment", { request: payload })); await loadConda(true); return task; }
  async function deleteConda(name: string) { await runTask(() => invokeCommand<TaskSnapshot>("start_delete_conda_environment", { name })); await loadConda(true); }
  async function exportConda(payload: Record<string, unknown>) { await runTask(() => invokeCommand<TaskSnapshot>("start_export_conda_environment", { request: payload })); }
  async function exportAllConda(directory: string) { await runTask(() => invokeCommand<TaskSnapshot>("start_export_all_conda_environments", { request: { directory } })); }
  async function upgradeConda() { return runTask(() => invokeCommand<TaskSnapshot>("start_upgrade_conda")); }
  async function acceptCondaTos() { const value = await run(() => invokeCommand<OperationResult>("accept_conda_tos")); if (value) showResult(value); return Boolean(value); }
  async function installUv(version = "", installDirectory = "") { return runTask(() => invokeCommand<TaskSnapshot>("start_install_uv", { version: version.trim() || null, installDirectory: installDirectory.trim() || null })); }
  async function uninstallUv(path = "") { return runTask(() => invokeCommand<TaskSnapshot>("start_uninstall_uv", { path })); }
  async function uninstallUvPython(path = "") { return runTask(() => invokeCommand<TaskSnapshot>("start_uninstall_uv_python", { path })); }
  async function importConda(payload: Record<string, unknown>) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_import_conda_environment", { request: payload })); await loadConda(true); return task; }
  async function createVenv(payload: Record<string, unknown>) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_create_virtual_environment", { request: payload })); await loadVenvs(undefined, true); return task; }
  async function exportUvEnvironment(environmentPath: string, filePath: string) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_export_uv_environment", { request: { environmentPath, filePath } })); return task; }
  async function importUvEnvironment(environmentPath: string, filePath: string) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_import_uv_environment", { request: { environmentPath, filePath } })); return task; }
  async function deleteVenv(path: string) { const value = await run(() => invokeCommand<OperationResult>("delete_virtual_environment", { path })); if (value) { showResult(value); await loadVenvs(undefined, true); } }
  async function loadPackages(target: EnvironmentTarget | null) {
    const request = ++packageRequest;
    if (!target) { selectedTarget.value = null; packages.value = []; return; }
    if (JSON.stringify(selectedTarget.value) !== JSON.stringify(target)) packages.value = [];
    selectedTarget.value = { ...target };
    pending.value++;
    if (currentTask.value?.status !== "failed") error.value = "";
    try {
      const value = await invokeCommand<PackageInfo[]>("list_packages", { target });
      if (request === packageRequest) packages.value = value;
    } catch (cause) { if (request === packageRequest) error.value = describeError(cause); }
    finally { pending.value--; }
  }
  async function loadProcesses() { if (!isTauri) return; activeProcesses.value = await invokeCommand<ActiveProcess[]>("get_active_processes"); }
  const delay = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  async function waitForTask(initial: TaskSnapshot): Promise<TaskSnapshot> {
    let task = initial;
    currentTask.value = task;
    message.value = "";
    output.value = [task.command, task.output].filter(Boolean).join("\n\n");
    let failures = 0;
    while (task.status === "running") {
      await delay(500);
      try {
        task = await invokeCommand<TaskSnapshot>("get_operation_task", { taskId: task.taskId });
        failures = 0;
      } catch (cause) {
        if (String(cause).includes("任务不存在或已过期")) {
          task = { ...task, status: "failed", message: "任务不存在或已过期，请刷新环境确认实际状态" };
        } else if (++failures < 3) { continue; }
        else { taskConnectionLost.value = true; throw cause; }
      }
      currentTask.value = task;
      output.value = [task.command, task.output].filter(Boolean).join("\n\n");
      await loadProcesses().catch(() => undefined);
    }
    if (task.status === "completed" || task.status === "cancelled") {
      message.value = task.message;
      error.value = "";
    } else {
      error.value = task.message || "后台任务失败";
      message.value = "";
    }
    return task;
  }
  async function runTask(start: () => Promise<TaskSnapshot>): Promise<TaskSnapshot | undefined> {
    if (taskInFlight || currentTask.value?.status === "running") { error.value = "请等待当前任务完成，或重新连接当前任务"; return; }
    taskInFlight = true;
    taskConnectionLost.value = false;
    pending.value++;
    error.value = "";
    try {
      const initial = await start();
      if (batchRunning.value && batchCancelled && initial.status === "running") await invokeCommand("cancel_operation_task", { taskId: initial.taskId });
      return await waitForTask(initial);
    }
    catch (cause) { error.value = describeError(cause, "后台任务启动失败"); return undefined; }
    finally { pending.value--; taskInFlight = false; invalidateScans(); }
  }
  async function cancelCurrentTask() {
    if (batchRunning.value) batchCancelled = true;
    if (!currentTask.value || currentTask.value.status !== "running") return;
    try { await invokeCommand("cancel_operation_task", { taskId: currentTask.value.taskId }); }
    catch (cause) { error.value = describeError(cause, "取消任务失败"); }
  }
  async function reconnectTask() {
    if (taskInFlight || !currentTask.value || currentTask.value.status !== "running") return;
    taskInFlight = true;
    pending.value++;
    taskConnectionLost.value = false;
    try { await waitForTask(currentTask.value); await refreshAll(); }
    catch (cause) { error.value = describeError(cause, "重新连接任务失败"); }
    finally { pending.value--; taskInFlight = false; }
  }
  async function startSetup(payload: Record<string, unknown>) { const task = await runTask(() => invokeCommand<TaskSnapshot>("start_initialize_environment", { request: payload })); if (task?.status === "completed") await refreshAll(); }
  async function startPythonUpgrade(name: string, version: string, channel: string) { await runTask(() => invokeCommand<TaskSnapshot>("start_upgrade_conda_python", { name, version, channel })); await loadConda(true); }
  async function packageAction(payload: Record<string, unknown>) {
    const task = await runTask(() => invokeCommand<TaskSnapshot>("start_package_action", { request: payload }));
    if (task?.status === "completed" && selectedTarget.value) await loadPackages(selectedTarget.value);
    return task;
  }
  async function installPackages(target: EnvironmentTarget, names: string[], indexUrl: string) {
    if (batchRunning.value) return;
    batchRunning.value = true;
    batchCancelled = false;
    pending.value++;
    let completed = 0;
    try {
      for (const packageName of names) {
        if (batchCancelled) break;
        const task = await runTask(() => invokeCommand<TaskSnapshot>("start_package_action", { request: { target, action: "install", packageName, indexUrl } }));
        if (task?.status === "completed") completed++;
        if (batchCancelled || task?.status !== "completed") break;
      }
      const taskError = error.value;
      if (selectedTarget.value) await loadPackages(selectedTarget.value);
      if (taskError) error.value = taskError;
      if (batchCancelled) message.value = `批量安装已停止（已完成 ${completed}/${names.length} 项）`;
    } finally { pending.value--; batchRunning.value = false; }
  }
  function clearLog() { message.value = ""; error.value = ""; output.value = ""; if (currentTask.value?.status !== "running") currentTask.value = null; }

  async function refreshAll(force = true) { await Promise.all([loadConda(force), loadVenvs(undefined, force), loadPythonVersions(force)]); }
  return { conda, venvs, packages, selectedTarget, pythonVersions, condaPythonVersions, condaPythonSearchStatus, condaPythonSearchKey, condaPythonForm, targets, busy, message, error, output, activeProcesses, currentTask, taskConnectionLost, inventoryGeneration, condaRevision, beginCondaRequest, setConda, invalidateScans, loadConda, loadVenvs, loadPythonVersions, uninstallPython, startSystemPythonUpgrade, loadProcesses, createConda, deleteConda, exportConda, exportAllConda, upgradeConda, acceptCondaTos, installUv, uninstallUv, uninstallUvPython, importConda, createVenv, exportUvEnvironment, importUvEnvironment, deleteVenv, loadPackages, packageAction, installPackages, startSetup, startPythonUpgrade, cancelCurrentTask, reconnectTask, clearLog, refreshAll };
});
