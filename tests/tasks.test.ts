import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createTasksFromInputs,
  deleteOneTask,
  deleteTaskGroup,
  findCurrentTask,
  getDailyTaskSummary,
  getRemainingTime,
  getTaskEnd,
  getTaskGroup,
  getTaskStatus,
  readTasks,
  toggleSubtaskCompletion,
  toggleTaskCompletion,
  updateTaskFromInput,
  type Task,
  type TaskInput,
} from '../src/tasks.ts'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test',
    title: '测试任务',
    date: '2026-10-04',
    startTime: '09:00',
    endTime: '11:30',
    completed: false,
    createdAt: '2026-10-04T00:00:00.000Z',
    ...overrides,
  }
}

test('current task and countdown follow local time', () => {
  const active = task()
  const now = new Date(2026, 9, 4, 10, 20)
  assert.equal(getTaskStatus(active, now), 'active')
  assert.equal(findCurrentTask([active], now)?.id, 'test')
  assert.equal(getRemainingTime(active, now), 70 * 60 * 1000)
})

test('midnight end belongs to the next day and is exclusive', () => {
  const overnight = task({ startTime: '23:30', endTime: '00:00' })
  assert.equal(getTaskEnd(overnight).getDate(), 5)
  assert.equal(getTaskStatus(overnight, new Date(2026, 9, 4, 23, 45)), 'active')
  assert.equal(getTaskStatus(overnight, new Date(2026, 9, 5, 0, 0)), 'pending')
})

test('an overnight task remains current after the date changes', () => {
  const overnight = task({ startTime: '23:30', endTime: '00:30' })
  const now = new Date(2026, 9, 5, 0, 15)
  assert.equal(findCurrentTask([overnight], now)?.id, 'test')
  assert.equal(getRemainingTime(overnight, now), 15 * 60 * 1000)
})

test('completed tasks never become current', () => {
  const done = task({ completed: true })
  const now = new Date(2026, 9, 4, 10, 20)
  assert.equal(getTaskStatus(done, now), 'completed')
  assert.equal(findCurrentTask([done], now), undefined)
})

test('deleting one task removes it from the task collection', () => {
  const tasks = [task(), task({ id: 'other', startTime: '10:00', endTime: '12:00' })]
  assert.deepEqual(deleteOneTask(tasks, 'test').map((item) => item.id), ['other'])
  assert.equal(deleteOneTask(tasks, 'missing').length, 2)
})

test('tasks created in one repeated plan share a generated group', () => {
  const inputs: TaskInput[] = [
    { title: ' 阅读 ', date: '2026-10-04', startTime: '18:00', endTime: '19:00' },
    { title: '阅读', date: '2026-10-05', startTime: '18:00', endTime: '19:00' },
    { title: '英语', date: '2026-10-04', startTime: '19:00', endTime: '20:00' },
  ]
  let sequence = 0
  const created = createTasksFromInputs(inputs, '2026-10-04T00:00:00.000Z', () => `id-${++sequence}`)

  assert.equal(created[0].repeatGroupId, created[1].repeatGroupId)
  assert.notEqual(created[0].repeatGroupId, created[2].repeatGroupId)
  assert.equal(created[0].title, '阅读')
  assert.ok(created.every((item) => item.completed === false))
})

test('repeated task instances deep-copy subtasks with fresh ids and reset completion', () => {
  const inputs: TaskInput[] = [
    {
      title: '背单词',
      date: '2026-10-04',
      startTime: '07:00',
      endTime: '08:00',
      subtasks: [
        { id: 'source-a', title: ' abandon ', completed: true },
        { id: 'source-b', title: 'apple', completed: true },
      ],
    },
    {
      title: '背单词',
      date: '2026-10-05',
      startTime: '07:00',
      endTime: '08:00',
      subtasks: [
        { id: 'source-a', title: 'abandon', completed: true },
        { id: 'source-b', title: 'apple', completed: true },
      ],
    },
  ]
  let sequence = 0
  const created = createTasksFromInputs(inputs, '2026-10-04T00:00:00.000Z', () => `id-${++sequence}`)

  assert.deepEqual(created.map((item) => item.subtasks?.map((subtask) => subtask.title)), [
    ['abandon', 'apple'],
    ['abandon', 'apple'],
  ])
  assert.ok(created.every((item) => item.completed === false))
  assert.ok(created.every((item) => item.subtasks?.every((subtask) => subtask.completed === false)))
  assert.notEqual(created[0].subtasks?.[0].id, 'source-a')
  assert.notEqual(created[0].subtasks?.[0].id, created[1].subtasks?.[0].id)
  assert.notEqual(created[0].subtasks, created[1].subtasks)
})

