import { useEffect, useId, useMemo, useState } from 'react'
import type { Task, TaskInput } from '../tasks'
import { analyzeImportedTasks, parseImportedTasks, type ParsedTask } from '../utils/parseImportedTasks'
import { CloseIcon, TrashIcon } from './Icons'
import './BulkImportModal.css'

export type BulkImportStats = {
  imported: number
  duplicate: number
  invalid: number
  conflict: number
}

type Props = {
  date: string
  tasks: Task[]
  noticeOpen: boolean
  onClose: () => void
  onImport: (inputs: TaskInput[], stats: BulkImportStats) => void
}

function rowMessage(row: ParsedTask): string | undefined {
  if (!row.valid) return row.error ?? '格式错误'
  if (row.duplicate) return '与已有计划重复，将自动跳过'
  if (row.conflict) return '与其他计划时间冲突，仍可导入'
  return undefined
}

export function BulkImportModal({ date, tasks, noticeOpen, onClose, onImport }: Props) {
  const titleId = useId()
  const [importDate, setImportDate] = useState(date)
  const [text, setText] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedTask[] | null>(null)
  const [error, setError] = useState('')
  const previewRows = useMemo(
    () => parsedRows ? analyzeImportedTasks(parsedRows, importDate, tasks) : [],
    [importDate, parsedRows, tasks],
  )
  const stats = useMemo<BulkImportStats>(() => ({
    imported: previewRows.filter((row) => row.valid && !row.duplicate).length,
    duplicate: previewRows.filter((row) => row.valid && row.duplicate).length,
    invalid: previewRows.filter((row) => !row.valid).length,
    conflict: previewRows.filter((row) => row.valid && !row.duplicate && row.conflict).length,
  }), [previewRows])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !noticeOpen) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [noticeOpen, onClose])

  function changeText(value: string) {
    setText(value)
    setParsedRows(null)
    setError('')
  }

  function parseText() {
    if (!text.trim()) {
      setParsedRows(null)
      setError('请先粘贴每日计划')
      return
    }
    const rows = parseImportedTasks(text)
    if (rows.length === 0) {
      setParsedRows(null)
      setError('没有可解析的计划，请检查输入内容')
      return
    }
    setParsedRows(rows)
    setError('')
  }

  function removeRow(id: string) {
    setParsedRows((current) => current?.filter((row) => row.id !== id) ?? null)
  }

  function confirmImport() {
    const inputs = previewRows
      .filter((row) => row.valid && !row.duplicate)
      .map<TaskInput>((row) => ({
        date: importDate,
        title: row.title,
        startTime: row.startTime,
        endTime: row.endTime,
      }))
    if (inputs.length === 0) return
    onImport(inputs, stats)
  }

  return (
    <div className="dialog-backdrop bulk-import-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="task-dialog bulk-import-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="dialog-head">
          <div>
            <span className="eyebrow">todo</span>
            <h2 id={titleId}>批量导入每日计划</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><CloseIcon size={18} /></button>
        </div>

        <div className="bulk-import-date-row">
          <div>
            <label className="field-label" htmlFor="bulk-import-date">导入日期</label>
            <input
              id="bulk-import-date"
              className="text-field"
              type="date"
              required
              value={importDate}
              onChange={(event) => { setImportDate(event.target.value); setError('') }}
            />
          </div>
          <p>计划将导入到所选日期。</p>
        </div>

        <label className="field-label" htmlFor="bulk-import-text">计划文本</label>
        <textarea
          id="bulk-import-text"
          className="text-field bulk-import-textarea"
          autoFocus
          spellCheck={false}
          placeholder={'每行一条计划，例如：\n07:00-07:30 起床\n07:30-08:00 跑步'}
          value={text}
          onChange={(event) => changeText(event.target.value)}
        />
        <div className="bulk-import-parse-row">
          <p className="form-note">支持 -、~ 和 – 分隔开始与结束时间。</p>
          <button className="button button-secondary" type="button" onClick={parseText}>解析计划</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        {parsedRows && <div className="bulk-import-preview" aria-live="polite">
          <div className="bulk-import-summary">
            <strong>已识别 {previewRows.length} 条计划</strong>
            <div className="bulk-import-counts">
              <span className="is-valid">有效 {previewRows.length - stats.invalid} 条</span>
              <span className="is-warning">冲突 {stats.conflict} 条</span>
              <span className="is-warning">重复 {stats.duplicate} 条</span>
              <span className="is-invalid">错误 {stats.invalid} 条</span>
            </div>
          </div>
          {previewRows.length > 0 ? <ul className="bulk-import-list">
            {previewRows.map((row) => {
              const state = !row.valid ? 'invalid' : row.duplicate || row.conflict ? 'warning' : 'valid'
              return <li className={`bulk-import-item is-${state}`} key={row.id}>
                <span className="bulk-import-state" aria-hidden="true">{state === 'valid' ? '✓' : state === 'warning' ? '⚠' : '✕'}</span>
                <div className="bulk-import-item-content">
                  <strong>{row.valid ? `${row.startTime}-${row.endTime} ${row.title}` : row.rawText}</strong>
                  {rowMessage(row) && <span>{rowMessage(row)}</span>}
                </div>
                <button className="icon-button" type="button" aria-label={`删除 ${row.rawText}`} title="删除该条" onClick={() => removeRow(row.id)}><TrashIcon size={14} /></button>
              </li>
            })}
          </ul> : <p className="bulk-import-empty">预览中没有计划。</p>}
        </div>}

        <div className="dialog-actions bulk-import-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>取消</button>
          <button className="button button-primary" type="button" disabled={!parsedRows || stats.imported === 0 || !importDate} onClick={confirmImport}>确认导入</button>
        </div>
      </section>
    </div>
  )
}
