const state = {
  overview: null,
  conda: [],
  venvs: [],
  pythonVersionsLoaded: false,
  condaLoading: false,
  condaSelectedMajor: null,
  condaFullVersions: [],
  condaFullVersionsLoading: false,
  condaChannel: "defaults",
  installedPackages: [],
  setup: null,
  setupTask: null,
  pythonUpgradeCheck: null
};

const elements = {
  statusPill: document.querySelector("#statusPill"),
  globalLogStatus: document.querySelector("#globalLogStatus"),
  globalLogTitle: document.querySelector("#globalLogTitle"),
  globalLogMessage: document.querySelector("#globalLogMessage"),
  globalLogOutput: document.querySelector("#globalLogOutput"),
  clearGlobalLogButton: document.querySelector("#clearGlobalLogButton"),
  heroNodeVersion: document.querySelector("#heroNodeVersion"),
  heroCondaState: document.querySelector("#heroCondaState"),
  overviewStats: document.querySelector("#overviewStats"),
  pythonVersionsList: document.querySelector("#pythonVersionsList"),
  pythonVersionCount: document.querySelector("#pythonVersionCount"),
  condaOverviewList: document.querySelector("#condaOverviewList"),
  condaEnvCount: document.querySelector("#condaEnvCount"),
  condaList: document.querySelector("#condaList"),
  condaInventoryMeta: document.querySelector("#condaInventoryMeta"),
  venvList: document.querySelector("#venvList"),
  venvInventoryMeta: document.querySelector("#venvInventoryMeta"),
  packageTargetSelect: document.querySelector("#packageTargetSelect"),
  installedPackageSelect: document.querySelector("#installedPackageSelect"),
  pipSourceSelect: document.querySelector("#pipSourceSelect"),
  customPipSourceField: document.querySelector("#customPipSourceField"),
  customPipSourceInput: document.querySelector("#customPipSourceInput"),
  condaSourceSelect: document.querySelector("#condaSourceSelect"),
  condaExportSourceSelect: document.querySelector("#condaExportSourceSelect"),
  condaExportAutoPathButton: document.querySelector("#condaExportAutoPathButton"),
  condaExportBrowseButton: document.querySelector("#condaExportBrowseButton"),
  condaExportAllAutoPathButton: document.querySelector("#condaExportAllAutoPathButton"),
  condaExportAllBrowseButton: document.querySelector("#condaExportAllBrowseButton"),
  condaModeSelect: document.querySelector("#condaModeSelect"),
  condaPythonFields: document.querySelector("#condaPythonFields"),
  condaCloneFields: document.querySelector("#condaCloneFields"),
  condaSummary: document.querySelector("#condaSummary"),
  confirmModal: document.querySelector("#confirmModal"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  confirmCancelButton: document.querySelector("#confirmCancelButton"),
  confirmAcceptButton: document.querySelector("#confirmAcceptButton"),
  refreshInstalledPackagesButton: document.querySelector("#refreshInstalledPackagesButton"),
  upgradeNodeButton: document.querySelector("#upgradeNodeButton"),
  upgradeAllPackagesButton: document.querySelector("#upgradeAllPackagesButton"),
  checkPythonUpgradeButton: document.querySelector("#checkPythonUpgradeButton"),
  upgradePythonButton: document.querySelector("#upgradePythonButton"),
  upgradePythonVersionSelect: document.querySelector("#upgradePythonVersionSelect"),
  upgradeCondaChannelRadios: document.querySelectorAll("input[name='upgradeCondaChannel']"),
  condaMajorVersionsList: document.querySelector("#condaMajorVersionsList"),
  condaVersionDetailCard: document.querySelector("#condaVersionDetailCard"),
  condaVersionDetailTitle: document.querySelector("#condaVersionDetailTitle"),
  condaPythonVersionsList: document.querySelector("#condaPythonVersionsList"),
  condaPythonVersionsMeta: document.querySelector("#condaPythonVersionsMeta"),
  refreshCondaPythonVersionsButton: document.querySelector("#refreshCondaPythonVersionsButton"),
  condaChannelRadios: document.querySelectorAll("input[name='condaChannel']"),
  condaPythonVersionSelect: document.querySelector("#condaPythonVersionSelect"),
  condaClonePythonVersionSelect: document.querySelector("#condaClonePythonVersionSelect"),
  condaCreateChannelSelect: document.querySelector("#condaCreateChannelSelect"),
  condaCloneChannelSelect: document.querySelector("#condaCloneChannelSelect"),
  refreshCondaCreateVersionsButton: document.querySelector("#refreshCondaCreateVersionsButton"),
  navAboutButton: document.querySelector("#navAboutButton"),
  aboutModal: document.querySelector("#aboutModal"),
  aboutCloseButton: document.querySelector("#aboutCloseButton"),
  aboutPlatform: document.querySelector("#aboutPlatform"),
  aboutNodeVersion: document.querySelector("#aboutNodeVersion"),
  aboutCondaState: document.querySelector("#aboutCondaState"),
  setupForm: document.querySelector("#setupForm"),
  setupInstallPath: document.querySelector("#setupInstallPath"),
  setupStateBadge: document.querySelector("#setupStateBadge"),
  setupProgressText: document.querySelector("#setupProgressText"),
  setupProgressBar: document.querySelector("#setupProgressBar"),
  setupCondaPackages: document.querySelector("#setupCondaPackages"),
  setupPipPackages: document.querySelector("#setupPipPackages"),
  startSetupButton: document.querySelector("#startSetupButton"),
  refreshSetupButton: document.querySelector("#refreshSetupButton"),
  minicondaMaintenanceState: document.querySelector("#minicondaMaintenanceState"),
  minicondaVersion: document.querySelector("#minicondaVersion"),
  minicondaBasePython: document.querySelector("#minicondaBasePython"),
  minicondaRootPath: document.querySelector("#minicondaRootPath"),
  minicondaEnvironmentCount: document.querySelector("#minicondaEnvironmentCount"),
  minicondaMaintenanceNote: document.querySelector("#minicondaMaintenanceNote"),
  upgradeMinicondaButton: document.querySelector("#upgradeMinicondaButton"),
  skinButton: document.querySelector("#skinButton"),
  skinModal: document.querySelector("#skinModal"),
  skinCloseButton: document.querySelector("#skinCloseButton"),
  skinImportButton: document.querySelector("#skinImportButton"),
  skinResetButton: document.querySelector("#skinResetButton"),
  skinFileInput: document.querySelector("#skinFileInput"),
  skinNote: document.querySelector("#skinNote"),
  skinPreviewInner: document.querySelector("#skinPreviewInner"),
  skinTaglineInput: document.querySelector("#skinTaglineInput"),
  skinTaglineResetButton: document.querySelector("#skinTaglineResetButton"),
  skinPrimaryColor: document.querySelector("#skinPrimaryColor"),
  skinSecondaryColor: document.querySelector("#skinSecondaryColor"),
  skinInkColor: document.querySelector("#skinInkColor"),
  skinColorsResetButton: document.querySelector("#skinColorsResetButton")
};

let confirmResolver = null;
let operationProgressTimer = null;
let processMonitorTimer = null;
let processMonitorEnabled = false;
let activeProcesses = [];
let globalLogDetails = elements.globalLogOutput?.textContent || "尚未开始。";
const PYTHON_UPGRADE_CHECK_TIMEOUT_MS = 300000;

function scrollGlobalLogToBottom() {
  if (elements.globalLogOutput) {
    elements.globalLogOutput.scrollTop = elements.globalLogOutput.scrollHeight;
  }
}

function renderGlobalLogOutput() {
  if (!elements.globalLogOutput) {
    return;
  }
  const processLines = activeProcesses.length
    ? [
        "",
        "[进程监控]",
        ...activeProcesses.map((processInfo) =>
          `PID ${processInfo.pid} · 已运行 ${processInfo.elapsedSeconds} 秒 · ${processInfo.command}`
        )
      ]
    : [];
  elements.globalLogOutput.textContent = `${globalLogDetails || "尚未开始。"}${processLines.join("\n")}`;
  scrollGlobalLogToBottom();
}

async function refreshActiveProcesses() {
  try {
    const processes = await request("/api/processes");
    activeProcesses = Array.isArray(processes) ? processes : [];
    renderGlobalLogOutput();
  } catch {
    // 进程监控失败不影响当前操作本身。
  }

  if (!processMonitorEnabled && !activeProcesses.length && processMonitorTimer) {
    clearInterval(processMonitorTimer);
    processMonitorTimer = null;
  }
}

function enableProcessMonitor() {
  processMonitorEnabled = true;
  if (!processMonitorTimer) {
    processMonitorTimer = setInterval(() => {
      void refreshActiveProcesses();
    }, 700);
  }
  void refreshActiveProcesses();
}

function disableProcessMonitor() {
  processMonitorEnabled = false;
  void refreshActiveProcesses();
}

function setGlobalLog({ eyebrow, title, message, details } = {}) {
  if (eyebrow !== undefined) {
    elements.globalLogStatus.textContent = eyebrow;
  }
  if (title !== undefined) {
    elements.globalLogTitle.textContent = title;
  }
  if (message !== undefined) {
    elements.globalLogMessage.textContent = message || "等待操作。";
  }
  if (details !== undefined) {
    globalLogDetails = details || "尚未开始。";
  }
  renderGlobalLogOutput();
}

function appendGlobalLog(message) {
  const text = String(message || "").trim();
  if (!text) return;
  const stamp = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const line = `[${stamp}] ${text}`;
  globalLogDetails = globalLogDetails && globalLogDetails !== "尚未开始。"
    ? `${globalLogDetails}\n${line}`
    : line;
  renderGlobalLogOutput();
}

function setBusy(message) {
  elements.statusPill.textContent = "处理中";
  setGlobalLog({ eyebrow: "处理中", message });
  appendGlobalLog(message);
  enableProcessMonitor();
}

function setReady(message = "等待操作。") {
  elements.statusPill.textContent = "就绪";
  setGlobalLog({ eyebrow: "就绪", message });
  appendGlobalLog(message);
  disableProcessMonitor();
}

function setError(message) {
  elements.statusPill.textContent = "异常";
  setGlobalLog({ eyebrow: "异常", message });
  appendGlobalLog(message);
  disableProcessMonitor();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function askConfirm({ title, message, confirmText = "确认" }) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAcceptButton.textContent = confirmText;
  elements.confirmModal.classList.remove("hidden");

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(result) {
  elements.confirmModal.classList.add("hidden");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

function showOperationModal({ eyebrow = "Operation", title, message, details = "", closable = false }) {
  setGlobalLog({ eyebrow, title, message, details });
}

function updateOperationModal({ eyebrow, title, message, details, closable }) {
  setGlobalLog({ eyebrow, title, message, details });
}

function clearOperationProgressTimer() {
  if (operationProgressTimer) {
    clearInterval(operationProgressTimer);
    operationProgressTimer = null;
  }
}

function formatProgressDetails(steps, activeIndex, extraLines = []) {
  const lines = steps.map((step, index) => {
    if (index < activeIndex) {
      return `[已完成] ${step}`;
    }
    if (index === activeIndex) {
      return `[进行中] ${step}`;
    }
    return `[等待中] ${step}`;
  });

  if (extraLines.length) {
    lines.push("", ...extraLines);
  }

  return lines.join("\n");
}

function startOperationProgress({ eyebrow, title, message, steps, extraLines = [], stepIntervalMs = 1600 }) {
  clearOperationProgressTimer();

  let activeIndex = 0;
  showOperationModal({
    eyebrow,
    title,
    message,
    details: formatProgressDetails(steps, activeIndex, extraLines),
    closable: false
  });

  operationProgressTimer = setInterval(() => {
    activeIndex = Math.min(activeIndex + 1, steps.length - 1);
    updateOperationModal({
      details: formatProgressDetails(steps, activeIndex, extraLines)
    });
  }, stepIntervalMs);

  return {
    complete({ eyebrow: nextEyebrow = "Completed", title: nextTitle, message: nextMessage, details, closable = true }) {
      clearOperationProgressTimer();
      updateOperationModal({
        eyebrow: nextEyebrow,
        title: nextTitle,
        message: nextMessage,
        details,
        closable
      });
    },
    fail({ eyebrow: nextEyebrow = "Failed", title: nextTitle, message: nextMessage, details, closable = true }) {
      clearOperationProgressTimer();
      updateOperationModal({
        eyebrow: nextEyebrow,
        title: nextTitle,
        message: nextMessage,
        details,
        closable
      });
    }
  };
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 0;
  const timeoutId = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "请求失败");
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`请求超时（${timeoutMs}ms）`);
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function switchPanel(panelName) {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `panel-${panelName}`);
  });

  // 首次切换到包管理面板时懒加载已安装包
  if (panelName === "packages" && !state.installedPackages.length) {
    loadInstalledPackages({ silent: true }).catch(() => {});
  }
  if (panelName === "setup" && !state.setup) {
    loadSetupStatus().catch((error) => setError(error.message));
  }
}

