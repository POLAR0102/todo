import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzeCopyConflicts,
  findFirstTimeConflict,
  generateDayCopyInputs,
  generateTaskInputs,
  type CopyDayInput,
  type PlanInput,
} from '../src/schedule.ts'
import type { Task, TaskInput } from '../src/tasks.ts'

const plan: PlanInput = {
  title: ' 学习 ',
  startDate: '2026-10-04',
  endDate: '2026-10-11',
  startTime: '09:00',
  endTime: '10:00',
  frequency: 'daily',
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'existing',
    title: '已有任务',
    date: '2026-10-04',
    startTime: '09:00',
    endTime: '10:00',
    completed: false,
    createdAt: '2026-10-04T00:00:00.000Z',
    ...overrides,
  }
}

test('daily plans include both dates and preserve one task per date', () => {
  const inputs = generateTaskInputs(plan)
  assert.equal(inputs.length, 8)
  assert.equal(inputs[0].date, '2026-10-04')
  assert.equal(inputs.at(-1)?.date, '2026-10-11')
  assert.ok(inputs.every((item) => item.title === '学习'))
})

test('repeated plan generation deep-copies subtask templates in their original order', () => {
  const inputs = generateTaskInputs({
    ...plan,
    endDate: '2026-10-05',
    subtasks: [
      { id: 'source-a', title: 'abandon', completed: true },
      { id: 'source-b', title: 'apple', completed: false },
    ],
  })

  assert.deepEqual(inputs.map((input) => input.subtasks?.map((subtask) => subtask.title)), [
    ['abandon', 'apple'],
    ['abandon', 'apple'],
  ])
  assert.notEqual(inputs[0].subtasks, inputs[1].subtasks)
})

test('six-on/one-off and five-on/two-off start their cycle on the selected date', () => {
  assert.deepEqual(
    generateTaskInputs({ ...plan, frequency: 'six-one' }).map((item) => item.date),
    ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-11'],
  )
  assert.deepEqual(
    generateTaskInputs({ ...plan, frequency: 'five-two' }).map((item) => item.date),
    ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-11'],
  )
})

test('date generation crosses month boundaries and rejects invalid or excessive ranges', () => {
  const range = generateTaskInputs({ ...plan, startDate: '2026-10-31', endDate: '2026-11-02' })
  assert.deepEqual(range.map((item) => item.date), ['2026-10-31', '2026-11-01', '2026-11-02'])
  assert.throws(() => generateTaskInputs({ ...plan, endDate: '2026-10-03' }), /截止日期/)
  assert.throws(() => generateTaskInputs({ ...plan, startDate: '2026-02-30' }), /有效日期/)
  assert.throws(() => generateTaskInputs({ ...plan, endDate: '2027-10-05' }), /最多 366 天/)
})

test('a conflict in any generated day is found for rejecting the entire group', () => {
  const conflict = findFirstTimeConflict(
    [task({ date: '2026-10-08', startTime: '09:30', endTime: '10:30' })],
    generateTaskInputs(plan),
  )
  assert.equal(conflict?.date, '2026-10-08')
  assert.equal(conflict?.existingTask.title, '已有任务')
})

test('adjacent intervals do not conflict; deleted tasks and the edited task are ignored', () => {
  const candidate: TaskInput = { title: '新任务', date: '2026-10-04', startTime: '10:00', endTime: '11:00' }
  assert.equal(findFirstTimeConflict([task()], [candidate]), undefined)
  assert.equal(findFirstTimeConflict([task({ startTime: '10:00', endTime: '11:00', deletedAt: '2026-10-04T01:00:00Z' })], [candidate]), undefined)
  assert.equal(findFirstTimeConflict([task({ startTime: '10:00', endTime: '11:00' })], [candidate], 'existing'), undefined)
  assert.equal(findFirstTimeConflict([task({ startTime: '10:00', endTime: '11:00' })], [candidate])?.date, '2026-10-04')
})

test('overnight tasks conflict with the next calendar day when intervals overlap', () => {
  const priorNight = task({ date: '2026-10-04', startTime: '23:30', endTime: '00:30' })
  const nextMorning: TaskInput = { title: '早起', date: '2026-10-05', startTime: '00:15', endTime: '01:00' }
  assert.equal(findFirstTimeConflict([priorNight], [nextMorning])?.existingTask.id, 'existing')
  assert.equal(findFirstTimeConflict([priorNight], [{ ...nextMorning, startTime: '00:30' }]), undefined)
})

const copyDay: CopyDayInput = {
  sourceDate: '2026-10-04',
  startDate: '2026-10-05',
  endDate: '2026-10-06',
  frequency: 'daily',
}

