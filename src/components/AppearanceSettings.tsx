import type { AppearanceOpacity, ColorTheme, ThemePreference } from '../appearance'
import { saveAppearanceOpacity } from '../appearance'
import './AppearanceSettings.css'

type Props = {
  themePreference: ThemePreference
  onThemeChange: (theme: ThemePreference) => void
  opacitySettings: AppearanceOpacity
  onOpacityChange: (theme: ColorTheme, value: number) => void
}

const themes: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
]

export function AppearanceSettings({ themePreference, onThemeChange, opacitySettings, onOpacityChange }: Props) {
  function changeOpacity(theme: ColorTheme, value: number) {
    saveAppearanceOpacity({ ...opacitySettings, [theme]: value })
    onOpacityChange(theme, value)
  }

  return (
    <fieldset className="display-settings">
      <legend>显示设置</legend>
      <p>选择界面的明暗外观。</p>
      <div className="theme-options">
        {themes.map(({ value, label }) => (
          <label className="theme-option" key={value}>
            <input type="radio" name="theme" value={value} checked={themePreference === value} onChange={() => onThemeChange(value)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="appearance-opacity-settings">
        {(['light', 'dark'] as const).map((theme) => (
          <div className="appearance-opacity-row" key={theme}>
            <label htmlFor={`opacity-${theme}`}>{theme === 'light' ? '浅色背景透明度' : '深色背景透明度'}</label>
            <input
              id={`opacity-${theme}`}
              type="range"
              min="0"
              max="100"
              step="1"
              value={100 - opacitySettings[theme]}
              onChange={(event) => changeOpacity(theme, 100 - Number(event.target.value))}
            />
            <output htmlFor={`opacity-${theme}`}>{100 - opacitySettings[theme]}%</output>
          </div>
        ))}
        <p className="appearance-opacity-note">跟随系统时，自动使用对应模式的透明度。</p>
      </div>
    </fieldset>
  )
}
