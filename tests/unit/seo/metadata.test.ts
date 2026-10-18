import { describe, expect, it } from 'vitest'

import { showroom } from '@/data'
import {
  inventoryMetadata,
  showroomMetadata,
  truncateDescription,
  vehicleMetadata,
  vehicleTitle,
} from '@/lib/seo/metadata'
import type { Showroom, Vehicle } from '@/lib/types'

const origin = 'https://prima.otoweb.id'

const tenantShowroom: Showroom = {
  ...showroom,
  heroImageUrl: 'https://images.unsplash.com/photo-hero?auto=format&fit=crop&w=2200',
  logoUrl: 'https://res.cloudinary.com/demo/logo.png',
  seo: {
    title: 'Prima Auto Gallery — Mobil Bekas Berkualitas',
    description: 'Temukan mobil bekas berkualitas dan terinspeksi di Prima Auto Gallery.',
  },
}

const vehicle: Vehicle = {
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
  features: ['Kamera parkir'],
  description: 'Unit terawat dengan riwayat servis yang jelas.',
  images: [
    {
      id: 'img-1',
      url: 'https://images.unsplash.com/photo-cover?auto=format&fit=crop&w=1600',
      alt: 'Toyota Fortuner',
      order: 0,
      isCover: true,
    },
  ],
  availability: 'available',
  publication: 'published',
  featured: true,
  location: 'Jakarta Selatan',
  createdAt: '2026-10-18',
  updatedAt: '2026-10-18',
}

describe('truncateDescription', () => {
  it('collapses whitespace and keeps short descriptions intact', () => {
    expect(truncateDescription('  Unit   terawat\nsekali.  ')).toBe('Unit terawat sekali.')
  })

  it('truncates long descriptions to the stable limit', () => {
    const result = truncateDescription('a'.repeat(400))
    expect(result).toHaveLength(160)
    expect(result.endsWith('…')).toBe(true)
  })
})

describe('showroomMetadata', () => {
  it('emits tenant title, description, canonical, OpenGraph, and icons', () => {
    const metadata = showroomMetadata(tenantShowroom, { origin, path: '/' })

    expect(metadata.title).toBe(tenantShowroom.seo.title)
    expect(metadata.description).toBe(tenantShowroom.seo.description)
    expect(metadata.metadataBase?.toString()).toBe(`${origin}/`)
    expect(metadata.alternates?.canonical).toBe('/')
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      url: '/',
      siteName: tenantShowroom.name,
      title: tenantShowroom.seo.title,
    })
    expect(metadata.openGraph?.images).toEqual([
      {
        url: tenantShowroom.logoUrl,
        alt: tenantShowroom.seo.title,
      },
    ])
    expect(metadata.applicationName).toBe(tenantShowroom.name)
    expect(metadata.icons).toMatchObject({ icon: tenantShowroom.logoUrl })
  })

  it('falls back to the identity when SEO fields are empty', () => {
    const metadata = showroomMetadata(
      {
        ...tenantShowroom,
        logoUrl: '',
        seo: { title: '   ', description: '' },
      },
      { origin, path: '/' },
    )

    expect(metadata.title).toBe(tenantShowroom.name)
    expect(metadata.description).toBe(tenantShowroom.description)
    expect(metadata.icons).toBeUndefined()
  })
})

describe('inventoryMetadata', () => {
  it('canonicalizes the inventory to /cars without filters', () => {
    const metadata = inventoryMetadata(tenantShowroom, origin)

    expect(metadata.title).toBe(`Koleksi mobil — ${tenantShowroom.name}`)
    expect(metadata.alternates?.canonical).toBe('/cars')
    expect(metadata.openGraph?.url).toBe('/cars')
  })
})

describe('vehicleMetadata', () => {
  it('uses the roadmap title pattern and a self-canonical URL', () => {
    const metadata = vehicleMetadata(vehicle, tenantShowroom, origin)

    expect(metadata.title).toBe(
      `Toyota Fortuner 2.4 VRZ TRD 2021 Bekas Jakarta Selatan | ${tenantShowroom.name}`,
    )
    expect(vehicleTitle(vehicle, tenantShowroom)).toBe(metadata.title)
    expect(metadata.alternates?.canonical).toBe('/cars/toyota-fortuner-2021-1')
    expect(metadata.openGraph?.url).toBe('/cars/toyota-fortuner-2021-1')
    expect(metadata.openGraph?.images).toEqual([
      {
        url: vehicle.images[0]!.url,
        alt: metadata.title,
      },
    ])
  })

  it('keeps sold pages indexable with a self-canonical URL', () => {
    const metadata = vehicleMetadata(
      { ...vehicle, availability: 'sold' },
      tenantShowroom,
      origin,
    )

    expect(metadata.robots).toMatchObject({ index: true, follow: true })
    expect(metadata.alternates?.canonical).toBe('/cars/toyota-fortuner-2021-1')
  })
})
