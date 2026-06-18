import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  listCondaEnvironments,
  parseJsonCommandOutput,
  runCondaCommand
} from "./environment-service.js";

const tasks = new Map();
const TASK_TTL_MS = 60 * 60 * 1000;
const MAX_LOG_LENGTH = 160000;

function compareVersions(left, right) {
  const a = String(left || "").split(".").map(Number);
  const b = String(right || "").split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] || 0) - (b[index] || 0);
    if (delta) return delta;
  }
  return 0;
}

function getCurrentCondaSubdir() {
  if (process.platform === "win32") return process.arch === "arm64" ? "win-arm64" : "win-64";
  if (process.platform === "darwin") return process.arch === "arm64" ? "osx-arm64" : "osx-64";
  return process.arch === "aarch64" || process.arch === "arm64" ? "linux-aarch64" : "linux-64";
}

export function extractPlatformPythonVersions(records, subdir = getCurrentCondaSubdir()) {
  return (records || [])
    .filter((record) => String(record?.subdir || record?.platform || "") === subdir)
    .map((record) => record?.version)
    .filter(Boolean);
}

export function buildPythonInstallArgs(environmentPath, targetVersion, dryRun = false) {
  const args = [
    "install", "-p", environmentPath, "--override-channels", "-c", "defaults", `python=${targetVersion}`, "-y"
  ];
  if (dryRun) args.push("--dry-run", "--json");
  return args;
}

export function selectPythonUpgradeCandidates(currentVersion, versions) {
  const latestByMinor = new Map();
  for (const value of versions || []) {
    const version = String(value || "").trim();
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match || compareVersions(version, currentVersion) <= 0) continue;
    const minor = `${match[1]}.${match[2]}`;
    const existing = latestByMinor.get(minor);
    if (!existing || compareVersions(version, existing) > 0) latestByMinor.set(minor, version);
  }
  return [...latestByMinor.values()].sort((a, b) => compareVersions(b, a));
}

function normalizePath(value) {
  const resolved = path.resolve(String(value || ""));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
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
    status: task.status,
    stage: task.stage,
    message: task.message,
    progress: task.progress,
    target: task.target,
    currentVersion: task.currentVersion,
    targetVersion: task.targetVersion,
    backupPath: task.backupPath,
    output: task.output,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt
  };
}

function cleanupTasks() {
  const now = Date.now();
  for (const [taskId, task] of tasks.entries()) {
    if (task.finishedAt && now - Date.parse(task.finishedAt) > TASK_TTL_MS) tasks.delete(taskId);
  }
}

async function resolveCondaTarget(target, preferredRoot) {
  if (target?.type !== "conda") throw new Error("Python 无损升级仅支持 Conda 环境");
  const result = await listCondaEnvironments(preferredRoot);
  const requestedPath = target.path ? normalizePath(target.path) : null;
  const environment = result.environments.find((item) =>
    requestedPath ? normalizePath(item.path) === requestedPath : item.name === target.name
  );
  if (!environment) throw new Error("未找到目标 Conda 环境");
  if (!/^\d+\.\d+\.\d+$/.test(String(environment.pythonVersion || ""))) {
    throw new Error(`无法识别环境“${environment.name}”的 Python 版本`);
  }
  return { environment, allEnvironments: result.environments };
}

export async function checkCondaPythonUpgrade(target, preferredRoot = "") {
  const { environment } = await resolveCondaTarget(target, preferredRoot);
  const search = await runCondaCommand([
    "search", "--override-channels", "-c", "defaults", "python", "--json"
  ], preferredRoot);
  if (!search.ok) throw new Error(search.stderr || search.stdout || "查询 Python 可升级版本失败");
  const parsed = parseJsonCommandOutput(search.stdout, {});
  const platformVersions = extractPlatformPythonVersions(Array.isArray(parsed.python) ? parsed.python : []);
  const discoveredCandidates = selectPythonUpgradeCandidates(environment.pythonVersion, platformVersions);
  const candidates = [];
  for (const version of discoveredCandidates.slice(0, 6)) {
    const solved = await runCondaCommand(buildPythonInstallArgs(environment.path, version, true), preferredRoot);
    if (solved.ok) candidates.push(version);
  }
  return {
    target: { type: "conda", name: environment.name, path: environment.path },
    currentVersion: environment.pythonVersion,
    candidates,
    unavailableCandidates: discoveredCandidates.filter((version) => !candidates.includes(version)),
    recommendedVersion: candidates[0] || null
  };
}