const SETUP_STAGE_ORDER = ["detect", "download", "resolve", "environment", "packages", "complete"];

function renderSetupPackageCatalog(catalog = {}) {
  const renderGroup = (items, type) => (items || []).map((item) => `
    <label class="package-choice">
      <input type="checkbox" name="${type}PackageIds" value="${escapeHtml(item.id)}"${item.defaultSelected ? " checked" : ""} />
      <span class="package-choice-copy">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </span>
    </label>
  `).join("");

  elements.setupCondaPackages.innerHTML = renderGroup(catalog.conda, "conda");
  elements.setupPipPackages.innerHTML = renderGroup(catalog.pip, "pip");
}

function renderSetupTask(task) {
  state.setupTask = task;
  const progress = Number(task?.progress || 0);
  elements.setupProgressText.textContent = `${progress}%`;
  elements.setupProgressBar.style.width = `${progress}%`;
  elements.setupStateBadge.textContent = task?.message || "等待开始";

  const visualStage = task?.stage === "install" ? "download" : task?.stage || "detect";
  const currentIndex = SETUP_STAGE_ORDER.indexOf(visualStage);
  document.querySelectorAll("[data-setup-stage]").forEach((item) => {
    const itemIndex = SETUP_STAGE_ORDER.indexOf(item.dataset.setupStage);
    item.classList.toggle("complete", task?.status === "completed" || itemIndex < currentIndex);
    item.classList.toggle("active", task?.status === "running" && itemIndex === currentIndex);
  });
}

async function loadSetupStatus(options = {}) {
  if (!options.silent) setBusy("正在检测初始化状态...");
  const result = await request("/api/setup/status", { timeoutMs: 20000 });
  state.setup = result;
  if (!elements.setupInstallPath.value) {
    elements.setupInstallPath.value = result.recommendedInstallPath;
  }
  renderSetupPackageCatalog(result.packageCatalog);
  const miniconda = result.miniconda || {};
  elements.minicondaVersion.textContent = miniconda.condaVersion || "未安装";
  elements.minicondaBasePython.textContent = miniconda.basePythonVersion || "-";
  elements.minicondaRootPath.textContent = miniconda.rootPrefix || "-";
  elements.minicondaEnvironmentCount.textContent = String(miniconda.environmentCount || 0);
  elements.minicondaMaintenanceState.textContent = miniconda.available ? "已连接" : "未检测到";
  elements.minicondaMaintenanceNote.textContent = !miniconda.available
    ? "请先完成 Miniconda 初始化安装。"
    : miniconda.rootWritable
      ? "只更新 base 中的 Conda 核心包，不修改已有业务环境；升级前会自动备份 base 配置。"
      : "当前安装目录需要管理员权限。查看功能可用；升级时请以管理员身份运行 WeiPython。";
  elements.upgradeMinicondaButton.disabled = !miniconda.available || !miniconda.rootWritable;
  elements.setupStateBadge.textContent = result.condaAvailable
    ? `已检测到 Conda · ${result.environments.length} 个环境`
    : result.platformSupported
      ? "尚未安装 Conda"
      : `不支持自动安装 · ${result.platform}/${result.arch}`;
  elements.startSetupButton.disabled = !result.platformSupported && !result.condaAvailable;
  if (!options.silent) setReady("初始化状态已更新。");
  return result;
}

