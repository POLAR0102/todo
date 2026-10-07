import { contextBridge, ipcRenderer } from 'electron'

type Appearance = { theme: 'light' | 'dark'; opacity: number }
let latest: Appearance | undefined
const subscribers = new Set<(appearance: Appearance) => void>()

ipcRenderer.on('daily-plan-notification:appearance', (_event, value: unknown) => {
  if (!value || typeof value !== 'object') return
  const input = value as Record<string, unknown>
  if (input.theme !== 'light' && input.theme !== 'dark') return
  if (typeof input.opacity !== 'number' || !Number.isInteger(input.opacity) || input.opacity < 0 || input.opacity > 100) return
  latest = { theme: input.theme, opacity: input.opacity }
  for (const subscriber of subscribers) subscriber(latest)
})

contextBridge.exposeInMainWorld('dailyPlanNotification', {
  onAppearance: (callback: (appearance: Appearance) => void) => {
    subscribers.add(callback)
    if (latest) callback(latest)
    return () => { subscribers.delete(callback) }
  },
})
