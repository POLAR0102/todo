import { formatDateKey, getTaskEnd, getTaskStatus, type Task } from './tasks.ts'

export const CALENDAR_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const
export const CALENDAR_DAY_COUNT = 42

export type CalendarDay = {
  date: Date
  dateKey: string
  dayNumber: number
  inCurrentMonth: boolean
  isToday: boolean
  tasks: Task[]
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function firstGridDay(month: Date): Date {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  firstDay.setDate(firstDay.getDate() - mondayOffset)
  return firstDay
}

export function formatCalendarMonth(month: Date): string {
  return `${month.getFullYear()}年${month.getMonth() + 1}月`
}

export function buildCalendarDays(tasks: Task[], month: Date, today: Date = new Date()): CalendarDay[] {
  const start = firstGridDay(month)
  const todayKey = formatDateKey(today)
  const tasksByDate = new Map<string, Task[]>()

  for (const task of tasks) {
    if (task.deletedAt) continue
    const dateTasks = tasksByDate.get(task.date) ?? []
    dateTasks.push(task)
    tasksByDate.set(task.date, dateTasks)
  }

  for (const dateTasks of tasksByDate.values()) {
    dateTasks.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.title.localeCompare(right.title, 'zh-CN'))
  }

  return Array.from({ length: CALENDAR_DAY_COUNT }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const dateKey = formatDateKey(date)
    return {
      date,
      dateKey,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(),
      isToday: dateKey === todayKey,
      tasks: tasksByDate.get(dateKey) ?? [],
    }
  })
}

export function calendarTaskState(task: Task, now: Date): string {
  const status = getTaskStatus(task, now)
  if (status === 'completed') return '已完成'
  if (status === 'active') return '进行中'
  return getTaskEnd(task) <= now ? '未完成' : '等待开始'
}

export function calendarTaskTime(task: Task): string {
  return `${task.startTime} — ${task.endTime <= task.startTime ? `次日 ${task.endTime}` : task.endTime}`
}

export function calendarDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${month}月${day}日 星期${weekday}`
}

export function monthFromDate(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function moveCalendarMonth(month: Date, amount: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1)
}
