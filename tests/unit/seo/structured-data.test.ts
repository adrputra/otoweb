import { describe, expect, it } from 'vitest'

import { showroom } from '@/data'
import {
  buildShowroomStructuredData,
  buildVehicleStructuredData,
  serializeJsonLd,
  vehicleAvailability,
} from '@/lib/seo/structured-data'
import type { Showroom, Vehicle } from '@/lib/types'

const origin = 'https://prima.otoweb.id'

const tenantShowroom: Showroom = {
  ...showroom,
  logoUrl: 'https://res.cloudinary.com/demo/logo.png',
  heroImageUrl: 'https://images.unsplash.com/photo-hero?auto=format&fit=crop&w=2200',
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

describe('showroom structured data', () => {
  it('describes the tenant as a LocalBusiness-compatible AutoDealer', () => {
    const data = buildShowroomStructuredData(tenantShowroom, origin)

    expect(data['@context']).toBe('https://schema.org')
    expect(data['@type']).toEqual(['LocalBusiness', 'AutoDealer'])
    expect(data.name).toBe(tenantShowroom.name)
    expect(data.url).toBe(`${origin}/`)
    expect(data.telephone).toBe(tenantShowroom.contact.phone)
    expect(data.email).toBe(tenantShowroom.contact.email)
    expect(data.address).toMatchObject({
      '@type': 'PostalAddress',
      streetAddress: tenantShowroom.address.street,
      addressLocality: tenantShowroom.address.city,
      addressRegion: tenantShowroom.address.province,
      postalCode: tenantShowroom.address.postalCode,
      addressCountry: 'ID',
    })
    expect(data.logo).toBe(tenantShowroom.logoUrl)
    expect(data.sameAs).toEqual([
      tenantShowroom.social.instagram,
      tenantShowroom.social.tiktok,
    ])
  })
})

describe('vehicle structured data', () => {
  it('describes the vehicle and its offer', () => {
    const data = buildVehicleStructuredData(vehicle, tenantShowroom, origin)
    const url = `${origin}/cars/toyota-fortuner-2021-1`

    expect(data['@type']).toBe('Vehicle')
    expect(data.url).toBe(url)
    expect(data.name).toBe('Toyota Fortuner 2.4 VRZ TRD')
    expect(data.brand).toMatchObject({ '@type': 'Brand', name: 'Toyota' })
    expect(data.vehicleModelDate).toBe('2021')
    expect(data.mileageFromOdometer).toMatchObject({
      '@type': 'QuantitativeValue',
      value: 12000,
      unitCode: 'KMT',
    })
    expect(data.offers).toMatchObject({
      '@type': 'Offer',
      url,
      price: 485000000,
      priceCurrency: 'IDR',
      availability: 'https://schema.org/InStock',
    })
  })

  it('maps sold and reserved statuses to the correct availability', () => {
    expect(vehicleAvailability('available')).toBe('https://schema.org/InStock')
    expect(vehicleAvailability('reserved')).toBe('https://schema.org/PreOrder')
    expect(vehicleAvailability('sold')).toBe('https://schema.org/SoldOut')

    const sold = buildVehicleStructuredData(
      { ...vehicle, availability: 'sold' },
      tenantShowroom,
      origin,
    )
    expect((sold.offers as Record<string, unknown>).availability).toBe(
      'https://schema.org/SoldOut',
    )
  })
})

describe('serializeJsonLd', () => {
  it('escapes markup and line separators while remaining valid JSON', () => {
    const payload = {
      name: '</script><script>alert(1)</script>',
      note: 'a & b',
      line: 'one\u2028two\u2029three',
    }
    const serialized = serializeJsonLd(payload)

    expect(serialized).not.toContain('</script')
    expect(serialized).not.toContain('<script')
    expect(serialized).not.toContain('\u2028')
    expect(serialized).not.toContain('\u2029')
    expect(JSON.parse(serialized)).toEqual(payload)
  })
})