async function runUpgrade(task, preferredRoot) {
  try {
    const before = await resolveCondaTarget(task.target, preferredRoot);
    task.currentVersion = before.environment.pythonVersion;
    if (compareVersions(task.targetVersion, task.currentVersion) <= 0) {
      throw new Error(`目标版本 ${task.targetVersion} 必须高于当前版本 ${task.currentVersion}`);
    }
    const beforePaths = before.allEnvironments.map((item) => item.path);

    setStage(task, "backup", `正在备份环境“${before.environment.name}”的显式配置`, 25);
    let exported = await runCondaCommand([
      "env", "export", "-p", before.environment.path, "--from-history"
    ], preferredRoot);
    let backupMode = "显式配置";
    if (!exported.ok) {
      appendLog(task, `显式配置备份不可用，改用完整无构建号备份。\n${exported.stderr || exported.stdout}\n`);
      exported = await runCondaCommand([
        "env", "export", "-p", before.environment.path, "--no-builds"
      ], preferredRoot);
      backupMode = "完整配置（无构建号）";
    }
    if (!exported.ok) throw new Error(exported.stderr || exported.stdout || "备份环境失败");
    const backupDirectory = path.join(os.homedir(), "WeiPythonBackups", "python-upgrades");
    await fs.mkdir(backupDirectory, { recursive: true });
    const safeName = String(before.environment.name || "conda-env").replace(/[^A-Za-z0-9_.-]+/g, "-");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    task.backupPath = path.join(backupDirectory, `${safeName}-python-${task.currentVersion}-before-${task.targetVersion}-${timestamp}.yml`);
    await fs.writeFile(task.backupPath, exported.stdout, "utf8");
    appendLog(task, `备份模式: ${backupMode}\n备份文件: ${task.backupPath}\n`);

    setStage(task, "upgrade", `正在升级 Python ${task.currentVersion} → ${task.targetVersion}`, 55);
    const installed = await runCondaCommand(
      buildPythonInstallArgs(before.environment.path, task.targetVersion),
      preferredRoot
    );
    appendLog(task, installed.stdout);
    if (installed.stderr) appendLog(task, `[stderr] ${installed.stderr}`);
    if (!installed.ok) throw new Error(installed.stderr || installed.stdout || "升级 Python 失败");

    setStage(task, "verify", "正在校验 Python 版本与全部 Conda 环境路径", 90);
    const after = await listCondaEnvironments(preferredRoot);
    const afterPathSet = new Set(after.environments.map((item) => normalizePath(item.path)));
    const missingPaths = beforePaths.filter((item) => !afterPathSet.has(normalizePath(item)));
    if (missingPaths.length) throw new Error(`升级后有 ${missingPaths.length} 个 Conda 环境未被检测到`);
    const upgraded = after.environments.find((item) => normalizePath(item.path) === normalizePath(before.environment.path));
    if (!upgraded || compareVersions(upgraded.pythonVersion, task.targetVersion) !== 0) {
      throw new Error(`升级命令已结束，但实际 Python 版本为 ${upgraded?.pythonVersion || "未知"}，目标为 ${task.targetVersion}`);
    }

    task.status = "completed";
    task.finishedAt = new Date().toISOString();
    setStage(task, "complete", `无损升级完成：${before.environment.name} 已使用 Python ${upgraded.pythonVersion}`, 100);
  } catch (error) {
    task.status = "failed";
    task.stage = "failed";
    task.message = error.message || "Python 无损升级失败";
    task.finishedAt = new Date().toISOString();
    appendLog(task, `\n[失败] ${task.message}\n`);
  }
}

export async function startCondaPythonUpgradeTask(payload = {}, preferredRoot = "") {
  cleanupTasks();
  const running = [...tasks.values()].find((task) => task.status === "running");
  if (running) return snapshot(running);
  const targetVersion = String(payload.targetVersion || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) throw new Error("请选择有效的 Python 目标版本");
  const resolved = await resolveCondaTarget(payload.target, preferredRoot);
  const task = {
    taskId: crypto.randomUUID(),
    status: "running",
    stage: "prepare",
    message: "正在准备 Python 无损升级",
    progress: 5,
    target: { type: "conda", name: resolved.environment.name, path: resolved.environment.path },
    currentVersion: resolved.environment.pythonVersion,
    targetVersion,
    backupPath: null,
    output: `WeiPython Conda Python 无损升级\n环境: ${resolved.environment.name}\n路径: ${resolved.environment.path}\n目标: Python ${targetVersion}\n`,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  tasks.set(task.taskId, task);
  void runUpgrade(task, preferredRoot);
  return snapshot(task);
}

export function getCondaPythonUpgradeTask(taskId) {
  cleanupTasks();
  const task = tasks.get(taskId);
  if (!task) throw new Error("Python 升级任务不存在或已过期");
  return snapshot(task);
}
