import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseJsonCommandOutput } from "../src/services/environment-service.js";
import {
  buildEnvironmentName,
  buildCondaCoreUpdateArgs,
  cleanupStaleCondaUpdateArtifacts,
  comparePythonVersions,
  getSetupPackageCatalog,
  normalizeSelectedPackages,
  isRecoverableCondaCleanupFailure,
  resolveLatestCondaVersion,
  resolveLatestStablePythonVersion
} from "../src/services/setup-service.js";

test("resolves the latest stable Python version from conda search output", () => {
  const result = resolveLatestStablePythonVersion({
    python: [
      { version: "3.13.12" },
      { version: "3.14.5" },
      { version: "3.14.6" },
      { version: "3.15.0a1" }
    ]
  });
  assert.equal(result, "3.14.6");
});

test("builds py3146-style environment names", () => {
  assert.equal(buildEnvironmentName("3.14.6"), "py3146");
});

test("compares numeric version components instead of strings", () => {
  assert.ok(comparePythonVersions("3.14.10", "3.14.9") > 0);
});

test("rejects an empty stable version result", () => {
  assert.throws(
    () => resolveLatestStablePythonVersion({ python: [{ version: "3.15.0rc1" }] }),
    /稳定版 Python/
  );
});

test("maps only catalog package ids to installable package names", () => {
  assert.deepEqual(normalizeSelectedPackages(["numpy", "openpyxl", "not-allowed"], "conda"), [
    "numpy",
    "openpyxl"
  ]);
  assert.deepEqual(normalizeSelectedPackages(["openai", "drissionpage"], "pip"), ["openai", "DrissionPage"]);
});

test("uses curated defaults when package selections are omitted", () => {
  assert.deepEqual(normalizeSelectedPackages(undefined, "conda"), ["numpy", "pandas", "openpyxl"]);
  assert.deepEqual(normalizeSelectedPackages(undefined, "pip"), ["openai", "loguru"]);
});

test("returns independent package catalog data", () => {
  const first = getSetupPackageCatalog();
  first.conda[0].label = "changed";
  assert.equal(getSetupPackageCatalog().conda[0].label, "NumPy");
});

test("resolves the latest stable Conda core version", () => {
  assert.equal(resolveLatestCondaVersion({
    conda: [{ version: "25.9.1" }, { version: "26.1.0" }, { version: "25.11.1" }, { version: "26.1.0rc1" }]
  }), "26.1.0");
});

test("recognizes the Windows Conda cleanup failure", () => {
  assert.equal(isRecoverableCondaCleanupFailure(
    "AttributeError: 'str' object has no attribute 'splitext'\nD:\\Miniconda\\Scripts\\conda.exe.c~.conda_trash"
  ), true);
  assert.equal(isRecoverableCondaCleanupFailure("PackagesNotFoundError: missing"), false);
});

test("installs the requested Conda core version with an exact spec", () => {
  assert.deepEqual(buildCondaCoreUpdateArgs("26.5.3"), [
    "install", "-n", "base", "-c", "defaults", "conda=26.5.3", "-y"
  ]);
  assert.throws(() => buildCondaCoreUpdateArgs("latest"), /目标版本无效/);
});

test("parses Conda JSON when plugin diagnostics pollute stdout", () => {
  const output = [
    "Error loading anaconda-anon-usage: incompatible plugin",
    '{"conda_version":"26.5.3","envs":["base"]}',
    "plugin warning after JSON"
  ].join("\n");
  assert.deepEqual(parseJsonCommandOutput(output), {
    conda_version: "26.5.3",
    envs: ["base"]
  });
});

test("cleans only known Conda self-update artifacts", { skip: process.platform !== "win32" }, async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "weipython-conda-cleanup-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const scripts = path.join(root, "Scripts");
  await fs.mkdir(scripts);
  await Promise.all([
    fs.writeFile(path.join(scripts, "conda.exe.c~"), "temporary"),
    fs.writeFile(path.join(scripts, "conda.exe.c~.conda_trash"), "trash"),
    fs.writeFile(path.join(scripts, "conda.exe"), "keep"),
    fs.writeFile(path.join(scripts, "unrelated.conda_trash"), "keep")
  ]);

  const result = await cleanupStaleCondaUpdateArtifacts(root);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(new Set(result.removed), new Set(["conda.exe.c~", "conda.exe.c~.conda_trash"]));
  assert.equal(await fs.readFile(path.join(scripts, "conda.exe"), "utf8"), "keep");
  assert.equal(await fs.readFile(path.join(scripts, "unrelated.conda_trash"), "utf8"), "keep");
});
