const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  isDesktop() {
    return true;
  },
  chooseCondaExportPath(defaultPath) {
    return ipcRenderer.invoke("dialog:choose-conda-export-path", { defaultPath });
  },
  chooseCondaExportDirectory(defaultPath) {
    return ipcRenderer.invoke("dialog:choose-conda-export-directory", { defaultPath });
  },
  onShowAbout(callback) {
    ipcRenderer.on("app:show-about", () => callback());
  },
  onRequestSkinOpen(callback) {
    ipcRenderer.on("app:request-skin-open", () => callback());
  },
  onRequestWallpaperImport(callback) {
    ipcRenderer.on("app:request-wallpaper-import", () => callback());
  },
  onRequestWallpaperReset(callback) {
    ipcRenderer.on("app:request-wallpaper-reset", () => callback());
  }
});