test('parent completion cascades to every subtask', () => {
  const withSubtasks = task({
    subtasks: [
      { id: 'word-a', title: 'abandon', completed: false },
      { id: 'word-b', title: 'apple', completed: true },
    ],
  })

  const completed = toggleTaskCompletion([withSubtasks], 'test')[0]
  assert.equal(completed.completed, true)
  assert.ok(completed.subtasks?.every((subtask) => subtask.completed))

  const reopened = toggleTaskCompletion([completed], 'test')[0]
  assert.equal(reopened.completed, false)
  assert.ok(reopened.subtasks?.every((subtask) => !subtask.completed))
})

test('subtask completion controls parent completion when all children are done', () => {
  const withSubtasks = task({
    subtasks: [
      { id: 'word-a', title: 'abandon', completed: false },
      { id: 'word-b', title: 'apple', completed: true },
    ],
  })

  const completed = toggleSubtaskCompletion([withSubtasks], 'test', 'word-a')[0]
  assert.equal(completed.completed, true)
  assert.ok(completed.subtasks?.every((subtask) => subtask.completed))

  const reopened = toggleSubtaskCompletion([completed], 'test', 'word-b')[0]
  assert.equal(reopened.completed, false)
  assert.equal(reopened.subtasks?.find((subtask) => subtask.id === 'word-b')?.completed, false)
  assert.equal(toggleSubtaskCompletion([reopened], 'test', 'missing')[0], reopened)
})

test('editing subtasks preserves known ids and creates ids only for new children', () => {
  const withSubtasks = task({
    subtasks: [{ id: 'word-a', title: '旧标题', completed: true }],
    completed: true,
  })
  let sequence = 0
  const updated = updateTaskFromInput([withSubtasks], 'test', {
    subtasks: [
      { id: 'word-a', title: ' 新标题 ' },
      { title: '新增', completed: false },
    ],
  }, () => `new-${++sequence}`)[0]

  assert.deepEqual(updated.subtasks, [
    { id: 'word-a', title: '新标题', completed: true },
    { id: 'new-1', title: '新增', completed: false },
  ])
  assert.equal(updated.completed, false)
})

test('temporary copy keys are remapped to fresh groups and keep source plans separate', () => {
  const inputs: TaskInput[] = [
    { title: '阅读', date: '2026-10-05', startTime: '18:00', endTime: '19:00', repeatGroupId: 'source-a' },
    { title: '阅读', date: '2026-10-06', startTime: '18:00', endTime: '19:00', repeatGroupId: 'source-a' },
    { title: '阅读', date: '2026-10-05', startTime: '18:00', endTime: '19:00', repeatGroupId: 'source-b' },
  ]
  let sequence = 0
  const created = createTasksFromInputs(inputs, '2026-10-04T00:00:00.000Z', () => `id-${++sequence}`)

  assert.equal(created[0].repeatGroupId, created[1].repeatGroupId)
  assert.notEqual(created[0].repeatGroupId, 'source-a')
  assert.notEqual(created[2].repeatGroupId, 'source-b')
  assert.notEqual(created[0].repeatGroupId, created[2].repeatGroupId)
})

