import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_NOTIFICATION_SETTINGS, loadNotificationSettings, saveNotificationSettings } from '../src/notificationSettings.ts'

function memoryStorage(initial?: string) {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set('dailyplan-notification-settings', initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

test('notification settings use enabled and 70 percent defaults', () => {
  assert.deepEqual(loadNotificationSettings(memoryStorage()), DEFAULT_NOTIFICATION_SETTINGS)
  assert.deepEqual(loadNotificationSettings(memoryStorage('{broken')), DEFAULT_NOTIFICATION_SETTINGS)
})

test('notification settings validate fields independently', () => {
  const disabled = memoryStorage(JSON.stringify({ notificationSoundEnabled: false, notificationVolume: 35 }))
  assert.deepEqual(loadNotificationSettings(disabled), { notificationSoundEnabled: false, notificationVolume: 35 })

  const invalid = memoryStorage(JSON.stringify({ notificationSoundEnabled: 'yes', notificationVolume: 120 }))
  assert.deepEqual(loadNotificationSettings(invalid), DEFAULT_NOTIFICATION_SETTINGS)
})

test('notification settings save and reload without another store', () => {
  const storage = memoryStorage()
  assert.equal(saveNotificationSettings({ notificationSoundEnabled: false, notificationVolume: 0 }, storage), true)
  assert.deepEqual(loadNotificationSettings(storage), { notificationSoundEnabled: false, notificationVolume: 0 })
})

test('notification setting storage failures never crash the app', () => {
  const failingRead = { getItem: () => { throw new Error('unavailable') }, setItem: () => undefined }
  const failingWrite = { getItem: () => null, setItem: () => { throw new Error('full') } }
  assert.deepEqual(loadNotificationSettings(failingRead), DEFAULT_NOTIFICATION_SETTINGS)
  assert.equal(saveNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, failingWrite), false)
})
