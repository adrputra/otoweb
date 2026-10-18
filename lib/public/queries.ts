import { and, asc, desc, eq, gte, ilike, inArray, lte, ne } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { vehicleImages, vehicles } from '@/db/schema'
import type * as schema from '@/db/schema'
import { optimizedImageUrl, thumbnailImageUrl } from '@/lib/media/urls'
import {
  getShowroomSettings,
  listTenantVehicleImages,
  requireTenantId,
} from '@/lib/tenant/scoped-queries'
import type { TenantIdentity } from '@/lib/tenant/types'
import type { Availability, Showroom, Vehicle, VehicleFilters } from '@/lib/types'

export type PublicDatabase = PgDatabase<PgQueryResultHKT, typeof schema>

export const PUBLIC_VEHICLE_STATUSES = ['available', 'reserved', 'sold'] as const

/**
 * Related-unit suggestions must offer a next step, so sold units are excluded
 * even though their detail pages remain public for SEO preservation.
 */
export const RELATED_VEHICLE_STATUSES = ['available', 'reserved'] as const

const TRANSMISSIONS = new Set(['AT', 'MT', 'CVT'])
const FUELS = new Set(['bensin', 'diesel', 'hybrid', 'listrik'])
const SORTS = new Set([
  'terbaru',
  'harga-terendah',
  'harga-tertinggi',
  'tahun-terbaru',
  'km-terendah',
])

type SearchValue = string | string[] | number | undefined
type SearchParams = Record<string, SearchValue>

function first(value: SearchValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toNonNegativeInteger(value: SearchValue): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === undefined || raw === '') return undefined
  const parsed = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0 || !Number.isFinite(parsed)) return undefined
  return parsed
}

/**
 * Normalize Next.js search params into the filter model used by the query
 * layer. Empty, repeated, and malformed values are ignored rather than turned
 * into `NaN` predicates.
 */
export function normalizeVehicleFilters(input: SearchParams = {}): VehicleFilters {
  const brand = first(input.brand)
  const model = first(input.model)
  const transmission = first(input.transmission)
  const fuel = first(input.fuel)
  const sort = first(input.sort)

  return {
    brand,
    model,
    transmission:
      transmission && TRANSMISSIONS.has(transmission)
        ? (transmission as Vehicle['transmission'])
        : undefined,
    fuel: fuel && FUELS.has(fuel) ? (fuel as Vehicle['fuel']) : undefined,
    year: toNonNegativeInteger(input.year),
    minPrice: toNonNegativeInteger(input.minPrice),
    maxPrice: toNonNegativeInteger(input.maxPrice),
    maxMileage: toNonNegativeInteger(input.maxMileage),
    sort: sort && SORTS.has(sort) ? sort : 'terbaru',
  }
}

function publicVehicleConditions(tenantId: string, filters: VehicleFilters = {}) {
  const conditions = [
    eq(vehicles.tenantId, requireTenantId(tenantId)),
    inArray(vehicles.status, [...PUBLIC_VEHICLE_STATUSES]),
  ]

  if (filters.brand) conditions.push(ilike(vehicles.brand, filters.brand))
  if (filters.model) conditions.push(ilike(vehicles.model, filters.model))
  if (filters.transmission) conditions.push(eq(vehicles.transmission, filters.transmission))
  if (filters.fuel) conditions.push(eq(vehicles.fuelType, filters.fuel))
  if (filters.year !== undefined) conditions.push(eq(vehicles.year, filters.year))
  if (filters.minPrice !== undefined) conditions.push(gte(vehicles.price, filters.minPrice))
  if (filters.maxPrice !== undefined) conditions.push(lte(vehicles.price, filters.maxPrice))
  if (filters.maxMileage !== undefined) conditions.push(lte(vehicles.mileage, filters.maxMileage))

  return and(...conditions)
}

