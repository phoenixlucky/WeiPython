import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startServer } from "../src/server.js";

const ORIGINAL_USER_DATA_ENV = process.env.WEIPYTHON_USER_DATA;
let tempUserData = null;
let handle = null;

async function setupServer() {
  tempUserData = await fs.mkdtemp(path.join(os.tmpdir(), "weipython-skin-test-"));
  process.env.WEIPYTHON_USER_DATA = tempUserData;
  handle = await startServer({ port: 0 });
  return `http://127.0.0.1:${handle.port}`;
}

async function teardownServer() {
  if (handle?.server) {
    await new Promise((resolve) => {
      handle.server.closeAllConnections?.();
      handle.server.close(resolve);
    });
  }
  if (tempUserData) {
    await fs.rm(tempUserData, { recursive: true, force: true });
  }
  if (ORIGINAL_USER_DATA_ENV === undefined) {
    delete process.env.WEIPYTHON_USER_DATA;
  } else {
    process.env.WEIPYTHON_USER_DATA = ORIGINAL_USER_DATA_ENV;
  }
  handle = null;
  tempUserData = null;
}

function putSkin(base, body) {
  return fetch(`${base}/api/skin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("GET /api/skin returns empty config when no file exists yet", async () => {
  const base = await setupServer();
  try {
    const response = await fetch(`${base}/api/skin`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {});
  } finally {
    await teardownServer();
  }
});

test("PUT /api/skin merges partial updates instead of replacing", async () => {
  const base = await setupServer();
  try {
    assert.equal((await putSkin(base, { tagline: "自定义标语" })).status, 200);
    assert.equal((await putSkin(base, { primary: "#3B82F6" })).status, 200);
    assert.equal(
      (await putSkin(base, { wallpaper: "data:image/webp;base64,AAAA" })).status,
      200
    );

    const skin = await (await fetch(`${base}/api/skin`)).json();
    assert.equal(skin.tagline, "自定义标语");
    assert.equal(skin.primary, "#3B82F6");
    assert.equal(skin.wallpaper, "data:image/webp;base64,AAAA");
  } finally {
    await teardownServer();
  }
});

test("concurrent PUT requests to /api/skin do not lose fields", async () => {
  const base = await setupServer();
  try {
    await Promise.all([
      putSkin(base, { tagline: "T1" }),
      putSkin(base, { primary: "#111111" }),
      putSkin(base, { secondary: "#222222" })
    ]);

    const skin = await (await fetch(`${base}/api/skin`)).json();
    assert.equal(skin.tagline, "T1");
    assert.equal(skin.primary, "#111111");
    assert.equal(skin.secondary, "#222222");
  } finally {
    await teardownServer();
  }
});

test("PUT /api/skin persists to userData/skin.json on disk", async () => {
  const base = await setupServer();
  try {
    await putSkin(base, { ink: "#1E293B" });
    const raw = await fs.readFile(path.join(tempUserData, "skin.json"), "utf8");
    assert.deepEqual(JSON.parse(raw), { ink: "#1E293B" });
  } finally {
    await teardownServer();
  }
});

test("GET/PUT /api/skin return 501 when userData env is absent", async () => {
  delete process.env.WEIPYTHON_USER_DATA;
  const isolated = await startServer({ port: 0 });
  const base = `http://127.0.0.1:${isolated.port}`;
  try {
    assert.equal((await fetch(`${base}/api/skin`)).status, 501);
    assert.equal((await putSkin(base, { tagline: "x" })).status, 501);
  } finally {
    await new Promise((resolve) => {
      isolated.server.closeAllConnections?.();
      isolated.server.close(resolve);
    });
    if (ORIGINAL_USER_DATA_ENV === undefined) {
      delete process.env.WEIPYTHON_USER_DATA;
    } else {
      process.env.WEIPYTHON_USER_DATA = ORIGINAL_USER_DATA_ENV;
    }
  }
});
