import { findFirstTimeConflict } from '../schedule.ts'
import type { Task, TaskInput } from '../tasks.ts'

export interface ParsedTask {
  id: string
  rawText: string
  title: string
  startTime: string
  endTime: string
  valid: boolean
  error?: string
  conflict?: boolean
  duplicate?: boolean
}

let parsedTaskSequence = 0

function createParsedTaskId(): string {
  parsedTaskSequence += 1
  return `import-${Date.now()}-${parsedTaskSequence}`
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null

  return hour * 60 + minute
}

export function parseImportedTasks(
  text: string,
  idFactory: () => string = createParsedTaskId,
): ParsedTask[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rawText) => {
      const id = idFactory()
      const separatedParts = /^(\S*)\s*[-~–]\s*(.*)$/.exec(rawText)
      const possibleEnd = separatedParts?.[2].trim() ?? ''
      if (
        separatedParts
        && /^\d{2}:\d{2}$/.test(separatedParts[1])
        && (!possibleEnd || !/^[\d:]/.test(possibleEnd))
      ) {
        return {
          id,
          rawText,
          title: possibleEnd,
          startTime: separatedParts[1],
          endTime: '',
          valid: false,
          error: '缺少结束时间',
        }
      }
      const match = /^(\S+)\s*[-~–]\s*(\S+)(?:\s+(.+))?$/.exec(rawText)

      if (!match) {
        const startsWithTime = /^(\d{2}:\d{2})(?:\s+|$)/.exec(rawText)
        const missingStart = /^[-~–]\s*\d{2}:\d{2}(?:\s+|$)/.test(rawText)
        const missingEnd = /^\d{2}:\d{2}\s*[-~–]\s*$/.test(rawText) || Boolean(startsWithTime)
        return {
          id,
          rawText,
          title: startsWithTime ? rawText.slice(startsWithTime[0].length).trim() : '',
          startTime: startsWithTime?.[1] ?? '',
          endTime: '',
          valid: false,
          error: missingStart ? '缺少开始时间' : missingEnd ? '缺少结束时间' : '时间格式不正确',
        }
      }

      const [, startTime, endTime, rawTitle = ''] = match
      const title = rawTitle.trim()
      if (timeToMinutes(startTime) === null || timeToMinutes(endTime) === null) {
        return {
          id,
          rawText,
          title,
          startTime,
          endTime,
          valid: false,
          error: '时间格式不正确',
        }
      }

      if (!title) {
        return {
          id,
          rawText,
          title,
          startTime,
          endTime,
          valid: false,
          error: '任务名称不能为空',
        }
      }

      return {
        id,
        rawText,
        title,
        startTime,
        endTime,
        valid: true,
      }
    })
}

function duplicateKey(date: string, task: Pick<ParsedTask, 'title' | 'startTime' | 'endTime'>): string {
  return JSON.stringify([date, task.title.trim(), task.startTime, task.endTime])
}

function minuteInterval(task: ParsedTask): [number, number] | undefined {
  const start = timeToMinutes(task.startTime)
  const parsedEnd = timeToMinutes(task.endTime)
  if (start === null || parsedEnd === null) return undefined
  return [start, parsedEnd <= start ? parsedEnd + 24 * 60 : parsedEnd]
}

function intervalsOverlap(first: [number, number], second: [number, number]): boolean {
  return first[0] < second[1] && second[0] < first[1]
}

export function analyzeImportedTasks(parsed: ParsedTask[], date: string, existingTasks: Task[]): ParsedTask[] {
  const existingKeys = new Set(existingTasks
    .filter((task) => !task.deletedAt)
    .map((task) => duplicateKey(task.date, task)))
  const seenKeys = new Set<string>()
  const analyzed = parsed.map((task) => {
    if (!task.valid) return { ...task, duplicate: false, conflict: false }
    const key = duplicateKey(date, task)
    const duplicate = existingKeys.has(key) || seenKeys.has(key)
    seenKeys.add(key)
    return { ...task, duplicate, conflict: false }
  })

  const importable = analyzed
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.valid && !task.duplicate)

  for (const entry of importable) {
    const candidate: TaskInput = {
      date,
      title: entry.task.title,
      startTime: entry.task.startTime,
      endTime: entry.task.endTime,
    }
    try {
      if (findFirstTimeConflict(existingTasks, [candidate])) {
        analyzed[entry.index] = { ...analyzed[entry.index], conflict: true }
      }
    } catch {
      // An invalid date is handled by the date input without breaking the preview.
    }
  }

  for (let firstIndex = 0; firstIndex < importable.length; firstIndex += 1) {
    const first = importable[firstIndex]
    const firstInterval = minuteInterval(first.task)
    if (!firstInterval) continue
    for (let secondIndex = firstIndex + 1; secondIndex < importable.length; secondIndex += 1) {
      const second = importable[secondIndex]
      const secondInterval = minuteInterval(second.task)
      if (!secondInterval || !intervalsOverlap(firstInterval, secondInterval)) continue
      analyzed[first.index] = { ...analyzed[first.index], conflict: true }
      analyzed[second.index] = { ...analyzed[second.index], conflict: true }
    }
  }

  return analyzed
}
