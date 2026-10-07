import assert from 'node:assert/strict'
import test from 'node:test'
import { taskEndNotificationKey, tasksEndingBetween } from '../src/taskEndNotifications.ts'
import type { Task } from '../src/tasks.ts'

const task: Task = {
  id: 'one',
  title: '阅读',
  date: '2026-10-05',
  startTime: '09:00',
  endTime: '10:00',
  completed: false,
  createdAt: '2026-10-05T00:00:00.000Z',
}

test('notifies once when an unfinished task crosses its end time', () => {
  const before = new Date(2026, 9, 5, 9, 59, 59).getTime()
  const after = new Date(2026, 9, 5, 10, 0, 1).getTime()
  assert.deepEqual(tasksEndingBetween([task], before, after, new Set()).map(({ id }) => id), ['one'])
  assert.deepEqual(tasksEndingBetween([task], before, after, new Set([taskEndNotificationKey(task)])), [])
  assert.deepEqual(tasksEndingBetween([{ ...task, completed: true }, { ...task, id: 'removed', deletedAt: task.createdAt }], before, after, new Set()), [])
})

test('a new end time can notify again for the same task', () => {
  const extended = { ...task, endTime: '10:30' }
  const before = new Date(2026, 9, 5, 10, 29, 59).getTime()
  const after = new Date(2026, 9, 5, 10, 30, 1).getTime()
  assert.deepEqual(tasksEndingBetween([extended], before, after, new Set([taskEndNotificationKey(task)])).map(({ id }) => id), ['one'])
})

test('does not replay old endings after startup or a long sleep', () => {
  const before = new Date(2026, 9, 5, 9, 59, 59).getTime()
  const after = new Date(2026, 9, 5, 11, 0, 0).getTime()
  assert.deepEqual(tasksEndingBetween([task], before, after, new Set()), [])
  assert.deepEqual(tasksEndingBetween([task], after, before, new Set()), [])
})

test('handles a task that ends after midnight', () => {
  const overnight = { ...task, startTime: '23:30', endTime: '00:00' }
  const before = new Date(2026, 9, 5, 23, 59, 59).getTime()
  const after = new Date(2026, 9, 6, 0, 0, 1).getTime()
  assert.deepEqual(tasksEndingBetween([overnight], before, after, new Set()).map(({ id }) => id), ['one'])
})
