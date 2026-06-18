import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { clearCondaCache, detectCondaExecutable, listCondaEnvironments, runCondaCommand } from "./environment-service.js";
import { runStreamingCommand } from "../utils/process.js";

const MINICONDA_WINDOWS_X64_URL = "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe";
const DEFAULT_WINDOWS_INSTALL_PATH = "D:\\ProgramData\\miniconda3";
const REQUIRED_CONDA_PACKAGES = ["ipykernel"];
const SETUP_PACKAGE_CATALOG = {
  conda: [
    { id: "numpy", packageName: "numpy", label: "NumPy", description: "数组与数值计算", defaultSelected: true },
    { id: "pandas", packageName: "pandas", label: "Pandas", description: "表格数据处理", defaultSelected: true },
    { id: "openpyxl", packageName: "openpyxl", label: "OpenPyXL", description: "Excel 文件读写", defaultSelected: true },
    { id: "matplotlib", packageName: "matplotlib", label: "Matplotlib", description: "基础数据可视化", defaultSelected: false },
    { id: "pyarrow", packageName: "pyarrow", label: "PyArrow", description: "Arrow 与 Parquet 数据", defaultSelected: false }
  ],
  pip: [
    { id: "openai", packageName: "openai", label: "OpenAI", description: "OpenAI Python SDK", defaultSelected: true },
    { id: "loguru", packageName: "loguru", label: "Loguru", description: "简洁的日志工具", defaultSelected: true },
    { id: "streamlit", packageName: "streamlit", label: "Streamlit", description: "快速构建数据应用", defaultSelected: false },
    { id: "drissionpage", packageName: "DrissionPage", label: "DrissionPage", description: "浏览器自动化与采集", defaultSelected: false },
    { id: "ipython-sql", packageName: "ipython-sql", label: "IPython SQL", description: "Notebook 中执行 SQL", defaultSelected: false },
    { id: "sqlalchemy", packageName: "SQLAlchemy", label: "SQLAlchemy", description: "数据库 ORM 与连接", defaultSelected: false },
    { id: "aiomysql", packageName: "aiomysql", label: "aiomysql", description: "异步 MySQL 客户端", defaultSelected: false },
    { id: "pymysql", packageName: "PyMySQL", label: "PyMySQL", description: "纯 Python MySQL 客户端", defaultSelected: false },
    { id: "mysql-connector", packageName: "mysql-connector-python", label: "MySQL Connector", description: "MySQL 官方连接器", defaultSelected: false },
    { id: "schedule", packageName: "schedule", label: "Schedule", description: "轻量定时任务", defaultSelected: false },
    { id: "wei-data-shu", packageName: "wei-data-shu", label: "wei-data-shu", description: "py3146 已安装的数据工具", defaultSelected: false }
  ]
};
const setupTasks = new Map();
const TASK_TTL_MS = 60 * 60 * 1000;
const MAX_LOG_LENGTH = 160000;

function cleanupTasks() {
  const now = Date.now();
  for (const [taskId, task] of setupTasks.entries()) {
    if (task.finishedAt && now - Date.parse(task.finishedAt) > TASK_TTL_MS) {
      setupTasks.delete(taskId);
    }
  }
}

function appendLog(task, text) {
  if (!text) return;
  task.output += String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (task.output.length > MAX_LOG_LENGTH) {
    task.output = `[日志过长，已截断早期输出]\n${task.output.slice(-MAX_LOG_LENGTH)}`;
  }
}

function setStage(task, stage, message, progress) {
  task.stage = stage;
  task.message = message;
  task.progress = progress;
  appendLog(task, `\n[${new Date().toLocaleTimeString("zh-CN")}] ${message}\n`);
}

function snapshot(task) {
  return {
    taskId: task.taskId,
    taskType: task.taskType || "initialize",
    status: task.status,
    stage: task.stage,
    message: task.message,
    progress: task.progress,
    output: task.output,
    installPath: task.installPath,
    condaPath: task.condaPath,
    pythonVersion: task.pythonVersion,
    environmentName: task.environmentName,
    condaPackages: task.condaPackages,
    pipPackages: task.pipPackages,
    currentCondaVersion: task.currentCondaVersion,
    latestCondaVersion: task.latestCondaVersion,
    backupPath: task.backupPath,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt
  };
}

