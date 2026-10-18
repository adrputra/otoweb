import type { CSSProperties } from 'react'

/**
 * Pure showroom theme helpers.
 *
 * Tenant colors are stored as hex strings. The public site consumes CSS custom
 * properties derived here so the incumbent layout can keep its own spacing,
 * borders, and typography while accent surfaces follow the tenant configuration.
 */

export interface ShowroomColors {
  primary?: string | null
  secondary?: string | null
}

export const DEFAULT_PRIMARY_COLOR = '#b88a44'
export const DEFAULT_SECONDARY_COLOR = '#171717'

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i
const WHITE = '#ffffff'

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function toRgb(hex: string): { r: number; g: number; b: number } {
  const match = HEX_PATTERN.exec(hex.trim())
  if (!match) return { r: 184, g: 138, b: 68 }

  const value = Number.parseInt(match[1], 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Normalize a stored color, falling back when it is missing or malformed. */
export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback
  return HEX_PATTERN.test(value.trim())
    ? toHex(toRgb(value).r, toRgb(value).g, toRgb(value).b)
    : fallback
}

/** WCAG relative luminance for a hex color. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = toRgb(normalizeHexColor(hex, WHITE))
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colors. */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Readable foreground for a filled color surface. */
export function contrastForeground(hex: string): '#ffffff' | '#111111' {
  const normalized = normalizeHexColor(hex, DEFAULT_SECONDARY_COLOR)
  const onWhite = contrastRatio('#ffffff', normalized)
  const onBlack = contrastRatio('#111111', normalized)
  return onWhite >= onBlack ? '#ffffff' : '#111111'
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = toRgb(hex)
  const factor = 1 - Math.max(0, Math.min(1, amount))
  return toHex(r * factor, g * factor, b * factor)
}

function mixWithWhite(hex: string, ratio: number): string {
  const { r, g, b } = toRgb(hex)
  const amount = Math.max(0, Math.min(1, ratio))
  const mix = (channel: number) => channel * (1 - amount) + 255 * amount
  return toHex(mix(r), mix(g), mix(b))
}

/**
 * Derive an accent for small text on white that keeps the tenant hue but meets
 * the normal-text contrast floor (4.5:1).
 */
export function readableAccent(hex: string, background = WHITE): string {
  const normalized = normalizeHexColor(hex, DEFAULT_PRIMARY_COLOR)

  for (let step = 0; step <= 24; step += 1) {
    const candidate = darken(normalized, step * 0.06)
    if (contrastRatio(candidate, background) >= 4.5) return candidate
  }

  return '#111111'
}

/** CSS custom properties consumed by the public pages and the editor preview. */
export function showroomThemeVars(colors: ShowroomColors): Record<string, string> {
  const primary = normalizeHexColor(colors.primary, DEFAULT_PRIMARY_COLOR)
  const secondary = normalizeHexColor(colors.secondary, DEFAULT_SECONDARY_COLOR)

  return {
    '--showroom-primary': primary,
    '--showroom-primary-soft': mixWithWhite(primary, 0.5),
    '--showroom-accent': readableAccent(primary),
    '--showroom-secondary': secondary,
    '--showroom-on-primary': contrastForeground(primary),
    '--showroom-on-secondary': contrastForeground(secondary),
  }
}

/** Type helper for React inline styles carrying CSS custom properties. */
export type ShowroomThemeStyle = Record<string, string>

/** Inline style object accepted by React, carrying the showroom variables. */
export function showroomThemeStyle(colors: ShowroomColors): CSSProperties {
  return showroomThemeVars(colors) as CSSProperties
}
