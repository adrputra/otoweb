import type { VehicleImage } from '@/db/schema'
import type { Vehicle } from '@/lib/types'

type VehicleRow = {
  id: string
  slug: string
  brand: string
  model: string
  variant: string
  year: number
  bodyType: string
  transmission: Vehicle['transmission']
  fuelType: Vehicle['fuel']
  mileage: number
  color: string
  engineCapacity: number
  price: number
  originalPrice: number | null
  taxExpiryDate: string
  plateRegion: string
  ownerCount: number | null
  documents: { stnk: boolean; bpkb: boolean } | null
  features: string[] | null
  description: string
  status: 'draft' | 'available' | 'reserved' | 'sold' | 'archived'
  featured: boolean
  location: string
  createdAt: Date
  updatedAt: Date
}

function normalizeImageUrl(url: string): string {
  if (!url) return '/placeholder.jpg'
  if (url.startsWith('/') || url.startsWith('http')) return url
  return `https://images.unsplash.com/${url}`
}

/** Group image rows by vehicle for a single-query list mapping. */
export function groupVehicleImages(rows: VehicleImage[]): Map<string, Vehicle['images']> {
  const grouped = new Map<string, Vehicle['images']>()

  for (const row of rows) {
    const list = grouped.get(row.vehicleId) ?? []
    list.push({
      id: row.id,
      url: normalizeImageUrl(row.url),
      alt: row.alt,
      order: row.position,
      isCover: row.isCover,
    })
    grouped.set(row.vehicleId, list)
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }

  return grouped
}

/**
 * Map a stored vehicle row to the admin view model.
 *
 * The public mapper deliberately collapses every public status to
 * `publication: 'published'`; the admin surface needs the inverse so drafts and
 * archived units stay visible in the back office.
 */
export function toAdminVehicle(row: VehicleRow, images: Vehicle['images'] = []): Vehicle {
  const publication: Vehicle['publication'] =
    row.status === 'draft' ? 'draft' : row.status === 'archived' ? 'archived' : 'published'

  const availability: Vehicle['availability'] =
    row.status === 'reserved' ? 'reserved' : row.status === 'sold' ? 'sold' : 'available'

  return {
    id: row.id,
    slug: row.slug,
    brand: row.brand,
    model: row.model,
    variant: row.variant,
    year: row.year,
    bodyType: row.bodyType,
    transmission: row.transmission,
    fuel: row.fuelType,
    mileageKm: row.mileage,
    color: row.color,
    engineCc: row.engineCapacity,
    price: row.price,
    originalPrice: row.originalPrice ?? undefined,
    taxExpiry: row.taxExpiryDate,
    plateRegion: row.plateRegion,
    ownerCount: row.ownerCount ?? 0,
    documents: row.documents ?? { stnk: false, bpkb: false },
    features: row.features ?? [],
    description: row.description,
    images: images.length > 0 ? images : [],
    availability,
    publication,
    featured: row.featured,
    location: row.location,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
