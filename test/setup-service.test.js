import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEnvironmentName,
  comparePythonVersions,
  getSetupPackageCatalog,
  normalizeSelectedPackages,
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