test('copying a day preserves times and assigns a separate repeat group per source task', () => {
  const source = [
    task({ title: '上午学习', completed: true }),
    task({ id: 'afternoon', title: '下午阅读', startTime: '14:00', endTime: '15:30' }),
    task({ id: 'removed', title: '已删除', deletedAt: '2026-10-04T00:00:00Z' }),
    task({ id: 'other-day', date: '2026-10-03', title: '其他日期' }),
  ]
  const candidates = generateDayCopyInputs(source, copyDay)
  assert.deepEqual(candidates, [
    { title: '上午学习', date: '2026-10-05', startTime: '09:00', endTime: '10:00', repeatGroupId: 'existing' },
    { title: '下午阅读', date: '2026-10-05', startTime: '14:00', endTime: '15:30', repeatGroupId: 'afternoon' },
    { title: '上午学习', date: '2026-10-06', startTime: '09:00', endTime: '10:00', repeatGroupId: 'existing' },
    { title: '下午阅读', date: '2026-10-06', startTime: '14:00', endTime: '15:30', repeatGroupId: 'afternoon' },
  ])
  assert.equal(source[0].completed, true)
  assert.equal(findFirstTimeConflict(source, candidates), undefined)
})

test('copying a day preserves subtask titles and order without source ids or completion', () => {
  const source = [task({
    title: '背单词',
    subtasks: [
      { id: 'source-a', title: 'abandon', completed: true },
      { id: 'source-b', title: 'apple', completed: false },
    ],
  })]
  const candidates = generateDayCopyInputs(source, copyDay)

  assert.deepEqual(candidates.map((candidate) => candidate.subtasks), [
    [{ title: 'abandon' }, { title: 'apple' }],
    [{ title: 'abandon' }, { title: 'apple' }],
  ])
  assert.notEqual(candidates[0].subtasks, candidates[1].subtasks)
  assert.equal(findFirstTimeConflict([], candidates), undefined)
})

