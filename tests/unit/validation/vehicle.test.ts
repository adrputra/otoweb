import { describe, expect, it } from 'vitest'

import {
  slugifyVehicle,
  vehicleActionSchema,
  vehicleIdSchema,
  vehicleInputSchema,
} from '@/lib/validation/vehicle'

const valid = {
  brand: 'Toyota',
  model: 'Fortuner',
  variant: '2.4 VRZ',
  year: 2024,
  transmission: 'AT' as const,
  fuel: 'diesel' as const,
  bodyType: 'SUV',
  engineCc: 2393,
  mileageKm: 12_500,
  color: 'Putih',
  price: 485_000_000,
  plateRegion: 'B 1234 XYZ',
  taxExpiry: '2027-09-12',
  description: 'Unit terawat dengan riwayat servis yang jelas.',
  featured: true,
  location: 'Jakarta Selatan',
  features: ['Kamera parkir'],
  ownerCount: 1,
  documents: { stnk: true, bpkb: true },
  publication: 'draft' as const,
}

describe('vehicleInputSchema', () => {
  it('accepts a complete vehicle and applies defaults', () => {
    const parsed = vehicleInputSchema.parse(valid)

    expect(parsed.brand).toBe('Toyota')
    expect(parsed.fuel).toBe('diesel')
    expect(parsed.publication).toBe('draft')
    expect(parsed.features).toEqual(['Kamera parkir'])
  })

  it('defaults optional collections and publication', () => {
    const parsed = vehicleInputSchema.parse({
      ...valid,
      features: undefined,
      ownerCount: undefined,
      documents: undefined,
      publication: undefined,
    })

    expect(parsed.features).toEqual([])
    expect(parsed.ownerCount).toBe(0)
    expect(parsed.documents).toEqual({ stnk: false, bpkb: false })
    expect(parsed.publication).toBe('draft')
  })

  it.each([
    ['empty brand', { brand: '   ' }],
    ['short description', { description: 'pendek' }],
    ['zero price', { price: 0 }],
    ['year below range', { year: 1979 }],
    ['year above range', { year: 2031 }],
    ['unknown transmission', { transmission: 'DCT' }],
    ['unknown fuel', { fuel: 'gas' }],
    ['unknown publication', { publication: 'live' }],
    ['impossible tax date', { taxExpiry: '2026-02-31' }],
    ['malformed tax date', { taxExpiry: '12/09/2027' }],
    ['negative mileage', { mileageKm: -1 }],
    ['zero engine capacity', { engineCc: 0 }],
    ['too many features', { features: Array.from({ length: 51 }, (_, i) => `fitur ${i}`) }],
  ])('rejects %s', (_label, patch) => {
    expect(vehicleInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })

  it('rejects string numbers so the server never coerces untrusted values', () => {
    expect(vehicleInputSchema.safeParse({ ...valid, year: '2024' }).success).toBe(false)
  })
})

describe('vehicle helpers', () => {
  it('validates ids and lifecycle actions', () => {
    expect(vehicleIdSchema.safeParse('30000000-0000-4000-8000-000000000001').success).toBe(true)
    expect(vehicleIdSchema.safeParse('car-1').success).toBe(false)
    expect(vehicleActionSchema.safeParse('publish').success).toBe(true)
    expect(vehicleActionSchema.safeParse('delete').success).toBe(false)
  })

  it('builds deterministic slugs and falls back for empty input', () => {
    expect(slugifyVehicle('Toyota', 'Fortuner', '2.4 VRZ TRD', 2021)).toBe(
      'toyota-fortuner-2-4-vrz-trd-2021',
    )
    expect(slugifyVehicle('  ', '')).toBe('kendaraan')
  })
})
