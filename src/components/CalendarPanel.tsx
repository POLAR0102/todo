import { useMemo, useState } from 'react'
import {
  CALENDAR_WEEKDAYS,
  buildCalendarDays,
  calendarDateLabel,
  calendarTaskState,
  calendarTaskTime,
  formatCalendarMonth,
  monthFromDate,
  moveCalendarMonth,
} from '../calendar'
import { formatDateKey, type Task } from '../tasks'
import { TrashIcon } from './Icons'
import './CalendarPanel.css'

type CalendarPanelProps = {
  tasks: Task[]
  now: Date
  onDeleteTask: (task: Task) => void
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
}

export function CalendarPanel({ tasks, now, onDeleteTask }: CalendarPanelProps) {
  const todayKey = formatDateKey(now)
  const [month, setMonth] = useState(() => monthFromDate(now))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const days = useMemo(() => buildCalendarDays(tasks, month, now), [tasks, month, now])
  const selectedTasks = useMemo(() => tasks
    .filter((task) => task.date === selectedDate && !task.deletedAt)
    .sort((left, right) => left.startTime.localeCompare(right.startTime) || left.title.localeCompare(right.title, 'zh-CN')), [tasks, selectedDate])

  function changeMonth(amount: number): void {
    const nextMonth = moveCalendarMonth(month, amount)
    setMonth(nextMonth)
    setSelectedDate(formatDateKey(nextMonth))
  }

  function returnToToday(): void {
    setMonth(monthFromDate(now))
    setSelectedDate(todayKey)
  }

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <div>
          <h1>计划日历</h1>
          <p>按日期查看每天的计划安排。</p>
        </div>
        <div className="calendar-controls" aria-label="切换月份">
          <button className="calendar-nav-button" type="button" aria-label="上个月" title="上个月" onClick={() => changeMonth(-1)}><ChevronIcon direction="left" /></button>
          <strong aria-live="polite">{formatCalendarMonth(month)}</strong>
          <button className="calendar-nav-button" type="button" aria-label="下个月" title="下个月" onClick={() => changeMonth(1)}><ChevronIcon direction="right" /></button>
          <button className="calendar-today-button" type="button" onClick={returnToToday}>回到今天</button>
        </div>
      </header>

      <section className="calendar-board" aria-label={`${formatCalendarMonth(month)}计划日历`}>
        <div className="calendar-weekdays" aria-hidden="true">
          {CALENDAR_WEEKDAYS.map((weekday) => <span key={weekday}>周{weekday}</span>)}
        </div>
        <div className="calendar-grid">
          {days.map((day) => {
            const hiddenCount = Math.max(0, day.tasks.length - 2)
            const selected = day.dateKey === selectedDate
            return <button
              className={`calendar-day ${day.inCurrentMonth ? '' : 'is-outside'} ${day.isToday ? 'is-today' : ''} ${selected ? 'is-selected' : ''}`}
              type="button"
              key={day.dateKey}
              aria-label={`${calendarDateLabel(day.dateKey)}，${day.tasks.length} 项计划`}
              aria-pressed={selected}
              onClick={() => setSelectedDate(day.dateKey)}
            >
              <span className="calendar-day-head"><b>{day.dayNumber}</b>{day.tasks.length > 0 && <em>{day.tasks.length}项</em>}</span>
              <span className="calendar-previews">
                {day.tasks.slice(0, 2).map((task) => <span className={`calendar-preview ${task.completed ? 'is-completed' : ''}`} title={`${task.startTime} ${task.title}`} key={task.id}>{task.title}</span>)}
                {hiddenCount > 0 && <span className="calendar-more">还有 {hiddenCount} 项</span>}
              </span>
            </button>
          })}
        </div>
      </section>

      <section className="calendar-detail" aria-label={`${calendarDateLabel(selectedDate)}计划详情`}>
        <div className="calendar-detail-head">
          <div><h2>{calendarDateLabel(selectedDate)}</h2>{selectedDate === todayKey && <span>今天</span>}</div>
          <small>{selectedTasks.length} 项计划</small>
        </div>
        {selectedTasks.length === 0 ? <div className="calendar-detail-empty">这一天还没有计划。</div> : <ul className="calendar-detail-list">
          {selectedTasks.map((task) => {
            const subtasks = task.subtasks ?? []
            const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length
            const state = calendarTaskState(task, now)
            return <li className="calendar-detail-row" key={task.id}>
              <time>{calendarTaskTime(task)}</time>
              <div className="calendar-detail-main"><strong title={task.title}>{task.title}</strong>{subtasks.length > 0 && <span>子任务 {completedSubtasks}/{subtasks.length}</span>}</div>
              <span className={`calendar-detail-state state-${state}`}>{state}</span>
              <button
                className="calendar-delete-button"
                type="button"
                aria-label={`删除 ${task.title}`}
                title="删除计划"
                onClick={() => onDeleteTask(task)}
              >
                <TrashIcon size={14} />
              </button>
            </li>
          })}
        </ul>}
      </section>
    </div>
  )
}
