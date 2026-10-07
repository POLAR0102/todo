import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { findFirstTimeConflict, generateDayCopyInputs, type CopyDayInput, type Frequency } from '../schedule'
import { formatDateKey, type Task } from '../tasks'
import { CloseIcon } from './Icons'
import './CopyDayDialog.css'

type Props = {
  date: string
  tasks: Task[]
  noticeOpen: boolean
  onClose: () => void
  onSave: (input: CopyDayInput) => void
}

function followingDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return formatDateKey(new Date(year, month - 1, day + 1))
}

export function CopyDayDialog({ date, tasks, noticeOpen, onClose, onSave }: Props) {
  const [sourceDate, setSourceDate] = useState(date)
  const [startDate, setStartDate] = useState(() => followingDate(date))
  const [endDate, setEndDate] = useState(() => followingDate(date))
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [error, setError] = useState('')

  const sourceTasks = useMemo(() => tasks
    .filter((task) => task.date === sourceDate && !task.deletedAt)
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [tasks, sourceDate])
  const input: CopyDayInput = { sourceDate, startDate, endDate, frequency }
  const preview = useMemo(() => {
    try {
      const candidates = generateDayCopyInputs(tasks, { sourceDate, startDate, endDate, frequency })
      return {
        days: new Set(candidates.map((task) => task.date)).size,
        count: candidates.length,
        conflict: findFirstTimeConflict(tasks, candidates),
        error: '',
      }
    } catch (reason) {
      return { days: 0, count: 0, conflict: undefined, error: reason instanceof Error ? reason.message : '请选择有效的来源日期和目标日期' }
    }
  }, [tasks, sourceDate, startDate, endDate, frequency])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !noticeOpen) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [noticeOpen, onClose])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      generateDayCopyInputs(tasks, input)
      onSave(input)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法复制计划，请检查日期')
    }
  }

  return (
    <div className="dialog-backdrop" onPointerDown={(event) => { if (!noticeOpen && event.target === event.currentTarget) onClose() }}>
      <section className="task-dialog copy-day-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-day-dialog-title">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">todo</span>
            <h2 id="copy-day-dialog-title">复制一天计划</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><CloseIcon size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="copy-source-date">复制哪一天</label>
          <input id="copy-source-date" className="text-field" type="date" required autoFocus value={sourceDate} onChange={(event) => { setSourceDate(event.target.value); setError('') }} />
          <p className="form-note">来源日期共 {sourceTasks.length} 项计划，包含已完成的计划。</p>
          {sourceTasks.length > 0 ? (
            <ul className="copy-source-list" aria-label="来源计划预览">
              {sourceTasks.map((task) => (
                <li key={task.id}>
                  <span className="form-note copy-source-time">{task.startTime} — {task.endTime}{task.endTime <= task.startTime ? ' 次日' : ''}</span>
                  <span className="field-label copy-source-title" title={task.title}>{task.title}</span>
                </li>
              ))}
            </ul>
          ) : <p className="form-note copy-source-empty">这一天没有可复制的计划，请选择其他日期。</p>}
          <div className="field-grid">
            <div>
              <label className="field-label" htmlFor="copy-start-date">复制到 · 开始日期</label>
              <input id="copy-start-date" className="text-field" type="date" required value={startDate} onChange={(event) => { setStartDate(event.target.value); setError('') }} />
            </div>
            <div>
              <label className="field-label" htmlFor="copy-end-date">截止日期</label>
              <input id="copy-end-date" className="text-field" type="date" required min={startDate} value={endDate} onChange={(event) => { setEndDate(event.target.value); setError('') }} />
            </div>
          </div>
          <div className="frequency-field">
            <label className="field-label" htmlFor="copy-frequency">安排频率</label>
            <select id="copy-frequency" className="text-field" value={frequency} onChange={(event) => { setFrequency(event.target.value as Frequency); setError('') }}>
              <option value="daily">每天</option>
              <option value="six-one">隔 6 休 1</option>
              <option value="five-two">隔 5 休 2</option>
            </select>
            <p className="form-note">休息周期从开始日期起算，日期范围最多 366 天。</p>
          </div>
          <p className="field-label copy-day-summary" aria-live="polite">将复制到 {preview.days} 天，共 {preview.count} 项计划</p>
          <p className="form-note">新计划均为未完成；目标范围中的来源日会自动跳过。</p>
          {preview.conflict && <p className="form-error">检测到时间冲突。点击“复制计划”后，可以选择取消复制或跳过冲突日期。</p>}
          {(error || preview.error) && <p className="form-error" role="alert">{error || preview.error}</p>}
          <div className="dialog-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
            <button className="button button-primary" type="submit">复制计划</button>
          </div>
        </form>
      </section>
    </div>
  )
}
