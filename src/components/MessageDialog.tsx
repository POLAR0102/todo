import { useEffect } from 'react'
import { CloseIcon } from './Icons'

type Props = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export function MessageDialog({ title, message, confirmLabel = '知道了', cancelLabel, onConfirm, onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="dialog-backdrop message-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="task-dialog message-dialog" role="alertdialog" aria-modal="true" aria-labelledby="message-dialog-title" aria-describedby="message-dialog-description">
      <div className="dialog-head">
        <div><span className="eyebrow">todo</span><h2 id="message-dialog-title">{title}</h2></div>
        <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><CloseIcon size={18} /></button>
      </div>
      <p id="message-dialog-description" className="message-text">{message}</p>
      <div className="dialog-actions">
        {cancelLabel && <button className="button button-secondary" type="button" onClick={onClose}>{cancelLabel}</button>}
        <button className="button button-primary" type="button" autoFocus onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>
}