export function comparePythonVersions(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

export function resolveLatestStablePythonVersion(searchOutput) {
  const parsed = typeof searchOutput === "string" ? JSON.parse(searchOutput || "{}") : searchOutput;
  const records = Array.isArray(parsed?.python) ? parsed.python : [];
  const versions = records
    .map((record) => String(record?.version || "").trim())
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version));
  const uniqueVersions = [...new Set(versions)].sort(comparePythonVersions);
  if (!uniqueVersions.length) {
    throw new Error("conda-forge 未返回可用的稳定版 Python");
  }
  return uniqueVersions.at(-1);
}

export function resolveLatestCondaVersion(searchOutput) {
  const parsed = typeof searchOutput === "string" ? JSON.parse(searchOutput || "{}") : searchOutput;
  const records = Array.isArray(parsed?.conda) ? parsed.conda : [];
  const versions = records
    .map((record) => String(record?.version || "").trim())
    .filter((version) => /^\d+(?:\.\d+)+$/.test(version));
  const uniqueVersions = [...new Set(versions)].sort(comparePythonVersions);
  if (!uniqueVersions.length) throw new Error("未查询到可用的 Conda 版本");
  return uniqueVersions.at(-1);
}

const CONDA_UPDATE_ARTIFACT_PATTERN = /^conda(?:\.exe)?\.c~(?:\.conda_trash(?:_\d+)?)?$/i;

