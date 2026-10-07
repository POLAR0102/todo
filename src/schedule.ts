import type { Task, TaskInput } from './tasks'

export type Frequency = 'daily' | 'six-one' | 'five-two'

export type PlanInput = Omit<TaskInput, 'date'> & {
  startDate: string
  endDate: string
  frequency: Frequency
}

export type CopyDayInput = {
  sourceDate: string
  startDate: string
  endDate: string
  frequency: Frequency
}

export type TimeConflict = {
  date: string
  startTime: string
  endTime: string
  existingTask: Task
}

export type CopyConflict = TimeConflict & {
  candidate: TaskInput
  kind: 'existing' | 'batch'
}

export type CopyConflictAnalysis = {
  conflictDates: string[]
  conflicts: CopyConflict[]
  batchConflicts: CopyConflict[]
  safeCandidates: TaskInput[]
}

const MAX_PLAN_DAYS = 366

function parseDateKey(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError('请选择有效日期')
  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new RangeError('请选择有效日期')
  }
  return date
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseTime(value: string): [number, number] {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new RangeError('请选择有效时间')
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) throw new RangeError('请选择有效时间')
  return [hour, minute]
}

function taskInterval(task: TaskInput): [number, number] {
  const date = parseDateKey(task.date)
  const [startHour, startMinute] = parseTime(task.startTime)
  const [endHour, endMinute] = parseTime(task.endTime)
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute)
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMinute)
  if (end <= start) end.setDate(end.getDate() + 1)
  return [start.getTime(), end.getTime()]
}

function intervalsOverlap(first: [number, number], second: [number, number]): boolean {
  return first[0] < second[1] && second[0] < first[1]
}

function candidateAsTask(candidate: TaskInput, index: number): Task {
  const { subtasks, ...taskFields } = candidate
  return {
    ...taskFields,
    id: `candidate-${index}`,
    completed: false,
    createdAt: '',
    subtasks: subtasks?.map((subtask, subtaskIndex) => ({
      id: subtask.id ?? `candidate-${index}-subtask-${subtaskIndex}`,
      title: subtask.title,
      completed: subtask.completed ?? false,
    })),
  }
}

export function generateTaskInputs(input: PlanInput): TaskInput[] {
  const start = parseDateKey(input.startDate)
  const end = parseDateKey(input.endDate)
  parseTime(input.startTime)
  parseTime(input.endTime)
  if (input.startTime === input.endTime) throw new RangeError('开始时间和结束时间不能相同')
  if (start > end) throw new RangeError('截止日期不能早于开始日期')

  const onDays = input.frequency === 'daily' ? 7 : input.frequency === 'six-one' ? 6 : input.frequency === 'five-two' ? 5 : 0
  if (onDays === 0) throw new RangeError('请选择有效频率')

  const candidates: TaskInput[] = []
  const date = new Date(start)
  for (let offset = 0; date <= end; offset += 1, date.setDate(date.getDate() + 1)) {
    if (offset >= MAX_PLAN_DAYS) throw new RangeError(`日期范围最多 ${MAX_PLAN_DAYS} 天`)
    if (offset % 7 < onDays) {
      candidates.push({
        title: input.title.trim(),
        date: formatDateKey(date),
        startTime: input.startTime,
        endTime: input.endTime,
        ...(input.subtasks?.length ? {
          subtasks: input.subtasks.map((subtask) => ({ ...subtask })),
        } : {}),
      })
    }
  }
  return candidates
}

export function generateDayCopyInputs(tasks: Task[], input: CopyDayInput): TaskInput[] {
  parseDateKey(input.sourceDate)
  const sourceTasks = tasks.filter((task) => task.date === input.sourceDate && !task.deletedAt)
  if (sourceTasks.length === 0) throw new RangeError('所选来源日期没有可复制的计划')

  const candidates = sourceTasks.flatMap((task) => generateTaskInputs({
    title: task.title,
    startTime: task.startTime,
    endTime: task.endTime,
    ...(task.subtasks?.length ? {
      subtasks: task.subtasks.map((subtask) => ({ title: subtask.title })),
    } : {}),
    startDate: input.startDate,
    endDate: input.endDate,
    frequency: input.frequency,
  }).map((candidate) => ({
    ...candidate,
    repeatGroupId: task.id,
  }))).filter((task) => task.date !== input.sourceDate)
  if (candidates.length === 0) throw new RangeError('所选范围没有可复制的目标日期，请选择来源日期以外的日期')

  return candidates.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

export function findFirstTimeConflict(
  existingTasks: Task[],
  candidates: TaskInput[],
  excludedTaskId?: string,
): TimeConflict | undefined {
  const intervals = existingTasks
    .filter((task) => !task.deletedAt && task.id !== excludedTaskId)
    .map((task) => ({ task, interval: taskInterval(task) }))
  for (const candidate of candidates) {
    const [start, end] = taskInterval(candidate)
    for (const { task, interval: [existingStart, existingEnd] } of intervals) {
      if (start < existingEnd && existingStart < end) {
        return { date: candidate.date, startTime: candidate.startTime, endTime: candidate.endTime, existingTask: task }
      }
    }
    intervals.push({
      task: candidateAsTask(candidate, intervals.length),
      interval: [start, end],
    })
  }
  return undefined
}

export function analyzeCopyConflicts(
  existingTasks: Task[],
  candidates: TaskInput[],
): CopyConflictAnalysis {
  const existingIntervals = existingTasks
    .filter((task) => !task.deletedAt)
    .map((task) => ({ task, interval: taskInterval(task) }))
  const candidateIntervals = candidates.map((candidate, index) => ({
    candidate,
    task: candidateAsTask(candidate, index),
    interval: taskInterval(candidate),
  }))

  const conflicts: CopyConflict[] = []
  const conflictDateSet = new Set<string>()
  for (const candidateEntry of candidateIntervals) {
    for (const existingEntry of existingIntervals) {
      if (!intervalsOverlap(candidateEntry.interval, existingEntry.interval)) continue
      conflictDateSet.add(candidateEntry.candidate.date)
      conflicts.push({
        kind: 'existing',
        candidate: candidateEntry.candidate,
        date: candidateEntry.candidate.date,
        startTime: candidateEntry.candidate.startTime,
        endTime: candidateEntry.candidate.endTime,
        existingTask: existingEntry.task,
      })
    }
  }

  const batchConflicts: CopyConflict[] = []
  for (let firstIndex = 0; firstIndex < candidateIntervals.length; firstIndex += 1) {
    const first = candidateIntervals[firstIndex]
    for (let secondIndex = firstIndex + 1; secondIndex < candidateIntervals.length; secondIndex += 1) {
      const second = candidateIntervals[secondIndex]
      if (!intervalsOverlap(first.interval, second.interval)) continue
      const [earlier, later] = first.interval[0] <= second.interval[0]
        ? [first, second]
        : [second, first]
      batchConflicts.push({
        kind: 'batch',
        candidate: later.candidate,
        date: later.candidate.date,
        startTime: later.candidate.startTime,
        endTime: later.candidate.endTime,
        existingTask: earlier.task,
      })
    }
  }

  const conflictDates = [...conflictDateSet].sort()
  return {
    conflictDates,
    conflicts,
    batchConflicts,
    safeCandidates: batchConflicts.length > 0
      ? []
      : candidates.filter((candidate) => !conflictDateSet.has(candidate.date)),
  }
}
