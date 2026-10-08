import type { NotificationSettings } from '../notificationSettings'

const notificationSoundUrl = new URL('../assets/sounds/notification.wav', import.meta.url).href
export const SOUND_COOLDOWN_MS = 800

export type SoundAudio = {
  currentTime: number
  loop: boolean
  volume: number
  pause: () => void
  play: () => Promise<void> | void
}

type PlayerOptions = {
  createAudio?: (source: string) => SoundAudio
  now?: () => number
  warn?: (message: string, reason?: unknown) => void
  cooldownMs?: number
  source?: string
}

export type NotificationSoundPlayer = {
  play: (settings: NotificationSettings) => Promise<boolean>
  preview: (volume: number) => Promise<boolean>
}

function normalizedVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value)) / 100
}

export function createNotificationSoundPlayer(options: PlayerOptions = {}): NotificationSoundPlayer {
  const createAudio = options.createAudio ?? ((source: string) => new Audio(source))
  const now = options.now ?? Date.now
  const warn = options.warn ?? ((message: string, reason?: unknown) => console.warn(message, reason))
  const cooldownMs = options.cooldownMs ?? SOUND_COOLDOWN_MS
  const source = options.source ?? notificationSoundUrl
  let audio: SoundAudio | undefined
  let lastNotificationPlay = Number.NEGATIVE_INFINITY

  async function playAtVolume(volumeValue: number, useCooldown: boolean): Promise<boolean> {
    const volume = normalizedVolume(volumeValue)
    if (volume === 0) return false

    const current = now()
    if (useCooldown && current - lastNotificationPlay < cooldownMs) return false
    if (useCooldown) lastNotificationPlay = current

    try {
      audio ??= createAudio(source)
      audio.pause()
      audio.currentTime = 0
      audio.loop = false
      audio.volume = volume
      await audio.play()
      return true
    } catch (reason) {
      warn('Notification sound failed', reason)
      return false
    }
  }

  return {
    play: (settings) => settings.notificationSoundEnabled
      ? playAtVolume(settings.notificationVolume, true)
      : Promise.resolve(false),
    preview: (volume) => playAtVolume(volume, false),
  }
}

const notificationSoundPlayer = createNotificationSoundPlayer()

export function playNotificationSound(settings: NotificationSettings): Promise<boolean> {
  return notificationSoundPlayer.play(settings)
}

export function previewNotificationSound(volume: number): Promise<boolean> {
  return notificationSoundPlayer.preview(volume)
}
