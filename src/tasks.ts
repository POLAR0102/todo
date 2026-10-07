import { useEffect, useState } from 'react'

export type Subtask = {
  id: string
  title: string
  completed: boolean
}

export type SubtaskInput = {
  id?: string
  title: string
  completed?: boolean
}

export type Task = {
  id: string
  title: string
  startTime: string
  endTime: string
  completed: boolean
  date: string
  createdAt: string
  repeatGroupId?: string
  deletedAt?: string
  subtasks?: Subtask[]
}

export type TaskInput = Pick<Task, 'title' | 'startTime' | 'endTime' | 'date' | 'repeatGroupId'> & {
  subtasks?: SubtaskInput[]
}
export type TaskStatus = 'completed' | 'active' | 'pending' | 'deleted'

const STORAGE_KEY = 'daily-plan.tasks.v1'

const sampleSchedule: Array<[string, string, string]> = [
  ['08:00', '08:30', '整理今天的计划'],
  ['08:30', '10:00', '处理最重要的任务'],
  ['10:00', '10:20', '休息与活动'],
  ['10:20', '11:30', '推进项目进度'],
  ['11:30', '12:00', '整理上午成果'],
  ['14:00', '15:30', '专注工作'],
  ['15:30', '16:00', '回复消息与邮件'],
  ['16:00', '17:00', '学习与阅读'],
  ['17:00', '17:30', '复盘并安排明天'],
]

export function formatDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateAtTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

export function getTaskStart(task: Task): Date {
  return dateAtTime(task.date, task.startTime)
}

export function getTaskEnd(task: Task): Date {
  const start = getTaskStart(task)
  const end = dateAtTime(task.date, task.endTime)
  if (end <= start) end.setDate(end.getDate() + 1)
  return end
}

export function getTaskStatus(task: Task, now: Date = new Date()): TaskStatus {
  if (task.deletedAt) return 'deleted'
  if (task.completed) return 'completed'
  if (getTaskStart(task) <= now && now < getTaskEnd(task)) return 'active'
  return 'pending'
}

export function findCurrentTask(tasks: Task[], now: Date = new Date()): Task | undefined {
  return tasks
    .filter((task) => getTaskStatus(task, now) === 'active')
    .sort((a, b) => getTaskStart(a).getTime() - getTaskStart(b).getTime())[0]
}

export function getRemainingTime(task: Task, now: Date = new Date()): number {
  return Math.max(0, getTaskEnd(task).getTime() - now.getTime())
}

export function getDailyTaskSummary(tasks: Task[], date: string) {
  const todayTasks = tasks
    .filter((task) => task.date === date && !task.deletedAt)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const removedTasks = tasks
    .filter((task) => task.date === date && Boolean(task.deletedAt))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const total = todayTasks.length
  const completed = todayTasks.filter((task) => task.completed).length
  const pending = total - completed
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100)

  return {
    todayTasks,
    removedTasks,
    timelineTasks: [...todayTasks, ...removedTasks],
    total,
    completed,
    pending,
    progress,
  }
}

export function markTaskDeleted(tasks: Task[], id: string, deletedAt: string = new Date().toISOString()): Task[] {
  return tasks.map((task) => task.id === id && !task.deletedAt
    ? { ...task, deletedAt }
    : task)
}

export function restoreDeletedTask(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => {
    if (task.id !== id || !task.deletedAt) return task
    const restored = { ...task }
    delete restored.deletedAt
    return restored
  })
}

export function deleteOneTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((task) => task.id !== id)
}

function legacyRepeatGroupKey(task: Task): string {
  return JSON.stringify([task.createdAt, task.title, task.startTime, task.endTime])
}

export function getTaskGroup(tasks: Task[], id: string): Task[] {
  const target = tasks.find((task) => task.id === id)
  if (!target) return []
  if (target.repeatGroupId) {
    return tasks.filter((task) => task.repeatGroupId === target.repeatGroupId)
  }

  const legacyKey = legacyRepeatGroupKey(target)
  return tasks.filter((task) => !task.repeatGroupId && legacyRepeatGroupKey(task) === legacyKey)
}

export function deleteTaskGroup(tasks: Task[], id: string): Task[] {
  const groupedIds = new Set(getTaskGroup(tasks, id).map((task) => task.id))
  if (groupedIds.size === 0) return tasks
  return tasks.filter((task) => !groupedIds.has(task.id))
}

export function toggleTaskCompletion(tasks: Task[], id: string): Task[] {
  return tasks.map((task) => {
    if (task.id !== id || task.deletedAt) return task
    const completed = !task.completed
    return {
      ...task,
      completed,
      subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask, completed })),
    }
  })
}

export function toggleSubtaskCompletion(tasks: Task[], taskId: string, subtaskId: string): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId || task.deletedAt) return task
    let found = false
    const subtasks = (task.subtasks ?? []).map((subtask) => {
      if (subtask.id !== subtaskId) return subtask
      found = true
      return { ...subtask, completed: !subtask.completed }
    })
    if (!found) return task
    return {
      ...task,
      subtasks,
      completed: subtasks.length > 0 && subtasks.every((subtask) => subtask.completed),
    }
  })
}

