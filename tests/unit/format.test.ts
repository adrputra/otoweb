import { describe, expect, it } from 'vitest'

import { formatDate, formatKm, formatRupiah, whatsappLink } from '@/lib/format'

describe('format helpers', () => {
  it('formats rupiah values in Indonesian currency', () => {
    expect(formatRupiah(150_000_000)).toBe('Rp\u00a0150.000.000')
  })

  it('formats mileage with a thousands separator and km suffix', () => {
    expect(formatKm(45_000)).toBe('45.000 km')
  })

  it('formats dates in Indonesian long form', () => {
    expect(formatDate('2021-05-01')).toBe('1 Mei 2021')
  })

  it('builds a wa.me link and strips non-digits from the phone number', () => {
    expect(whatsappLink('0812-3456-7890', 'Halo Prima Auto')).toBe(
      'https://wa.me/081234567890?text=Halo%20Prima%20Auto',
    )
  })
})
