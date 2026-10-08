import type { NotificationSettings as NotificationSettingsValue } from '../notificationSettings'
import './NotificationSettings.css'

type Props = {
  settings: NotificationSettingsValue
  onChange: (patch: Partial<NotificationSettingsValue>) => void
  onPreview: () => void
}

export function NotificationSettings({ settings, onChange, onPreview }: Props) {
  return (
    <fieldset className="display-settings notification-settings">
      <legend>提醒设置</legend>
      <p>设置任务与休息提醒的提示音。</p>

      <label className="notification-setting-row notification-toggle-row">
        <span>
          <strong>通知声音</strong>
          <small>关闭后仍会显示通知。</small>
        </span>
        <span className="notification-switch-wrap">
          <input
            type="checkbox"
            role="switch"
            aria-label="通知声音"
            checked={settings.notificationSoundEnabled}
            onChange={(event) => onChange({ notificationSoundEnabled: event.target.checked })}
          />
          <span>{settings.notificationSoundEnabled ? '开启' : '关闭'}</span>
        </span>
      </label>

      <div className="notification-setting-row notification-preview-row">
        <span>
          <strong>提示音</strong>
          <small>默认提示音</small>
        </span>
        <button className="button button-secondary" type="button" onClick={onPreview}>试听</button>
      </div>

      <div className="notification-setting-row notification-volume-row">
        <label htmlFor="notification-volume">通知音量</label>
        <input
          id="notification-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={settings.notificationVolume}
          onChange={(event) => onChange({ notificationVolume: Number(event.target.value) })}
        />
        <output htmlFor="notification-volume">{settings.notificationVolume}%</output>
      </div>
    </fieldset>
  )
}
