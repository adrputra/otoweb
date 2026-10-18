import { describe, expect, it } from 'vitest'

import { buildSitemapEntries } from '@/lib/seo/sitemap'
import type { Vehicle } from '@/lib/types'

const origin = 'https://prima.otoweb.id'
const now = new Date('2026-10-19T00:00:00.000Z')

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'car-1',
    slug: 'toyota-fortuner-2021-1',
    brand: 'Toyota',
    model: 'Fortuner',
    variant: '2.4 VRZ TRD',
    year: 2021,
    bodyType: 'SUV',
    transmission: 'AT',
    fuel: 'diesel',
    mileageKm: 12000,
    color: 'Putih',
    engineCc: 2393,
    price: 485000000,
    taxExpiry: '2026-09-12',
    plateRegion: 'B Jakarta',
    ownerCount: 1,
    documents: { stnk: true, bpkb: true },
    features: [],
    description: 'Unit terawat.',
    images: [],
    availability: 'available',
    publication: 'published',
    featured: false,
    location: 'Jakarta Selatan',
    createdAt: '2026-10-18',
    updatedAt: '2026-10-18',
    ...overrides,
  }
}

describe('buildSitemapEntries', () => {
  it('includes the tenant home, inventory, and public vehicles on its origin', () => {
    const entries = buildSitemapEntries(
      origin,
      [
        vehicle(),
        vehicle({ id: 'car-2', slug: 'honda-crv-2022-2', availability: 'reserved' }),
        vehicle({ id: 'car-3', slug: 'toyota-camry-2019-11', availability: 'sold' }),
      ],
      now,
    )

    expect(entries.map((entry) => entry.url)).toEqual([
      `${origin}/`,
      `${origin}/cars`,
      `${origin}/cars/toyota-fortuner-2021-1`,
      `${origin}/cars/honda-crv-2022-2`,
      `${origin}/cars/toyota-camry-2019-11`,
    ])
    expect(entries[0]).toMatchObject({ changeFrequency: 'daily', priority: 1 })
    expect(entries[2]).toMatchObject({
      changeFrequency: 'weekly',
      priority: 0.8,
      lastModified: new Date('2026-10-18'),
    })
  })

  it('defensively excludes draft, archived, and non-public statuses', () => {
    const entries = buildSitemapEntries(
      origin,
      [
        vehicle({ id: 'draft', slug: 'draft-car', publication: 'draft' }),
        vehicle({ id: 'archived', slug: 'archived-car', publication: 'archived' }),
        vehicle({ id: 'unknown', slug: 'unknown-car', availability: 'draft' as never }),
      ],
      now,
    )

    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.url)).toEqual([`${origin}/`, `${origin}/cars`])
  })

  it('returns no vehicle entries for an empty tenant inventory', () => {
    const entries = buildSitemapEntries(origin, [], now)
    expect(entries.map((entry) => entry.url)).toEqual([`${origin}/`, `${origin}/cars`])
  })
})
