import os from "node:os";
import process from "node:process";
import { detectCondaExecutable, discoverPythonVersions, listCondaEnvironments } from "./environment-service.js";
import { runCommand } from "../utils/process.js";

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise.catch(() => fallbackValue),
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs))
  ]);
}

async function detectPipVersion() {
  try {
    const result = await runCommand(
      process.platform === "win32" ? "python" : "python3",
      ["-m", "pip", "--version"],
      { timeoutMs: 3000 }
    );
    return result.ok ? result.stdout.trim() : "未找到";
  } catch {
    return "未找到";
  }
}

async function detectNodeVersion() {
  try {
    const result = await runCommand("node", ["--version"], { timeoutMs: 5000 });
    return result.ok ? result.stdout.trim() : "未找到";
  } catch {
    return "未找到";
  }
}

async function detectNpmVersion() {
  try {
    const result = await runCommand("npm", ["--version"], { timeoutMs: 5000 });
    return result.ok ? result.stdout.trim() : "未找到";
  } catch {
    return "未找到";
  }
}

export async function getSystemOverview(preferredRoot = "") {
  const [pythonVersions, condaInfo, pipVersion, systemNodeVersion, npmVersion] = await Promise.all([
    withTimeout(discoverPythonVersions(), 1500, []),
    withTimeout(listCondaEnvironments(preferredRoot), 2000, {
      condaAvailable: false,
      condaPath: null,
      environments: []
    }),
    withTimeout(detectPipVersion(), 3000, "未找到"),
    withTimeout(detectNodeVersion(), 5000, "未找到"),
    withTimeout(detectNpmVersion(), 5000, "未找到")
  ]);

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    systemNodeVersion,
    npmVersion,
    hostname: os.hostname(),
    homeDirectory: os.homedir(),
    currentDirectory: process.cwd(),
    pipVersion,
    condaPath: condaInfo.condaPath || (await detectCondaExecutable(preferredRoot)),
    condaAvailable: condaInfo.condaAvailable,
    condaEnvironments: condaInfo.environments,
    pythonVersions
  };
}

export async function upgradeNodeVersion() {
  if (process.platform !== "win32") {
    throw new Error("当前仅支持在 Windows 上通过 nvm-windows 或 winget 升级系统 Node.js");
  }

  const beforeResult = await runCommand("node", ["--version"], { timeoutMs: 5000 });
  const beforeVersion = beforeResult.ok ? beforeResult.stdout.trim() : "未找到";
  const nodePathResult = await runCommand("where.exe", ["node"], { timeoutMs: 5000 });
  const nodePath = nodePathResult.ok ? nodePathResult.stdout.split(/\r?\n/u).find(Boolean) || "" : "";
  const nvmVersion = await runCommand("nvm", ["version"], { timeoutMs: 5000 });

  if (nvmVersion.ok && /nvm/i.test(nodePath)) {
    const installResult = await runCommand("nvm", ["install", "latest"], { timeoutMs: 600000 });
    const installedVersion =
      [installResult.stdout, installResult.stderr]
        .filter(Boolean)
        .join("\n")
        .match(/\b(\d+\.\d+\.\d+)\b/u)?.[1] || "latest";
    const useResult = installResult.ok ? await runCommand("nvm", ["use", installedVersion], { timeoutMs: 120000 }) : installResult;
    const output = [installResult.stdout, installResult.stderr, useResult.stdout, useResult.stderr].filter(Boolean).join("\n").trim();
    if (!installResult.ok || !useResult.ok) {
      throw new Error(output || "通过 nvm 升级 Node.js 失败");
    }

    const afterResult = await runCommand("node", ["--version"], { timeoutMs: 5000 });
    const afterVersion = afterResult.ok ? afterResult.stdout.trim() : beforeVersion;

    return {
      message: beforeVersion === afterVersion ? "Node.js 已检查完成，当前可能已经是最新版本。" : "Node.js 升级完成。",
      beforeVersion,
      afterVersion,
      manager: "nvm-windows",
      output,
      runtimeNote: "如果当前是 Electron 桌面版，内置运行时 Node 版本会随应用安装包更新；系统 Node.js 升级不会改变已运行进程的 Node 版本。"
    };
  }

  const wingetVersion = await runCommand("winget", ["--version"], { timeoutMs: 5000 });
  if (!wingetVersion.ok) {
    throw new Error("未检测到 nvm 或 winget。请先安装 nvm-windows，或启用 Windows App Installer 后重试。");
  }

  let result = await runCommand(
    "winget",
    [
      "upgrade",
      "--id",
      "OpenJS.NodeJS.LTS",
      "-e",
      "--accept-package-agreements",
      "--accept-source-agreements",
      "--disable-interactivity"
    ],
    { timeoutMs: 600000 }
  );
  let output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  let manager = "winget upgrade";

  if (/No installed package found|找不到已安装的程序包/iu.test(output)) {
    result = await runCommand(
      "winget",
      [
        "install",
        "--id",
        "OpenJS.NodeJS.LTS",
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity"
      ],
      { timeoutMs: 600000 }
    );
    output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    manager = "winget install";
  }

  if (!result.ok && !/No applicable upgrade|没有可用升级/iu.test(output)) {
    throw new Error(output || "Node.js 升级失败");
  }

  const afterResult = await runCommand("node", ["--version"], { timeoutMs: 5000 });
  const afterVersion = afterResult.ok ? afterResult.stdout.trim() : beforeVersion;

  return {
    message: beforeVersion === afterVersion ? "Node.js 已检查完成，当前可能已经是最新版本。" : "Node.js 升级完成。",
    beforeVersion,
    afterVersion,
    manager,
    output,
    runtimeNote: "如果当前是 Electron 桌面版，内置运行时 Node 版本会随应用安装包更新；系统 Node.js 升级不会改变已运行进程的 Node 版本。"
  };
}
