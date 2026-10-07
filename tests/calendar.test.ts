import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CALENDAR_DAY_COUNT,
  buildCalendarDays,
  calendarDateLabel,
  calendarTaskState,
  calendarTaskTime,
  formatCalendarMonth,
  moveCalendarMonth,
} from '../src/calendar.ts'
import type { Task } from '../src/tasks.ts'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task',
    title: '阅读',
    date: '2026-10-07',
    startTime: '09:00',
    endTime: '10:00',
    completed: false,
    createdAt: '2026-10-07T00:00:00.000Z',
    ...overrides,
  }
}

test('month view always contains six Monday-first weeks', () => {
  const days = buildCalendarDays([], new Date(2026, 9, 1), new Date(2026, 9, 7))

  assert.equal(days.length, CALENDAR_DAY_COUNT)
  assert.equal(days[0].dateKey, '2026-09-28')
  assert.equal(days[0].date.getDay(), 1)
  assert.equal(days[41].dateKey, '2026-11-08')
  assert.equal(days.find((day) => day.dateKey === '2026-10-07')?.isToday, true)
})

test('calendar groups and sorts parent plans while ignoring legacy deleted records', () => {
  const days = buildCalendarDays([
    task({ id: 'late', title: '晚间复盘', startTime: '20:00' }),
    task({ id: 'early', title: '晨间学习', startTime: '07:00', subtasks: [
      { id: 'child-a', title: '步骤一', completed: true },
      { id: 'child-b', title: '步骤二', completed: false },
    ] }),
    task({ id: 'deleted', title: '旧计划', deletedAt: '2026-10-07T01:00:00.000Z' }),
  ], new Date(2026, 9, 1), new Date(2026, 9, 7))
  const selected = days.find((day) => day.dateKey === '2026-10-07')

  assert.equal(selected?.tasks.length, 2)
  assert.deepEqual(selected?.tasks.map((item) => item.id), ['early', 'late'])
  assert.equal(selected?.tasks[0].subtasks?.length, 2)
})

test('calendar detail helpers format status, overnight time and Chinese labels', () => {
  const now = new Date(2026, 9, 7, 9, 30)

  assert.equal(calendarTaskState(task(), now), '进行中')
  assert.equal(calendarTaskState(task({ completed: true }), now), '已完成')
  assert.equal(calendarTaskState(task({ startTime: '07:00', endTime: '08:00' }), now), '未完成')
  assert.equal(calendarTaskState(task({ startTime: '11:00', endTime: '12:00' }), now), '等待开始')
  assert.equal(calendarTaskTime(task({ startTime: '23:30', endTime: '00:30' })), '23:30 — 次日 00:30')
  assert.equal(calendarDateLabel('2026-10-07'), '10月7日 星期三')
})

test('month labels and month movement cross year boundaries', () => {
  const december = new Date(2026, 11, 1)
  const january = moveCalendarMonth(december, 1)

  assert.equal(formatCalendarMonth(december), '2026年12月')
  assert.equal(formatCalendarMonth(january), '2027年1月')
  assert.equal(january.getDate(), 1)
})