function createSampleTasks(): Task[] {
  const date = formatDateKey()
  const createdAt = new Date().toISOString()
  return sampleSchedule.map(([startTime, endTime, title], index) => ({
    id: `sample-${date}-${index + 1}`,
    title,
    startTime,
    endTime,
    completed: false,
    date,
    createdAt,
    subtasks: [],
  }))
}

function normalizeStoredSubtasks(value: unknown): Subtask[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const candidate = entry as Partial<Subtask>
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : ''
    if (!title) return []
    return [{
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createId(),
      title,
      completed: candidate.completed === true,
    }]
  })
}

export function readTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === null) return createSampleTasks()
    const parsed: unknown = JSON.parse(saved)
    if (Array.isArray(parsed)) {
      return (parsed as Task[])
        .filter((task) => !task.deletedAt)
        .map((task) => ({ ...task, subtasks: normalizeStoredSubtasks(task.subtasks) }))
    }
  } catch {
    // Keep the first-run schedule usable if local storage is unavailable.
  }
  return createSampleTasks()
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function inputGroupKey(input: TaskInput): string {
  const suppliedKey = input.repeatGroupId?.trim()
  return suppliedKey
    ? `supplied:${suppliedKey}`
    : `plan:${JSON.stringify([input.title.trim(), input.startTime, input.endTime])}`
}

export function createTasksFromInputs(
  inputs: TaskInput[],
  createdAt: string = new Date().toISOString(),
  idFactory: () => string = createId,
): Task[] {
  const groupIds = new Map<string, string>()
  return inputs.map((input): Task => {
    const groupKey = inputGroupKey(input)
    let repeatGroupId = groupIds.get(groupKey)
    if (!repeatGroupId) {
      repeatGroupId = `repeat-${idFactory()}`
      groupIds.set(groupKey, repeatGroupId)
    }

    const id = idFactory()
    const subtasks = (input.subtasks ?? [])
      .map((subtask) => ({ title: subtask.title.trim() }))
      .filter((subtask) => subtask.title)
      .map((subtask): Subtask => ({
        id: idFactory(),
        title: subtask.title,
        completed: false,
      }))

    return {
      ...input,
      title: input.title.trim(),
      repeatGroupId,
      id,
      completed: false,
      createdAt,
      subtasks,
    }
  })
}

export function updateTaskFromInput(
  tasks: Task[],
  id: string,
  patch: Partial<TaskInput>,
  idFactory: () => string = createId,
): Task[] {
  return tasks.map((task) => {
    if (task.id !== id) return task
    if (!patch.subtasks) {
      const { subtasks: _subtasks, ...taskPatch } = patch
      return { ...task, ...taskPatch, title: patch.title?.trim() ?? task.title }
    }

    const currentSubtasks = new Map((task.subtasks ?? []).map((subtask) => [subtask.id, subtask]))
    const subtasks = patch.subtasks
      .map((subtask) => {
        const existing = subtask.id ? currentSubtasks.get(subtask.id) : undefined
        return {
          id: existing?.id ?? idFactory(),
          title: subtask.title.trim(),
          completed: subtask.completed ?? existing?.completed ?? false,
        }
      })
      .filter((subtask) => subtask.title)

    return {
      ...task,
      ...patch,
      title: patch.title?.trim() ?? task.title,
      subtasks,
      completed: subtasks.length > 0 ? subtasks.every((subtask) => subtask.completed) : task.completed,
    }
  })
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(readTasks)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // Tasks remain usable for this session if the storage quota is unavailable.
    }
  }, [tasks])

  function addTasks(inputs: TaskInput[]): void {
    if (inputs.length === 0) return
    const added = createTasksFromInputs(inputs)
    setTasks((current) => [...current, ...added])
  }

  function addTask(input: TaskInput): void {
    addTasks([input])
  }

  function updateTask(id: string, patch: Partial<TaskInput>): void {
    setTasks((current) => updateTaskFromInput(current, id, patch))
  }

  function deleteTask(id: string, scope: 'one' | 'group' = 'one'): void {
    setTasks((current) => scope === 'group'
      ? deleteTaskGroup(current, id)
      : deleteOneTask(current, id))
  }

  function restoreTask(id: string): void {
    setTasks((current) => restoreDeletedTask(current, id))
  }

  function toggleCompleted(id: string): void {
    setTasks((current) => toggleTaskCompletion(current, id))
  }

  function toggleSubtask(taskId: string, subtaskId: string): void {
    setTasks((current) => toggleSubtaskCompletion(current, taskId, subtaskId))
  }

  return { tasks, addTask, addTasks, updateTask, deleteTask, restoreTask, toggleCompleted, toggleSubtask }
}