test('day copy skips its source date without shifting the selected frequency cycle', () => {
  for (const frequency of ['six-one', 'five-two'] as const) {
    const dates = generateDayCopyInputs([task()], {
      ...copyDay, startDate: '2026-10-04', endDate: '2026-10-11', frequency,
    }).map((candidate) => candidate.date)
    assert.deepEqual(dates, frequency === 'six-one'
      ? ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-11']
      : ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-11'])
  }
})

test('day copy rejects empty source, empty target and invalid or excessive date ranges', () => {
  assert.throws(() => generateDayCopyInputs([], copyDay), /没有可复制的计划/)
  assert.throws(() => generateDayCopyInputs([task({ deletedAt: '2026-10-04T00:00:00Z' })], copyDay), /没有可复制的计划/)
  assert.throws(() => generateDayCopyInputs([task()], {
    ...copyDay, startDate: '2026-10-04', endDate: '2026-10-04',
  }), /没有可复制的目标日期/)
  assert.throws(() => generateDayCopyInputs([task()], { ...copyDay, sourceDate: '2026-02-30' }), /有效日期/)
  assert.throws(() => generateDayCopyInputs([task()], { ...copyDay, endDate: '2026-10-03' }), /截止日期/)
  assert.throws(() => generateDayCopyInputs([task()], { ...copyDay, endDate: '2027-10-06' }), /最多 366 天/)
})

test('copied day conflicts with an existing task on any target date', () => {
  const candidates = generateDayCopyInputs([task()], copyDay)
  const conflict = findFirstTimeConflict([
    task(), task({ id: 'target-task', date: '2026-10-06', startTime: '09:30', endTime: '11:00' }),
  ], candidates)
  assert.equal(conflict?.date, '2026-10-06')
  assert.equal(conflict?.existingTask.id, 'target-task')
})

test('copied plans detect overlapping source plans within the new batch', () => {
  const source = [task(), task({ id: 'overlapping', startTime: '09:30', endTime: '10:30' })]
  const conflict = findFirstTimeConflict(source, generateDayCopyInputs(source, copyDay))
  assert.equal(conflict?.date, '2026-10-05')
  assert.equal(conflict?.existingTask.date, '2026-10-05')
  assert.equal(conflict?.existingTask.startTime, '09:00')
})

test('consecutive copied dates detect overnight overlaps inside the new batch', () => {
  const source = [
    task({ title: '早起', startTime: '00:15', endTime: '01:00' }),
    task({ id: 'night', title: '夜间工作', startTime: '23:30', endTime: '00:30' }),
  ]
  const candidates = generateDayCopyInputs(source, {
    ...copyDay, startDate: '2026-10-06', endDate: '2026-10-07',
  })
  const conflict = findFirstTimeConflict(source, candidates)
  assert.equal(conflict?.date, '2026-10-07')
  assert.equal(conflict?.existingTask.date, '2026-10-06')
  assert.equal(conflict?.existingTask.title, '夜间工作')

  const adjacent = candidates.map((candidate) => candidate.title === '早起'
    ? { ...candidate, startTime: '00:30' } : candidate)
  assert.equal(findFirstTimeConflict(source, adjacent), undefined)
})

test('copy conflict analysis skips each conflicting target date as a complete day', () => {
  const candidates: TaskInput[] = [
    { title: '上午学习', date: '2026-10-07', startTime: '09:00', endTime: '10:00' },
    { title: '下午阅读', date: '2026-10-07', startTime: '14:00', endTime: '15:00' },
    { title: '上午学习', date: '2026-10-05', startTime: '09:00', endTime: '10:00' },
    { title: '下午阅读', date: '2026-10-05', startTime: '14:00', endTime: '15:00' },
    { title: '上午学习', date: '2026-10-06', startTime: '09:00', endTime: '10:00' },
    { title: '下午阅读', date: '2026-10-06', startTime: '14:00', endTime: '15:00' },
  ]
  const analysis = analyzeCopyConflicts([
    task({ id: 'morning-conflict', date: '2026-10-05', startTime: '09:30', endTime: '09:45' }),
    task({ id: 'afternoon-conflict', date: '2026-10-07', startTime: '13:30', endTime: '14:30' }),
  ], candidates)

  assert.deepEqual(analysis.conflictDates, ['2026-10-05', '2026-10-07'])
  assert.deepEqual(analysis.conflicts.map((conflict) => conflict.existingTask.id), [
    'afternoon-conflict', 'morning-conflict',
  ])
  assert.deepEqual(analysis.safeCandidates, candidates.filter((candidate) => candidate.date === '2026-10-06'))
  assert.deepEqual(analysis.batchConflicts, [])
})

test('copy conflict analysis ignores deleted tasks and keeps all safe candidates', () => {
  const candidates: TaskInput[] = [
    { title: '学习', date: '2026-10-05', startTime: '09:00', endTime: '10:00' },
    { title: '学习', date: '2026-10-06', startTime: '09:00', endTime: '10:00' },
  ]
  const analysis = analyzeCopyConflicts([
    task({ date: '2026-10-05', startTime: '09:30', endTime: '10:30', deletedAt: '2026-10-04T01:00:00Z' }),
  ], candidates)

  assert.deepEqual(analysis.conflictDates, [])
  assert.deepEqual(analysis.conflicts, [])
  assert.deepEqual(analysis.safeCandidates, candidates)
})

test('copy conflict analysis reports overlapping templates separately and cancels safe output', () => {
  const candidates: TaskInput[] = [
    { title: '第一项', date: '2026-10-05', startTime: '09:00', endTime: '10:00' },
    { title: '第二项', date: '2026-10-05', startTime: '09:30', endTime: '10:30' },
    { title: '第一项', date: '2026-10-06', startTime: '09:00', endTime: '10:00' },
    { title: '第二项', date: '2026-10-06', startTime: '09:30', endTime: '10:30' },
  ]
  const analysis = analyzeCopyConflicts([], candidates)

  assert.deepEqual(analysis.conflictDates, [])
  assert.deepEqual(analysis.conflicts, [])
  assert.equal(analysis.batchConflicts.length, 2)
  assert.ok(analysis.batchConflicts.every((conflict) => conflict.kind === 'batch'))
  assert.deepEqual(analysis.safeCandidates, [])
})

test('copy conflict analysis reports overnight candidate overlap across adjacent target dates', () => {
  const candidates: TaskInput[] = [
    { title: '夜间工作', date: '2026-10-05', startTime: '23:30', endTime: '00:30' },
    { title: '早起', date: '2026-10-06', startTime: '00:15', endTime: '01:00' },
  ]
  const analysis = analyzeCopyConflicts([], candidates)

  assert.equal(analysis.batchConflicts.length, 1)
  assert.equal(analysis.batchConflicts[0].date, '2026-10-06')
  assert.equal(analysis.batchConflicts[0].existingTask.title, '夜间工作')
  assert.deepEqual(analysis.safeCandidates, [])
})

test('copy conflict analysis assigns overnight existing conflicts to the candidate target day', () => {
  const candidates: TaskInput[] = [
    { title: '夜间复制', date: '2026-10-06', startTime: '23:30', endTime: '00:30' },
    { title: '次日计划', date: '2026-10-07', startTime: '09:00', endTime: '10:00' },
  ]
  const analysis = analyzeCopyConflicts([
    task({ id: 'next-day-existing', date: '2026-10-07', startTime: '00:15', endTime: '01:00' }),
  ], candidates)

  assert.deepEqual(analysis.conflictDates, ['2026-10-06'])
  assert.equal(analysis.conflicts[0].existingTask.id, 'next-day-existing')
  assert.deepEqual(analysis.safeCandidates, [candidates[1]])
})
