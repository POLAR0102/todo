import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { findFirstTimeConflict, generateTaskInputs, type Frequency, type PlanInput, type TimeConflict } from '../schedule'
import type { SubtaskInput, Task } from '../tasks'
import { CloseIcon, PlusIcon, TrashIcon } from './Icons'

type Props = {
  date: string
  task?: Task
  tasks: Task[]
  noticeOpen: boolean
  onClose: () => void
  onSave: (input: PlanInput) => void
  onConflict: (conflict: TimeConflict) => void
}

export function TaskDialog({ date, task, tasks, noticeOpen, onClose, onSave, onConflict }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [subtasks, setSubtasks] = useState<Array<SubtaskInput & { key: string }>>(() =>
    (task?.subtasks ?? []).map((subtask) => ({ ...subtask, key: subtask.id })),
  )
  const [startDate, setStartDate] = useState(task?.date ?? date)
  const [endDate, setEndDate] = useState(task?.date ?? date)
  const [startTime, setStartTime] = useState(task?.startTime ?? '09:00')
  const [endTime, setEndTime] = useState(task?.endTime ?? '10:00')
  const [frequency, setFrequency] = useState<Frequency>('daily')
  const [error, setError] = useState('')
  const [scheduleTouched, setScheduleTouched] = useState(false)
  const [changedTimes, setChangedTimes] = useState({ start: false, end: false })
  const lastConflictKey = useRef('')

  const input: PlanInput = {
    title: title.trim(), startDate, endDate: task ? startDate : endDate,
    startTime, endTime, frequency: task ? 'daily' : frequency,
    subtasks: subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title.trim(), completed: subtask.completed })),
  }
  const preview = useMemo(() => {
    try {
      const candidates = generateTaskInputs(input)
      return { conflict: findFirstTimeConflict(tasks, candidates, task?.id), error: '' }
    } catch (reason) {
      return { conflict: undefined, error: reason instanceof Error ? reason.message : '请选择有效的日期和时间' }
    }
  }, [title, startDate, endDate, startTime, endTime, frequency, task, tasks])
  const conflictKey = preview.conflict
    ? `${preview.conflict.date}|${preview.conflict.startTime}|${preview.conflict.endTime}|${preview.conflict.existingTask.id}`
    : ''

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !noticeOpen) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [noticeOpen, onClose])

  useEffect(() => {
    if (!changedTimes.start || !changedTimes.end || noticeOpen) return
    if (!conflictKey) {
      lastConflictKey.current = ''
      return
    }
    if (conflictKey !== lastConflictKey.current && preview.conflict) {
      lastConflictKey.current = conflictKey
      onConflict(preview.conflict)
    }
  }, [changedTimes, conflictKey, noticeOpen, onConflict, preview.conflict])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) {
      setError('请输入计划名称')
      return
    }
    if (subtasks.some((subtask) => !subtask.title.trim())) {
      setError('请输入子任务内容，或删除空白子任务')
      return
    }
    if (preview.error) {
      setError(preview.error)
      return
    }
    if (preview.conflict) {
      onConflict(preview.conflict)
      return
    }
    onSave(input)
  }

  function changedSchedule(timeField?: 'start' | 'end') {
    setScheduleTouched(true)
    setError('')
    if (timeField) setChangedTimes((current) => ({ ...current, [timeField]: true }))
  }

  function changeStartDate(value: string) { setStartDate(value); changedSchedule() }
  function changeEndDate(value: string) { setEndDate(value); changedSchedule() }
  function changeStartTime(value: string) { setStartTime(value); changedSchedule('start') }
  function changeEndTime(value: string) { setEndTime(value); changedSchedule('end') }

  function addSubtask() {
    if (subtasks.length >= 20) return
    setSubtasks((current) => [...current, { key: crypto.randomUUID(), title: '', completed: false }])
    setError('')
  }

  function updateSubtask(key: string, value: string) {
    setSubtasks((current) => current.map((subtask) => subtask.key === key ? { ...subtask, title: value } : subtask))
    setError('')
  }

  function removeSubtask(key: string) {
    setSubtasks((current) => current.filter((subtask) => subtask.key !== key))
    setError('')
  }

  return (
    <div className="dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">todo</span>
            <h2 id="task-dialog-title">{task ? '编辑计划' : '添加计划'}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><CloseIcon size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="task-title">计划名称</label>
          <input id="task-title" className="text-field" autoFocus maxLength={80} placeholder="例如：整理今天的工作" value={title} onChange={(event) => { setTitle(event.target.value); setError('') }} />
          <div className="subtask-editor">
            <div className="subtask-editor-head">
              <label className="field-label">子任务 <span>{subtasks.length}/20</span></label>
              <button className="subtask-add" type="button" disabled={subtasks.length >= 20} onClick={addSubtask}><PlusIcon size={14} />添加</button>
            </div>
            {subtasks.length > 0 && <div className="subtask-editor-list">
              {subtasks.map((subtask, index) => <div className="subtask-editor-row" key={subtask.key}>
                <span className="subtask-index" aria-hidden="true">{index + 1}</span>
                <input
                  className="text-field"
                  maxLength={80}
                  aria-label={`子任务 ${index + 1}`}
                  placeholder="输入子任务内容"
                  value={subtask.title}
                  onChange={(event) => updateSubtask(subtask.key, event.target.value)}
                />
                <button className="icon-button" type="button" aria-label={`删除子任务 ${index + 1}`} title="删除子任务" onClick={() => removeSubtask(subtask.key)}><TrashIcon size={14} /></button>
              </div>)}
            </div>}
            {subtasks.length === 0 && <p className="subtask-empty-note">可将计划拆成更小的步骤。</p>}
          </div>
          <div className="field-grid">
            <div>
              <label className="field-label" htmlFor="task-start-date">{task ? '计划日期' : '开始日期'}</label>
              <input id="task-start-date" className="text-field" type="date" required value={startDate} onInput={(event) => changeStartDate(event.currentTarget.value)} onChange={(event) => changeStartDate(event.currentTarget.value)} />
            </div>
            {!task && <div>
              <label className="field-label" htmlFor="task-end-date">截止日期</label>
              <input id="task-end-date" className="text-field" type="date" required min={startDate} value={endDate} onInput={(event) => changeEndDate(event.currentTarget.value)} onChange={(event) => changeEndDate(event.currentTarget.value)} />
            </div>}
          </div>
          {!task && <div className="frequency-field">
            <label className="field-label" htmlFor="task-frequency">安排频率</label>
            <select id="task-frequency" className="text-field" value={frequency} onChange={(event) => { setFrequency(event.target.value as Frequency); changedSchedule() }}>
              <option value="daily">每天</option>
              <option value="six-one">隔 6 休 1</option>
              <option value="five-two">隔 5 休 2</option>
            </select>
            <p className="form-note">休息周期从开始日期起算，日期范围最多 366 天。</p>
          </div>}
          <div className="field-grid">
            <div>
              <label className="field-label" htmlFor="task-start">开始时间</label>
              <input id="task-start" className="text-field" type="time" required aria-invalid={scheduleTouched && Boolean(preview.conflict)} value={startTime} onInput={(event) => changeStartTime(event.currentTarget.value)} onChange={(event) => changeStartTime(event.currentTarget.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="task-end">结束时间</label>
              <input id="task-end" className="text-field" type="time" required aria-invalid={scheduleTouched && Boolean(preview.conflict)} value={endTime} onInput={(event) => changeEndTime(event.currentTarget.value)} onChange={(event) => changeEndTime(event.currentTarget.value)} />
            </div>
          </div>
          <p className="form-note">结束时间早于开始时间时，视为次日结束。</p>
          {scheduleTouched && preview.conflict && <p className="form-error" role="alert">{preview.conflict.date} 的时间与「{preview.conflict.existingTask.title}」冲突，请调整时间。</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
            <button className="button button-primary" type="submit">{task ? '保存修改' : '添加计划'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
