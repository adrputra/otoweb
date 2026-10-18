import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  emptyToNull,
  normalizeShowroomSettings,
  normalizeSocialUrl,
  nullToEmpty,
  showroomSettingsInputSchema,
} from '@/lib/validation/showroom-settings'

const validInput = {
  displayName: 'Prima Auto Gallery',
  tagline: 'Pilihan mobil berkualitas.',
  description: 'Dealer mobil bekas terpercaya di Jakarta Selatan.',
  logoUrl: '/uploads/logo.png',
  heroImageUrl: 'https://images.unsplash.com/photo-1',
  primaryColor: '#b88a44',
  secondaryColor: '#171717',
  phone: '+62217654321',
  whatsapp: '6281299001122',
  email: 'halo@primaauto.id',
  address: 'Jl. TB Simatupang No. 18',
  city: 'Jakarta Selatan',
  province: 'DKI Jakarta',
  postalCode: '12430',
  googleMapsUrl: 'https://maps.google.com/?q=Prima+Auto+Gallery',
  instagramUrl: '@primaauto.id',
  tiktokUrl: 'primaauto.id',
  facebookUrl: 'https://facebook.com/primaauto',
  openingHours: 'Senin–Sabtu, 08.00–18.00',
  seoTitle: 'Prima Auto Gallery — Mobil Bekas Berkualitas',
  seoDescription: 'Temukan mobil bekas berkualitas di Prima Auto Gallery.',
}

describe('showroom settings schema', () => {
  it('accepts a complete payload and keeps every editable field', () => {
    const parsed = showroomSettingsInputSchema.parse(validInput)

    expect(parsed).toMatchObject(validInput)
  })

  it('applies safe color and empty-string defaults', () => {
    const parsed = showroomSettingsInputSchema.parse({ displayName: 'Showroom Baru' })

    expect(parsed.primaryColor).toBe(DEFAULT_PRIMARY_COLOR)
    expect(parsed.secondaryColor).toBe(DEFAULT_SECONDARY_COLOR)
    expect(parsed.logoUrl).toBe('')
    expect(parsed.instagramUrl).toBe('')
  })

  it('rejects a missing or blank display name', () => {
    expect(showroomSettingsInputSchema.safeParse({}).success).toBe(false)
    expect(
      showroomSettingsInputSchema.safeParse({ displayName: '   ' }).success,
    ).toBe(false)
  })

  it('rejects malformed colors, emails, phone numbers, and media URLs', () => {
    const cases = [
      { primaryColor: 'amber' },
      { secondaryColor: '#12345' },
      { email: 'not-an-email' },
      { phone: 'call-us' },
      { whatsapp: '62812 ext 4' },
      { logoUrl: 'javascript:alert(1)' },
      { heroImageUrl: 'ftp://example.com/hero.jpg' },
      { googleMapsUrl: '/relative-map' },
      { instagramUrl: 'not a handle with spaces' },
    ]

    for (const patch of cases) {
      const result = showroomSettingsInputSchema.safeParse({ ...validInput, ...patch })
      expect(result.success, JSON.stringify(patch)).toBe(false)
    }
  })

  it('enforces bounded text fields', () => {
    expect(
      showroomSettingsInputSchema.safeParse({
        ...validInput,
        tagline: 'x'.repeat(161),
      }).success,
    ).toBe(false)
    expect(
      showroomSettingsInputSchema.safeParse({
        ...validInput,
        seoTitle: 'x'.repeat(121),
      }).success,
    ).toBe(false)
    expect(
      showroomSettingsInputSchema.safeParse({
        ...validInput,
        description: 'x'.repeat(2001),
      }).success,
    ).toBe(false)
  })
})

describe('social normalization', () => {
  it('turns handles into platform profile URLs', () => {
    expect(normalizeSocialUrl('@primaauto.id', 'instagram')).toBe(
      'https://instagram.com/primaauto.id',
    )
    expect(normalizeSocialUrl('primaauto.id', 'tiktok')).toBe(
      'https://tiktok.com/@primaauto.id',
    )
    expect(normalizeSocialUrl('@primaauto', 'facebook')).toBe(
      'https://facebook.com/primaauto',
    )
  })

  it('keeps absolute URLs and expands bare domains', () => {
    expect(normalizeSocialUrl('https://instagram.com/prima', 'instagram')).toBe(
      'https://instagram.com/prima',
    )
    expect(normalizeSocialUrl('instagram.com/prima', 'instagram')).toBe(
      'https://instagram.com/prima',
    )
    expect(normalizeSocialUrl('', 'instagram')).toBe('')
  })

  it('normalizes all social fields in a parsed payload', () => {
    const parsed = showroomSettingsInputSchema.parse(validInput)
    const normalized = normalizeShowroomSettings(parsed)

    expect(normalized.instagramUrl).toBe('https://instagram.com/primaauto.id')
    expect(normalized.tiktokUrl).toBe('https://tiktok.com/@primaauto.id')
    expect(normalized.facebookUrl).toBe('https://facebook.com/primaauto')
  })
})

describe('empty/null conversion', () => {
  it('maps empty strings to null and back', () => {
    expect(emptyToNull('')).toBeNull()
    expect(emptyToNull('   ')).toBeNull()
    expect(emptyToNull(' value ')).toBe('value')
    expect(nullToEmpty(null)).toBe('')
    expect(nullToEmpty(undefined)).toBe('')
    expect(nullToEmpty('value')).toBe('value')
  })
})
