import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPythonInstallArgs,
  extractPlatformPythonVersions,
  selectPythonUpgradeCandidates
} from "../src/services/python-upgrade-service.js";

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