function vehicleOrder(filters: VehicleFilters = {}) {
  switch (filters.sort) {
    case 'harga-terendah':
      return [asc(vehicles.price), asc(vehicles.slug), asc(vehicles.id)]
    case 'harga-tertinggi':
      return [desc(vehicles.price), asc(vehicles.slug), asc(vehicles.id)]
    case 'tahun-terbaru':
      return [desc(vehicles.year), asc(vehicles.slug), asc(vehicles.id)]
    case 'km-terendah':
      return [asc(vehicles.mileage), asc(vehicles.slug), asc(vehicles.id)]
    case 'terbaru':
    default:
      return [desc(vehicles.createdAt), asc(vehicles.slug), asc(vehicles.id)]
  }
}

function absoluteImageUrl(url: string): string {
  if (url.startsWith('/') || url.startsWith('http')) return url
  return `https://images.unsplash.com/${url}`
}

function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder.jpg'
  return optimizedImageUrl(absoluteImageUrl(url), 1600)
}

function normalizeHeroImageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder.jpg'
  return optimizedImageUrl(absoluteImageUrl(url), 2200)
}

type VehicleRow = typeof vehicles.$inferSelect
type VehicleImageRow = typeof vehicleImages.$inferSelect
type VehicleImages = Vehicle['images']

function groupImages(rows: VehicleImageRow[]): Map<string, VehicleImages> {
  const grouped = new Map<string, VehicleImages>()

  for (const row of rows) {
    const list = grouped.get(row.vehicleId) ?? []
    const url = normalizeImageUrl(row.url)
    list.push({
      id: row.id,
      url,
      thumbnailUrl: thumbnailImageUrl(url, 640),
      alt: row.alt,
      order: row.position,
      isCover: row.isCover,
      provider: row.provider,
      providerAssetId: row.providerAssetId,
      width: row.width,
      height: row.height,
    })
    grouped.set(row.vehicleId, list)
  }

  return grouped
}

function toVehicle(row: VehicleRow, images: VehicleImages = []): Vehicle {
  // The chosen cover is the public hero regardless of its stored position.
  const orderedImages = [...images].sort(
    (a, b) =>
      Number(b.isCover) - Number(a.isCover) ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
  )

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
    images:
      orderedImages.length > 0
        ? orderedImages
        : [
            {
              id: `placeholder-${row.id}`,
              url: '/placeholder.jpg',
              alt: `${row.brand} ${row.model}`.trim(),
              order: 0,
              isCover: true,
            },
          ],
    availability: row.status as Availability,
    publication: 'published',
    featured: row.featured,
    location: row.location,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadVehicleImages(
  db: PublicDatabase,
  tenantId: string,
  vehicleId?: string,
): Promise<Map<string, VehicleImages>> {
  const rows = await listTenantVehicleImages(db, tenantId, vehicleId)
  return groupImages(rows)
}

async function loadVehicles(
  db: PublicDatabase,
  tenantId: string,
  filters: VehicleFilters = {},
  options: { featuredOnly?: boolean; limit?: number } = {},
): Promise<Vehicle[]> {
  const conditions = [publicVehicleConditions(tenantId, filters)]
  if (options.featuredOnly) conditions.push(eq(vehicles.featured, true))

  const query = db
    .select()
    .from(vehicles)
    .where(and(...conditions))
    .orderBy(...vehicleOrder(filters))

  const rows = options.limit ? await query.limit(options.limit) : await query
  if (rows.length === 0) return []

  const images = await loadVehicleImages(db, tenantId)

  return rows.map((row) => toVehicle(row, images.get(row.id) ?? []))
}

/** List the tenant's public vehicles with the supported filters and sort order. */
export async function listPublicVehicles(
  db: PublicDatabase,
  tenantId: string,
  filters: VehicleFilters = {},
): Promise<Vehicle[]> {
  return loadVehicles(db, tenantId, filters)
}

/** List the tenant's public vehicles whose stored featured flag is true. */
export async function listFeaturedVehicles(
  db: PublicDatabase,
  tenantId: string,
): Promise<Vehicle[]> {
  return loadVehicles(db, tenantId, {}, { featuredOnly: true })
}

/** Distinct brands in the tenant's public inventory, sorted for the UI selects. */
export async function listPublicVehicleBrands(
  db: PublicDatabase,
  tenantId: string,
): Promise<string[]> {
  const conditions = publicVehicleConditions(tenantId)
  const rows = await db
    .selectDistinct({ brand: vehicles.brand })
    .from(vehicles)
    .where(conditions)
    .orderBy(asc(vehicles.brand))

  return rows.map((row) => row.brand)
}

/** Resolve a public vehicle for one tenant. Draft/archived/other-tenant slugs return null. */
export async function getPublicVehicleBySlug(
  db: PublicDatabase,
  tenantId: string,
  slug: string,
): Promise<Vehicle | null> {
  const id = requireTenantId(tenantId)
  if (!slug) return null

  const rows = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.tenantId, id),
        eq(vehicles.slug, slug),
        inArray(vehicles.status, [...PUBLIC_VEHICLE_STATUSES]),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const images = await loadVehicleImages(db, id, row.id)
  return toVehicle(row, images.get(row.id) ?? [])
}

