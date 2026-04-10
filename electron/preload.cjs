const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("radioCastDesktop", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  updateSettings: (settings) => ipcRenderer.invoke("desktop:update-settings", settings),
  openAudioFiles: (options) => ipcRenderer.invoke("desktop:open-audio", options),
  saveTextFile: (payload) => ipcRenderer.invoke("desktop:save-file", payload),
  showItemInFolder: (filePath) => ipcRenderer.invoke("desktop:show-item", filePath),
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("desktop:command", listener);
    return () => ipcRenderer.removeListener("desktop:command", listener);
  },
});
