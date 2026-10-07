import { getTaskEnd, type Task } from './tasks.ts'

const MAX_LATE_MS = 60_000

export function taskEndNotificationKey(task: Task): string {
  return `${task.id}:${getTaskEnd(task).getTime()}`
}

export function tasksEndingBetween(tasks: Task[], previousCheck: number, now: number, notifiedEnds: ReadonlySet<string>): Task[] {
  if (now <= previousCheck) return []

  const earliest = Math.max(previousCheck, now - MAX_LATE_MS)
  return tasks
    .filter((task) => {
      if (task.completed || task.deletedAt || notifiedEnds.has(taskEndNotificationKey(task))) return false
      const end = getTaskEnd(task).getTime()
      return end > earliest && end <= now
    })
    .sort((a, b) => getTaskEnd(a).getTime() - getTaskEnd(b).getTime())
}
