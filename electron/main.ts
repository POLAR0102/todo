import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  attachWindow,
  cancelCollapse,
  collapseWindow,
  expandWindow,
  getInitialBounds,
  positionWindow,
  scheduleCollapse,
  toggleWindow,
} from "./windowManager.js";
import { closeTaskEndNotifications, positionTaskEndNotification, queueTaskEndNotification, updateNotificationAppearance } from './taskEndNotification.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

app.setName("todo");
app.setAppUserModelId("io.github.polar0102.todo");
app.setPath("userData", path.join(app.getPath("appData"), "daily-plan"));

function createWindow() {
  const browserWindow = new BrowserWindow({
    ...getInitialBounds(),
    title: "todo",
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(currentDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow = browserWindow;
  attachWindow(browserWindow);
  browserWindow.once("ready-to-show", () => {
    positionWindow();
    browserWindow.showInactive();
  });
  browserWindow.on("closed", () => {
    mainWindow = null;
    closeTaskEndNotifications();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void browserWindow.loadURL(devUrl);
  } else {
    void browserWindow.loadFile(path.join(currentDirectory, "../dist/index.html"));
  }
}

function registerWindowCommands() {
  const commands = {
    "daily-plan-window:expand": expandWindow,
    "daily-plan-window:collapse": collapseWindow,
    "daily-plan-window:cancel-collapse": cancelCollapse,
    "daily-plan-window:schedule-collapse": scheduleCollapse,
    "daily-plan-window:toggle": toggleWindow,
  };

  for (const [channel, command] of Object.entries(commands)) {
    ipcMain.on(channel, (event) => {
      if (event.sender === mainWindow?.webContents) command();
    });
  }

  ipcMain.on('daily-plan-notification:task-end', (event, notification: unknown) => {
    if (event.sender === mainWindow?.webContents) queueTaskEndNotification(notification)
  })
  ipcMain.on('daily-plan-notification:appearance', (event, appearance: unknown) => {
    if (event.sender === mainWindow?.webContents) updateNotificationAppearance(appearance)
  })
}

app.whenReady().then(() => {
  registerWindowCommands();
  createWindow();

  const positionAllWindows = () => {
    positionWindow();
    positionTaskEndNotification();
  };
  screen.on("display-metrics-changed", positionAllWindows);
  screen.on("display-added", positionAllWindows);
  screen.on("display-removed", positionAllWindows);
});

app.on("window-all-closed", () => app.quit());
