import { computed, onScopeDispose, ref, watch } from "vue";
import { defineStore } from "pinia";
import { describeError, invokeCommand, isTauri } from "@/lib/tauri";
import type { AppSettings, Overview } from "@/types";
import { useWorkspaceStore } from "@/stores/workspace";
import { prepareWallpaper } from "@/lib/wallpaper";

const defaultSettings: AppSettings = {
  tagline: "以工程控制台的方式管理 Python 环境",
  compactMode: false,
  primary: "#2563eb",
  secondary: "#0ea5e9",
  ink: "#0f172a",
  wallpaper: "",
};

export const useAppStore = defineStore("app", () => {
  const workspace = useWorkspaceStore();
  const overviewSnapshot = ref<Overview | null>(null);
  const overview = computed<Overview | null>({
    get: () => overviewSnapshot.value ? { ...overviewSnapshot.value, environments: workspace.conda } : null,
    set: (value) => { overviewSnapshot.value = value; if (value) { workspace.beginCondaRequest(); workspace.setConda(value.environments); } },
  });
  const settings = ref<AppSettings>({ ...defaultSettings });
  let persistedSettings = { ...defaultSettings };
  const wallpaperUrl = ref("");
  const loading = ref(false);
  const error = ref("");
  const lastRefreshLabel = computed(() => {
    if (!overview.value) return "尚未刷新";
    const value = overview.value.checkedAt.startsWith("unix:")
      ? Number(overview.value.checkedAt.slice(5)) * 1000
      : overview.value.checkedAt;
    return new Date(value).toLocaleTimeString();
  });

  let refreshRequest: Promise<void> | undefined;
  async function refresh(force = false) {
    if (refreshRequest) return refreshRequest;
    refreshRequest = refreshOverview(force);
    try { await refreshRequest; } finally { refreshRequest = undefined; }
  }

  async function refreshOverview(force: boolean) {
    if (!isTauri) {
      overview.value = { runtime: { python: "3.14.7", conda: "26.7.2", platform: "Windows" }, environments: overview.value?.environments || [], checkedAt: new Date().toISOString() };
      return;
    }
    loading.value = true;
    error.value = "";
    const generation = workspace.inventoryGeneration;
    const revision = workspace.beginCondaRequest();
    try {
      const value = await invokeCommand<Overview>("get_overview", { forceRefresh: force });
      overviewSnapshot.value = value;
      if (generation === workspace.inventoryGeneration && revision === workspace.condaRevision) workspace.setConda(value.environments);
    } catch (cause) {
      error.value = describeError(cause, "刷新失败");
    } finally {
      loading.value = false;
    }
  }

  function normalizeSettings(value: Partial<AppSettings>): AppSettings {
    return { ...defaultSettings, ...Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)) };
  }

  let wallpaperPath: string | undefined;
  let wallpaperRequest: Promise<void> = Promise.resolve();
  let wallpaperVersion = 0;
  function loadWallpaper(path = settings.value.wallpaper || ""): Promise<void> {
    if (path === wallpaperPath) return wallpaperRequest;
    wallpaperPath = path;
    const version = ++wallpaperVersion;
    wallpaperRequest = (async () => {
      let url = path;
      if (isTauri && path && !path.startsWith("/assets/") && !path.startsWith("data:") && !path.startsWith("blob:")) {
        const bytes = await invokeCommand<ArrayBuffer>("read_wallpaper", { path });
        const type = path.endsWith(".jpg") ? "image/jpeg" : path.endsWith(".png") ? "image/png" : "image/webp";
        url = URL.createObjectURL(new Blob([bytes], { type }));
      }
      if (version !== wallpaperVersion) { if (url.startsWith("blob:")) URL.revokeObjectURL(url); return; }
      if (wallpaperUrl.value.startsWith("blob:")) URL.revokeObjectURL(wallpaperUrl.value);
      wallpaperUrl.value = url;
    })().catch((cause) => {
      if (version === wallpaperVersion) { wallpaperPath = undefined; error.value = describeError(cause, "读取壁纸失败"); }
    });
    return wallpaperRequest;
  }
  watch(() => settings.value.wallpaper, (path) => { void loadWallpaper(path || ""); });
  onScopeDispose(() => { wallpaperVersion++; if (wallpaperUrl.value.startsWith("blob:")) URL.revokeObjectURL(wallpaperUrl.value); });

  async function loadSettings() {
    if (!isTauri) {
      settings.value = { ...defaultSettings };
      return;
    }
    try {
      settings.value = normalizeSettings(await invokeCommand<Partial<AppSettings>>("get_settings"));
      persistedSettings = { ...settings.value };
    } catch (cause) {
      settings.value = { ...defaultSettings };
      error.value = describeError(cause, "读取设置失败");
      return;
    }
    if (settings.value.wallpaper?.startsWith("data:image/")) {
      try { await importWallpaper(settings.value.wallpaper); }
      catch (cause) { error.value = describeError(cause, "迁移旧壁纸失败"); }
    } else { await loadWallpaper(); }
  }

  let saveQueue: Promise<unknown> = Promise.resolve();
  let saveVersion = 0;
  async function saveSettings(patch: Partial<AppSettings>) {
    const version = ++saveVersion;
    settings.value = { ...settings.value, ...patch };
    if (!isTauri) return true;
    saveQueue = saveQueue.catch(() => undefined).then(() => invokeCommand<AppSettings>("save_settings", { settings: { ...patch } }));
    try {
      const saved = await saveQueue as AppSettings;
      persistedSettings = normalizeSettings(saved);
      if (version === saveVersion) settings.value = { ...persistedSettings };
      if ("condaPath" in patch) workspace.invalidateScans();
      await loadWallpaper();
      return true;
    } catch (cause) {
      if (version === saveVersion) { settings.value = { ...persistedSettings }; await loadWallpaper(persistedSettings.wallpaper || ""); }
      error.value = describeError(cause, "设置保存失败");
      return false;
    }
  }

  async function importWallpaper(source: Blob | string) {
    const bytes = await prepareWallpaper(source);
    const path = isTauri
      ? await invokeCommand<string>("save_wallpaper", { bytes: Array.from(bytes) })
      : URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
    if (!await saveSettings({ wallpaper: path })) throw new Error(error.value);
    await loadWallpaper();
  }

  return { overview, settings, wallpaperUrl, loading, error, lastRefreshLabel, refresh, loadSettings, saveSettings, importWallpaper };
});
