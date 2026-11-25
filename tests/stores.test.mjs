import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { createServer } from "vite";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

let invoke;
globalThis.window = {
  __TAURI_INTERNALS__: { invoke: (...args) => invoke(...args) },
  setTimeout,
};
const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom" });
const { useAppStore } = await server.ssrLoadModule("/src/stores/app.ts");
const { useWorkspaceStore } = await server.ssrLoadModule("/src/stores/workspace.ts");
after(() => server.close());
beforeEach(() => { setActivePinia(createPinia()); invoke = async () => []; });

const target = (path) => ({ targetType: "venv", path, name: path });
const task = (status, output = "") => ({ taskId: "test-task", taskType: "package", status, message: status, progress: 100, output, command: "", startedAt: 0 });
const environment = (name) => ({ name, prefix: name, python: "3.14", packageCount: 0, active: false });

test("appearance saves only its patch and preserves paths saved by an installer", async () => {
  let disk = { tagline: "before", compactMode: false };
  invoke = async (command, args) => {
    if (command === "get_settings") return { ...disk };
    if (command === "save_settings") {
      assert.deepEqual(args, { settings: { primary: "#123456" } });
      disk = { ...disk, ...args.settings };
      return { ...disk };
    }
  };
  const app = useAppStore();
  await app.loadSettings();
  disk.uvPath = "Z:/custom/uv.exe";
  disk.condaPath = "Z:/custom/conda.exe";
  await app.saveSettings({ primary: "#123456" });
  assert.equal(app.error, "");
  assert.equal(disk.uvPath, "Z:/custom/uv.exe");
  assert.equal(app.settings.condaPath, "Z:/custom/conda.exe");
});

test("consecutive failed setting saves roll back to the last persisted values", async () => {
  invoke = async (command) => {
    if (command === "get_settings") return { primary: "#111111", ink: "#222222", tagline: "saved" };
    throw new Error("read-only settings");
  };
  const app = useAppStore();
  await app.loadSettings();
  await Promise.all([app.saveSettings({ primary: "#333333" }), app.saveSettings({ ink: "#444444" })]);
  assert.equal(app.settings.primary, "#111111");
  assert.equal(app.settings.ink, "#222222");
});

test("a late response from environment A cannot replace B's package list", async () => {
  const requests = [];
  invoke = (command, args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject }));
  const workspace = useWorkspaceStore();
  const first = workspace.loadPackages(target("A"));
  const second = workspace.loadPackages(target("B"));
  requests[1].resolve([{ name: "from-B", version: "2" }]);
  await second;
  requests[0].resolve([{ name: "from-A", version: "1" }]);
  await first;
  assert.equal(workspace.selectedTarget.path, "B");
  assert.deepEqual(workspace.packages, [{ name: "from-B", version: "2" }]);
});

test("switching targets clears old packages, and an obsolete failure is ignored", async () => {
  const requests = [];
  invoke = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const workspace = useWorkspaceStore();
  workspace.packages = [{ name: "old", version: "1" }];
  const first = workspace.loadPackages(target("A"));
  const second = workspace.loadPackages(target("B"));
  const packagesWhileLoading = [...workspace.packages];
  requests[1].resolve([{ name: "from-B", version: "2" }]);
  await second;
  requests[0].reject(new Error("obsolete A error"));
  await first;
  assert.deepEqual(packagesWhileLoading, []);
  assert.equal(workspace.error, "");
});

for (const status of ["cancelled", "failed"]) {
  test(`a ${status} package stops the whole recommended-install batch`, async () => {
    const started = [];
    invoke = async (command, args) => {
      if (command === "start_package_action") { started.push(args.request.packageName); return task(status); }
      return [];
    };
    const workspace = useWorkspaceStore();
    await workspace.installPackages(target("A"), ["first", "second"], "https://pypi.org/simple");
    assert.deepEqual(started, ["first"]);
    assert.equal(workspace.busy, false);
  });
}

test("cancelling a batch still stops it when the child finished before the cancel arrived", async () => {
  const started = [];
  invoke = async (command, args) => {
    if (command === "start_package_action") { started.push(args.request.packageName); return task("running"); }
    if (command === "get_operation_task") return task("completed");
    return [];
  };
  const workspace = useWorkspaceStore();
  const batch = workspace.installPackages(target("A"), ["first", "second"], "https://pypi.org/simple");
  await new Promise(setImmediate);
  await workspace.cancelCurrentTask();
  await batch;
  assert.deepEqual(started, ["first"]);
});

