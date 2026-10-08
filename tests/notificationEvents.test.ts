import assert from 'node:assert/strict'
import test from 'node:test'
import { focusReminderKey, focusRemindersBetween, taskStartNotificationKey, tasksStartingBetween } from '../src/notificationEvents.ts'
import type { Task } from '../src/tasks.ts'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'one',
    title: '深度工作',
    date: '2026-10-08',
    startTime: '09:00',
    endTime: '11:30',
    completed: false,
    createdAt: '2026-10-08T00:00:00.000Z',
    ...overrides,
  }
}

test('task starts notify once and skip completed or deleted tasks', () => {
  const before = new Date(2026, 9, 8, 8, 59, 59).getTime()
  const after = new Date(2026, 9, 8, 9, 0, 1).getTime()
  assert.deepEqual(tasksStartingBetween([task()], before, after, new Set()).map(({ id }) => id), ['one'])
  assert.deepEqual(tasksStartingBetween([task()], before, after, new Set([taskStartNotificationKey(task())])), [])
  assert.deepEqual(tasksStartingBetween([task({ completed: true }), task({ id: 'removed', deletedAt: 'now' })], before, after, new Set()), [])
})

test('task starts do not replay after startup or a long sleep', () => {
  const before = new Date(2026, 9, 8, 8, 59, 59).getTime()
  const muchLater = new Date(2026, 9, 8, 10, 0, 0).getTime()
  assert.deepEqual(tasksStartingBetween([task()], before, muchLater, new Set()), [])
  assert.deepEqual(tasksStartingBetween([task()], muchLater, before, new Set()), [])
})

test('focus reminders fire every 40 minutes only once per interval', () => {
  const firstBefore = new Date(2026, 9, 8, 9, 39, 59).getTime()
  const firstAfter = new Date(2026, 9, 8, 9, 40, 1).getTime()
  const first = focusRemindersBetween([task()], firstBefore, firstAfter, new Set())
  assert.equal(first.length, 1)
  assert.equal(first[0].elapsedMinutes, 40)
  assert.deepEqual(focusRemindersBetween([task()], firstBefore, firstAfter, new Set([first[0].key])), [])

  const secondBefore = new Date(2026, 9, 8, 10, 19, 59).getTime()
  const secondAfter = new Date(2026, 9, 8, 10, 20, 1).getTime()
  const second = focusRemindersBetween([task()], secondBefore, secondAfter, new Set())
  assert.equal(second[0].elapsedMinutes, 80)
  assert.equal(second[0].key, focusReminderKey(task(), 2))
})

test('focus reminders work across midnight and include an exact 40-minute end', () => {
  const overnight = task({ date: '2026-10-08', startTime: '23:30', endTime: '00:10' })
  const before = new Date(2026, 9, 9, 0, 9, 59).getTime()
  const after = new Date(2026, 9, 9, 0, 10, 1).getTime()
  assert.equal(focusRemindersBetween([overnight], before, after, new Set()).length, 1)
})

test('focus reminders skip stale, completed and deleted work', () => {
  const before = new Date(2026, 9, 8, 9, 0, 0).getTime()
  const after = new Date(2026, 9, 8, 10, 0, 0).getTime()
  assert.deepEqual(focusRemindersBetween([task()], before, after, new Set()), [])
  assert.deepEqual(focusRemindersBetween([task({ completed: true }), task({ id: 'removed', deletedAt: 'now' })], before, after, new Set()), [])
})
