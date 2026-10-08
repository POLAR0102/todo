import { getTaskEnd, getTaskStart, type Task } from './tasks.ts'

const MAX_LATE_MS = 60_000
export const FOCUS_REMINDER_INTERVAL_MS = 40 * 60_000

export type FocusReminder = {
  task: Task
  elapsedMinutes: number
  reminderAt: number
  key: string
}

export function taskStartNotificationKey(task: Task): string {
  return `${task.id}:${getTaskStart(task).getTime()}`
}

export function focusReminderKey(task: Task, reminderNumber: number): string {
  return `${task.id}:${getTaskStart(task).getTime()}:focus-${reminderNumber}`
}

function earliestAllowed(previousCheck: number, now: number): number | undefined {
  if (now <= previousCheck) return undefined
  return Math.max(previousCheck, now - MAX_LATE_MS)
}

export function tasksStartingBetween(
  tasks: Task[],
  previousCheck: number,
  now: number,
  notifiedStarts: ReadonlySet<string>,
): Task[] {
  const earliest = earliestAllowed(previousCheck, now)
  if (earliest === undefined) return []
  return tasks
    .filter((task) => {
      if (task.completed || task.deletedAt || notifiedStarts.has(taskStartNotificationKey(task))) return false
      const start = getTaskStart(task).getTime()
      return start > earliest && start <= now
    })
    .sort((a, b) => getTaskStart(a).getTime() - getTaskStart(b).getTime())
}

export function focusRemindersBetween(
  tasks: Task[],
  previousCheck: number,
  now: number,
  notifiedReminders: ReadonlySet<string>,
): FocusReminder[] {
  const earliest = earliestAllowed(previousCheck, now)
  if (earliest === undefined) return []
  const reminders: FocusReminder[] = []

  for (const task of tasks) {
    if (task.completed || task.deletedAt) continue
    const start = getTaskStart(task).getTime()
    const end = getTaskEnd(task).getTime()
    const firstNumber = Math.max(1, Math.floor((earliest - start) / FOCUS_REMINDER_INTERVAL_MS) + 1)
    const lastNumber = Math.floor((now - start) / FOCUS_REMINDER_INTERVAL_MS)

    for (let reminderNumber = firstNumber; reminderNumber <= lastNumber; reminderNumber += 1) {
      const reminderAt = start + reminderNumber * FOCUS_REMINDER_INTERVAL_MS
      if (reminderAt <= earliest || reminderAt > now || reminderAt > end) continue
      const key = focusReminderKey(task, reminderNumber)
      if (notifiedReminders.has(key)) continue
      reminders.push({ task, elapsedMinutes: reminderNumber * 40, reminderAt, key })
    }
  }

  return reminders.sort((a, b) => a.reminderAt - b.reminderAt)
}
