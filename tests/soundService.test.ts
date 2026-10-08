import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createNotificationSoundPlayer } from '../src/services/soundService.ts'

function fakeAudio() {
  return {
    currentTime: 4,
    loop: true,
    volume: 0,
    pauses: 0,
    plays: 0,
    pause() { this.pauses += 1 },
    async play() { this.plays += 1 },
  }
}

test('notification sound applies volume and reuses one non-looping audio player', async () => {
  let clock = 1_000
  let created = 0
  const audio = fakeAudio()
  const player = createNotificationSoundPlayer({
    now: () => clock,
    createAudio: () => { created += 1; return audio },
  })

  assert.equal(await player.play({ notificationSoundEnabled: true, notificationVolume: 70 }), true)
  assert.equal(audio.volume, 0.7)
  assert.equal(audio.currentTime, 0)
  assert.equal(audio.loop, false)

  clock += 800
  assert.equal(await player.play({ notificationSoundEnabled: true, notificationVolume: 100 }), true)
  assert.equal(created, 1)
  assert.equal(audio.plays, 2)
  assert.equal(audio.pauses, 2)
  assert.equal(audio.volume, 1)
})

test('disabled and zero-volume notification sounds stay silent while preview bypasses the switch', async () => {
  const audio = fakeAudio()
  const player = createNotificationSoundPlayer({ createAudio: () => audio })

  assert.equal(await player.play({ notificationSoundEnabled: false, notificationVolume: 70 }), false)
  assert.equal(await player.play({ notificationSoundEnabled: true, notificationVolume: 0 }), false)
  assert.equal(audio.plays, 0)
  assert.equal(await player.preview(45), true)
  assert.equal(audio.plays, 1)
  assert.equal(audio.volume, 0.45)
})

test('notification sound suppresses repeated triggers inside 800ms', async () => {
  let clock = 5_000
  const audio = fakeAudio()
  const player = createNotificationSoundPlayer({ now: () => clock, createAudio: () => audio })
  const settings = { notificationSoundEnabled: true, notificationVolume: 70 }

  assert.equal(await player.play(settings), true)
  clock += 799
  assert.equal(await player.play(settings), false)
  clock += 1
  assert.equal(await player.play(settings), true)
  assert.equal(audio.plays, 2)
})

test('audio failures are logged and never reject the notification flow', async () => {
  const warnings: string[] = []
  const player = createNotificationSoundPlayer({
    createAudio: () => ({ ...fakeAudio(), play: async () => { throw new Error('decode failed') } }),
    warn: (message) => warnings.push(message),
  })

  assert.equal(await player.play({ notificationSoundEnabled: true, notificationVolume: 70 }), false)
  assert.deepEqual(warnings, ['Notification sound failed'])
})

test('built-in notification asset is a valid WAV container', async () => {
  const bytes = await readFile(new URL('../src/assets/sounds/notification.wav', import.meta.url))
  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF')
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WAVE')
})
