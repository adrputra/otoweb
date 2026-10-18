import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildSecurityHeaders, SECURITY_HEADERS } from '@/lib/security/headers.mjs'
import { NEUTRAL_PLATFORM_BRAND, resolveAuthBrandName } from '@/lib/public/branding'

vi.mock('@/lib/repositories', () => ({
  getShowroom: vi.fn(),
}))

import { getShowroom } from '@/lib/repositories'

const getShowroomMock = vi.mocked(getShowroom)

function headerMap(headers: { key: string; value: string }[]): Map<string, string> {
  return new Map(headers.map((header) => [header.key, header.value]))
}

describe('security headers', () => {
  it('sends the documented non-HSTS headers in every environment', () => {
    const headers = headerMap(buildSecurityHeaders(false))

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Permissions-Policy')).toContain('camera=()')
    expect(headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin')
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'")
    expect(headers.has('Strict-Transport-Security')).toBe(false)
  })

  it('adds HSTS only in production', () => {
    const headers = headerMap(buildSecurityHeaders(true))

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')
  })

  it('keeps the exported base header list free of duplicates', () => {
    const keys = SECURITY_HEADERS.map((header) => header.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('disables framework disclosure in the Next config', () => {
    const config = readFileSync('next.config.mjs', 'utf8')
    expect(config).toMatch(/poweredByHeader\s*:\s*false/)
  })
})

describe('robots private surfaces', () => {
  it('disallows admin, platform, API, auth, and account-recovery paths', () => {
    const source = readFileSync('app/robots.ts', 'utf8')

    for (const path of [
      "'/admin/'",
      "'/platform'",
      "'/api/'",
      "'/auth/'",
      "'/login'",
      "'/forgot-password'",
      "'/reset-password'",
    ]) {
      expect(source, `robots must disallow ${path}`).toContain(path)
    }
  })
})

describe('auth branding', () => {
  beforeEach(() => {
    getShowroomMock.mockReset()
  })

  it('uses the resolved showroom name', async () => {
    getShowroomMock.mockResolvedValue({ name: 'Tenant B Test Showroom' } as never)
    await expect(resolveAuthBrandName()).resolves.toBe('Tenant B Test Showroom')
  })

  it('trims whitespace and falls back for an empty name', async () => {
    getShowroomMock.mockResolvedValue({ name: '   ' } as never)
    await expect(resolveAuthBrandName()).resolves.toBe(NEUTRAL_PLATFORM_BRAND)
  })

  it('falls back neutrally when no tenant resolves', async () => {
    getShowroomMock.mockResolvedValue(null)
    await expect(resolveAuthBrandName()).resolves.toBe(NEUTRAL_PLATFORM_BRAND)
  })

  it('falls back neutrally when the database throws', async () => {
    getShowroomMock.mockRejectedValue(new Error('database unavailable'))
    await expect(resolveAuthBrandName()).resolves.toBe(NEUTRAL_PLATFORM_BRAND)
  })
})
