import type { CSSProperties } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorTheme = 'light' | 'dark'
export type AppearanceOpacity = Record<ColorTheme, number>

const OPACITY_STORAGE_KEY = 'dailyplan-background-opacity'

export const DEFAULT_APPEARANCE_OPACITY: AppearanceOpacity = {
  light: 78,
  dark: 86,
}

function validOpacity(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : fallback
}

export function loadAppearanceOpacity(): AppearanceOpacity {
  try {
    const saved = JSON.parse(window.localStorage.getItem(OPACITY_STORAGE_KEY) ?? '{}')
    return {
      light: validOpacity(saved.light, DEFAULT_APPEARANCE_OPACITY.light),
      dark: validOpacity(saved.dark, DEFAULT_APPEARANCE_OPACITY.dark),
    }
  } catch {
    return { ...DEFAULT_APPEARANCE_OPACITY }
  }
}

export function saveAppearanceOpacity(opacity: AppearanceOpacity) {
  try {
    window.localStorage.setItem(OPACITY_STORAGE_KEY, JSON.stringify(opacity))
  } catch {
    // Keep the current session's setting if storage is unavailable.
  }
}

const MAX_LIGHT_GLASS_OPACITY = 0.85
const GLASS_LAYERS = {
  light: { max: MAX_LIGHT_GLASS_OPACITY, panel: 0.05, card: 0.10, featured: 0.10 },
  dark: { max: 1, panel: 0.02, card: 0.04, featured: 0.10 },
} as const

function layerOpacity(target: number, background: number): number {
  // Convert a desired visible opacity into the alpha needed over an existing glass layer.
  if (background === 1) return 1
  return (target - background) / (1 - background)
}

export function glassOpacity(value: number, theme: ColorTheme) {
  const layers = GLASS_LAYERS[theme]
  const app = Math.min(value / 100, layers.max)
  const panel = Math.min(app + layers.panel, layers.max)
  const card = Math.min(app + layers.card, layers.max)
  const featured = Math.min(app + layers.featured, layers.max)
  const control = Math.min(card + 0.03, layers.max)
  const dialogControl = Math.min(featured + 0.03, layers.max)

  return {
    app,
    panel,
    card,
    featured,
    panelLayer: layerOpacity(panel, app),
    cardLayer: layerOpacity(card, panel),
    featuredLayer: layerOpacity(featured, panel),
    controlLayer: layerOpacity(control, card),
    dialogControlLayer: layerOpacity(dialogControl, featured),
  }
}

export function appearanceStyle(theme: ColorTheme, opacity: AppearanceOpacity): CSSProperties {
  // Both themes use the same layer calculation with theme-specific depths.
  const glass = glassOpacity(opacity[theme], theme)
  return {
    '--glass-app-opacity': String(glass.app),
    '--glass-panel-opacity': String(glass.panel),
    '--glass-panel-layer-opacity': String(glass.panelLayer),
    '--glass-card-layer-opacity': String(glass.cardLayer),
    '--glass-card-opacity': String(glass.card),
    '--glass-featured-layer-opacity': String(glass.featuredLayer),
    '--glass-featured-opacity': String(glass.featured),
    '--glass-control-layer-opacity': String(glass.controlLayer),
    '--glass-dialog-control-layer-opacity': String(glass.dialogControlLayer),
  } as CSSProperties
}
