import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPythonInstallArgs,
  extractPlatformPythonVersions,
  selectPythonUpgradeCandidates
} from "../src/services/python-upgrade-service.js";
import { stripPythonWarnings } from "../src/utils/process.js";

test("returns only the latest stable patch for each higher Python minor", () => {
  assert.deepEqual(selectPythonUpgradeCandidates("3.13.5", [
    "3.13.6",
    "3.13.11",
    "3.14.0rc1",
    "3.14.5",
    "3.14.6",
    "3.12.12"
  ]), ["3.14.6", "3.13.11"]);
});

test("does not offer downgrades or the current Python version", () => {
  assert.deepEqual(selectPythonUpgradeCandidates("3.14.6", ["3.14.6", "3.14.5", "3.13.11"]), []);
});

test("filters Python builds to the active Conda platform", () => {
  assert.deepEqual(extractPlatformPythonVersions([
    { version: "3.14.5", subdir: "linux-64" },
    { version: "3.13.9", subdir: "win-64" },
    { version: "3.13.8", platform: "win-64" },
    { version: "3.14.4", subdir: "osx-arm64" }
  ], "win-64"), ["3.13.9", "3.13.8"]);
});

test("uses the same strict channel for dry-run validation and installation", () => {
  const baseArgs = [
    "install", "-p", "D:\\Miniconda", "--override-channels", "-c", "defaults", "python=3.13.9", "-y"
  ];
  assert.deepEqual(buildPythonInstallArgs("D:\\Miniconda", "3.13.9"), baseArgs);
  assert.deepEqual(buildPythonInstallArgs("D:\\Miniconda", "3.13.9", true), [
    ...baseArgs, "--dry-run", "--json"
  ]);
});

test("builds install args with conda-forge channel", () => {
  const baseArgs = [
    "install", "-p", "D:\\Miniconda", "-c", "conda-forge", "--override-channels", "python=3.14.5", "-y"
  ];
  assert.deepEqual(buildPythonInstallArgs("D:\\Miniconda", "3.14.5", false, "conda-forge"), baseArgs);
  assert.deepEqual(buildPythonInstallArgs("D:\\Miniconda", "3.14.5", true, "conda-forge"), [
    ...baseArgs, "--dry-run", "--json"
  ]);
});

test("falls back to defaults for unsupported channel", () => {
  const baseArgs = [
    "install", "-p", "/opt/conda", "--override-channels", "-c", "defaults", "python=3.13.9", "-y"
  ];
  assert.deepEqual(buildPythonInstallArgs("/opt/conda", "3.13.9", false, "bioconda"), baseArgs);
});

test("stripPythonWarnings removes Python warn() lines from conda stderr", () => {
  const raw = [
    "CondaValueError: Requested package 'setuptools' is not found in 'explicit_packages'.",
    'D:\\ProgramData\\miniconda3\\Lib\\site-packages\\requests\\__init__.py:92: RequestsDependencyWarning: Unable to find acceptable character detection dependency (chardet or charset_normalizer).',
    "  warnings.warn(",
    "",
    "CondaError: Run 'conda init' before 'conda activate'."
  ].join("\n");
  const cleaned = stripPythonWarnings(raw);
  assert.ok(!cleaned.includes("RequestsDependencyWarning"), "kept RequestsDependencyWarning line");
  assert.ok(!cleaned.includes("warnings.warn("), "kept warnings.warn( continuation");
  assert.ok(cleaned.includes("CondaValueError"), "preserved real conda error");
  assert.ok(cleaned.includes("CondaError"), "preserved second real conda error");
});

test("stripPythonWarnings leaves clean text unchanged", () => {
  const clean = [
    "CondaValueError: Some problem",
    "CondaError: Another issue"
  ].join("\n");
  assert.equal(stripPythonWarnings(clean), clean);
});

test("stripPythonWarnings handles empty and whitespace inputs", () => {
  assert.equal(stripPythonWarnings(""), "");
  assert.equal(stripPythonWarnings(null), "");
  assert.equal(stripPythonWarnings(undefined), "");
  assert.equal(stripPythonWarnings("   "), "");
});
