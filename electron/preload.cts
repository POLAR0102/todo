import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("dailyPlanWindow", {
  expand: () => ipcRenderer.send("daily-plan-window:expand"),
  collapse: () => ipcRenderer.send("daily-plan-window:collapse"),
  cancelCollapse: () => ipcRenderer.send("daily-plan-window:cancel-collapse"),
  scheduleCollapse: () => ipcRenderer.send("daily-plan-window:schedule-collapse"),
  toggle: () => ipcRenderer.send("daily-plan-window:toggle"),
  showTaskEnd: (notification: { title: string; endTime: string; theme: 'light' | 'dark'; opacity: number }) => ipcRenderer.send('daily-plan-notification:task-end', notification),
  updateNotificationAppearance: (appearance: { theme: 'light' | 'dark'; opacity: number }) => ipcRenderer.send('daily-plan-notification:appearance', appearance),
});
