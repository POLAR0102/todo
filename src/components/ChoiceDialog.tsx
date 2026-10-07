import { useEffect, useId } from 'react'
import { CloseIcon } from './Icons'
import './ChoiceDialog.css'

type Props = {
  title: string
  message: string
  primaryLabel: string
  secondaryLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onPrimary: () => void
  onSecondary?: () => void
  onClose: () => void
}

export function ChoiceDialog({
  title,
  message,
  primaryLabel,
  secondaryLabel,
  cancelLabel = '取消',
  tone = 'default',
  onPrimary,
  onSecondary,
  onClose,
}: Props) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="dialog-backdrop choice-backdrop"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        className="task-dialog choice-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">todo</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        </div>
        <p id={descriptionId} className="choice-dialog-message">{message}</p>
        <div className="dialog-actions choice-dialog-actions">
          <button className="button button-secondary" type="button" autoFocus onClick={onClose}>
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary && <button className="button button-secondary choice-secondary-button" type="button" onClick={onSecondary}>
            {secondaryLabel}
          </button>}
          <button
            className={`button ${tone === 'danger' ? 'choice-danger-button' : 'button-primary'}`}
            type="button"
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