/** Up to `limit` other public vehicles from the same tenant and body type. */
export async function listRelatedPublicVehicles(
  db: PublicDatabase,
  tenantId: string,
  vehicleId: string,
  bodyType: string,
  limit = 3,
): Promise<Vehicle[]> {
  const id = requireTenantId(tenantId)
  if (!vehicleId || !bodyType || limit <= 0) return []

  const rows = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.tenantId, id),
        inArray(vehicles.status, [...RELATED_VEHICLE_STATUSES]),
        eq(vehicles.bodyType, bodyType),
        ne(vehicles.id, vehicleId),
      ),
    )
    .orderBy(desc(vehicles.featured), desc(vehicles.createdAt), asc(vehicles.slug), asc(vehicles.id))
    .limit(limit)

  if (rows.length === 0) return []

  const images = await loadVehicleImages(db, id)

  return rows.map((row) => toVehicle(row, images.get(row.id) ?? []))
}

function fallbackShowroom(tenant: TenantIdentity): Showroom {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    tagline: '',
    description: '',
    logoUrl: '',
    heroImageUrl: '/placeholder.jpg',
    colors: { primary: '#b88a44', secondary: '#171717' },
    contact: { phone: '', whatsapp: '', email: '' },
    address: { street: '', city: '', province: '', postalCode: '', mapUrl: '', openingHours: '' },
    social: {},
    seo: { title: tenant.name, description: '' },
    hero: {
      headline: tenant.name,
      subheadline: '',
      ctaLabel: 'Lihat semua mobil',
    },
  }
}

/** Map the tenant's stored showroom settings to the public view model. */
export async function getShowroomForTenant(
  db: PublicDatabase,
  tenant: TenantIdentity,
): Promise<Showroom> {
  const tenantId = requireTenantId(tenant.id)
  const settings = await getShowroomSettings(db, tenantId)

  if (!settings) return fallbackShowroom(tenant)

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: settings.displayName,
    tagline: settings.tagline ?? '',
    description: settings.description ?? '',
    logoUrl: settings.logoUrl ?? '',
    heroImageUrl: normalizeHeroImageUrl(settings.heroImageUrl),
    colors: {
      primary: settings.primaryColor ?? '#b88a44',
      secondary: settings.secondaryColor ?? '#171717',
    },
    contact: {
      phone: settings.phone ?? '',
      whatsapp: settings.whatsapp ?? '',
      email: settings.email ?? '',
    },
    address: {
      street: settings.address ?? '',
      city: settings.city ?? '',
      province: settings.province ?? '',
      postalCode: settings.postalCode ?? '',
      mapUrl: settings.googleMapsUrl ?? '',
      openingHours: settings.openingHours ?? '',
    },
    social: {
      instagram: settings.instagramUrl ?? undefined,
      tiktok: settings.tiktokUrl ?? undefined,
      facebook: settings.facebookUrl ?? undefined,
    },
    seo: {
      title: settings.seoTitle ?? settings.displayName,
      description: settings.seoDescription ?? '',
    },
    hero: {
      headline: settings.displayName,
      subheadline: settings.description ?? settings.tagline ?? '',
      ctaLabel: 'Lihat semua mobil',
    },
  }
}
