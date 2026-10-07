import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type TaskEndNotification = {
  title: string
  endTime: string
  theme: 'light' | 'dark'
  opacity: number
}

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const TOAST_WIDTH = 360
const TOAST_HEIGHT = 130
const TOAST_MARGIN = 18
const TOAST_DURATION_MS = 7_000

const pending: TaskEndNotification[] = []
let toastWindow: BrowserWindow | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let currentAppearance: Pick<TaskEndNotification, 'theme' | 'opacity'> | null = null

function readNotification(value: unknown): TaskEndNotification | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (typeof input.title !== 'string' || !input.title.trim()) return null
  if (typeof input.endTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) return null
  if (input.theme !== 'light' && input.theme !== 'dark') return null
  if (typeof input.opacity !== 'number' || !Number.isInteger(input.opacity) || input.opacity < 0 || input.opacity > 100) return null

  return {
    title: input.title.trim().slice(0, 80),
    endTime: input.endTime,
    theme: input.theme,
    opacity: input.opacity,
  }
}

function toastBounds() {
  const { workArea } = screen.getPrimaryDisplay()
  const width = Math.min(TOAST_WIDTH, workArea.width)
  const height = Math.min(TOAST_HEIGHT, workArea.height)
  return {
    x: workArea.x + workArea.width - width - Math.min(TOAST_MARGIN, Math.max(0, workArea.width - width)),
    y: workArea.y + workArea.height - height - Math.min(TOAST_MARGIN, Math.max(0, workArea.height - height)),
    width,
    height,
  }
}

function showNext() {
  if (toastWindow || pending.length === 0) return
  const notification = pending.shift()!
  const popup = new BrowserWindow({
    ...toastBounds(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    webPreferences: {
      preload: path.join(currentDirectory, 'notificationPreload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  toastWindow = popup
  popup.setIgnoreMouseEvents(true)
  popup.once('ready-to-show', () => {
    if (popup.isDestroyed()) return
    if (currentAppearance) popup.webContents.send('daily-plan-notification:appearance', currentAppearance)
    popup.showInactive()
    closeTimer = setTimeout(() => popup.close(), TOAST_DURATION_MS)
  })
  popup.on('closed', () => {
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = null
    toastWindow = null
    showNext()
  })

  const query = {
    title: notification.title,
    endTime: notification.endTime,
    theme: (currentAppearance ?? notification).theme,
    opacity: String((currentAppearance ?? notification).opacity),
  }
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    const url = new URL('notification.html', `${devUrl.replace(/\/$/, '')}/`)
    url.search = new URLSearchParams(query).toString()
    void popup.loadURL(url.toString()).catch(() => popup.close())
  } else {
    void popup.loadFile(path.join(currentDirectory, '../dist/notification.html'), { query }).catch(() => popup.close())
  }
}

export function queueTaskEndNotification(value: unknown) {
  const notification = readNotification(value)
  if (!notification) return
  updateNotificationAppearance(notification)
  pending.push(notification)
  showNext()
}

export function updateNotificationAppearance(value: unknown) {
  if (!value || typeof value !== 'object') return
  const input = value as Record<string, unknown>
  if (input.theme !== 'light' && input.theme !== 'dark') return
  if (typeof input.opacity !== 'number' || !Number.isInteger(input.opacity) || input.opacity < 0 || input.opacity > 100) return
  currentAppearance = { theme: input.theme, opacity: input.opacity }
  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.webContents.send('daily-plan-notification:appearance', currentAppearance)
  }
}

export function positionTaskEndNotification() {
  if (toastWindow && !toastWindow.isDestroyed()) toastWindow.setBounds(toastBounds())
}

export function closeTaskEndNotifications() {
  pending.length = 0
  if (toastWindow && !toastWindow.isDestroyed()) toastWindow.close()
}
