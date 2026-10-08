import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeImportedTasks, parseImportedTasks, timeToMinutes } from '../src/utils/parseImportedTasks.ts'
import type { Task } from '../src/tasks.ts'

function sequentialIds(): () => string {
  let sequence = 0
  return () => `parsed-${++sequence}`
}

test('parses normal plans, ignores empty lines and trims each line', () => {
  const parsed = parseImportedTasks(`
    07:00-07:30 起床

    07:30-08:00 跑步
    08:00-08:30 早餐
  `, sequentialIds())

  assert.deepEqual(parsed, [
    { id: 'parsed-1', rawText: '07:00-07:30 起床', title: '起床', startTime: '07:00', endTime: '07:30', valid: true },
    { id: 'parsed-2', rawText: '07:30-08:00 跑步', title: '跑步', startTime: '07:30', endTime: '08:00', valid: true },
    { id: 'parsed-3', rawText: '08:00-08:30 早餐', title: '早餐', startTime: '08:00', endTime: '08:30', valid: true },
  ])
})

test('accepts tilde and en dash separators and normalizes task fields', () => {
  const parsed = parseImportedTasks([
    '09:00~10:00 AI学习',
    '10:00–11:00 写代码',
    '11:00 - 12:00   整理资料',
  ].join('\n'), sequentialIds())

  assert.deepEqual(parsed.map(({ startTime, endTime, title, valid }) => ({ startTime, endTime, title, valid })), [
    { startTime: '09:00', endTime: '10:00', title: 'AI学习', valid: true },
    { startTime: '10:00', endTime: '11:00', title: '写代码', valid: true },
    { startTime: '11:00', endTime: '12:00', title: '整理资料', valid: true },
  ])
})

test('marks only the invalid line and reports the expected error', () => {
  const parsed = parseImportedTasks([
    '12:00 午饭',
    'abc',
    '13:00-14:00',
    '25:00-26:00 测试',
    '14:00-15:00 正常任务',
  ].join('\n'), sequentialIds())

  assert.deepEqual(parsed.map(({ valid, error }) => ({ valid, error })), [
    { valid: false, error: '缺少结束时间' },
    { valid: false, error: '时间格式不正确' },
    { valid: false, error: '任务名称不能为空' },
    { valid: false, error: '时间格式不正确' },
    { valid: true, error: undefined },
  ])
})

test('reports a missing start or end time without throwing', () => {
  const parsed = parseImportedTasks('-10:00 测试\n09:00-\n09:00- 写报告\n10:00~ 整理资料\n11:00– 阅读', sequentialIds())
  assert.equal(parsed[0].error, '缺少开始时间')
  assert.equal(parsed[1].error, '缺少结束时间')
  assert.deepEqual(parsed.slice(2).map(({ title, error }) => ({ title, error })), [
    { title: '写报告', error: '缺少结束时间' },
    { title: '整理资料', error: '缺少结束时间' },
    { title: '阅读', error: '缺少结束时间' },
  ])
})

test('allows overnight and equal-time ranges while converting strict times to minutes', () => {
  const parsed = parseImportedTasks([
    '23:30-00:00 洗漱、准备睡觉',
    '00:00-00:00 全天之后',
  ].join('\n'), sequentialIds())

  assert.ok(parsed.every((item) => item.valid))
  assert.equal(timeToMinutes('09:30'), 570)
  assert.equal(timeToMinutes('00:00'), 0)
  assert.equal(timeToMinutes('23:59'), 1439)
  assert.equal(timeToMinutes('9:30'), null)
  assert.equal(timeToMinutes('24:00'), null)
  assert.equal(timeToMinutes('12:60'), null)
})

test('empty and whitespace-only input produces an empty preview', () => {
  assert.deepEqual(parseImportedTasks('', sequentialIds()), [])
  assert.deepEqual(parseImportedTasks('  \n\t\n', sequentialIds()), [])
})

function existingTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'existing',
    title: '已有计划',
    date: '2026-10-08',
    startTime: '14:00',
    endTime: '15:00',
    completed: false,
    createdAt: '2026-10-08T00:00:00.000Z',
    ...overrides,
  }
}

test('marks both imported rows when their time ranges conflict', () => {
  const parsed = parseImportedTasks('09:00-11:00 AI学习\n10:00-12:00 项目开发', sequentialIds())
  const analyzed = analyzeImportedTasks(parsed, '2026-10-08', [])

  assert.deepEqual(analyzed.map((task) => task.conflict), [true, true])
  assert.ok(analyzed.every((task) => task.duplicate === false))
})

test('marks conflicts with existing tasks but allows adjacent time ranges', () => {
  const parsed = parseImportedTasks('13:00-14:00 午后准备\n14:30-15:30 深度工作', sequentialIds())
  const analyzed = analyzeImportedTasks(parsed, '2026-10-08', [existingTask()])

  assert.deepEqual(analyzed.map((task) => task.conflict), [false, true])
})

test('marks existing and repeated batch entries as duplicates', () => {
  const parsed = parseImportedTasks([
    '08:00-08:30 早餐',
    '09:00-09:30 阅读',
    '09:00-09:30 阅读',
  ].join('\n'), sequentialIds())
  const analyzed = analyzeImportedTasks(parsed, '2026-10-08', [existingTask({
    title: '早餐', startTime: '08:00', endTime: '08:30',
  })])

  assert.deepEqual(analyzed.map((task) => task.duplicate), [true, false, true])
})

test('detects an overnight import conflict with an existing next-day task', () => {
  const parsed = parseImportedTasks('23:30-00:30 洗漱、准备睡觉', sequentialIds())
  const analyzed = analyzeImportedTasks(parsed, '2026-10-08', [existingTask({
    date: '2026-10-09', startTime: '00:00', endTime: '01:00',
  })])

  assert.equal(analyzed[0].conflict, true)
})