test("removing the selected target clears packages and supersedes outstanding queries", async () => {
  let complete;
  invoke = () => new Promise((resolve) => { complete = resolve; });
  const workspace = useWorkspaceStore();
  const request = workspace.loadPackages(target("A"));
  await workspace.loadPackages(null);
  complete([{ name: "from-A", version: "1" }]);
  await request;
  assert.equal(workspace.selectedTarget, null);
  assert.deepEqual(workspace.packages, []);
});

test("stored wallpapers are read once and color changes send no image data", async () => {
  const calls = [];
  let disk = { wallpaper: "Z:/app/wallpapers/test.webp", tagline: "hello", compactMode: false };
  invoke = async (command, args) => {
    calls.push({ command, args });
    if (command === "get_settings") return { ...disk };
    if (command === "read_wallpaper") return new Uint8Array([1, 2, 3]).buffer;
    if (command === "save_settings") { disk = { ...disk, ...args.settings }; return { ...disk }; }
  };
  const app = useAppStore();
  await app.loadSettings();
  assert.match(app.wallpaperUrl, /^blob:/);
  await app.saveSettings({ primary: "#123456" });
  assert.equal(calls.filter((call) => call.command === "read_wallpaper").length, 1);
  assert.deepEqual(calls.find((call) => call.command === "save_settings").args.settings, { primary: "#123456" });
  app.$dispose();
});

test("wallpaper import shrinks a large image and compresses it as WebP", async () => {
  const { prepareWallpaper } = await server.ssrLoadModule("/src/lib/wallpaper.ts");
  const drawing = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => drawing.push(args) }), toBlob: (callback, type) => callback(new Blob(["compressed"], { type })) };
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  globalThis.Image = class {
    naturalWidth = 6000; naturalHeight = 3000;
    set src(value) { queueMicrotask(() => this.onload()); }
  };
  globalThis.document = { createElement: () => canvas };
  try {
    const bytes = await prepareWallpaper(new Blob(["original"], { type: "image/png" }));
    assert.equal(canvas.width, 2560);
    assert.equal(canvas.height, 1280);
    assert.deepEqual(drawing[0].slice(1), [0, 0, 2560, 1280]);
    assert.equal(new TextDecoder().decode(bytes), "compressed");
  } finally { globalThis.Image = previousImage; globalThis.document = previousDocument; }
});

test("a failed legacy wallpaper migration preserves the user's loaded settings", async () => {
  const legacy = "data:image/png;base64,broken";
  invoke = async () => ({ wallpaper: legacy, tagline: "keep my tagline", condaPath: "Z:/conda.exe" });
  const previousImage = globalThis.Image;
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror()); } };
  try {
    const app = useAppStore();
    await app.loadSettings();
    assert.equal(app.settings.tagline, "keep my tagline");
    assert.equal(app.settings.condaPath, "Z:/conda.exe");
    assert.equal(app.settings.wallpaper, legacy);
    assert.match(app.error, /壁纸/);
    app.$dispose();
  } finally { globalThis.Image = previousImage; }
});

test("legacy wallpaper data migrates once to a compressed local file without losing tool paths", async () => {
  let disk = { wallpaper: "data:image/png;base64,legacy", tagline: "keep me", condaPath: "Z:/conda.exe", uvPath: "Z:/uv.exe" };
  let imports = 0;
  invoke = async (command, args) => {
    if (command === "get_settings") return { ...disk };
    if (command === "save_wallpaper") { imports++; return "Z:/app/wallpapers/migrated.webp"; }
    if (command === "read_wallpaper") return new Uint8Array([1, 2, 3]).buffer;
    if (command === "save_settings") { assert.deepEqual(Object.keys(args.settings), ["wallpaper"]); disk = { ...disk, ...args.settings }; return { ...disk }; }
  };
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; set src(value) { queueMicrotask(() => this.onload()); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (callback, type) => callback(new Blob(["compressed"], { type })) }) };
  const app = useAppStore();
  try {
    await app.loadSettings();
    assert.equal(disk.wallpaper, "Z:/app/wallpapers/migrated.webp");
    assert.equal(app.settings.uvPath, "Z:/uv.exe");
    assert.equal(app.settings.condaPath, "Z:/conda.exe");
    assert.match(app.wallpaperUrl, /^blob:/);
    await app.loadSettings();
    assert.equal(imports, 1);
  } finally { app.$dispose(); globalThis.Image = previousImage; globalThis.document = previousDocument; }
});

