import { describe, expect, it } from 'vitest'

import {
  contrastForeground,
  contrastRatio,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  normalizeHexColor,
  readableAccent,
  showroomThemeStyle,
  showroomThemeVars,
} from '@/lib/theme'

describe('showroom theme helpers', () => {
  it('normalizes valid hex colors and falls back for malformed values', () => {
    expect(normalizeHexColor('#B88A44', DEFAULT_PRIMARY_COLOR)).toBe('#b88a44')
    expect(normalizeHexColor('b88a44', DEFAULT_PRIMARY_COLOR)).toBe('#b88a44')
    expect(normalizeHexColor('amber', DEFAULT_PRIMARY_COLOR)).toBe(DEFAULT_PRIMARY_COLOR)
    expect(normalizeHexColor(null, DEFAULT_SECONDARY_COLOR)).toBe(DEFAULT_SECONDARY_COLOR)
  })

  it('chooses a readable foreground for filled surfaces', () => {
    expect(contrastForeground('#171717')).toBe('#ffffff')
    expect(contrastForeground('#f5f5f4')).toBe('#111111')
    // The amber is light enough that near-black text is the higher-contrast choice.
    expect(contrastForeground('#b88a44')).toBe('#111111')
  })

  it('derives an accent that meets normal-text contrast on white', () => {
    const accent = readableAccent('#facc15')

    expect(contrastRatio(accent, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(readableAccent('#b88a44'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(readableAccent('#0f766e'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('emits the full CSS variable set with tenant values', () => {
    const vars = showroomThemeVars({ primary: '#0f766e', secondary: '#0b1220' })

    expect(vars['--showroom-primary']).toBe('#0f766e')
    expect(vars['--showroom-secondary']).toBe('#0b1220')
    expect(vars['--showroom-on-primary']).toBe('#ffffff')
    expect(vars['--showroom-on-secondary']).toBe('#ffffff')
    expect(vars['--showroom-accent']).toMatch(/^#[0-9a-f]{6}$/)
    expect(contrastRatio(vars['--showroom-accent'], '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('uses the default palette for an unset configuration', () => {
    const vars = showroomThemeVars({})

    expect(vars['--showroom-primary']).toBe(DEFAULT_PRIMARY_COLOR)
    expect(vars['--showroom-secondary']).toBe(DEFAULT_SECONDARY_COLOR)
    expect(showroomThemeStyle({})).toEqual(vars)
  })
})
