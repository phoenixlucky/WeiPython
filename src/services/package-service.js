import crypto from "node:crypto";
import { runCommand, runStreamingCommand } from "../utils/process.js";
import { resolvePythonExecutable, runCondaCommand } from "./environment-service.js";

const latestVersionCache = new Map();
const LATEST_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;
const packageTasks = new Map();
const PACKAGE_TASK_TTL_MS = 30 * 60 * 1000;
const MAX_TASK_LOG_LENGTH = 120000;
const DEFAULT_PIP_INDEX_URL = "https://pypi.org/simple";

function normalizePipIndexUrl(value = "") {
  const raw = String(value || DEFAULT_PIP_INDEX_URL).trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("pip 源地址无效，请填写完整的 http/https 地址。");
  }
  if (!/^https?:$/u.test(url.protocol)) {
    throw new Error("pip 源必须使用 http 或 https 地址。");
  }
  return url.toString();
}

function buildPipIndexArgs(pipIndexUrl) {
  return ["--index-url", normalizePipIndexUrl(pipIndexUrl)];
}

function cleanupPackageTasks() {
  const now = Date.now();
  for (const [taskId, task] of packageTasks.entries()) {
    const finishedAtMs = task.finishedAt ? Date.parse(task.finishedAt) : NaN;
    if (Number.isFinite(finishedAtMs) && now - finishedAtMs > PACKAGE_TASK_TTL_MS) {
      packageTasks.delete(taskId);
    }
  }
}

function createPackageTaskSnapshot(task) {
  return {
    taskId: task.taskId,
    status: task.status,
    packageName: task.packageName,
    upgrade: task.upgrade,
    target: task.target,
    message: task.message,
    pid: task.pid,
    output: task.output,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt
  };
}

function appendTaskOutput(task, chunk, source = "stdout") {
  const normalized = String(chunk || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) {
    return;
  }

  const prefix = source === "stderr" ? "[stderr] " : "";
  task.output += normalized
    .split("\n")
    .map((line, index, lines) => {
      if (!line && index === lines.length - 1) {
        return "";
      }
      return `${prefix}${line}`;
    })
    .join("\n");

  if (task.output.length > MAX_TASK_LOG_LENGTH) {
    task.output = `[日志过长，已截断早期输出]\n${task.output.slice(-MAX_TASK_LOG_LENGTH)}`;
  }
}

export async function listPackages(target, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);

  // 第 1 级：pip list --format=json（最快路径，遇损坏元数据会崩溃）
  let result = await runCommand(pythonExecutable, ["-m", "pip", "list", "--format=json"], { timeoutMs: 15000 });
  if (result.ok) {
    try { return JSON.parse(result.stdout || "[]").sort((a, b) => a.name.localeCompare(b.name)); } catch {}
  }

  // 第 2 级：importlib.metadata 直接枚举（跳过 BadMetadata）
  result = await runInlinePython(pythonExecutable, [
    'import json, sys, importlib.metadata',
    'out = []',
    'for d in importlib.metadata.distributions():',
    '    try:',
    '        n = d.metadata["Name"]',
    '        v = str(d.version) if d.version else ""',
    '        if n: out.append({"name": n, "version": v})',
    '    except Exception:',
    '        pass',
    'json.dump(out, sys.stdout)'
  ]);
  if (result.ok) {
    try { return JSON.parse(result.stdout || "[]").sort((a, b) => a.name.localeCompare(b.name)); } catch {}
  }

  // 第 3 级：手动扫描 site-packages/*.dist-info/METADATA（最底层，几乎不会被破坏）
  result = await runInlinePython(pythonExecutable, [
    'import json, sys, os',
    'sp = next((p for p in sys.path if p.endswith("site-packages") and os.path.isdir(p)), None)',
    'out = []',
    'if sp:',
    '    for e in os.listdir(sp):',
    '        if not e.endswith(".dist-info"): continue',
    '        mf = os.path.join(sp, e, "METADATA")',
    '        if not os.path.isfile(mf): continue',
    '        try:',
    '            with open(mf, "r", encoding="utf-8", errors="replace") as f:',
    '                t = f.read()',
    '            name = v = None',
    '            for line in t.splitlines():',
    '                if line.startswith("Name:") and name is None: name = line[5:].strip()',
    '                elif line.startswith("Version:") and v is None: v = line[8:].strip()',
    '                if name and v: break',
    '            if name and v: out.append({"name": name, "version": v})',
    '        except Exception:',
    '            pass',
    'json.dump(out, sys.stdout)'
  ]);
  if (result.ok) {
    try { return JSON.parse(result.stdout || "[]").sort((a, b) => a.name.localeCompare(b.name)); } catch {}
  }

  // 全部回退失败 → 返回空列表而不是报错（服务端路由也兜底了，这里双重保障）
  return [];
}

/**
 * 用 python -c 执行一段 Python 代码并返回命令结果。
 * 代码以多行字符串数组传入，用换行符拼接。
 */