test("unknown task completion renders an accessible native indeterminate progress bar", async () => {
  const { default: Progress } = await server.ssrLoadModule("/src/components/TaskProgress.vue");
  const html = await renderToString(createSSRApp(Progress, { value: null, label: "正在求解依赖" }));
  assert.match(html, /<progress/);
  assert.match(html, /aria-label="正在求解依赖"/);
  assert.doesNotMatch(html, /\svalue=/);
  const complete = await renderToString(createSSRApp(Progress, { value: 100, label: "完成" }));
  assert.match(complete, /value="100"/);
});

test("completed tasks publish final output even when polling was unnecessary", async () => {
  invoke = async (command) => command === "start_package_action" ? task("completed", "final output") : [];
  const workspace = useWorkspaceStore();
  const result = await workspace.packageAction({ target: target("A"), action: "install", packageName: "demo" });
  assert.equal(result.status, "completed");
  assert.match(workspace.output, /final output/);
});

test("overview and environment actions use the same Conda inventory", async () => {
  invoke = async (command) => {
    if (command === "get_overview") return { runtime: { python: "3.14", conda: "test", platform: "windows" }, environments: [environment("base")], checkedAt: "unix:1" };
    if (command === "list_conda_environments") return [environment("base"), environment("new")];
  };
  const app = useAppStore();
  const workspace = useWorkspaceStore();
  await app.refresh();
  assert.deepEqual(workspace.conda.map((item) => item.name), ["base"]);
  await workspace.loadConda(true);
  assert.deepEqual(app.overview.environments.map((item) => item.name), ["base", "new"]);
});

test("an old overview cannot overwrite a newer inventory", async () => {
  let finishOverview;
  invoke = (command) => command === "get_overview"
    ? new Promise((resolve) => { finishOverview = resolve; })
    : Promise.resolve([environment("new")]);
  const app = useAppStore();
  const workspace = useWorkspaceStore();
  const old = app.refresh();
  await workspace.loadConda(true);
  finishOverview({ runtime: { python: "3.14", conda: "test", platform: "windows" }, environments: [environment("old")], checkedAt: "unix:1" });
  await old;
  assert.deepEqual(app.overview.environments.map((item) => item.name), ["new"]);
});

test("an old overview completing first cannot invalidate a newer manual scan", async () => {
  let finishOverview;
  let finishScan;
  invoke = (command) => new Promise((resolve) => { if (command === "get_overview") finishOverview = resolve; else finishScan = resolve; });
  const app = useAppStore();
  const workspace = useWorkspaceStore();
  const old = app.refresh();
  const fresh = workspace.loadConda(true);
  finishOverview({ runtime: { python: "3.14", conda: "test", platform: "windows" }, environments: [environment("old")], checkedAt: "unix:1" });
  await old;
  finishScan([environment("new")]);
  await fresh;
  assert.deepEqual(app.overview.environments.map((item) => item.name), ["new"]);
});

test("a failed settings commit during migration keeps the legacy wallpaper in memory and on disk", async () => {
  const legacy = "data:image/png;base64,legacy";
  const disk = { wallpaper: legacy, tagline: "keep me", condaPath: "Z:/conda.exe" };
  invoke = async (command) => {
    if (command === "get_settings") return { ...disk };
    if (command === "save_wallpaper") return "Z:/app/wallpapers/uncommitted.webp";
    if (command === "save_settings") throw new Error("settings directory is read-only");
    if (command === "read_wallpaper") return new Uint8Array([1, 2, 3]).buffer;
  };
  const previousImage = globalThis.Image;
  const previousDocument = globalThis.document;
  globalThis.Image = class { naturalWidth = 1; naturalHeight = 1; set src(value) { queueMicrotask(() => this.onload()); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (callback, type) => callback(new Blob(["compressed"], { type })) }) };
  const app = useAppStore();
  try {
    await app.loadSettings();
    assert.equal(app.settings.wallpaper, legacy);
    assert.equal(disk.wallpaper, legacy);
    assert.equal(app.settings.tagline, "keep me");
    assert.match(app.error, /read-only/);
  } finally { app.$dispose(); globalThis.Image = previousImage; globalThis.document = previousDocument; }
});

