const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const {
  app,
  BrowserWindow,
  shell,
  powerSaveBlocker,
  ipcMain,
  dialog,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
} = require("electron");

let mainWindow = null;
let keepAwakeId = null;
let tray = null;
let isQuitting = false;

const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const isDev = Boolean(devServerUrl);
const audioExtensions = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
const settingsPath = path.join(app.getPath("userData"), "desktop-settings.json");
const defaultDesktopSettings = {
  closeToTray: false,
  autoLaunch: false,
  mediaShortcuts: true,
};
let desktopSettings = loadDesktopSettings();

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.name = "Radio Cast";

function getAppIconPath() {
  return path.join(__dirname, "..", "build", "icon.png");
}

function loadDesktopSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaultDesktopSettings, ...JSON.parse(fs.readFileSync(settingsPath, "utf8")) };
    }
  } catch {}
  return { ...defaultDesktopSettings };
}

function saveDesktopSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(desktopSettings, null, 2));
  } catch {}
}

function sendDesktopCommand(command) {
  if (!mainWindow?.webContents) return;
  mainWindow.webContents.send("desktop:command", command);
}

function getTrayImage() {
  const source = nativeImage.createFromPath(getAppIconPath());
  return source.resize({ width: 18, height: 18 });
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

function ensureTray() {
  if (tray || !desktopSettings.closeToTray) return;
  tray = new Tray(getTrayImage());
  tray.setToolTip("Radio Cast");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Mostrar Radio Cast", click: () => showMainWindow() },
      { type: "separator" },
      { label: "Play/Pausa", click: () => sendDesktopCommand("toggle-play") },
      { label: "Siguiente", click: () => sendDesktopCommand("next-track") },
      { label: "Locución", click: () => sendDesktopCommand("toggle-ducking") },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", showMainWindow);
}

function updateTrayBehavior() {
  if (desktopSettings.closeToTray) ensureTray();
  else destroyTray();
}

function updateLoginItem() {
  if (typeof app.setLoginItemSettings === "function") {
    app.setLoginItemSettings({ openAtLogin: Boolean(desktopSettings.autoLaunch) });
  }
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  if (!desktopSettings.mediaShortcuts) return;
  globalShortcut.register("MediaPlayPause", () => sendDesktopCommand("toggle-play"));
  globalShortcut.register("MediaNextTrack", () => sendDesktopCommand("next-track"));
  globalShortcut.register("MediaStop", () => sendDesktopCommand("stop-main"));
  globalShortcut.register("CommandOrControl+Shift+L", () => sendDesktopCommand("toggle-ducking"));
  globalShortcut.register("CommandOrControl+Shift+I", () => sendDesktopCommand("play-intro"));
}

function applyDesktopSettings(partialSettings = {}) {
  desktopSettings = { ...desktopSettings, ...partialSettings };
  saveDesktopSettings();
  updateTrayBehavior();
  updateLoginItem();
  if (app.isReady()) registerGlobalShortcuts();
  return desktopSettings;
}

function mimeFromExt(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    case ".ogg":
      return "audio/ogg";
    case ".flac":
      return "audio/flac";
    default:
      return "application/octet-stream";
  }
}

async function collectDirectoryAudio(dirPath, rootDir = dirPath) {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectDirectoryAudio(absolute, rootDir)));
      continue;
    }
    if (!audioExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    files.push({
      path: absolute,
      relativePath: path.relative(rootDir, absolute) || entry.name,
      folderName: path.basename(rootDir),
    });
  }
  return files;
}

async function serializeAudioFile(filePath, relativePath = "", folderName = "") {
  const buffer = await fsp.readFile(filePath);
  return {
    path: filePath,
    fileName: path.basename(filePath),
    relativePath: relativePath || path.basename(filePath),
    folderName: folderName || path.dirname(filePath).split(path.sep).pop() || "",
    mimeType: mimeFromExt(filePath),
    data: buffer.toString("base64"),
  };
}

async function openAudioSelection({ directory = false } = {}) {
  if (!mainWindow) return { canceled: true, files: [] };
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: directory ? "Elegir carpeta de audios" : "Elegir audios",
    properties: directory ? ["openDirectory"] : ["openFile", "multiSelections"],
    filters: directory ? [] : [{ name: "Audios", extensions: [...audioExtensions].map((ext) => ext.slice(1)) }],
  });
  if (selection.canceled || !selection.filePaths.length) return { canceled: true, files: [] };

  if (directory) {
    const entries = await collectDirectoryAudio(selection.filePaths[0]);
    const files = await Promise.all(entries.map((entry) => serializeAudioFile(entry.path, entry.relativePath, entry.folderName)));
    return { canceled: false, files };
  }

  const files = await Promise.all(selection.filePaths.map((filePath) => serializeAudioFile(filePath)));
  return { canceled: false, files };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1180,
    minHeight: 720,
    title: "Radio Cast",
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  if (!keepAwakeId || !powerSaveBlocker.isStarted(keepAwakeId)) {
    keepAwakeId = powerSaveBlocker.start("prevent-app-suspension");
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("close", (event) => {
    if (desktopSettings.closeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("desktop:get-settings", () => desktopSettings);
ipcMain.handle("desktop:update-settings", (_event, payload = {}) => applyDesktopSettings(payload));
ipcMain.handle("desktop:open-audio", async (_event, options = {}) => openAudioSelection(options));
ipcMain.handle("desktop:save-file", async (_event, payload = {}) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: payload.title || "Guardar archivo",
    defaultPath: payload.defaultPath,
    filters: payload.filters || [],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await fsp.writeFile(result.filePath, payload.content || "", "utf8");
  return { canceled: false, filePath: result.filePath };
});
ipcMain.handle("desktop:show-item", async (_event, filePath) => {
  if (!filePath) return false;
  shell.showItemInFolder(filePath);
  return true;
});

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.whenReady().then(() => {
    applyDesktopSettings(desktopSettings);
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
      else showMainWindow();
    });
  });
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (keepAwakeId && powerSaveBlocker.isStarted(keepAwakeId)) {
    powerSaveBlocker.stop(keepAwakeId);
    keepAwakeId = null;
  }
  if (process.platform !== "darwin") app.quit();
});