export function isRecoverableCondaCleanupFailure(stderr = "", stdout = "") {
  const output = `${stderr}\n${stdout}`;
  return /conda\.exe\.c~/i.test(output) && (
    /\.conda_trash/i.test(output)
    || /unlink_or_rename_to_trash/i.test(output)
    || /has no attribute ['"]splitext['"]/i.test(output)
  );
}

export async function cleanupStaleCondaUpdateArtifacts(installRoot) {
  if (process.platform !== "win32") return { removed: [], failed: [] };

  const scriptsDirectory = path.join(installRoot, "Scripts");
  let entries;
  try {
    entries = await fsp.readdir(scriptsDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return { removed: [], failed: [] };
    throw error;
  }

  const artifactNames = entries
    .filter((entry) => entry.isFile() && CONDA_UPDATE_ARTIFACT_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => Number(right.includes(".conda_trash")) - Number(left.includes(".conda_trash")));
  const removed = [];
  const failed = [];

  for (const name of artifactNames) {
    try {
      await fsp.unlink(path.join(scriptsDirectory, name));
      removed.push(name);
    } catch (error) {
      failed.push({ name, code: error?.code || "UNKNOWN" });
    }
  }

  return { removed, failed };
}

export function buildEnvironmentName(pythonVersion) {
  return `py${String(pythonVersion).replace(/\D/g, "")}`;
}

function getDefaultInstallPath() {
  return process.platform === "win32" ? DEFAULT_WINDOWS_INSTALL_PATH : path.join(os.homedir(), "miniconda3");
}

export function getSetupPackageCatalog() {
  return structuredClone(SETUP_PACKAGE_CATALOG);
}

export function normalizeSelectedPackages(selectedIds, type) {
  const catalog = SETUP_PACKAGE_CATALOG[type] || [];
  const requested = Array.isArray(selectedIds)
    ? new Set(selectedIds.map((item) => String(item).trim()))
    : new Set(catalog.filter((item) => item.defaultSelected).map((item) => item.id));
  return catalog.filter((item) => requested.has(item.id)).map((item) => item.packageName);
}

function downloadFile(url, destination, task, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects >= 5) {
          reject(new Error("Miniconda 下载重定向次数过多"));
          return;
        }
        const nextUrl = new URL(response.headers.location, url).toString();
        resolve(downloadFile(nextUrl, destination, task, redirects + 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Miniconda 下载失败（HTTP ${response.statusCode}）`));
        return;
      }

      const total = Number(response.headers["content-length"] || 0);
      let received = 0;
      let lastReported = -1;
      const stream = fs.createWriteStream(destination);
      response.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0) {
          const percent = Math.floor((received / total) * 100);
          if (percent >= lastReported + 10) {
            lastReported = percent;
            appendLog(task, `下载进度: ${percent}%\n`);
          }
        }
      });
      response.pipe(stream);
      stream.on("finish", () => stream.close(resolve));
      stream.on("error", reject);
    });
    request.on("error", reject);
  });
}

async function installMiniconda(task) {
  const installerPath = path.join(os.tmpdir(), `WeiPython-Miniconda-${task.taskId}.exe`);
  try {
    setStage(task, "download", "正在下载最新版 Miniconda", 15);
    await downloadFile(MINICONDA_WINDOWS_X64_URL, installerPath, task);
    setStage(task, "install", "正在静默安装 Miniconda", 35);
    const result = await runStreamingCommand(installerPath, [
      "/InstallationType=JustMe",
      "/RegisterPython=0",
      "/AddToPath=0",
      "/S",
      `/D=${task.installPath}`
    ], {
      timeoutMs: 15 * 60 * 1000,
      onStdout: (text) => appendLog(task, text),
      onStderr: (text) => appendLog(task, `[stderr] ${text}`)
    });
    if (!result.ok) {
      throw new Error(result.stderr || result.stdout || `Miniconda 安装程序退出码 ${result.code}`);
    }
  } finally {
    await fsp.rm(installerPath, { force: true }).catch(() => {});
  }
}

async function runSetup(task) {
  try {
    let condaPath = await detectCondaExecutable(task.installPath);
    if (!condaPath) {
      if (process.platform !== "win32" || process.arch !== "x64") {
        throw new Error("自动安装当前仅支持 Windows x64；请先手动安装 Miniconda 后重试");
      }
      await installMiniconda(task);
      clearCondaCache();
      condaPath = await detectCondaExecutable(task.installPath);
      if (!condaPath) {
        throw new Error("Miniconda 安装完成，但未找到 conda 可执行文件");
      }
    } else {
      setStage(task, "detect", "已检测到 Conda，跳过 Miniconda 安装", 35);
    }
    task.condaPath = condaPath;

    setStage(task, "resolve", "正在从 conda-forge 查询最新版 Python", 55);
    const searchResult = await runCondaCommand([
      "search",
      "-c",
      "conda-forge",
      "--override-channels",
      "--repodata-fn",
      "current_repodata.json",
      "python",
      "--json"
    ], task.installPath);
    if (!searchResult.ok) {
      throw new Error(searchResult.stderr || searchResult.stdout || "查询 conda-forge 失败");
    }

    task.pythonVersion = resolveLatestStablePythonVersion(searchResult.stdout);
    task.environmentName = buildEnvironmentName(task.pythonVersion);
    appendLog(task, `最新版 Python: ${task.pythonVersion}\n环境名称: ${task.environmentName}\n`);

    const { environments } = await listCondaEnvironments(task.installPath);
    const existing = environments.find((environment) => environment.name === task.environmentName);

    if (!existing) {
      setStage(task, "environment", `正在创建首个环境 ${task.environmentName}`, 70);
      const createResult = await runCondaCommand([
        "create",
        "-n",
        task.environmentName,
        "-c",
        "conda-forge",
        "--override-channels",
        "--solver",
        "classic",
        "--no-default-packages",
        `python=${task.pythonVersion}`,
        ...REQUIRED_CONDA_PACKAGES,
        ...task.condaPackages,
        "-y"
      ], task.installPath);
      appendLog(task, createResult.stdout);
      appendLog(task, createResult.stderr ? `[stderr] ${createResult.stderr}` : "");
      if (!createResult.ok) {
        throw new Error(createResult.stderr || createResult.stdout || "创建首个 Conda 环境失败");
      }
    } else {
      setStage(task, "environment", `环境 ${task.environmentName} 已存在，正在补充选择的库`, 70);
      const packagesToEnsure = [...REQUIRED_CONDA_PACKAGES, ...task.condaPackages];
      if (packagesToEnsure.length) {
        const installResult = await runCondaCommand([
          "install",
          "-n",
          task.environmentName,
          "-c",
          "conda-forge",
          "--override-channels",
          ...packagesToEnsure,
          "-y"
        ], task.installPath);
        appendLog(task, installResult.stdout);
        appendLog(task, installResult.stderr ? `[stderr] ${installResult.stderr}` : "");
        if (!installResult.ok) {
          throw new Error(installResult.stderr || installResult.stdout || "安装 Conda 常用库失败");
        }
      }
    }

    if (task.pipPackages.length) {
      setStage(task, "packages", "正在通过 pip 安装选择的常用库", 88);
      const refreshed = await listCondaEnvironments(task.installPath);
      const targetEnvironment = refreshed.environments.find((environment) => environment.name === task.environmentName);
      if (!targetEnvironment) throw new Error(`未找到新环境 ${task.environmentName}`);
      const pythonExecutable = process.platform === "win32"
        ? path.join(targetEnvironment.path, "python.exe")
        : path.join(targetEnvironment.path, "bin", "python");
      const pipResult = await runStreamingCommand(pythonExecutable, ["-m", "pip", "install", ...task.pipPackages], {
        timeoutMs: 20 * 60 * 1000,
        onStdout: (text) => appendLog(task, text),
        onStderr: (text) => appendLog(task, `[stderr] ${text}`)
      });
      if (!pipResult.ok) {
        throw new Error(pipResult.stderr || pipResult.stdout || "安装 pip 常用库失败");
      }
    }

    clearCondaCache();
    setStage(task, "complete", `初始化完成：${task.environmentName}（Python ${task.pythonVersion}）`, 100);
    task.status = "completed";
    task.finishedAt = new Date().toISOString();
  } catch (error) {
    task.status = "failed";
    task.stage = "failed";
    task.message = error.message || "初始化失败";
    task.finishedAt = new Date().toISOString();
    appendLog(task, `\n[失败] ${task.message}\n`);
  }
}

async function getMinicondaInfo(preferredRoot) {
  const condaPath = await detectCondaExecutable(preferredRoot);
  if (!condaPath) {
    return {
      available: false,
      condaPath: null,
      rootPrefix: null,
      condaVersion: null,
      basePythonVersion: null,
      rootWritable: false
    };
  }
  const result = await runCondaCommand(["info", "--json"], preferredRoot);
  if (!result.ok) throw new Error(result.stderr || result.stdout || "读取 Miniconda 信息失败");
  const info = JSON.parse(result.stdout || "{}");
  const basePythonVersion = String(info.python_version || "").match(/^\d+\.\d+\.\d+/)?.[0] || info.python_version || null;
  return {
    available: true,
    condaPath,
    rootPrefix: info.root_prefix || preferredRoot,
    condaVersion: info.conda_version || null,
    basePythonVersion,
    rootWritable: Boolean(info.root_writable)
  };
}

async function createBaseBackup(task) {
  setStage(task, "backup", "正在备份 base 环境显式配置", 45);
  const result = await runCondaCommand(["env", "export", "-n", "base", "--from-history"], task.installPath);
  if (!result.ok) throw new Error(result.stderr || result.stdout || "备份 base 环境失败");
  const backupDirectory = path.join(os.homedir(), "WeiPythonBackups", "miniconda");
  await fsp.mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  task.backupPath = path.join(backupDirectory, `base-before-conda-upgrade-${timestamp}.yml`);
  await fsp.writeFile(task.backupPath, result.stdout, "utf8");
  appendLog(task, `备份文件: ${task.backupPath}\n`);
}

async function runMinicondaUpgrade(task) {
  try {
    const beforeInfo = await getMinicondaInfo(task.installPath);
    if (!beforeInfo.available) throw new Error("未检测到 Miniconda");
    task.currentCondaVersion = beforeInfo.condaVersion;
    task.condaPath = beforeInfo.condaPath;
    task.installPath = beforeInfo.rootPrefix || task.installPath;

    setStage(task, "check", "正在检查 Conda 核心更新", 20);
    const searchResult = await runCondaCommand(["search", "-c", "defaults", "conda", "--json"], task.installPath);
    if (!searchResult.ok) throw new Error(searchResult.stderr || searchResult.stdout || "检查 Conda 更新失败");
    task.latestCondaVersion = resolveLatestCondaVersion(searchResult.stdout);
    appendLog(task, `当前版本: ${task.currentCondaVersion}\n最新版本: ${task.latestCondaVersion}\n`);

    if (comparePythonVersions(task.currentCondaVersion, task.latestCondaVersion) >= 0) {
      setStage(task, "complete", `Conda ${task.currentCondaVersion} 已是最新版`, 100);
      task.status = "completed";
      task.finishedAt = new Date().toISOString();
      return;
    }
    if (!beforeInfo.rootWritable) {
      throw new Error("Miniconda 安装目录不可写；请以管理员身份运行 WeiPython 后再升级");
    }

    const beforeEnvironments = await listCondaEnvironments(task.installPath);
    const beforePaths = beforeEnvironments.environments.map((environment) => environment.path);
    await createBaseBackup(task);

    setStage(task, "prepare", "正在清理旧的 Conda 升级临时文件", 55);
    const preflightCleanup = await cleanupStaleCondaUpdateArtifacts(task.installPath);
    if (preflightCleanup.removed.length) {
      appendLog(task, `已清理: ${preflightCleanup.removed.join(", ")}\n`);
    }
    const blockedTrashFiles = preflightCleanup.failed.filter((item) => item.name.includes(".conda_trash"));
    if (blockedTrashFiles.length) {
      throw new Error(`无法清理旧的 Conda 升级残留（${blockedTrashFiles.map((item) => item.name).join(", ")}）；请关闭占用该 Miniconda 的 Python/Conda 进程后重试`);
    }
    if (preflightCleanup.failed.length) {
      appendLog(task, `暂时无法删除（将由 Conda 接管）: ${preflightCleanup.failed.map((item) => `${item.name} [${item.code}]`).join(", ")}\n`);
    }

    setStage(task, "upgrade", `正在将 Conda ${task.currentCondaVersion} 升级到 ${task.latestCondaVersion}`, 65);
    const updateArgs = [
      "update",
      "-n",
      "base",
      "-c",
      "defaults",
      "conda",
      "-y"
    ];
    let updateResult = await runCondaCommand(updateArgs, task.installPath);
    appendLog(task, updateResult.stdout);
    appendLog(task, updateResult.stderr ? `[stderr] ${updateResult.stderr}` : "");

    if (!updateResult.ok && isRecoverableCondaCleanupFailure(updateResult.stderr, updateResult.stdout)) {
      appendLog(task, "\n检测到 Conda 在 Windows 上清理升级临时文件失败，正在安全恢复。\n");
      const recoveryCleanup = await cleanupStaleCondaUpdateArtifacts(task.installPath);
      if (recoveryCleanup.removed.length) {
        appendLog(task, `恢复清理: ${recoveryCleanup.removed.join(", ")}\n`);
      }

      clearCondaCache();
      const recoveredInfo = await getMinicondaInfo(task.installPath);
      if (comparePythonVersions(recoveredInfo.condaVersion, task.latestCondaVersion) >= 0) {
        appendLog(task, `Conda 核心已升级到 ${recoveredInfo.condaVersion}；原错误仅发生在事务收尾，继续完整性校验。\n`);
        updateResult = { ...updateResult, ok: true };
      } else if (!recoveryCleanup.failed.some((item) => item.name.includes(".conda_trash"))) {
        appendLog(task, "清理完成，正在重试一次 Conda 核心升级。\n");
        updateResult = await runCondaCommand(updateArgs, task.installPath);
        appendLog(task, updateResult.stdout);
        appendLog(task, updateResult.stderr ? `[stderr] ${updateResult.stderr}` : "");
      }
    }

    if (!updateResult.ok) throw new Error(updateResult.stderr || updateResult.stdout || "升级 Conda 核心失败");

    setStage(task, "verify", "正在校验 Conda 版本与原有环境", 90);
    clearCondaCache();
    const afterInfo = await getMinicondaInfo(task.installPath);
    const afterEnvironments = await listCondaEnvironments(task.installPath);
    const afterPathSet = new Set(afterEnvironments.environments.map((environment) =>
      process.platform === "win32" ? environment.path.toLowerCase() : environment.path
    ));
    const missingPaths = beforePaths.filter((environmentPath) =>
      !afterPathSet.has(process.platform === "win32" ? environmentPath.toLowerCase() : environmentPath)
    );
    if (missingPaths.length) {
      throw new Error(`升级后有 ${missingPaths.length} 个环境未被检测到，请根据备份检查配置`);
    }

    task.currentCondaVersion = afterInfo.condaVersion;
    setStage(task, "complete", `无损升级完成：Conda ${afterInfo.condaVersion}，${beforePaths.length} 个环境均正常`, 100);
    task.status = "completed";
    task.finishedAt = new Date().toISOString();
  } catch (error) {
    task.status = "failed";
    task.stage = "failed";
    task.message = error.message || "Miniconda 升级失败";
    task.finishedAt = new Date().toISOString();
    appendLog(task, `\n[失败] ${task.message}\n`);
  }
}

export async function getSetupStatus() {
  const recommendedInstallPath = getDefaultInstallPath();
  const miniconda = await getMinicondaInfo(recommendedInstallPath);
  const condaPath = miniconda.condaPath;
  const environmentResult = condaPath ? await listCondaEnvironments(recommendedInstallPath) : { environments: [] };
  return {
    platformSupported: process.platform === "win32" && process.arch === "x64",
    platform: process.platform,
    arch: process.arch,
    recommendedInstallPath,
    condaAvailable: Boolean(condaPath),
    condaPath,
    environments: environmentResult.environments,
    miniconda: {
      ...miniconda,
      environmentCount: environmentResult.environments.length
    },
    packageCatalog: getSetupPackageCatalog(),
    requiredCondaPackages: REQUIRED_CONDA_PACKAGES
  };
}

export async function startSetupTask(payload = {}) {
  cleanupTasks();
  const runningTask = [...setupTasks.values()].find((task) => task.status === "running");
  if (runningTask) {
    if (runningTask.taskType === "initialize") return snapshot(runningTask);
    throw new Error("Miniconda 维护任务正在运行，请等待完成");
  }

  const installPath = path.resolve(String(payload.installPath || getDefaultInstallPath()).trim());
  const condaPackages = normalizeSelectedPackages(payload.condaPackageIds, "conda");
  const pipPackages = normalizeSelectedPackages(payload.pipPackageIds, "pip");
  const task = {
    taskId: crypto.randomUUID(),
    taskType: "initialize",
    status: "running",
    stage: "detect",
    message: "正在检测 Conda",
    progress: 5,
    output: [
      "WeiPython 新电脑初始化",
      "渠道: conda-forge",
      `基础组件: Python + ${REQUIRED_CONDA_PACKAGES.join(", ")}`,
      `Conda 可选库: ${condaPackages.join(", ") || "无"}`,
      `pip 可选库: ${pipPackages.join(", ") || "无"}`,
      ""
    ].join("\n"),
    installPath,
    condaPath: null,
    pythonVersion: null,
    environmentName: null,
    condaPackages,
    pipPackages,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  setupTasks.set(task.taskId, task);
  void runSetup(task);
  return snapshot(task);
}

export async function startMinicondaUpgradeTask(payload = {}) {
  cleanupTasks();
  const runningTask = [...setupTasks.values()].find((task) => task.status === "running");
  if (runningTask) {
    if (runningTask.taskType === "miniconda-upgrade") return snapshot(runningTask);
    throw new Error("初始化任务正在运行，请等待完成");
  }

  const task = {
    taskId: crypto.randomUUID(),
    taskType: "miniconda-upgrade",
    status: "running",
    stage: "check",
    message: "正在检查 Miniconda 状态",
    progress: 5,
    output: "WeiPython Miniconda 无损升级\n范围: 仅更新 base 环境中的 Conda 核心包\n业务环境: 不修改\n\n",
    installPath: path.resolve(String(payload.installPath || getDefaultInstallPath()).trim()),
    condaPath: null,
    currentCondaVersion: null,
    latestCondaVersion: null,
    backupPath: null,
    condaPackages: [],
    pipPackages: [],
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  setupTasks.set(task.taskId, task);
  void runMinicondaUpgrade(task);
  return snapshot(task);
}

export function getSetupTask(taskId) {
  cleanupTasks();
  const task = setupTasks.get(taskId);
  if (!task) throw new Error("初始化任务不存在或已过期");
  return snapshot(task);
}
