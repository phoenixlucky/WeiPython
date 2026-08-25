import assert from "node:assert/strict";
import test from "node:test";
import {
  condaSpecToPipSpec,
  isCondaOnlyPackage
} from "../src/services/environment-service.js";

test("converts conda MatchSpec bracket syntax into pip-readable constraints", () => {
  // 这是克隆 base 环境时触发 pip InvalidRequirement 崩溃的真实形态
  assert.equal(condaSpecToPipSpec("conda-anaconda-telemetry[version='>=0.2.0']"), "conda-anaconda-telemetry>=0.2.0");
  assert.equal(condaSpecToPipSpec("conda-anaconda-tos[version='>=0.2.1']"), "conda-anaconda-tos>=0.2.1");
});

test("keeps only version constraints when converting bracket specs", () => {
  assert.equal(condaSpecToPipSpec("pkg[version='>=1.0,<2.0']"), "pkg>=1.0,<2.0");
  assert.equal(condaSpecToPipSpec('pkg[version=">=1.0"]'), "pkg>=1.0");
  // python_version 等 pip 不支持的键直接丢弃
  assert.equal(condaSpecToPipSpec("pkg[python_version='>=3.8']"), "pkg");
  assert.equal(condaSpecToPipSpec("pkg[]"), "pkg");
});

test("still converts plain conda specs and preserves pip specs", () => {
  assert.equal(condaSpecToPipSpec("pyinstaller=6.21.0"), "pyinstaller==6.21.0");
  assert.equal(condaSpecToPipSpec("numpy=2.5.2=py314h1234_0"), "numpy==2.5.2");
  assert.equal(condaSpecToPipSpec("numpy==2.5.2"), "numpy==2.5.2");
  assert.equal(condaSpecToPipSpec("numpy>=1.26"), "numpy>=1.26");
});

test("flags Anaconda-channel-only packages that do not exist on PyPI", () => {
  assert.ok(isCondaOnlyPackage("conda-anaconda-telemetry[version='>=0.2.0']"));
  assert.ok(isCondaOnlyPackage("conda-anaconda-tos"));
  assert.ok(isCondaOnlyPackage("anaconda_prompt"));
  assert.ok(isCondaOnlyPackage("anaconda_powershell_prompt"));
  assert.ok(!isCondaOnlyPackage("menuinst[version='>=2']"));
  assert.ok(!isCondaOnlyPackage("pyinstaller"));
});