test('group deletion removes every date in the chosen generated group only', () => {
  const tasks = [
    task({ id: 'group-a-1', date: '2026-10-04', repeatGroupId: 'group-a' }),
    task({ id: 'group-a-2', date: '2026-10-05', repeatGroupId: 'group-a' }),
    task({ id: 'group-b', date: '2026-10-05', repeatGroupId: 'group-b' }),
  ]

  assert.deepEqual(getTaskGroup(tasks, 'group-a-1').map((item) => item.id), ['group-a-1', 'group-a-2'])
  assert.deepEqual(deleteTaskGroup(tasks, 'group-a-1').map((item) => item.id), ['group-b'])
})

test('legacy repeated tasks use creation time and plan details as a safe fallback group', () => {
  const tasks = [
    task({ id: 'legacy-1', date: '2026-10-04' }),
    task({ id: 'legacy-2', date: '2026-10-05' }),
    task({ id: 'different-title', date: '2026-10-05', title: '另一项任务' }),
    task({ id: 'different-time', date: '2026-10-05', startTime: '10:00' }),
    task({ id: 'different-batch', date: '2026-10-05', createdAt: '2026-10-04T00:00:01.000Z' }),
    task({ id: 'formal-group', date: '2026-10-05', repeatGroupId: 'formal' }),
  ]

  assert.deepEqual(getTaskGroup(tasks, 'legacy-1').map((item) => item.id), ['legacy-1', 'legacy-2'])
  assert.deepEqual(deleteTaskGroup(tasks, 'legacy-1').map((item) => item.id), [
    'different-title',
    'different-time',
    'different-batch',
    'formal-group',
  ])
})

test('loading stored tasks permanently drops records left by the old soft-delete behavior', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => JSON.stringify([
        task({ id: 'kept' }),
        task({ id: 'old-removed', deletedAt: '2026-10-04T02:20:00.000Z' }),
      ]),
    },
  })

  try {
    const loaded = readTasks()
    assert.deepEqual(loaded.map((item) => item.id), ['kept'])
    assert.deepEqual(loaded[0].subtasks, [])
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('first launch starts with an empty schedule instead of preset plans', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null },
  })

  try {
    assert.deepEqual(readTasks(), [])
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('loading stored tasks removes legacy preset plans but keeps user plans', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => JSON.stringify([
        task({ id: 'sample-2026-10-07-1', title: '旧预设计划' }),
        task({ id: 'user-plan', title: '用户计划' }),
      ]),
    },
  })

  try {
    const loaded = readTasks()
    assert.deepEqual(loaded.map((item) => item.id), ['user-plan'])
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('daily summary stays consistent after a task is permanently deleted', () => {
  const tasks = [
    task({ id: 'late', startTime: '11:00' }),
    task({ id: 'removed', startTime: '07:00', completed: true }),
    task({ id: 'done', startTime: '09:00', completed: true }),
    task({ id: 'early', startTime: '08:00' }),
    task({ id: 'another-day', date: '2026-10-05', completed: true }),
  ]
  const summary = getDailyTaskSummary(deleteOneTask(tasks, 'removed'), '2026-10-04')

  assert.deepEqual(summary.todayTasks.map((item) => item.id), ['early', 'done', 'late'])
  assert.deepEqual(summary.removedTasks, [])
  assert.deepEqual(summary.timelineTasks.map((item) => item.id), ['early', 'done', 'late'])
  assert.equal(summary.total, 3)
  assert.equal(summary.completed, 1)
  assert.equal(summary.pending, 2)
  assert.equal(summary.total, summary.completed + summary.pending)
  assert.equal(summary.progress, 33)

  const empty = getDailyTaskSummary(tasks, '2026-10-06')
  assert.equal(empty.total, 0)
  assert.equal(empty.progress, 0)
})

test('daily statistics count parent tasks only, regardless of subtask count', () => {
  const summary = getDailyTaskSummary([
    task({
      id: 'parent',
      completed: false,
      subtasks: [
        { id: 'child-a', title: '步骤一', completed: true },
        { id: 'child-b', title: '步骤二', completed: false },
      ],
    }),
  ], '2026-10-04')

  assert.equal(summary.total, 1)
  assert.equal(summary.completed, 0)
  assert.equal(summary.pending, 1)
})
