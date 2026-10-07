import assert from 'node:assert/strict'
import test from 'node:test'
import { appearanceStyle, glassOpacity } from '../src/appearance.ts'

function composedOpacity(background: number, layer: number) {
  return background + (1 - background) * layer
}

test('both themes use composed glass layers driven by their own sliders', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const value of [0, 30, 67, 78, 86, 100]) {
      const glass = glassOpacity(value, theme)
      assert.ok(glass.app <= glass.panel && glass.panel <= glass.card)
      assert.ok(glass.panel <= glass.featured)
      assert.ok(Math.abs(composedOpacity(glass.app, glass.panelLayer) - glass.panel) < 1e-10)
      assert.ok(Math.abs(composedOpacity(glass.panel, glass.cardLayer) - glass.card) < 1e-10)
      assert.ok(Math.abs(composedOpacity(glass.panel, glass.featuredLayer) - glass.featured) < 1e-10)
      assert.ok(Number.isFinite(glass.dialogControlLayer))
    }
    assert.ok(glassOpacity(30, theme).card < glassOpacity(67, theme).card)
  }
  assert.equal(glassOpacity(67, 'light').card, 0.77)
  assert.ok(glassOpacity(100, 'light').card <= 0.85)
})

test('dark cards and dialogs follow dark opacity independently of light', () => {
  const low = appearanceStyle('dark', { light: 30, dark: 30 }) as Record<string, string>
  const high = appearanceStyle('dark', { light: 30, dark: 86 }) as Record<string, string>
  const light = appearanceStyle('light', { light: 30, dark: 86 }) as Record<string, string>
  assert.equal(high['--glass-app-opacity'], '0.86')
  assert.ok(Number(low['--glass-card-opacity']) < Number(high['--glass-card-opacity']))
  assert.ok(Number(low['--glass-featured-opacity']) < Number(high['--glass-featured-opacity']))
  assert.equal(light['--glass-app-opacity'], '0.3')
})