async function pollMinicondaUpgradeTask(taskId) {
  while (true) {
    const task = await request(`/api/setup/tasks/${encodeURIComponent(taskId)}`, { timeoutMs: 20000 });
    updateOperationModal({
      eyebrow: task.status === "running" ? "Miniconda Maintenance" : task.status === "completed" ? "Completed" : "Failed",
      title: task.status === "running" ? "正在检查并升级 Miniconda" : task.status === "completed" ? "Miniconda 维护完成" : "Miniconda 维护失败",
      message: task.message,
      details: task.output,
      closable: task.status !== "running"
    });
    if (task.status !== "running") return task;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function upgradeMiniconda() {
  const miniconda = state.setup?.miniconda;
  if (!miniconda?.available) {
    setError("未检测到 Miniconda，请先完成初始化安装。");
    return;
  }
  if (!miniconda.rootWritable) {
    setError("Miniconda 安装目录不可写，请以管理员身份重新启动 WeiPython 后再升级。");
    return;
  }
  elements.upgradeMinicondaButton.disabled = true;
  try {
    setBusy("正在检查 Miniconda 更新...");
    const check = await request("/api/setup/miniconda-upgrade-check", {
      method: "POST",
      timeoutMs: 60000,
      body: JSON.stringify({ installPath: miniconda.rootPrefix })
    });
    if (!check.updateAvailable) {
      setReady(`Conda ${check.currentCondaVersion} 已是最新版。`);
      return;
    }

    const confirmed = await askConfirm({
      title: "确认升级 Miniconda",
      message: [
        `当前 Conda 版本：${check.currentCondaVersion}`,
        `可升级版本：${check.latestCondaVersion}`,
        `安装目录：${check.installPath}`,
        `已登记环境：${miniconda.environmentCount} 个`,
        "",
        "是否立即升级？升级只修改 base 环境中的 Conda 核心包；执行前将备份 base 显式配置，完成后核对全部环境路径。"
      ].join("\n"),
      confirmText: `升级到 ${check.latestCondaVersion}`
    });
    if (!confirmed) {
      setReady("已取消 Miniconda 升级。");
      return;
    }

    setBusy(`正在升级 Conda ${check.currentCondaVersion} → ${check.latestCondaVersion}...`);
    showOperationModal({
      eyebrow: "Miniconda Maintenance",
      title: "正在升级 Miniconda",
      message: `Conda ${check.currentCondaVersion} → ${check.latestCondaVersion}`,
      details: "准备备份 base 配置...",
      closable: false
    });
    const started = await request("/api/setup/miniconda-upgrade", {
      method: "POST",
      timeoutMs: 20000,
      body: JSON.stringify({ installPath: miniconda.rootPrefix })
    });
    const completed = await pollMinicondaUpgradeTask(started.taskId);
    if (completed.status === "failed") throw new Error(completed.message);
    await Promise.all([loadSetupStatus({ silent: true }), loadOverview()]);
    setReady(completed.message);
  } catch (error) {
    setError(error.message);
    updateOperationModal({
      eyebrow: "Failed",
      title: "Miniconda 维护失败",
      message: error.message,
      closable: true
    });
  } finally {
    elements.upgradeMinicondaButton.disabled = !state.setup?.miniconda?.available || !state.setup?.miniconda?.rootWritable;
  }
}

async function pollSetupTask(taskId) {
  while (true) {
    const task = await request(`/api/setup/tasks/${encodeURIComponent(taskId)}`, { timeoutMs: 20000 });
    renderSetupTask(task);
    updateOperationModal({
      eyebrow: task.status === "running" ? "First-run Setup" : task.status === "completed" ? "Completed" : "Failed",
      title: task.status === "running" ? "正在初始化 Python 环境" : task.status === "completed" ? "初始化完成" : "初始化失败",
      message: task.message,
      details: task.output,
      closable: task.status !== "running"
    });
    if (task.status !== "running") return task;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function initializeComputer(event) {
  event.preventDefault();
  const installPath = elements.setupInstallPath.value.trim();
  const condaPackageIds = [...elements.setupForm.querySelectorAll('input[name="condaPackageIds"]:checked')]
    .map((input) => input.value);
  const pipPackageIds = [...elements.setupForm.querySelectorAll('input[name="pipPackageIds"]:checked')]
    .map((input) => input.value);
  const confirmed = await askConfirm({
    title: "开始初始化配置",
    message: state.setup?.condaAvailable
      ? `已检测到 Conda。将跳过 Miniconda 安装，创建或更新最新版 Python 环境。\n\n已选择：${condaPackageIds.length} 个 Conda 库，${pipPackageIds.length} 个 pip 库。`
      : `将下载并静默安装最新版 Miniconda 到：\n${installPath}\n\n随后创建 conda-forge 最新 Python 环境，并安装 ${condaPackageIds.length} 个 Conda 库、${pipPackageIds.length} 个 pip 库。`,
    confirmText: "开始初始化"
  });
  if (!confirmed) return;

  elements.startSetupButton.disabled = true;
  setBusy("正在初始化 Miniconda 与首个 Conda 环境...");
  showOperationModal({
    eyebrow: "First-run Setup",
    title: "正在初始化 Python 环境",
    message: "正在启动初始化任务。",
    details: "准备中...",
    closable: false
  });

  try {
    const started = await request("/api/setup/tasks", {
      method: "POST",
      timeoutMs: 20000,
      body: JSON.stringify({ installPath, condaPackageIds, pipPackageIds })
    });
    renderSetupTask(started);
    const completed = await pollSetupTask(started.taskId);
    if (completed.status === "failed") throw new Error(completed.message);
    await Promise.all([loadSetupStatus({ silent: true }), loadOverview()]);
    setReady(completed.message);
  } catch (error) {
    setError(error.message);
    updateOperationModal({
      eyebrow: "Failed",
      title: "初始化失败",
      message: error.message,
      closable: true
    });
  } finally {
    elements.startSetupButton.disabled = false;
  }
}

function renderOverview() {
  const overview = state.overview;
  if (!overview) {
    return;
  }

  elements.heroNodeVersion.textContent = `系统 Node ${overview.systemNodeVersion || overview.nodeVersion || "-"}`;
  elements.heroCondaState.textContent = overview.condaAvailable || overview.condaPath ? "Conda 已连接" : "Conda 未检测到";

  const stats = [
    ["平台", `${overview.platform || "-"} / ${overview.arch || "-"}`],
    ["当前目录", overview.currentDirectory || "-"],
    ["Pip", overview.pipVersion || "-"],
    ["系统 Node", overview.systemNodeVersion || "-"],
    ["应用 Node", overview.nodeVersion || "-"],
    ["npm", overview.npmVersion || "-"],
    ["主机", overview.hostname || "-"]
  ];
  if (overview.condaPath) {
    stats.push(["Conda 路径", overview.condaPath]);
  }

  elements.overviewStats.innerHTML = stats
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span class="eyebrow">${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .join("");

  const pythonVersions = overview.pythonVersions || [];
  elements.pythonVersionCount.textContent = String(pythonVersions.length);
  elements.pythonVersionsList.innerHTML = pythonVersions.length
    ? pythonVersions
        .map(
          (entry) => `
            <article class="list-item">
              <strong>Python ${escapeHtml(entry.version)}</strong>
              <span class="list-meta">${escapeHtml(entry.path)}</span>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>${state.pythonVersionsLoaded ? "未检测到 Python 版本" : "正在扫描 Python 版本..."}</strong></article>`;

  const condaEnvironments = overview.condaEnvironments || [];
  elements.condaEnvCount.textContent = String(condaEnvironments.length);
  elements.condaOverviewList.innerHTML = condaEnvironments.length
    ? condaEnvironments
        .map(
          (env) => `
            <article class="list-item">
              <strong>${escapeHtml(env.name)}</strong>
              <span class="list-meta">Python ${escapeHtml(env.pythonVersion)}</span>
              <span class="list-meta">${escapeHtml(env.path)}</span>
            </article>
          `
        )
        .join("")
    : state.condaLoading
      ? `<article class="list-item"><strong>正在扫描 Conda 环境...</strong></article>`
      : `<article class="list-item"><strong>${overview.condaPath ? "Conda 已连接" : "未检测到 Conda"}</strong><span class="list-meta">${overview.condaPath ? "当前未读取到环境列表。你仍然可以尝试创建新环境。" : "请先确认 conda 安装路径或系统环境变量。"}</span></article>`;
}

function renderCondaList() {
  if (state.condaLoading) {
    elements.condaInventoryMeta.textContent = "扫描中...";
    elements.condaSourceSelect.innerHTML = "";
    elements.condaExportSourceSelect.innerHTML = "";
    elements.condaList.innerHTML = '<article class="list-item"><strong>正在扫描 Conda 环境...</strong></article>';
    return;
  }
  elements.condaInventoryMeta.textContent = `${state.conda.length} 个环境`;
  const condaOptions = state.conda
    .map((env) => `<option value="${escapeHtml(env.name)}">${escapeHtml(env.name)} · Python ${escapeHtml(env.pythonVersion)}</option>`)
    .join("");
  elements.condaSourceSelect.innerHTML = condaOptions;
  elements.condaExportSourceSelect.innerHTML = condaOptions;

  elements.condaList.innerHTML = state.conda.length
    ? state.conda
        .map(
          (env) => `
            <article class="conda-bookmark-card">
              <div class="conda-bookmark-head">
                <div class="conda-bookmark-title">
                  <strong>${escapeHtml(env.name)}</strong>
                  <span class="conda-bookmark-meta">Python ${escapeHtml(env.pythonVersion)}</span>
                </div>
                <div class="conda-bookmark-actions">
                  ${env.base ? "" : `<button class="ghost-button" data-delete-conda="${escapeHtml(env.name)}">删除</button>`}
                </div>
              </div>
              <span class="conda-bookmark-path" title="${escapeHtml(env.path)}">${escapeHtml(env.path)}</span>
              <div class="conda-bookmark-foot">
                <span class="conda-bookmark-state${env.base ? " base" : ""}">${env.base ? "base 环境" : "普通环境"}</span>
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>${state.overview?.condaPath ? "Conda 已连接" : "没有检测到 Conda"}</strong><span class="list-meta">${state.overview?.condaPath ? "当前未读取到环境列表。你仍然可以尝试创建新环境。" : "请先确认 conda 安装路径或系统环境变量。"}</span></article>`;

  updateCondaSummary();
  void fillCondaExportPath();
}

function renderVenvs() {
  elements.venvInventoryMeta.textContent = `${state.venvs.length} 个环境`;
  elements.venvList.innerHTML = state.venvs.length
    ? state.venvs
        .map(
          (env) => `
            <article class="list-item">
              <strong>${escapeHtml(env.name)}</strong>
              <span class="list-meta">Python ${escapeHtml(env.pythonVersion)}</span>
              <span class="list-meta">${escapeHtml(env.path)}</span>
              <div class="list-actions">
                <button class="ghost-button" data-delete-venv="${escapeHtml(env.path)}">删除</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<article class="list-item"><strong>没有检测到 venv</strong></article>`;
}

function refreshPackageTargets() {
  const targets = [{ label: "系统 Python", value: JSON.stringify({ type: "system" }) }];
  state.conda.forEach((env) => {
    targets.push({ label: `conda: ${env.name}`, value: JSON.stringify({ type: "conda", name: env.name, path: env.path }) });
  });
  state.venvs.forEach((env) => {
    targets.push({ label: `venv: ${env.name}`, value: JSON.stringify({ type: "venv", name: env.name, path: env.path }) });
  });
  elements.packageTargetSelect.innerHTML = targets
    .map((target) => `<option value='${escapeHtml(target.value)}'>${escapeHtml(target.label)}</option>`)
    .join("");
  resetPythonUpgradeControls();
}

function resetPythonUpgradeControls() {
  state.pythonUpgradeCheck = null;
  const target = getSelectedTarget();
  const isConda = target?.type === "conda";
  elements.checkPythonUpgradeButton.disabled = !isConda;
  elements.upgradePythonButton.disabled = true;
  elements.upgradePythonVersionSelect.disabled = true;
  elements.upgradePythonVersionSelect.innerHTML = `<option value="">${isConda ? "请先查询可升级版本" : "仅支持 Conda 环境"}</option>`;
}

function renderInstalledPackageOptions() {
  elements.installedPackageSelect.innerHTML = state.installedPackages.length
    ? [`<option value="">请选择一个已安装包</option>`, ...state.installedPackages.map((pkg) => `<option value="${escapeHtml(pkg.name)}">${escapeHtml(pkg.name)} (${escapeHtml(pkg.version)})</option>`)].join("")
    : `<option value="">未读取到已安装包</option>`;
}

function renderInstalledPackageLoading(text = "正在加载已安装包...") {
  elements.installedPackageSelect.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
}

function updateCondaSummary() {
  const form = document.querySelector("#condaCreateForm");
  const data = new FormData(form);
  const mode = data.get("mode");
  const name = data.get("name") || "<未命名>";
  const lines = [`目标环境: ${name}`];

  if (mode === "python") {
    const packages = String(data.get("packages") || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    lines.push("模式: 按 Python 版本创建");
    lines.push(`Python 版本: ${data.get("pythonVersion")}`);
    lines.push(`Conda 源: ${elements.condaCreateChannelSelect.value}`);
    lines.push(`额外安装包: ${packages.length ? packages.join(", ") : "无"}`);
    lines.push("预计动作: 执行 conda create，并追加额外包参数。");
  } else {
    const clonePython = form.elements.clonePython.checked;
    const clonePackages = form.elements.clonePackages.checked;
    lines.push("模式: 基于已有环境创建");
    lines.push(`源环境: ${data.get("sourceName") || "<未选择>"}`);
    lines.push(`克隆内容: ${[clonePython ? "Python 版本" : "", clonePackages ? "已安装库" : ""].filter(Boolean).join(", ") || "未选择"}`);
    if (clonePython && clonePackages) {
      lines.push(`Conda 源: ${elements.condaCloneChannelSelect.value}`);
      lines.push("预计动作: 使用 conda clone 完整复制。");
    } else if (clonePython) {
      lines.push(`Conda 源: ${elements.condaCloneChannelSelect.value}`);
      lines.push("预计动作: 读取源环境 Python 版本并创建空环境。");
    } else if (clonePackages) {
      lines.push(`目标 Python 版本: ${data.get("targetPythonVersion")}`);
      lines.push(`Conda 源: ${elements.condaCloneChannelSelect.value}`);
      lines.push(`导出策略: ${form.elements.explicitPackagesOnly.checked ? "仅显式安装包" : "完整环境依赖"}`);
      lines.push("预计动作: 导出环境 YAML，重写目标名称和 Python 版本后创建。");
    } else {
      lines.push("预计动作: 请至少选择一项克隆内容。");
    }
  }

  elements.condaSummary.textContent = lines.join("\n");
}

async function getDefaultCondaExportPath(sourceName) {
  const envName = String(sourceName || "").trim();
  if (!envName) {
    return "";
  }

  const result = await request(`/api/conda/environments/export/default-path?sourceName=${encodeURIComponent(envName)}`);
  return String(result.filePath || "").trim();
}

async function getDefaultCondaExportDirectory() {
  const result = await request("/api/conda/environments/export/default-directory");
  return String(result.directoryPath || "").trim();
}

async function fillCondaExportPath({ force = false } = {}) {
  const exportForm = document.querySelector("#condaExportForm");
  if (!exportForm) {
    return "";
  }

  const input = exportForm.elements.filePath;
  const currentValue = String(input.value || "").trim();
  if (!force && currentValue) {
    return currentValue;
  }

  const nextPath = await getDefaultCondaExportPath(exportForm.elements.sourceName.value);
  input.value = nextPath;
  return nextPath;
}

async function fillCondaExportDirectory({ force = false } = {}) {
  const exportAllForm = document.querySelector("#condaExportAllForm");
  if (!exportAllForm) {
    return "";
  }

  const input = exportAllForm.elements.directoryPath;
  const currentValue = String(input.value || "").trim();
  if (!force && currentValue) {
    return currentValue;
  }

  const nextPath = await getDefaultCondaExportDirectory();
  input.value = nextPath;
  return nextPath;
}

function ensureDesktopApi(actionDescription) {
  if (window.desktopAPI?.isDesktop?.()) {
    return true;
  }

  const message = `当前运行环境不支持${actionDescription}，已回退为自动填充默认路径。`;
  setReady(message);
  return false;
}

async function loadOverview() {
  setBusy("正在加载系统信息...");
  state.overview = await request("/api/overview");
  state.conda = state.overview.condaEnvironments || [];
  renderOverview();
  renderCondaList();
  refreshPackageTargets();
  setReady("系统信息已刷新。");
}

async function upgradeNodeVersion() {
  const confirmed = await askConfirm({
    title: "升级 Node.js",
    message:
      "将优先通过 nvm-windows 升级当前系统 Node；未检测到 nvm 时会改用 winget 升级 Node.js LTS。桌面版 Electron 内置的 Node 版本需要随应用安装包更新。",
    confirmText: "确认升级"
  });
  if (!confirmed) {
    return;
  }

  setBusy("正在升级系统 Node.js...");
  const progress = startOperationProgress({
    eyebrow: "Node.js",
    title: "正在升级 Node.js",
    message: "正在检测可用的 Node.js 版本管理工具。",
    steps: ["检查当前 Node.js 版本", "选择 nvm-windows 或 winget 升级 Node.js", "刷新系统运行时信息"],
    extraLines: ["此操作可能需要几分钟，过程中请不要关闭窗口。"],
    stepIntervalMs: 1800
  });

  try {
    const result = await request("/api/node/upgrade", {
      method: "POST",
      timeoutMs: 650000,
      body: JSON.stringify({})
    });
    await loadOverview();
    progress.complete({
      title: "Node.js 升级检查完成",
      message: result.message,
      details: [
        `升级工具: ${result.manager}`,
        `升级前: ${result.beforeVersion}`,
        `升级后: ${result.afterVersion}`,
        "",
        "执行命令:",
        ...(result.commands || []).map((command) => `  ${command}`),
        "",
        result.runtimeNote,
        "",
        result.output || "winget 未返回详细输出。"
      ].join("\n")
    });
    setReady(result.message);
  } catch (error) {
    progress.fail({
      title: "Node.js 升级失败",
      message: "系统 Node.js 未完成升级。",
      details: error.message
    });
    setReady(error.message);
  }
}

async function loadCondaEnvironments(options = {}) {
  state.condaLoading = true;
  if (!options.silent) {
    setBusy("正在刷新 Conda 环境...");
  }

  const result = await request("/api/conda/environments");
  state.conda = result.environments || [];
  state.condaLoading = false;

  if (!state.overview) {
    state.overview = {};
  }
  state.overview.condaAvailable = result.condaAvailable;
  state.overview.condaPath = result.condaPath;
  state.overview.condaEnvironments = state.conda;

  renderOverview();
  renderCondaList();
  refreshPackageTargets();

  if (!options.silent) {
    setReady("Conda 环境已刷新。");
  }
}

// 已知的 Conda 大版本列表（与后端 SUPPORTED_PYTHON_VERSIONS 保持一致）
const CONDA_MAJOR_VERSIONS = ["3.14", "3.13", "3.12", "3.11", "3.10", "3.9"];

// ---------- Conda 版本缓存与查询 ----------

function renderCondaMajorVersions() {
  const { condaSelectedMajor } = state;

  elements.condaMajorVersionsList.innerHTML = CONDA_MAJOR_VERSIONS
    .map(
      (ver) =>
        `<button class="version-chip${condaSelectedMajor === ver ? " active" : ""}" data-major="${ver}">Python ${ver}</button>`
    )
    .join("");
}

function renderCondaPythonVersionDetails() {
  const { condaSelectedMajor, condaFullVersions, condaFullVersionsLoading, condaChannel } = state;

  if (!condaSelectedMajor) {
    elements.condaVersionDetailCard.style.display = "none";
    return;
  }

  elements.condaVersionDetailCard.style.display = "";
  const channelLabel = condaChannel || "defaults";
  const fromCache = condaFullVersions._fromCache;
  const versions = Array.isArray(condaFullVersions) ? condaFullVersions : [];

  elements.condaVersionDetailTitle.textContent = `Python ${condaSelectedMajor} (${channelLabel})`;
  elements.condaPythonVersionsMeta.textContent = condaFullVersionsLoading
    ? "查询中..."
    : `${versions.length} 个构建${fromCache ? "（缓存）" : ""}`;

  if (condaFullVersionsLoading) {
    elements.condaPythonVersionsList.innerHTML = '<article class="list-item"><strong>正在查询...</strong></article>';
    return;
  }

  if (!versions.length) {
    elements.condaPythonVersionsList.innerHTML = '<article class="list-item"><strong>未查询到可用版本</strong><span class="list-meta">请确认 Conda 连接正常</span></article>';
    return;
  }

  elements.condaPythonVersionsList.innerHTML = versions
    .map(
      (ver) => `
        <article class="list-item" style="display:inline-flex;width:auto;padding:6px 14px">
          <span class="conda-bookmark-meta" style="font-size:12px;min-height:auto">${escapeHtml(ver)}</span>
        </article>
      `
    )
    .join("");
}

function getSelectedChannel() {
  for (const radio of elements.condaChannelRadios) {
    if (radio.checked) return radio.value;
  }
  return "defaults";
}

function getSelectedUpgradeChannel() {
  for (const radio of elements.upgradeCondaChannelRadios) {
    if (radio.checked) return radio.value;
  }
  return "defaults";
}

// 从缓存中获取指定大版本的小版本列表
function getCachedVersions(cache, major, channel) {
  const channelKey = channel || "defaults";
  const entry = cache?.channels?.[channelKey]?.[major];
  return entry?.versions || null;
}

// 更新 Python 版本页面的详情显示（从缓存或查询结果）
function showVersionsForMajor(major, channel, versions, fromCache) {
  state.condaSelectedMajor = major;
  state.condaChannel = channel;
  versions._fromCache = fromCache;
  state.condaFullVersions = versions;
  state.condaFullVersionsLoading = false;
  renderCondaMajorVersions();
  renderCondaPythonVersionDetails();
  // 同时填充创建表单的版本下拉
  populateCreateFormVersions(major, versions);
}

async function loadCondaPythonVersions(version) {
  const major = version || state.condaSelectedMajor;
  if (!major) return;

  const channel = getSelectedChannel();
  state.condaFullVersionsLoading = true;
  state.condaSelectedMajor = major;
  state.condaChannel = channel;
  renderCondaMajorVersions();
  renderCondaPythonVersionDetails();

  try {
    // 先查缓存
    const cacheResp = await request("/api/conda/python-versions/cache");
    const cached = getCachedVersions(cacheResp, major, channel);
    if (cached && cached.length) {
      showVersionsForMajor(major, channel, [...cached], true);
      setReady(`Python ${major}（${channel}）小版本已加载（缓存）。`);
      return;
    }

    // 缓存缺失 → 在线查询
    const params = new URLSearchParams({ version: major, channel });
    const result = await request(`/api/conda/python-versions?${params}`);
    const versions = result.versions || [];
    showVersionsForMajor(major, channel, versions, false);
    setReady(`Python ${major}（${channel}）小版本已加载。`);
  } catch {
    state.condaFullVersions = [];
    state.condaFullVersionsLoading = false;
    renderCondaPythonVersionDetails();
    setReady(`查询失败：Python ${major}（${channel}）。`);
  }
}

// 强制刷新指定大版本的 Conda 版本缓存
async function refreshCondaPythonVersions(version) {
  const major = version || state.condaSelectedMajor;
  if (!major) return;

  const channel = getSelectedChannel();
  state.condaFullVersionsLoading = true;
  state.condaSelectedMajor = major;
  state.condaChannel = channel;
  renderCondaMajorVersions();
  renderCondaPythonVersionDetails();

  try {
    const params = new URLSearchParams({ version: major, channel });
    const result = await request(`/api/conda/python-versions/refresh?${params}`, { method: "POST" });
    const versions = result.versions || [];
    showVersionsForMajor(major, channel, versions, false);
    setReady(`Python ${major}（${channel}）已刷新。`);
  } catch {
    state.condaFullVersions = [];
    state.condaFullVersionsLoading = false;
    renderCondaPythonVersionDetails();
    setReady(`刷新失败：Python ${major}（${channel}）。`);
  }
}

// ---------- 创建表单版本下拉填充 ----------

// 为创建表单的 Python 版本下拉填充小版本列表
function populateCreateFormVersions(major, versions) {
  const makeOptions = (select, keepLatest = true) => {
    // 保留当前选中的值
    const currentVal = select.value;
    select.innerHTML = "";
    if (keepLatest) {
      const opt = document.createElement("option");
      opt.value = "latest";
      opt.textContent = "latest（使用默认）";
      select.appendChild(opt);
    }
    if (versions && versions.length) {
      // 指定大版本时只显示对应小版本；创建表单按通道加载时 major 为空，直接展示全部缓存版本。
      const prefix = major ? `${major}.` : "";
      const filtered = prefix ? versions.filter((v) => v.startsWith(prefix)) : versions;
      const sorted = [...filtered].sort((a, b) =>
        b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
      );
      for (const ver of sorted) {
        const opt = document.createElement("option");
        opt.value = ver;
        opt.textContent = ver;
        select.appendChild(opt);
      }
    } else {
      // 缓存为空 → fallback 到已知大版本
      for (const ver of CONDA_MAJOR_VERSIONS) {
        const opt = document.createElement("option");
        opt.value = ver;
        opt.textContent = ver;
        select.appendChild(opt);
      }
    }
    // 恢复选中值（如果还在的话）
    if ([...select.options].some((o) => o.value === currentVal)) {
      select.value = currentVal;
    }
  };

  makeOptions(elements.condaPythonVersionSelect);
  makeOptions(elements.condaClonePythonVersionSelect);
}

// 创建表单版本下拉的自动刷新去抖（避免多入口同时触发重复请求）
let autoRefreshInFlight = false;

// 缓存里有任一条目超过 TTL（与后端 CACHE_TTL_MS 一致）→ 后台全量刷新一次并重填下拉。
// 不阻塞当前渲染：先用旧缓存填充，刷新完成后下拉自动更新为最新清单。
function autoRefreshStaleCreateFormVersions(channel) {
  if (autoRefreshInFlight) return;
  autoRefreshInFlight = true;
  const channelKey = channel || "defaults";
  (async () => {
    const params = new URLSearchParams({ channel: channelKey });
    await request(`/api/conda/python-versions/refresh?${params}`, { method: "POST" });
    await loadCreateFormVersions(channelKey, { skipAutoRefresh: true });
    setReady(`Python 版本清单已自动更新（${channelKey}）。`);
  })().catch(() => {}).finally(() => {
    autoRefreshInFlight = false;
  });
}

// 从缓存加载指定通道的全部版本数据，并更新创建表单的下拉
async function loadCreateFormVersions(channel, options = {}) {
  try {
    const cacheResp = await request("/api/conda/python-versions/cache");
    const versions = [];
    let hasStaleEntry = false;
    const staleCutoff = Date.now() - 60 * 60 * 1000; // 与后端 CACHE_TTL_MS 保持一致
    const channelKey = channel || "defaults";
    const channelData = cacheResp?.channels?.[channelKey] || {};
    // 合并所有大版本的小版本（新结构：{ versions: [...], updatedAt }）
    for (const [major, entry] of Object.entries(channelData)) {
      if (entry?.versions) {
        for (const v of entry.versions) {
          versions.push(v);
        }
        if (!entry.updatedAt || entry.updatedAt < staleCutoff) hasStaleEntry = true;
      }
    }

    if (versions.length) {
      // 有缓存 → 直接用缓存数据填充
      versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
      populateCreateFormVersions("", versions);
      // 缓存过期 → 后台静默刷新，不阻塞当前下拉
      if (hasStaleEntry && !options.skipAutoRefresh) {
        autoRefreshStaleCreateFormVersions(channelKey);
      }
      return;
    }

    // 无缓存 → 直接在线查询该通道的全部版本，后端会缓存结果
    const params = new URLSearchParams({ channel: channelKey });
    const result = await request(`/api/conda/python-versions?${params}`);
    const liveVersions = result.versions || [];
    if (liveVersions.length) {
      populateCreateFormVersions("", liveVersions);
    } else {
      // 在线查询也失败 → fallback 到已知大版本
      populateCreateFormVersions("", []);
    }
  } catch {
    // 缓存不可用时保持现状
  }
}

// 创建表单切换通道时重新加载版本列表
function setupCreateFormChannelListeners() {
  const reload = () => {
    const channelPython = elements.condaCreateChannelSelect.value;
    const channelClone = elements.condaCloneChannelSelect.value;
    // 哪个模式可见就刷新哪个
    if (!elements.condaPythonFields.classList.contains("hidden")) {
      loadCreateFormVersions(channelPython);
    }
    if (!elements.condaCloneFields.classList.contains("hidden")) {
      loadCreateFormVersions(channelClone);
    }
  };

  elements.condaCreateChannelSelect.addEventListener("change", reload);
  elements.condaCloneChannelSelect.addEventListener("change", reload);
}

async function loadPythonVersions() {
  try {
    const versions = await request("/api/python/versions");
    if (!state.overview) {
      state.overview = {};
    }
    state.overview.pythonVersions = versions;
    state.pythonVersionsLoaded = true;
    renderOverview();
    setReady("Python 版本已刷新。");
  } catch (error) {
    state.pythonVersionsLoaded = true;
    if (!state.overview) {
      state.overview = {};
    }
    state.overview.pythonVersions = [];
    renderOverview();
    setReady(`Python 版本扫描失败: ${error.message}`);
  }
}

async function loadVenvs(options = {}) {
  if (!options.silent) {
    setBusy("正在扫描虚拟环境...");
  }
  state.venvs = await request("/api/venvs");
  renderVenvs();
  refreshPackageTargets();
  if (!options.silent) {
    setReady("虚拟环境已刷新。");
  }
}

async function loadInstalledPackages(options = {}) {
  if (!options.silent) {
    setBusy("正在加载已安装包...");
  }

  const target = getSelectedTarget();
  if (!target) {
    state.installedPackages = [];
    renderInstalledPackageLoading("请先选择目标环境");
    if (!options.silent) {
      setReady("请先选择目标环境。");
    }
    return;
  }

  renderInstalledPackageLoading();

  try {
    state.installedPackages = await request("/api/packages/list", {
      method: "POST",
      timeoutMs: 12000,
      body: JSON.stringify({ target })
    });
    renderInstalledPackageOptions();
    if (!options.silent) {
      setReady(`已加载 ${state.installedPackages.length} 个包。`);
    }
  } catch (error) {
    state.installedPackages = [];
    renderInstalledPackageLoading("加载失败，点击“刷新包下拉”重试");
    if (!options.silent) {
      setReady(`包下拉加载失败: ${error.message}`);
    }
  }
}

async function createCondaEnvironment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const mode = data.get("mode");
  const payload = {
    name: String(data.get("name") || "").trim(),
    mode
  };

  if (mode === "python") {
    payload.pythonVersion = data.get("pythonVersion");
    payload.channel = elements.condaCreateChannelSelect.value;
    payload.packages = String(data.get("packages") || "")
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  } else {
    payload.sourceName = data.get("sourceName");
    payload.clonePython = form.elements.clonePython.checked;
    payload.clonePackages = form.elements.clonePackages.checked;
    payload.targetPythonVersion = data.get("targetPythonVersion");
    payload.explicitPackagesOnly = form.elements.explicitPackagesOnly.checked;
    payload.channel = elements.condaCloneChannelSelect.value;
  }

  setBusy(`正在创建环境 ${payload.name}...`);
  const submitButton = form.querySelector('button[type="submit"]');
  const progress = startOperationProgress({
    eyebrow: "Provisioning",
    title: "正在创建 Conda 环境",
    message: `目标环境：${payload.name || "<未填写>"}`,
    steps:
      mode === "python"
        ? [
            "校验环境名称与 Python 版本",
            "调用 Conda 创建新环境",
            "安装额外包",
            "刷新环境列表"
          ]
        : [
            "校验源环境与克隆策略",
            "准备目标环境配置",
            "调用 Conda 创建或克隆环境",
            "刷新环境列表"
          ],
    extraLines:
      mode === "python"
        ? [
            `创建方式: 按 Python 版本创建`,
            `Python 版本: ${payload.pythonVersion || "latest"}`,
            `Conda 源: ${payload.channel || "defaults"}`,
            `额外包: ${payload.packages?.length ? payload.packages.join(", ") : "无"}`
          ]
        : [
            "创建方式: 基于已有环境创建",
            `源环境: ${payload.sourceName || "<未选择>"}`,
            `克隆 Python: ${payload.clonePython ? "是" : "否"}`,
            `克隆包: ${payload.clonePackages ? "是" : "否"}`,
            ...(!payload.clonePython && payload.clonePackages ? [`目标 Python 版本: ${payload.targetPythonVersion || "latest"}`] : []),
            `Conda 源: ${payload.channel || "defaults"}`
          ]
  });

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/conda/environments", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await loadCondaEnvironments({ silent: true });
    renderOverview();
    setReady(result.message);
    progress.complete({
      title: "Conda 环境创建完成",
      message: `环境“${payload.name}”已创建完成。`,
      details: result.message
    });
  } catch (error) {
    setError(error.message);
    progress.fail({
      title: "Conda 环境创建失败",
      message: `环境“${payload.name || "<未填写>"}”创建未完成。`,
      details: error.message
    });
    throw error;
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function exportCondaEnvironment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const resolvedFilePath = String(data.get("filePath") || "").trim() || (await fillCondaExportPath({ force: true }));
  const payload = {
    sourceName: String(data.get("sourceName") || "").trim(),
    filePath: resolvedFilePath,
    explicitPackagesOnly: form.elements.explicitPackagesOnly.checked
  };

  setBusy(`正在导出 conda 环境 ${payload.sourceName}...`);
  const submitButton = form.querySelector('button[type="submit"]');
  const progress = startOperationProgress({
    eyebrow: "Exporting",
    title: "正在导出环境文件",
    message: `源环境：${payload.sourceName || "<未选择>"}`,
    steps: [
      "校验导出参数",
      `调用 Conda 导出${payload.explicitPackagesOnly ? "显式安装包" : "完整环境依赖"}`,
      "等待 Conda 返回环境配置",
      "写入 YAML 文件"
    ],
    extraLines: [
      `导出文件: ${payload.filePath || "<未填写>"}`,
      `导出策略: ${payload.explicitPackagesOnly ? "仅导出显式安装包" : "导出完整环境依赖"}`
    ]
  });

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/conda/environments/export", {
      method: "POST",
      timeoutMs: 300000,
      body: JSON.stringify(payload)
    });
    setReady(result.message);
    progress.complete({
      title: "环境文件导出完成",
      message: `Conda 环境“${payload.sourceName}”已导出。`,
      details: [`结果: ${result.message}`, `输出文件: ${result.filePath || payload.filePath}`].join("\n")
    });
  } catch (error) {
    setReady(error.message);
    progress.fail({
      title: "环境文件导出失败",
      message: `Conda 环境“${payload.sourceName || "<未选择>"}”导出未完成。`,
      details: error.message
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function exportAllCondaEnvironments(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const resolvedDirectoryPath = String(data.get("directoryPath") || "").trim() || (await fillCondaExportDirectory({ force: true }));
  const payload = {
    directoryPath: resolvedDirectoryPath,
    explicitPackagesOnly: form.elements.explicitPackagesOnly.checked
  };

  setBusy("正在批量导出 conda 环境...");
  const submitButton = form.querySelector('button[type="submit"]');
  const progress = startOperationProgress({
    eyebrow: "Exporting",
    title: "正在批量导出 Conda 环境",
    message: `目标目录：${payload.directoryPath || "<未填写>"}`,
    steps: [
      "校验导出目录",
      "读取 Conda 环境列表",
      "逐个导出环境配置",
      "按环境名称写入独立 YAML 文件"
    ],
    extraLines: [
      `导出目录: ${payload.directoryPath || "<未填写>"}`,
      `导出策略: ${payload.explicitPackagesOnly ? "仅导出显式安装包" : "导出完整环境依赖"}`
    ]
  });

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/conda/environments/export-all", {
      method: "POST",
      timeoutMs: 600000,
      body: JSON.stringify(payload)
    });

    const details = [
      `结果: ${result.message}`,
      `导出目录: ${result.directoryPath}`,
      ...((result.exportedFiles || []).map((entry) => `${entry.envName}: ${entry.filePath}`))
    ].join("\n");

    setReady(result.message);
    progress.complete({
      title: "全部环境导出完成",
      message: `已批量导出 ${result.exportedFiles?.length || 0} 个 Conda 环境。`,
      details
    });
  } catch (error) {
    setReady(error.message);
    progress.fail({
      title: "全部环境导出失败",
      message: "批量导出未完成。",
      details: error.message
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

function formatTaskOutput(output, fallbackMessage = "") {
  const text = String(output || "").trim();
  if (text) {
    return text;
  }
  return fallbackMessage;
}

function formatRunningTaskDetails(task) {
  const details = formatTaskOutput(task.output, task.message);
  if (task.status !== "running" || !task.startedAt) {
    return details;
  }

  const startedAt = Date.parse(task.startedAt);
  const elapsedSeconds = Number.isFinite(startedAt)
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : 0;
  const processLine = task.pid
    ? `[pip 进程] PID ${task.pid} 正在运行。`
    : "[pip 进程] 正在启动。";
  return `${details}\n\n${processLine}\n[进行中] 已等待 ${elapsedSeconds} 秒，正在等待 pip 返回。\n提示：如果长时间没有新输出，请切换 pip 源后重试。`;
}

function formatTargetLabel(target) {
  if (!target) {
    return "系统 Python";
  }
  return `${target.type || "system"}${target.name ? ` / ${target.name}` : ""}`;
}

function showResultLog(title, details, message = "操作完成。", meta = {}) {
  const commands = Array.isArray(meta.commands)
    ? meta.commands.filter(Boolean)
    : meta.command
      ? [meta.command]
      : [];
  const lines = meta.target !== undefined ? [`目标环境: ${formatTargetLabel(meta.target)}`] : [];
  if (commands.length) {
    lines.push("执行命令:", ...commands.map((command) => `  ${command}`));
  }
  if (meta.requestUrl) {
    lines.push(`请求地址: ${meta.requestUrl}`);
  }
  const output = String(meta.output || "").trim();
  if (output && output !== String(details || "").trim()) {
    lines.push("", "命令输出:", output);
  }
  if (details) {
    lines.push("", String(details));
  }
  setGlobalLog({ eyebrow: "结果", title, message, details: lines.join("\n") });
}

function previewPackageCommand(action, target, payload = {}) {
  const python = target?.path ? `"${target.path}"` : "python";
  const packageName = String(payload.packageName || "<包名>");
  const pipSource = payload.pipIndexUrl || "https://pypi.org/simple";
  if (action === "uninstall") return `${python} -m pip uninstall ${packageName} -y`;
  if (action === "show") return `${python} -m pip show ${packageName}`;
  if (action === "list") return `${python} -m pip list --format=json`;
  if (action === "latest-version") return `GET https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
  if (action === "upgrade-pip") return `${python} -m pip install --index-url ${pipSource} --upgrade pip`;
  if (action === "upgrade-all") return `${python} -m pip list --index-url ${pipSource} --outdated --format=json`;
  if (action === "install-requirements") return `${python} -m pip install --index-url ${pipSource} -r ${payload.requirementsPath || "<requirements.txt>"}`;
  return `${python} -m pip ${action}`;
}

async function runInstallPackageAction(payload = {}) {
  const target = getSelectedTarget();
  const packageName = String(payload.packageName || "").trim();
  const isUpgrade = Boolean(payload.upgrade);

  if (!packageName) {
    setReady("请输入包名。");
    showResultLog("包操作未执行", "请输入包名后再执行该操作。", "缺少包名");
    return;
  }

  const pipIndexUrl = readPipIndexUrl();
  if (!pipIndexUrl) {
    return;
  }

  setBusy(isUpgrade ? "正在升级包..." : "正在安装包...");
  showOperationModal({
    eyebrow: isUpgrade ? "Upgrading" : "Installing",
    title: isUpgrade ? "正在升级包" : "正在安装包",
    message: `${packageName} · ${target?.type || "unknown"}${target?.name ? ` / ${target.name}` : ""}`,
    details: "正在提交安装任务...",
    closable: false
  });

  try {
    const task = await request("/api/packages/install-task", {
      method: "POST",
      body: JSON.stringify({
        target,
        packageName,
        upgrade: isUpgrade,
        pipIndexUrl
      })
    });

    let latestTask = task;
    let finished = false;

    while (!finished) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      latestTask = await request(`/api/packages/tasks/${encodeURIComponent(task.taskId)}`, {
        timeoutMs: 10000
      });

      updateOperationModal({
        details: formatRunningTaskDetails(latestTask)
      });

      finished = latestTask.status === "completed" || latestTask.status === "failed";
    }

    const finalDetails = formatTaskOutput(latestTask.output, latestTask.message);
    if (latestTask.status === "completed") {
      setReady(latestTask.message || "包操作已完成。");
      updateOperationModal({
        eyebrow: "Completed",
        title: isUpgrade ? "包升级完成" : "包安装完成",
        message: latestTask.message,
        details: finalDetails,
        closable: true
      });
      await loadInstalledPackages({ silent: true });
      return;
    }

    setReady(latestTask.message || "包安装失败");
    updateOperationModal({
      eyebrow: "Failed",
      title: isUpgrade ? "包升级失败" : "包安装失败",
      message: latestTask.message || "安装过程失败",
      details: finalDetails,
      closable: true
    });
    throw new Error(latestTask.message || "包安装失败");
  } catch (error) {
    updateOperationModal({
      eyebrow: "Failed",
      title: isUpgrade ? "包升级失败" : "包安装失败",
      message: error.message || "安装过程失败",
      details: error.message || "安装过程失败",
      closable: true
    });
    throw error;
  }
}

async function importCondaEnvironment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") || "").trim(),
    filePath: String(data.get("filePath") || "").trim(),
    pythonVersion: data.get("pythonVersion")
  };

  setBusy(`正在根据环境文件创建 ${payload.name}...`);
  const submitButton = form.querySelector('button[type="submit"]');
  const progress = startOperationProgress({
    eyebrow: "Importing",
    title: "正在根据环境文件创建环境",
    message: `目标环境：${payload.name || "<未填写>"}`,
    steps: [
      "校验环境文件路径",
      "读取并重写环境 YAML",
      "调用 Conda 创建新环境",
      "刷新环境列表"
    ],
    extraLines: [
      `环境文件: ${payload.filePath || "<未填写>"}`,
      `Python 版本: ${payload.pythonVersion || "使用环境文件中的版本"}`
    ]
  });

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const result = await request("/api/conda/environments/import", {
      method: "POST",
      timeoutMs: 300000,
      body: JSON.stringify(payload)
    });
    await loadCondaEnvironments({ silent: true });
    renderOverview();
    setReady(result.message);
    progress.complete({
      title: "环境导入完成",
      message: `已根据环境文件创建环境“${payload.name}”。`,
      details: [`结果: ${result.message}`, `来源文件: ${result.sourceFile || payload.filePath}`].join("\n")
    });
  } catch (error) {
    setReady(error.message);
    progress.fail({
      title: "环境导入失败",
      message: `环境“${payload.name || "<未填写>"}”创建未完成。`,
      details: error.message
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

async function createVenv(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy("正在创建虚拟环境...");
  const result = await request("/api/venvs", {
    method: "POST",
    body: JSON.stringify({
      name: data.get("name"),
      targetPath: data.get("targetPath"),
      pythonPath: data.get("pythonPath")
    })
  });
  await loadVenvs();
  setReady(result.message);
}

async function deleteConda(name) {
  const confirmed = await askConfirm({
    title: "删除 Conda 环境",
    message: `确定要删除环境“${name}”吗？此操作不可撤销。`,
    confirmText: "确认删除"
  });
  if (!confirmed) {
    return;
  }

  setBusy(`正在删除 conda 环境 ${name}...`);
  showOperationModal({
    eyebrow: "Deleting",
    title: "正在删除 Conda 环境",
    message: `目标环境：${name}`,
    details: `已提交删除请求。\n环境名称：${name}\n请等待 Conda 返回结果。`,
    closable: false
  });

  try {
    const result = await request(`/api/conda/environments/${encodeURIComponent(name)}`, { method: "DELETE" });
    await loadCondaEnvironments({ silent: true });
    renderOverview();
    updateOperationModal({
      eyebrow: "Completed",
      title: "删除完成",
      message: `Conda 环境“${name}”已处理完成。`,
      details: result.message,
      closable: true
    });
    setReady(result.message);
  } catch (error) {
    setReady(error.message);
    updateOperationModal({
      eyebrow: "Failed",
      title: "删除失败",
      message: `Conda 环境“${name}”未能删除。`,
      details: error.message,
      closable: true
    });
  }
}

async function deleteVenv(targetPath) {
  const confirmed = await askConfirm({
    title: "删除虚拟环境",
    message: `确定要删除这个虚拟环境吗？\n${targetPath}`,
    confirmText: "确认删除"
  });
  if (!confirmed) {
    return;
  }
  setBusy(`正在删除虚拟环境 ${targetPath}...`);
  const result = await request(`/api/venvs?path=${encodeURIComponent(targetPath)}`, { method: "DELETE" });
  await loadVenvs();
  setReady(result.message);
}

function getSelectedTarget() {
  if (!elements.packageTargetSelect.value) {
    return null;
  }
  return JSON.parse(elements.packageTargetSelect.value);
}

function getSelectedPipIndexUrl() {
  const selected = elements.pipSourceSelect.value;
  return selected === "custom" ? elements.customPipSourceInput.value.trim() : selected;
}

function readPipIndexUrl() {
  const value = getSelectedPipIndexUrl();
  try {
    const url = new URL(value);
    if (!/^https?:$/u.test(url.protocol)) {
      throw new Error("pip 源必须使用 http 或 https 地址。");
    }
    return url.toString();
  } catch (error) {
    setError(error.message || "请输入有效的 pip 源地址。");
    return "";
  }
}

function updatePipSourceField() {
  const isCustom = elements.pipSourceSelect.value === "custom";
  elements.customPipSourceField.classList.toggle("hidden", !isCustom);
  if (isCustom) {
    elements.customPipSourceInput.focus();
  }
}

async function runPackageAction(action, payload = {}) {
  if (["install", "uninstall", "show", "latest-version"].includes(action) && !String(payload.packageName || "").trim()) {
    setReady("请输入包名。");
    showResultLog("包操作未执行", "请输入包名后再执行该操作。", "缺少包名");
    return;
  }

  if (action === "install") {
    await runInstallPackageAction(payload);
    return;
  }

  if (action === "upgrade-pip") {
    await runInstallPackageAction({ packageName: "pip", upgrade: true });
    return;
  }

  const needsPipSource = ["upgrade-all", "install-requirements"].includes(action);
  const pipIndexUrl = needsPipSource ? readPipIndexUrl() : "";
  if (needsPipSource && !pipIndexUrl) {
    return;
  }

  const actionMessageMap = {
    uninstall: "正在卸载包...",
    show: "正在读取包信息...",
    list: "正在列出包...",
    "latest-version": "正在查询 PyPI 最新版本...",
    "upgrade-pip": "正在升级 pip...",
    "upgrade-all": "正在批量升级环境中的全部包...",
    "install-requirements": "正在从 requirements 安装..."
  };
  const timeoutMap = {
    show: 12000,
    "latest-version": 7000,
    "upgrade-all": 300000
  };

  setBusy(actionMessageMap[action] || `正在执行包操作: ${action}`);
  const target = getSelectedTarget();
  const requestPayload = pipIndexUrl ? { ...payload, pipIndexUrl } : payload;
  setGlobalLog({
    eyebrow: "执行中",
    title: actionMessageMap[action] || `正在执行包操作: ${action}`,
    message: `目标环境: ${formatTargetLabel(target)}`,
    details: `目标环境: ${formatTargetLabel(target)}\n执行命令:\n  ${previewPackageCommand(action, target, requestPayload)}`
  });
  const data = await request(`/api/packages/${action}`, {
    method: "POST",
    timeoutMs: timeoutMap[action],
    body: JSON.stringify({
      target,
      ...requestPayload
    })
  });

  if (action === "list") {
    showResultLog("已安装包", data.map((pkg) => `${pkg.name} (${pkg.version})`).join("\n"), `${data.length} 个包`, { target });
  } else if (action === "show") {
    showResultLog("包信息", data.content, "包信息", { ...data, target });
  } else if (action === "latest-version") {
    const installedPackage = state.installedPackages.find((pkg) => pkg.name === data.packageName);
    const lines = [
      `包名: ${data.packageName}`,
      `PyPI 最新版本: ${data.latestVersion}`,
      `当前环境已安装: ${installedPackage ? installedPackage.version : "未安装"}`
    ];

    if (data.summary) {
      lines.push(`简介: ${data.summary}`);
    }
    if (data.homePage) {
      lines.push(`主页: ${data.homePage}`);
    }
    if (data.packageUrl) {
      lines.push(`PyPI: ${data.packageUrl}`);
    }

    showResultLog("最新版本", lines.join("\n"), "查询完成", { ...data, target });
  } else if (action === "upgrade-all") {
    showResultLog(
      "批量升级完成",
      data.summary || data.message,
      `${typeof data.upgradedCount === "number" ? `${data.upgradedCount} 个 pip 包` : "操作完成"}`,
      { ...data, target }
    );
    await loadInstalledPackages({ silent: true });
  } else {
    showResultLog("包操作完成", data.message, "操作完成", { ...data, target });
  }
  setReady("包操作已完成。");
}

async function checkSelectedCondaPythonUpgrade() {
  const target = getSelectedTarget();
  if (target?.type !== "conda") {
    setError("请先选择一个 Conda 环境（支持 base）。");
    return null;
  }

  elements.checkPythonUpgradeButton.disabled = true;
  elements.upgradePythonButton.disabled = true;
  setBusy(`正在查询环境“${target.name}”的 Python 可升级版本...`);
  try {
    const channel = getSelectedUpgradeChannel();
    const result = await request("/api/conda/python-upgrade/check", {
      method: "POST",
      timeoutMs: PYTHON_UPGRADE_CHECK_TIMEOUT_MS,
      body: JSON.stringify({ target, channel })
    });
    state.pythonUpgradeCheck = result;
    const candidates = result.candidates || [];
    const unavailableCandidates = result.unavailableCandidates || [];
    elements.upgradePythonVersionSelect.innerHTML = candidates.length
      ? candidates.map((version) => `<option value="${escapeHtml(version)}">Python ${escapeHtml(version)}</option>`).join("")
      : `<option value="">当前没有更高的稳定版本</option>`;
    elements.upgradePythonVersionSelect.disabled = !candidates.length;
    elements.upgradePythonButton.disabled = !candidates.length;
    const details = candidates.length
      ? [
          `环境: ${result.target.name}`,
          `当前 Python: ${result.currentVersion}`,
          `推荐升级: ${result.recommendedVersion}`,
          `可选稳定版本: ${candidates.join(", ")}`,
          "",
          "升级前会备份显式依赖；Conda 可能为兼容目标 Python 调整环境内的关联包。"
        ].join("\n")
      : unavailableCandidates.length
        ? [
            `环境“${result.target.name}”当前 Python ${result.currentVersion}。`,
            `检测到更高版本 ${unavailableCandidates.join(", ")}，但 ${result.channel} 无法为当前环境完成依赖求解，因此未提供升级。`,
            `提示：可切换到 conda-forge 源后重试。`
          ].join("\n")
        : `环境“${result.target.name}”当前 Python ${result.currentVersion}，没有检测到更高的稳定版本。`;
    showResultLog("Python 升级检查", details, candidates.length
      ? `${candidates.length} 个可升级版本`
      : unavailableCandidates.length ? "无兼容升级" : "已是最新");
    setReady(candidates.length
      ? "Python 可升级版本已加载。"
      : unavailableCandidates.length ? "更高版本与当前环境不兼容。" : "当前 Python 已是可用的最高稳定版本。");
    return result;
  } catch (error) {
    state.pythonUpgradeCheck = null;
    elements.upgradePythonVersionSelect.innerHTML = `<option value="">查询失败</option>`;
    elements.upgradePythonVersionSelect.disabled = true;
    setError(error.message);
    throw error;
  } finally {
    elements.checkPythonUpgradeButton.disabled = getSelectedTarget()?.type !== "conda";
  }
}

async function pollCondaPythonUpgradeTask(taskId) {
  while (true) {
    const task = await request(`/api/conda/python-upgrade/tasks/${encodeURIComponent(taskId)}`, { timeoutMs: 20000 });
    updateOperationModal({
      eyebrow: task.status === "running" ? "Python Upgrade" : task.status === "completed" ? "Completed" : "Failed",
      title: task.status === "running" ? "正在无损升级 Python" : task.status === "completed" ? "Python 升级完成" : "Python 升级失败",
      message: task.message,
      details: task.output,
      closable: task.status !== "running"
    });
    if (task.status !== "running") return task;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function upgradeSelectedCondaPython() {
  const target = getSelectedTarget();
  const check = state.pythonUpgradeCheck;
  const targetVersion = elements.upgradePythonVersionSelect.value;
  if (target?.type !== "conda" || !check || !targetVersion) {
    setError("请先查询并选择 Python 目标版本。");
    return;
  }
  if (String(check.target?.path).toLowerCase() !== String(target.path).toLowerCase()) {
    resetPythonUpgradeControls();
    setError("目标环境已变化，请重新查询 Python 版本。");
    return;
  }

  const confirmed = await askConfirm({
    title: `确认升级 ${target.name} 的 Python`,
    message: [
      `环境：${target.name}${target.name === "base" ? "（base）" : ""}`,
      `当前版本：Python ${check.currentVersion}`,
      `目标版本：Python ${targetVersion}`,
      `路径：${target.path}`,
      "",
      "升级将在原环境内执行。开始前会备份显式依赖，完成后核对 Python 版本及全部 Conda 环境路径；为满足兼容性，Conda 可能调整关联包。"
    ].join("\n"),
    confirmText: `升级到 ${targetVersion}`
  });
  if (!confirmed) {
    setReady("已取消 Python 升级。");
    return;
  }

  elements.checkPythonUpgradeButton.disabled = true;
  elements.upgradePythonButton.disabled = true;
  setBusy(`正在升级 ${target.name}: Python ${check.currentVersion} → ${targetVersion}...`);
  showOperationModal({
    eyebrow: "Python Upgrade",
    title: "正在无损升级 Python",
    message: `${target.name}: Python ${check.currentVersion} → ${targetVersion}`,
    details: "正在准备环境备份...",
    closable: false
  });

  try {
    const channel = check.channel || getSelectedUpgradeChannel();
    const started = await request("/api/conda/python-upgrade/tasks", {
      method: "POST",
      timeoutMs: 20000,
      body: JSON.stringify({ target, targetVersion, channel })
    });
    const completed = await pollCondaPythonUpgradeTask(started.taskId);
    if (completed.status === "failed") throw new Error(completed.message);
    await Promise.all([loadCondaEnvironments({ silent: true }), loadOverview()]);
    state.pythonUpgradeCheck = null;
    showResultLog("Python 升级完成", [
      completed.message,
      `备份文件: ${completed.backupPath || "未返回"}`,
      `目标环境: ${completed.target.path}`
    ].join("\n"), completed.message);
    setReady(completed.message);
  } catch (error) {
    setError(error.message);
    updateOperationModal({
      eyebrow: "Failed",
      title: "Python 升级失败",
      message: error.message,
      closable: true
    });
  } finally {
    resetPythonUpgradeControls();
  }
}

function wireNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.panel === "about") {
        showAboutModal();
      } else {
        switchPanel(button.dataset.panel);
      }
    });
  });
}

function wireConfirmModal() {
  elements.confirmCancelButton.addEventListener("click", () => closeConfirm(false));
  elements.confirmAcceptButton.addEventListener("click", () => closeConfirm(true));
  elements.confirmModal.addEventListener("click", (event) => {
    if (event.target === elements.confirmModal) {
      closeConfirm(false);
    }
  });
}

function wireCondaForm() {
  const form = document.querySelector("#condaCreateForm");
  const exportForm = document.querySelector("#condaExportForm");
  const exportAllForm = document.querySelector("#condaExportAllForm");
  const importForm = document.querySelector("#condaImportForm");

  const toggleMode = () => {
    const isClone = elements.condaModeSelect.value === "clone";
    elements.condaPythonFields.classList.toggle("hidden", isClone);
    elements.condaCloneFields.classList.toggle("hidden", !isClone);
    updateCondaSummary();
  };

  elements.condaModeSelect.addEventListener("change", toggleMode);
  form.addEventListener("input", updateCondaSummary);
  form.addEventListener("submit", async (event) => {
    try {
      await createCondaEnvironment(event);
    } catch (error) {
      setError(error.message);
    }
  });

  exportForm.addEventListener("submit", async (event) => {
    try {
      await exportCondaEnvironment(event);
    } catch (error) {
     setReady(error.message);
    }
  });

  exportAllForm.addEventListener("submit", async (event) => {
    try {
      await exportAllCondaEnvironments(event);
    } catch (error) {
     setReady(error.message);
    }
  });

  exportForm.elements.sourceName.addEventListener("change", async () => {
    try {
      await fillCondaExportPath({ force: true });
    } catch (error) {
      setReady(error.message);
    }
  });

  elements.condaExportAutoPathButton.addEventListener("click", async () => {
    try {
      const filePath = await fillCondaExportPath({ force: true });
      if (filePath) {
        setReady(`已生成导出路径: ${filePath}`);
      }
    } catch (error) {
     setReady(error.message);
    }
  });

  elements.condaExportBrowseButton.addEventListener("click", async () => {
    try {
      const sourceName = exportForm.elements.sourceName.value;
      const currentValue = String(exportForm.elements.filePath.value || "").trim();
      const defaultPath = currentValue || (await getDefaultCondaExportPath(sourceName));

      if (!window.desktopAPI?.chooseCondaExportPath || !ensureDesktopApi("系统保存位置选择")) {
        exportForm.elements.filePath.value = defaultPath;
        return;
      }

      const result = await window.desktopAPI.chooseCondaExportPath(defaultPath);
      if (!result?.canceled && result?.filePath) {
        exportForm.elements.filePath.value = result.filePath;
        setReady(`已选择导出路径: ${result.filePath}`);
      } else {
        setReady("已取消选择导出文件路径。");
      }
    } catch (error) {
     setReady(error.message);
    }
  });

  elements.condaExportAllAutoPathButton.addEventListener("click", async () => {
    try {
      const directoryPath = await fillCondaExportDirectory({ force: true });
      if (directoryPath) {
        setReady(`已生成导出目录: ${directoryPath}`);
      }
    } catch (error) {
     setReady(error.message);
    }
  });

  elements.condaExportAllBrowseButton.addEventListener("click", async () => {
    try {
      const currentValue = String(exportAllForm.elements.directoryPath.value || "").trim();
      const defaultPath = currentValue || (await getDefaultCondaExportDirectory());

      if (!window.desktopAPI?.chooseCondaExportDirectory || !ensureDesktopApi("系统目录选择")) {
        exportAllForm.elements.directoryPath.value = defaultPath;
        return;
      }

      const result = await window.desktopAPI.chooseCondaExportDirectory(defaultPath);
      if (!result?.canceled && result?.directoryPath) {
        exportAllForm.elements.directoryPath.value = result.directoryPath;
        setReady(`已选择导出目录: ${result.directoryPath}`);
      } else {
        setReady("已取消选择导出目录。");
      }
    } catch (error) {
     setReady(error.message);
    }
  });

  importForm.addEventListener("submit", async (event) => {
    try {
      await importCondaEnvironment(event);
    } catch (error) {
     setReady(error.message);
    }
  });

  document.querySelector("#refreshCondaButton").addEventListener("click", async () => {
    try {
      await loadCondaEnvironments();
    } catch (error) {
     setReady(error.message);
    }
  });

  elements.refreshCondaPythonVersionsButton.addEventListener("click", async () => {
    try {
      await refreshCondaPythonVersions(state.condaSelectedMajor);
    } catch (error) {
     setReady(error.message);
    }
  });

  // 大版本点击：查询对应的小版本
  elements.condaMajorVersionsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-major]");
    if (!button) return;
    const major = button.dataset.major;
    loadCondaPythonVersions(major).catch((error) => {
     setReady(error.message);
    });
  });

  // Conda 源切换时：重新查询当前选中的大版本
  elements.condaChannelRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (state.condaSelectedMajor) {
        loadCondaPythonVersions(state.condaSelectedMajor).catch(() => {});
      }
    });
  });

  // 创建表单：刷新版本按钮
  elements.refreshCondaCreateVersionsButton.addEventListener("click", async () => {
    const mode = elements.condaModeSelect.value;
    const channel = mode === "clone"
      ? elements.condaCloneChannelSelect.value
      : elements.condaCreateChannelSelect.value;
    try {
      // 单次全量刷新（后端一次 conda search 覆盖全部大版本并按大版本分桶缓存）
      const params = new URLSearchParams({ channel });
      await request(`/api/conda/python-versions/refresh?${params}`, { method: "POST" });
      await loadCreateFormVersions(channel, { skipAutoRefresh: true });
      setReady(`Conda 版本缓存（${channel}）已刷新。`);
    } catch (error) {
     setReady(error.message);
    }
  });

  // 创建表单：通道切换时重新加载版本下拉
  setupCreateFormChannelListeners();

  toggleMode();
  // 初始加载创建表单的版本下拉
  loadCreateFormVersions("defaults").catch(() => {});
  void fillCondaExportPath({ force: true });
  void fillCondaExportDirectory({ force: true });
}

function wireVenvForm() {
  document.querySelector("#venvCreateForm").addEventListener("submit", async (event) => {
    try {
      await createVenv(event);
    } catch (error) {
     setReady(error.message);
    }
  });

  document.querySelector("#refreshVenvButton").addEventListener("click", async () => {
    try {
      await loadVenvs();
    } catch (error) {
      setError(error.message);
    }
  });
}

function wirePackageActions() {
  const form = document.querySelector("#packageActionForm");

  elements.pipSourceSelect.addEventListener("change", updatePipSourceField);
  updatePipSourceField();

  elements.packageTargetSelect.addEventListener("change", () => {
    resetPythonUpgradeControls();
    loadInstalledPackages({ silent: true });
  });

  elements.installedPackageSelect.addEventListener("change", () => {
    if (elements.installedPackageSelect.value) {
      form.packageName.value = elements.installedPackageSelect.value;
    }
  });

  document.querySelector("#refreshTargetsButton").addEventListener("click", async () => {
    try {
      await Promise.all([loadCondaEnvironments({ silent: true }), loadVenvs({ silent: true }), loadOverview()]);
      await loadInstalledPackages({ silent: true });
    } catch (error) {
     setReady(error.message);
    }
  });

  elements.refreshInstalledPackagesButton.addEventListener("click", () => loadInstalledPackages());

  document.querySelector("#installPackageButton").addEventListener("click", () =>
    runPackageAction("install", { packageName: form.packageName.value })
  );
  document.querySelector("#upgradePackageButton").addEventListener("click", () =>
    runPackageAction("install", { packageName: form.packageName.value, upgrade: true })
  );
  document.querySelector("#uninstallPackageButton").addEventListener("click", () =>
    runPackageAction("uninstall", { packageName: form.packageName.value })
  );
  document.querySelector("#listPackagesButton").addEventListener("click", () => runPackageAction("list"));
  document.querySelector("#showPackageInfoButton").addEventListener("click", () =>
    runPackageAction("show", { packageName: form.packageName.value })
  );
  document.querySelector("#latestPackageVersionButton").addEventListener("click", () =>
    runPackageAction("latest-version", { packageName: form.packageName.value })
  );
  document.querySelector("#upgradePipButton").addEventListener("click", () => runPackageAction("upgrade-pip"));
  elements.checkPythonUpgradeButton.addEventListener("click", async () => {
    try {
      await checkSelectedCondaPythonUpgrade();
    } catch {
      // The status banner and result controls already show the request error.
    }
  });
  elements.upgradePythonButton.addEventListener("click", () => upgradeSelectedCondaPython());
  elements.upgradeCondaChannelRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      resetPythonUpgradeControls();
    });
  });
  elements.upgradeAllPackagesButton.addEventListener("click", async () => {
    const target = getSelectedTarget();
    if (!target) {
      setReady("请先选择目标环境。");
      return;
    }

    const confirmed = await askConfirm({
      title: "一键升级全部包",
      message:
        target.type === "conda"
          ? `确定要升级 conda 环境“${target.name}”中的全部库吗？\n将先执行 conda update --all，再升级 pip 包。`
          : "确定要升级当前目标环境中的全部 pip 包吗？",
      confirmText: "确认升级"
    });
    if (!confirmed) {
      return;
    }

    try {
      await runPackageAction("upgrade-all");
    } catch (error) {
     setReady(error.message);
    }
  });
  document.querySelector("#installRequirementsButton").addEventListener("click", () =>
    runPackageAction("install-requirements", { requirementsPath: form.requirementsPath.value })
  );
}

function wireListActions() {
  document.body.addEventListener("click", async (event) => {
    const condaName = event.target.dataset.deleteConda;
    const venvPath = event.target.dataset.deleteVenv;

    if (condaName) {
      try {
        await deleteConda(condaName);
      } catch (error) {
        setReady(error.message);
      }
    }

    if (venvPath) {
      try {
        await deleteVenv(venvPath);
      } catch (error) {
        setReady(error.message);
      }
    }
  });
}

function showAboutModal() {
  // 动态填充系统信息
  if (state.overview) {
    elements.aboutPlatform.textContent = `${state.overview.platform || "?"} / ${state.overview.arch || "?"}`;
    elements.aboutNodeVersion.textContent = state.overview.systemNodeVersion || state.overview.nodeVersion || "-";
    elements.aboutCondaState.textContent = state.overview.condaPath ? `已连接 (${state.overview.condaPath})` : "未检测到";
  }
  elements.aboutModal.classList.remove("hidden");
}

function wireAboutModal() {
  // 桌面版菜单栏「关于」触发的 IPC 监听
  if (window.desktopAPI?.onShowAbout) {
    window.desktopAPI.onShowAbout(() => {
      showAboutModal();
    });
  }

  elements.aboutCloseButton.addEventListener("click", () => {
    elements.aboutModal.classList.add("hidden");
  });

  elements.aboutModal.addEventListener("click", (event) => {
    if (event.target === elements.aboutModal) {
      elements.aboutModal.classList.add("hidden");
    }
  });
}

/* ---------- 外观设置 ---------- */
const SKIN_STORAGE_KEY = "weipython.skin";
const LEGACY_WALLPAPER_STORAGE_KEY = "weipython.wallpaper";
const WALLPAPER_MAX_SIDE = 2560;
const WALLPAPER_MAX_FILE_BYTES = 20 * 1024 * 1024;
const WALLPAPER_MAX_DATA_URL_BYTES = 4.5 * 1024 * 1024;

const DEFAULT_TAGLINE = "以工程控制台的方式管理 Python 环境";
const DEFAULT_THEME = {
  primary: "#2563EB",
  secondary: "#0EA5E9",
  ink: "#0F172A"
};

function getSkinFallback() {
  const fallback = { wallpaper: "", tagline: "", ...DEFAULT_THEME };
  try {
    const raw = localStorage.getItem(SKIN_STORAGE_KEY);
    if (raw) {
      return { ...fallback, ...JSON.parse(raw) };
    }
  } catch {
    // 本地存储损坏时忽略
  }
  try {
    // 迁移旧版单键壁纸设置
    const legacy = localStorage.getItem(LEGACY_WALLPAPER_STORAGE_KEY);
    if (legacy) {
      localStorage.removeItem(LEGACY_WALLPAPER_STORAGE_KEY);
      return { ...fallback, wallpaper: legacy };
    }
  } catch {
    // 忽略迁移失败
  }
  return fallback;
}

async function loadSkinFromServer() {
  try {
    const response = await fetch("/api/skin", { cache: "no-store" });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // 服务端不可用时回退本地存储
  }
  return null;
}

async function saveSkinToServer(skin) {
  try {
    const response = await fetch("/api/skin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skin)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function getSkin() {
  // 桌面版：以 userData/skin.json 文件为准（随机端口下 localStorage 无法跨启动保留）
  const serverSkin = await loadSkinFromServer();
  const fallback = getSkinFallback();
  const base =
    serverSkin && typeof serverSkin === "object"
      ? { ...fallback, ...serverSkin }
      : fallback;

  // localStorage 可能是上次保存失败时的最新兜底数据，优先于 server 文件采用
  let hasLocalFallback = false;
  try {
    const localRaw = localStorage.getItem(SKIN_STORAGE_KEY);
    if (localRaw) {
      const local = JSON.parse(localRaw);
      if (local && typeof local === "object") {
        Object.assign(base, local);
        hasLocalFallback = true;
      }
    }
  } catch {
    // 本地存储损坏时忽略
  }

  // 清洗旧数据：保证关键字段为可用值
  base.wallpaper = typeof base.wallpaper === "string" ? base.wallpaper : "";
  base.tagline = typeof base.tagline === "string" ? base.tagline : "";
  base.primary = typeof base.primary === "string" && base.primary ? base.primary : DEFAULT_THEME.primary;
  base.secondary = typeof base.secondary === "string" && base.secondary ? base.secondary : DEFAULT_THEME.secondary;
  base.ink = typeof base.ink === "string" && base.ink ? base.ink : DEFAULT_THEME.ink;

  // 本地兜底比 server 新：写回文件保持一致，成功后再清除本地
  if (hasLocalFallback) {
    const synced = await saveSkinToServer(base);
    if (synced) {
      try {
        localStorage.removeItem(SKIN_STORAGE_KEY);
      } catch {
        // 忽略清除失败
      }
    }
  }
  return base;
}

let cachedSkin = null;
let lastSavedSkin = null;

async function ensureSkinLoaded() {
  if (!cachedSkin) {
    cachedSkin = await getSkin();
    lastSavedSkin = { ...cachedSkin };
  }
  return cachedSkin;
}

function getCachedSkin() {
  return cachedSkin || getSkinFallback();
}

const SKIN_FIELDS = ["wallpaper", "tagline", "primary", "secondary", "ink"];

function diffSkin(prev, next) {
  const diff = {};
  for (const key of SKIN_FIELDS) {
    if ((prev?.[key] ?? "") !== (next[key] ?? "")) {
      diff[key] = next[key] ?? "";
    }
  }
  return diff;
}

function persistSkin() {
  const skin = getCachedSkin();
  if (!lastSavedSkin) {
    lastSavedSkin = { ...getSkinFallback() };
  }
  const diff = diffSkin(lastSavedSkin, skin);
  if (!Object.keys(diff).length) {
    // 无实际变更，跳过保存
    return;
  }
  void (async () => {
    try {
      // 只提交变更字段：颜色/标语等轻量修改不再携带几 MB 壁纸数据
      const saved = await saveSkinToServer(diff);
      if (saved) {
        lastSavedSkin = { ...skin };
        try {
          localStorage.removeItem(SKIN_STORAGE_KEY);
        } catch {
          // 忽略清除失败
        }
      } else {
        try {
          localStorage.setItem(SKIN_STORAGE_KEY, JSON.stringify(skin));
        } catch (error) {
          setError(`外观设置保存失败: ${error.message}`);
        }
      }
    } catch {
      // 保存失败静默，下次启动仍可从 localStorage 恢复部分设置
    }
  })();
}

function isThemeCustom(skin) {
  return (
    skin.primary !== DEFAULT_THEME.primary ||
    skin.secondary !== DEFAULT_THEME.secondary ||
    skin.ink !== DEFAULT_THEME.ink
  );
}

function updateSkinSummary(skin) {
  if (elements.skinPreviewInner) {
    elements.skinPreviewInner.style.backgroundImage = skin.wallpaper ? `url("${skin.wallpaper}")` : "";
    elements.skinPreviewInner.textContent = skin.wallpaper ? "" : "默认壁纸";
  }
  if (elements.skinNote) {
    const tagline = String(skin.tagline || "").trim();
    const parts = [];
    if (skin.wallpaper) parts.push("自定义壁纸");
    if (tagline) parts.push("自定义标语");
    if (isThemeCustom(skin)) parts.push("自定义配色");
    elements.skinNote.textContent = parts.length
      ? `已应用：${parts.join("、")}，重启后仍然生效。`
      : "当前使用默认外观。";
  }
}

function applyWallpaper(dataUrl) {
  if (dataUrl) {
    document.body.style.setProperty("--wallpaper-image", `url("${dataUrl}")`);
  } else {
    document.body.style.removeProperty("--wallpaper-image");
  }
}

function applyTagline(tagline) {
  const element = document.querySelector("#heroTagline");
  if (element) {
    element.textContent = String(tagline || "").trim() || DEFAULT_TAGLINE;
  }
}

/* ---------- 主题色工具 ---------- */
function hexToRgb(hex) {
  const value = String(hex || "").replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const num = parseInt(full || "0", 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mixHex(hexA, hexB, weightB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const mix = (x, y) => Math.round(x + (y - x) * weightB);
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbComma(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

function buildThemeVars(theme) {
  const primary = theme.primary;
  const secondary = theme.secondary;
  const ink = theme.ink;
  return {
    "--primary-rgb": rgbComma(mixHex(primary, "#FFFFFF", 0.60)),
    "--accent-rgb": rgbComma(primary),
    "--mauve-rgb": rgbComma(secondary),
    "--sakura-pink-rgb": rgbComma(mixHex(primary, "#FFFFFF", 0.88)),
    "--lavender-rgb": rgbComma(mixHex(secondary, "#FFFFFF", 0.80)),
    "--peach-rgb": rgbComma(mixHex(primary, "#FFFFFF", 0.55)),
    "--lavender-glow-rgb": rgbComma(secondary),
    "--overlay-a-rgb": rgbComma(mixHex(primary, "#FFFFFF", 0.90)),
    "--overlay-b-rgb": rgbComma(mixHex(secondary, "#FFFFFF", 0.90)),
    "--overlay-c-rgb": rgbComma(mixHex(primary, "#FFFFFF", 0.95)),
    "--ink-deep-rgb": rgbComma(ink),
    "--ink-rgb": rgbComma(mixHex(ink, "#FFFFFF", 0.18))
  };
}

const THEME_CSS_VARS = Object.keys(buildThemeVars(DEFAULT_THEME));

function applyTheme(theme) {
  const root = document.documentElement;
  const vars = buildThemeVars(theme);
  THEME_CSS_VARS.forEach((name) => root.style.setProperty(name, vars[name]));
}

function resetTheme() {
  const root = document.documentElement;
  THEME_CSS_VARS.forEach((name) => root.style.removeProperty(name));
}

async function restoreSkin() {
  const skin = await ensureSkinLoaded();
  if (skin.wallpaper) {
    applyWallpaper(skin.wallpaper);
  }
  applyTagline(skin.tagline);
  if (isThemeCustom(skin)) {
    applyTheme(skin);
  } else {
    resetTheme();
  }
}

async function compressImageFile(file) {
  if (file.size > WALLPAPER_MAX_FILE_BYTES) {
    throw new Error("图片过大，请选择 20MB 以内的图片。");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, WALLPAPER_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    // 统一转为 webp（比 JPEG 体积更小），环境不支持时回退 JPEG
    let dataUrl = canvas.toDataURL("image/webp", 0.85);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

async function importWallpaperFromFile(file) {
  try {
    const dataUrl = await compressImageFile(file);
    if (dataUrl.length > WALLPAPER_MAX_DATA_URL_BYTES) {
      throw new Error("压缩后的壁纸仍然过大，请换一张分辨率或体积更小的图片。");
    }
    const skin = await ensureSkinLoaded();
    skin.wallpaper = dataUrl;
    applyWallpaper(dataUrl);
    persistSkin();
    updateSkinSummary(skin);
    setReady("背景壁纸已更换。");
    return true;
  } catch (error) {
    setError(error.message);
    return false;
  }
}

function handleWallpaperImport() {
  elements.skinFileInput?.click();
}

async function handleWallpaperReset() {
  const skin = await ensureSkinLoaded();
  skin.wallpaper = "";
  applyWallpaper("");
  persistSkin();
  updateSkinSummary(skin);
  setReady("已恢复默认壁纸。");
}

async function handleTaglineChange() {
  const tagline = (elements.skinTaglineInput?.value || "").trim();
  const skin = await ensureSkinLoaded();
  skin.tagline = tagline;
  applyTagline(tagline);
  persistSkin();
  updateSkinSummary(skin);
  setReady(tagline ? "首页标语已更新。" : "已恢复默认标语。");
}

function handleTaglineReset() {
  if (elements.skinTaglineInput) {
    elements.skinTaglineInput.value = "";
  }
  void handleTaglineChange();
}

function handleColorPreview() {
  // 拖动取色器时仅实时预览，不写存储
  const skin = getCachedSkin();
  skin.primary = elements.skinPrimaryColor?.value || DEFAULT_THEME.primary;
  skin.secondary = elements.skinSecondaryColor?.value || DEFAULT_THEME.secondary;
  skin.ink = elements.skinInkColor?.value || DEFAULT_THEME.ink;
  applyTheme(skin);
  updateSkinSummary(skin);
}

async function handleColorChange() {
  await ensureSkinLoaded();
  handleColorPreview();
  persistSkin();
  setReady("整体配色已更新。");
}

async function handleColorsReset() {
  if (elements.skinPrimaryColor) elements.skinPrimaryColor.value = DEFAULT_THEME.primary;
  if (elements.skinSecondaryColor) elements.skinSecondaryColor.value = DEFAULT_THEME.secondary;
  if (elements.skinInkColor) elements.skinInkColor.value = DEFAULT_THEME.ink;
  const skin = await ensureSkinLoaded();
  skin.primary = DEFAULT_THEME.primary;
  skin.secondary = DEFAULT_THEME.secondary;
  skin.ink = DEFAULT_THEME.ink;
  resetTheme();
  persistSkin();
  updateSkinSummary(skin);
  setReady("已恢复默认配色。");
}

async function showSkinModal() {
  const skin = await ensureSkinLoaded();
  if (elements.skinTaglineInput) elements.skinTaglineInput.value = skin.tagline;
  if (elements.skinPrimaryColor) elements.skinPrimaryColor.value = skin.primary;
  if (elements.skinSecondaryColor) elements.skinSecondaryColor.value = skin.secondary;
  if (elements.skinInkColor) elements.skinInkColor.value = skin.ink;
  updateSkinSummary(skin);
  elements.skinModal.classList.remove("hidden");
}

function wireSkin() {
  elements.skinButton?.addEventListener("click", showSkinModal);
  elements.skinCloseButton?.addEventListener("click", () => {
    elements.skinModal.classList.add("hidden");
  });
  elements.skinModal?.addEventListener("click", (event) => {
    if (event.target === elements.skinModal) {
      elements.skinModal.classList.add("hidden");
    }
  });
  elements.skinImportButton?.addEventListener("click", handleWallpaperImport);
  elements.skinResetButton?.addEventListener("click", handleWallpaperReset);
  elements.skinTaglineResetButton?.addEventListener("click", handleTaglineReset);
  elements.skinColorsResetButton?.addEventListener("click", handleColorsReset);
  elements.skinTaglineInput?.addEventListener("change", handleTaglineChange);
  elements.skinPrimaryColor?.addEventListener("input", handleColorPreview);
  elements.skinSecondaryColor?.addEventListener("input", handleColorPreview);
  elements.skinInkColor?.addEventListener("input", handleColorPreview);
  elements.skinPrimaryColor?.addEventListener("change", handleColorChange);
  elements.skinSecondaryColor?.addEventListener("change", handleColorChange);
  elements.skinInkColor?.addEventListener("change", handleColorChange);
  elements.skinFileInput?.addEventListener("change", async () => {
    const file = elements.skinFileInput.files?.[0];
    elements.skinFileInput.value = "";
    if (file) {
      await importWallpaperFromFile(file);
    }
  });

  // 桌面版菜单栏「设置 → 外观设置」触发的 IPC 监听
  if (window.desktopAPI?.onRequestSkinOpen) {
    window.desktopAPI.onRequestSkinOpen(() => {
      showSkinModal();
    });
  }
  if (window.desktopAPI?.onRequestWallpaperImport) {
    window.desktopAPI.onRequestWallpaperImport(() => {
      handleWallpaperImport();
    });
  }
  if (window.desktopAPI?.onRequestWallpaperReset) {
    window.desktopAPI.onRequestWallpaperReset(() => {
      handleWallpaperReset();
    });
  }
}

function wireSetup() {
  elements.setupForm.addEventListener("submit", initializeComputer);
  elements.refreshSetupButton.addEventListener("click", () => {
    loadSetupStatus().catch((error) => setError(error.message));
  });
  elements.upgradeMinicondaButton.addEventListener("click", upgradeMiniconda);
  document.querySelectorAll("[data-toggle-setup-packages]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.toggleSetupPackages;
      const checkboxes = [...elements.setupForm.querySelectorAll(`input[name="${type}PackageIds"]`)];
      const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);
      checkboxes.forEach((checkbox) => {
        checkbox.checked = shouldSelect;
      });
    });
  });
}

async function bootstrap() {
  // 先恢复已保存的外观设置（壁纸/标语/配色），避免加载后闪烁
  await restoreSkin();

  wireNavigation();
  wireConfirmModal();
  wireCondaForm();
  wireVenvForm();
  wirePackageActions();
  wireListActions();
  wireAboutModal();
  wireSkin();
  wireSetup();

  elements.clearGlobalLogButton.addEventListener("click", () => {
    elements.globalLogStatus.textContent = "就绪";
    elements.globalLogTitle.textContent = "运行日志";
    elements.globalLogMessage.textContent = "日志已清空。";
    elements.globalLogOutput.textContent = "尚未开始。";
  });

  document.querySelector("#refreshOverviewButton").addEventListener("click", async () => {
    try {
      await loadOverview();
    } catch (error) {
      setError(error.message);
    }
  });

  elements.upgradeNodeButton.addEventListener("click", async () => {
    try {
      await upgradeNodeVersion();
    } catch (error) {
      setReady(error.message);
    }
  });

  try {
    await loadOverview();
    state.pythonVersionsLoaded = true;
    // 后台刷新 Conda 环境（loadOverview 可能超时，此调用兜底）
    loadCondaEnvironments({ silent: true }).catch(() => {});
    // 渲染 Conda 大版本选择列表（无需远程查询）
    renderCondaMajorVersions();
    loadVenvs({ silent: true }).catch((error) => setReady(`虚拟环境扫描失败: ${error.message}`));
    } catch (error) {
      setReady(error.message);
    }
  // ---------- 全局日志折叠：默认折叠，点击头部展开/收起 ----------
  const globalLogPanel = document.querySelector("#globalLogPanel");
  const globalLogToggle = document.querySelector("#globalLogToggle");
  if (globalLogPanel && globalLogToggle) {
    const setLogCollapsed = (collapsed) => {
      globalLogPanel.classList.toggle("collapsed", collapsed);
      globalLogToggle.setAttribute("aria-expanded", String(!collapsed));
    };
    const toggleLogPanel = (event) => {
      // 点击头部的清空按钮等内部控件时不切换折叠状态
      if (event && event.target.closest("#clearGlobalLogButton")) return;
      setLogCollapsed(!globalLogPanel.classList.contains("collapsed"));
    };
    globalLogToggle.addEventListener("click", toggleLogPanel);
    globalLogToggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleLogPanel(event);
      }
    });
    // 初始默认折叠（与 HTML 中的 collapsed 类保持一致）
    setLogCollapsed(true);
  }
}

bootstrap();
