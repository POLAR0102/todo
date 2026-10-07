import { useEffect, useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_APPEARANCE_OPACITY, glassOpacity, type ColorTheme } from './appearance'
import './notification.css'

const params = new URLSearchParams(window.location.search)

function taskTitle(value: string | null): string {
  const cleaned = (value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim()
  return Array.from(cleaned).slice(0, 100).join('') || '未命名任务'
}

function taskEndTime(value: string | null): string {
  return value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : ''
}

function themeOpacity(value: string | null, theme: ColorTheme): number {
  return value !== null && /^(100|[1-9]?\d)$/.test(value)
    ? Number(value)
    : DEFAULT_APPEARANCE_OPACITY[theme]
}

type NotificationAppearance = { theme: ColorTheme; opacity: number }
type NotificationBridge = {
  onAppearance: (callback: (appearance: NotificationAppearance) => void) => () => void
}

const initialTheme: ColorTheme = params.get('theme') === 'light' ? 'light' : 'dark'
const title = taskTitle(params.get('title'))
const endTime = taskEndTime(params.get('endTime'))
const initialOpacity = themeOpacity(params.get('opacity'), initialTheme)

function NotificationToast() {
  const [appearance, setAppearance] = useState<NotificationAppearance>({
    theme: initialTheme,
    opacity: initialOpacity,
  })

  useEffect(() => {
    const bridge = (window as Window & { dailyPlanNotification?: NotificationBridge }).dailyPlanNotification
    const unsubscribe = bridge?.onAppearance((next) => {
      if ((next.theme === 'light' || next.theme === 'dark') && Number.isInteger(next.opacity) && next.opacity >= 0 && next.opacity <= 100) {
        setAppearance(next)
      }
    })
    return () => unsubscribe?.()
  }, [])

  const cardStyle = { '--toast-opacity': String(glassOpacity(appearance.opacity, appearance.theme).featured) } as CSSProperties

  return <main className="notification-shell" data-theme={appearance.theme}>
    <section className="notification-card" style={cardStyle} role="status" aria-live="polite">
      <span className="notification-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v5l3.5 2" />
        </svg>
      </span>
      <div className="notification-content">
        <div className="notification-meta">
          <span>任务已结束</span>
          {endTime && <time>{endTime}</time>}
        </div>
        <strong className="notification-title" title={title}>{title}</strong>
        <p>这项计划的时间已到</p>
      </div>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<NotificationToast />)