test("changing the Conda path invalidates outstanding inventory responses", async () => {
  let complete;
  invoke = () => new Promise((resolve) => { complete = resolve; });
  const workspace = useWorkspaceStore();
  const old = workspace.loadConda();
  workspace.invalidateScans();
  complete([environment("old")]);
  await old;
  assert.deepEqual(workspace.conda, []);
});

test("failed task details survive inventory refresh", async () => {
  invoke = async (command) => command === "start_create_conda_environment" ? { ...task("failed"), message: "creation failed" } : [];
  const workspace = useWorkspaceStore();
  const result = await workspace.createConda({ name: "new" });
  assert.equal(result.status, "failed");
  assert.equal(workspace.error, "creation failed");
});

test("a transient status failure retries without locking out future tasks", async () => {
  let polls = 0;
  invoke = async (command) => {
    if (command === "start_package_action") return task("running");
    if (command === "get_operation_task") { if (++polls === 1) throw new Error("temporary transport error"); return task("completed"); }
    return [];
  };
  const workspace = useWorkspaceStore();
  const result = await workspace.packageAction({ target: target("A"), action: "install", packageName: "one" });
  assert.equal(result.status, "completed");
  assert.equal(polls, 2);
  assert.equal(workspace.error, "");
});

test("a batch start error survives automatic package refresh", async () => {
  invoke = async (command) => {
    if (command === "start_package_action") throw new Error("could not start package task");
    return [];
  };
  const workspace = useWorkspaceStore();
  workspace.selectedTarget = target("A");
  await workspace.installPackages(target("A"), ["one", "two"], "https://pypi.org/simple");
  assert.equal(workspace.error, "could not start package task");
});

test("an unreachable task remains busy until the user reconnects to its actual terminal state", async () => {
  invoke = async (command) => {
    if (command === "start_package_action") return task("running");
    if (command === "get_operation_task") throw new Error("transport unavailable");
    return [];
  };
  const workspace = useWorkspaceStore();
  await workspace.packageAction({ target: target("A"), action: "install", packageName: "one" });
  assert.equal(workspace.taskConnectionLost, true);
  assert.equal(workspace.busy, true);
  invoke = async (command) => command === "get_operation_task" ? task("completed") : [];
  await workspace.reconnectTask();
  assert.equal(workspace.currentTask.status, "completed");
  assert.equal(workspace.taskConnectionLost, false);
  assert.equal(workspace.busy, false);
});

test("task ownership is reserved before the start IPC returns", async () => {
  let start;
  let starts = 0;
  invoke = (command) => {
    if (command === "start_package_action") { starts++; return new Promise((resolve) => { start = resolve; }); }
    return Promise.resolve([]);
  };
  const workspace = useWorkspaceStore();
  const first = workspace.packageAction({ action: "install", target: target("A"), packageName: "one" });
  await workspace.packageAction({ action: "install", target: target("A"), packageName: "two" });
  assert.equal(starts, 1);
  start(task("completed"));
  await first;
});

test("simultaneous and recent scans reuse one request; manual refresh bypasses the cache", async () => {
  let calls = 0;
  invoke = async () => { calls++; return [environment("base")]; };
  const workspace = useWorkspaceStore();
  await Promise.all([workspace.loadConda(), workspace.loadConda()]);
  await workspace.loadConda();
  assert.equal(calls, 1);
  await workspace.loadConda(true);
  assert.equal(calls, 2);
});

for (const [method, command, payload] of [
  ["createConda", "start_create_conda_environment", { name: "new" }],
  ["importConda", "start_import_conda_environment", { path: "example.yml" }],
  ["createVenv", "start_create_virtual_environment", { name: "new", targetPath: "example" }],
]) {
  test(`${method} runs through the cancellable task API`, async () => {
    const commands = [];
    invoke = async (name) => { commands.push(name); return name === command ? task("completed") : []; };
    await useWorkspaceStore()[method](payload);
    assert.equal(commands[0], command);
  });
}