async function runInlinePython(pythonExecutable, lines) {
  try {
    return await runCommand(pythonExecutable, ["-c", lines.join("\n")], { timeoutMs: 15000 });
  } catch {
    return { ok: false, stdout: "", stderr: "" };
  }
}

export async function installPackage(target, packageName, upgrade = false, preferredRoot = "", pipIndexUrl = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const args = ["-m", "pip", "install", ...buildPipIndexArgs(pipIndexUrl)];
  if (upgrade) {
    args.push("--upgrade");
  }
  args.push(packageName);
  const result = await runCommand(pythonExecutable, args, { timeoutMs: 60000 });
  if (!result.ok) {
    throw new Error([result.command, result.stderr || "安装包失败"].filter(Boolean).join("\n"));
  }
  return {
    message: `包 '${packageName}' 安装成功`,
    command: result.command,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
  };
}

export async function startInstallPackageTask(target, packageName, upgrade = false, preferredRoot = "", pipIndexUrl = "") {
  cleanupPackageTasks();

  const normalizedName = String(packageName || "").trim();
  if (!normalizedName) {
    throw new Error("缺少包名");
  }

  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const args = ["-m", "pip", "install", ...buildPipIndexArgs(pipIndexUrl)];
  if (upgrade) {
    args.push("--upgrade");
  }
  args.push(normalizedName);

  const task = {
    taskId: crypto.randomUUID(),
    status: "running",
    packageName: normalizedName,
    upgrade: Boolean(upgrade),
    target,
    message: upgrade ? `正在升级包 '${normalizedName}'` : `正在安装包 '${normalizedName}'`,
    pid: null,
    output: [
      `命令: ${pythonExecutable} ${args.join(" ")}`,
      `目标环境: ${target.type}${target.name ? ` / ${target.name}` : ""}`,
      ""
    ].join("\n"),
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  packageTasks.set(task.taskId, task);

  void (async () => {
    try {
      const result = await runStreamingCommand(pythonExecutable, args, {
        timeoutMs: 300000,
        onStart: (child) => {
          task.pid = child.pid;
          appendTaskOutput(task, `进程 PID: ${child.pid}\n`);
        },
        onStdout: (text) => appendTaskOutput(task, text, "stdout"),
        onStderr: (text) => appendTaskOutput(task, text, "stderr")
      });

      task.finishedAt = new Date().toISOString();
      if (!result.ok) {
        task.status = "failed";
        task.message = result.stderr || result.stdout || "安装包失败";
        if (!task.output.includes(task.message)) {
          appendTaskOutput(task, `\n${task.message}\n`, "stderr");
        }
        return;
      }

      task.status = "completed";
      task.message = upgrade ? `包 '${normalizedName}' 升级成功` : `包 '${normalizedName}' 安装成功`;
      if (!task.output.endsWith("\n")) {
        task.output += "\n";
      }
      task.output += `${task.message}\n`;
    } catch (error) {
      task.status = "failed";
      task.message = error.message || "安装包失败";
      task.finishedAt = new Date().toISOString();
      appendTaskOutput(task, `\n${task.message}\n`, "stderr");
    }
  })();

  return createPackageTaskSnapshot(task);
}

export function getPackageTask(taskId) {
  cleanupPackageTasks();

  const task = packageTasks.get(taskId);
  if (!task) {
    throw new Error("安装任务不存在或已过期");
  }

  return createPackageTaskSnapshot(task);
}

async function listOutdatedPackages(pythonExecutable, pipIndexUrl = "") {
  const result = await runCommand(
    pythonExecutable,
    ["-m", "pip", "list", ...buildPipIndexArgs(pipIndexUrl), "--outdated", "--format=json"],
    { timeoutMs: 30000 }
  );
  if (!result.ok) {
    throw new Error([result.command, result.stderr || "获取可升级包列表失败"].filter(Boolean).join("\n"));
  }

  return {
    packages: JSON.parse(result.stdout || "[]"),
    command: result.command,
    output: result.stdout
  };
}

export async function uninstallPackage(target, packageName, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const args = ["-m", "pip", "uninstall", packageName, "-y"];
  const result = await runCommand(pythonExecutable, args, { timeoutMs: 30000 });
  if (!result.ok) {
    throw new Error([result.command, result.stderr || "卸载包失败"].filter(Boolean).join("\n"));
  }
  return {
    message: `包 '${packageName}' 卸载成功`,
    command: result.command,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
  };
}

export async function showPackageInfo(target, packageName, preferredRoot = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const args = ["-m", "pip", "show", packageName];
  const result = await runCommand(pythonExecutable, args, { timeoutMs: 10000 });
  if (!result.ok) {
    throw new Error([result.command, result.stderr || "无法获取包信息"].filter(Boolean).join("\n"));
  }
  return { content: result.stdout, command: result.command };
}

export async function getLatestPackageVersion(packageName) {
  const normalizedName = String(packageName || "").trim();
  if (!normalizedName) {
    throw new Error("缺少包名");
  }

  const cacheKey = normalizedName.toLowerCase();
  const cachedEntry = latestVersionCache.get(cacheKey);
  if (cachedEntry && Date.now() - cachedEntry.timestamp < LATEST_VERSION_CACHE_TTL_MS) {
    return cachedEntry.value;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`https://pypi.org/pypi/${encodeURIComponent(normalizedName)}/json`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });

    if (response.status === 404) {
      throw new Error(`PyPI 上未找到包 '${normalizedName}'`);
    }

    if (!response.ok) {
      throw new Error(`PyPI 查询失败: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const result = {
      packageName: payload.info?.name || normalizedName,
      latestVersion: payload.info?.version || "unknown",
      summary: payload.info?.summary || "",
      homePage: payload.info?.home_page || payload.info?.project_url || "",
      packageUrl: payload.info?.package_url || `https://pypi.org/project/${encodeURIComponent(normalizedName)}/`,
      requestUrl: `https://pypi.org/pypi/${encodeURIComponent(normalizedName)}/json`
    };
    latestVersionCache.set(cacheKey, {
      timestamp: Date.now(),
      value: result
    });
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("查询 PyPI 超时，请稍后重试");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function upgradePip(target, preferredRoot = "", pipIndexUrl = "") {
  return installPackage(target, "pip", true, preferredRoot, pipIndexUrl);
}

export async function upgradeAllPackages(target, preferredRoot = "", pipIndexUrl = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const initialOutdated = await listOutdatedPackages(pythonExecutable, pipIndexUrl);
  const pipOutdated = initialOutdated.packages;
  const commands = [initialOutdated.command].filter(Boolean);
  const outputs = [initialOutdated.output].filter(Boolean);
  let condaUpdated = false;

  if (target.type === "conda") {
    const condaResult = await runCondaCommand(["update", "-n", target.name, "--all", "-y"], preferredRoot);
    if (!condaResult.ok) {
      throw new Error([condaResult.command, condaResult.stderr || condaResult.stdout || "Conda 批量升级失败"].filter(Boolean).join("\n"));
    }
    if (condaResult.command) commands.push(condaResult.command);
    if (condaResult.stdout || condaResult.stderr) outputs.push([condaResult.stdout, condaResult.stderr].filter(Boolean).join("\n"));
    condaUpdated = true;
  }

  const afterCondaResult = target.type === "conda" ? await listOutdatedPackages(pythonExecutable, pipIndexUrl) : null;
  if (afterCondaResult) {
    if (afterCondaResult.command) commands.push(afterCondaResult.command);
    if (afterCondaResult.output) outputs.push(afterCondaResult.output);
  }
  const outdatedAfterConda = afterCondaResult?.packages || pipOutdated;
  const packageNames = outdatedAfterConda.map((pkg) => pkg.name).filter(Boolean);

  if (packageNames.length) {
    const upgradeResult = await runCommand(
      pythonExecutable,
      ["-m", "pip", "install", ...buildPipIndexArgs(pipIndexUrl), "--upgrade", ...packageNames],
      { timeoutMs: 300000 }
    );
    if (!upgradeResult.ok) {
      throw new Error([upgradeResult.command, upgradeResult.stderr || "pip 批量升级失败"].filter(Boolean).join("\n"));
    }
    if (upgradeResult.command) commands.push(upgradeResult.command);
    if (upgradeResult.stdout || upgradeResult.stderr) outputs.push([upgradeResult.stdout, upgradeResult.stderr].filter(Boolean).join("\n"));
  }

  const upgradedNames = packageNames.join(", ");
  const summary = [
    `目标环境: ${target.type}${target.name ? ` / ${target.name}` : ""}`,
    `Conda 全量升级: ${condaUpdated ? "已执行" : "未执行"}`,
    `pip 可升级包数量: ${packageNames.length}`
  ];

  if (packageNames.length) {
    summary.push(`pip 已升级包: ${upgradedNames}`);
  } else {
    summary.push("pip 已升级包: 无，当前已是最新");
  }

  return {
    message: packageNames.length || condaUpdated ? "批量升级完成" : "当前环境中的包已是最新",
    summary: summary.join("\n"),
    upgradedPackages: packageNames,
    upgradedCount: packageNames.length,
    condaUpdated,
    commands,
    output: outputs.join("\n").trim()
  };
}

export async function installFromRequirements(target, requirementsPath, preferredRoot = "", pipIndexUrl = "") {
  const pythonExecutable = await resolvePythonExecutable(target, preferredRoot);
  const result = await runCommand(
    pythonExecutable,
    ["-m", "pip", "install", ...buildPipIndexArgs(pipIndexUrl), "-r", requirementsPath],
    { timeoutMs: 120000 }
  );
  if (!result.ok) {
    throw new Error([result.command, result.stderr || "从 requirements 安装失败"].filter(Boolean).join("\n"));
  }
  return {
    message: "从 requirements 安装成功",
    command: result.command,
    output: [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
  };
}
