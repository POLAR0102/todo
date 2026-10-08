export type NotificationSettings = {
  notificationSoundEnabled: boolean
  notificationVolume: number
}

type StoragePort = Pick<Storage, 'getItem' | 'setItem'>

const NOTIFICATION_SETTINGS_STORAGE_KEY = 'dailyplan-notification-settings'

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notificationSoundEnabled: true,
  notificationVolume: 70,
}

function browserStorage(): StoragePort | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function validVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
}

export function loadNotificationSettings(storage: StoragePort | undefined = browserStorage()): NotificationSettings {
  if (!storage) return { ...DEFAULT_NOTIFICATION_SETTINGS }
  try {
    const parsed: unknown = JSON.parse(storage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_NOTIFICATION_SETTINGS }
    const value = parsed as Partial<NotificationSettings>
    return {
      notificationSoundEnabled: typeof value.notificationSoundEnabled === 'boolean'
        ? value.notificationSoundEnabled
        : DEFAULT_NOTIFICATION_SETTINGS.notificationSoundEnabled,
      notificationVolume: validVolume(value.notificationVolume)
        ? value.notificationVolume
        : DEFAULT_NOTIFICATION_SETTINGS.notificationVolume,
    }
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS }
  }
}

export function saveNotificationSettings(
  settings: NotificationSettings,
  storage: StoragePort | undefined = browserStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
