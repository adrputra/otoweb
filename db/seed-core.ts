import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { showroom as mockShowroom, vehicles as mockVehicles } from '../data'
import type { Vehicle as MockVehicle } from '../lib/types'
import {
  profiles,
  showroomSettings,
  tenantDomains,
  tenantMembers,
  tenants,
  vehicleImages,
  vehicles,
  type NewProfile,
  type NewShowroomSettings,
  type NewTenant,
  type NewTenantDomain,
  type NewTenantMember,
  type NewVehicle,
  type NewVehicleImage,
} from './schema'

type SeedDatabase = PgDatabase<PgQueryResultHKT, typeof import('./schema')>

export interface SeedResult {
  tenants: number
  domains: number
  profiles: number
  memberships: number
  showroomSettings: number
  vehicles: number
  vehicleImages: number
}

export const PRIMA_TENANT_ID = '11111111-1111-4111-8111-111111111111'
export const TENANT_B_TENANT_ID = '22222222-2222-4222-8222-222222222222'

export const PRIMA_PROFILE_ID = '50000000-0000-4000-8000-000000000001'
export const TENANT_B_PROFILE_ID = '50000000-0000-4000-8000-000000000002'
export const PLATFORM_PROFILE_ID = '50000000-0000-4000-8000-000000000003'

/** Development/visual-QA credential hash: correct-horse. Never seeded unless SEED_DEV_AUTH=1. */
const DEV_AUTH_PASSWORD_HASH =
  'scrypt$gFyNb14xuisdpr8bToNIBA$V4ofriCsmDyBhamfyiDGGFSHuUg5q0EqUzytlD2TJAmyi5osVf7JYxBip6WfEsCTpN2UdYgUrX7NzHrwuA063A'

export const PRIMA_DOMAIN_ID = '70000000-0000-4000-8000-000000000001'
export const TENANT_B_DOMAIN_ID = '70000000-0000-4000-8000-000000000002'

export const PRIMA_MEMBER_ID = '60000000-0000-4000-8000-000000000001'
export const TENANT_B_MEMBER_ID = '60000000-0000-4000-8000-000000000002'
export const PLATFORM_MEMBER_ID = '60000000-0000-4000-8000-000000000003'

export const PRIMA_SETTINGS_ID = '80000000-0000-4000-8000-000000000001'
export const TENANT_B_SETTINGS_ID = '80000000-0000-4000-8000-000000000002'

const SEED_TIMESTAMP = new Date('2026-10-18T00:00:00.000Z')

function seedUuid(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`
}

export function seededVehicleId(index: number): string {
  return seedUuid('30000000', index + 1)
}

export function seededVehicleImageId(index: number): string {
  return seedUuid('40000000', index + 1)
}

function toDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T00:00:00.000Z`)
}

function toImageUrl(value: string): string {
  return value.startsWith('http') ? value : `https://images.unsplash.com/${value}`
}

function toSocialUrl(handle: string | undefined, baseUrl: string): string | null {
  if (!handle) return null
  if (handle.startsWith('http')) return handle
  return `${baseUrl}${handle.replace(/^@/, '')}`
}

type VehicleStatusValue = (typeof import('./schema').vehicleStatus.enumValues)[number]

function mapVehicleStatus(vehicle: MockVehicle): VehicleStatusValue {
  if (vehicle.publication === 'draft') return 'draft'
  if (vehicle.publication === 'archived') return 'archived'
  return vehicle.availability
}

const tenantRows: NewTenant[] = [
  {
    id: PRIMA_TENANT_ID,
    name: 'Prima Auto Gallery',
    slug: 'prima-auto-gallery',
    status: 'active',
    plan: 'starter',
    theme: 'premium',
  },
  {
    id: TENANT_B_TENANT_ID,
    name: 'Tenant B Test Showroom',
    slug: 'tenant-b-test-showroom',
    status: 'trial',
    plan: 'trial',
    theme: 'premium',
  },
]

const devAuthEnabled = process.env.SEED_DEV_AUTH === '1'

function withDevAuth(profile: NewProfile, email: string): NewProfile {
  if (!devAuthEnabled) return profile

  return {
    ...profile,
    email,
    passwordHash: DEV_AUTH_PASSWORD_HASH,
    emailVerifiedAt: SEED_TIMESTAMP,
  }
}

const profileRows: NewProfile[] = [
  withDevAuth(
    {
      id: PRIMA_PROFILE_ID,
      fullName: 'Aditya Pranata',
    },
    'owner@primaauto.test',
  ),
  {
    id: TENANT_B_PROFILE_ID,
    fullName: 'Tenant B Owner',
  },
  withDevAuth(
    {
      id: PLATFORM_PROFILE_ID,
      fullName: 'Platform Operator',
    },
    'operator@otoweb.test',
  ),
]

const domainRows: NewTenantDomain[] = [
  {
    id: PRIMA_DOMAIN_ID,
    tenantId: PRIMA_TENANT_ID,
    hostname: 'prima.otoweb.id',
    type: 'platform_subdomain',
    status: 'active',
    verifiedAt: SEED_TIMESTAMP,
    verificationStatus: 'verified',
    sslStatus: 'active',
    sslProvisionedAt: SEED_TIMESTAMP,
    lastCheckedAt: SEED_TIMESTAMP,
  },
  {
    id: TENANT_B_DOMAIN_ID,
    tenantId: TENANT_B_TENANT_ID,
    hostname: 'tenant-b.otoweb.id',
    type: 'platform_subdomain',
    status: 'active',
    verifiedAt: SEED_TIMESTAMP,
    verificationStatus: 'verified',
    sslStatus: 'active',
    sslProvisionedAt: SEED_TIMESTAMP,
    lastCheckedAt: SEED_TIMESTAMP,
  },
]

const membershipRows: NewTenantMember[] = [
  {
    id: PRIMA_MEMBER_ID,
    tenantId: PRIMA_TENANT_ID,
    userId: PRIMA_PROFILE_ID,
    role: 'owner',
    status: 'active',
  },
  {
    id: TENANT_B_MEMBER_ID,
    tenantId: TENANT_B_TENANT_ID,
    userId: TENANT_B_PROFILE_ID,
    role: 'owner',
    status: 'active',
  },
  {
    id: PLATFORM_MEMBER_ID,
    tenantId: PRIMA_TENANT_ID,
    userId: PLATFORM_PROFILE_ID,
    role: 'platform_admin',
    status: 'active',
  },
]

const showroomRows: NewShowroomSettings[] = [
  {
    id: PRIMA_SETTINGS_ID,
    tenantId: PRIMA_TENANT_ID,
    displayName: mockShowroom.name,
    tagline: mockShowroom.tagline,
    description: mockShowroom.description,
    logoUrl: mockShowroom.logoUrl || null,
    faviconUrl: null,
    heroImageUrl: mockShowroom.heroImageUrl ? toImageUrl(mockShowroom.heroImageUrl) : null,
    primaryColor: mockShowroom.colors.primary,
    secondaryColor: mockShowroom.colors.secondary,
    phone: mockShowroom.contact.phone,
    whatsapp: mockShowroom.contact.whatsapp,
    email: mockShowroom.contact.email,
    address: mockShowroom.address.street,
    city: mockShowroom.address.city,
    province: null,
    postalCode: null,
    googleMapsUrl: mockShowroom.address.mapUrl,
    instagramUrl: toSocialUrl(mockShowroom.social.instagram, 'https://instagram.com/'),
    tiktokUrl: toSocialUrl(mockShowroom.social.tiktok, 'https://tiktok.com/@'),
    facebookUrl: toSocialUrl(mockShowroom.social.facebook, 'https://facebook.com/'),
    openingHours: mockShowroom.address.openingHours,
    seoTitle: mockShowroom.seo.title,
    seoDescription: mockShowroom.seo.description,
  },
  {
    id: TENANT_B_SETTINGS_ID,
    tenantId: TENANT_B_TENANT_ID,
    displayName: 'Tenant B Test Showroom',
    tagline: 'Mobil bekas berkualitas, siap pakai di Bandung.',
    description:
      'Tenant B Test Showroom melayani pembelian mobil bekas berkualitas di Bandung dengan inspeksi menyeluruh, harga transparan, dan dokumen lengkap.',
    logoUrl: null,
    faviconUrl: null,
    heroImageUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7',
    primaryColor: '#0f766e',
    secondaryColor: '#0b1220',
    phone: '+622100000002',
    whatsapp: '6281200000002',
    email: 'hello@tenant-b.test',
    address: 'Jl. Test No. 2',
    city: 'Bandung',
    province: 'Jawa Barat',
    postalCode: '40111',
    googleMapsUrl: 'https://maps.google.com/?q=Tenant+B+Test+Showroom',
    instagramUrl: 'https://instagram.com/tenantb',
    tiktokUrl: null,
    facebookUrl: null,
    openingHours: 'Senin-Jumat, 09.00-17.00',
    seoTitle: 'Tenant B Test Showroom — Mobil Bekas Berkualitas di Bandung',
    seoDescription: 'Temukan mobil bekas berkualitas di Tenant B Test Showroom, Bandung.',
  },
]

const vehicleRows: NewVehicle[] = mockVehicles.map((vehicle, index) => {
  const status = mapVehicleStatus(vehicle)
  const isPublished = vehicle.publication === 'published'

  return {
    id: seededVehicleId(index),
    tenantId: PRIMA_TENANT_ID,
    slug: vehicle.slug,
    brand: vehicle.brand,
    model: vehicle.model,
    variant: vehicle.variant,
    year: vehicle.year,
    transmission: vehicle.transmission,
    fuelType: vehicle.fuel,
    bodyType: vehicle.bodyType,
    engineCapacity: vehicle.engineCc,
    mileage: vehicle.mileageKm,
    color: vehicle.color,
    price: vehicle.price,
    originalPrice: vehicle.originalPrice ?? null,
    plateRegion: vehicle.plateRegion,
    taxExpiryDate: vehicle.taxExpiry,
    description: vehicle.description,
    status,
    featured: vehicle.featured,
    location: vehicle.location,
    features: vehicle.features,
    ownerCount: vehicle.ownerCount,
    documents: vehicle.documents,
    createdAt: toDate(vehicle.createdAt),
    updatedAt: toDate(vehicle.updatedAt),
    publishedAt: isPublished ? toDate(vehicle.createdAt) : null,
    reservedAt: status === 'reserved' && isPublished ? toDate(vehicle.updatedAt) : null,
    soldAt: status === 'sold' && isPublished ? toDate(vehicle.updatedAt) : null,
  }
})

const vehicleImageRows: NewVehicleImage[] = mockVehicles.flatMap((vehicle, index) =>
  vehicle.images.map((image, imageIndex) => ({
    id: seededVehicleImageId(index * 10 + imageIndex),
    tenantId: PRIMA_TENANT_ID,
    vehicleId: seededVehicleId(index),
    provider: image.url.includes('images.unsplash.com') ? 'unsplash' : 'external',
    providerAssetId: image.id,
    url: image.url,
    alt: image.alt,
    position: image.order,
    isCover: image.isCover,
    width: null,
    height: null,
    createdAt: toDate(vehicle.createdAt),
  })),
)

/**
 * F016 audit inventory for the second showroom.
 *
 * Tenant B previously had settings but no vehicles, which made two-showroom
 * public QA meaningless. These deterministic, tenant-owned rows exercise the
 * same public inventory/detail/metadata path as Prima.
 */
export const TENANT_B_VEHICLE_SLUGS = ['toyota-rush-2022-1', 'honda-mobilio-2021-2'] as const

export const TENANT_B_VEHICLE_IDS = {
  rush: '33333333-3333-4333-8333-333333333101',
  mobilio: '33333333-3333-4333-8333-333333333102',
} as const

export const TENANT_B_VEHICLE_IMAGE_IDS = {
  rush: '44444444-4444-4444-8444-444444444101',
  mobilio: '44444444-4444-4444-8444-444444444102',
} as const

const TENANT_B_SEED_TIMESTAMP = new Date('2026-10-10T00:00:00.000Z')

const tenantBVehicleRows: NewVehicle[] = [
  {
    id: TENANT_B_VEHICLE_IDS.rush,
    tenantId: TENANT_B_TENANT_ID,
    slug: TENANT_B_VEHICLE_SLUGS[0],
    brand: 'Toyota',
    model: 'Rush',
    variant: '1.5 G GR Sport',
    year: 2022,
    transmission: 'AT',
    fuelType: 'bensin',
    bodyType: 'SUV',
    engineCapacity: 1500,
    mileage: 24_500,
    color: 'Putih',
    price: 235_000_000,
    originalPrice: 250_000_000,
    plateRegion: 'D',
    taxExpiryDate: '2027-06-30',
    description:
      'Toyota Rush 2022 GR Sport dengan riwayat servis lengkap, interior bersih, dan dokumen siap balik nama.',
    status: 'available',
    featured: true,
    location: 'Bandung',
    features: ['Kamera belakang', 'Cruise control', 'Apple CarPlay', 'Sensor parkir'],
    ownerCount: 1,
    documents: { stnk: true, bpkb: true },
    createdAt: TENANT_B_SEED_TIMESTAMP,
    updatedAt: TENANT_B_SEED_TIMESTAMP,
    publishedAt: TENANT_B_SEED_TIMESTAMP,
    reservedAt: null,
    soldAt: null,
  },
  {
    id: TENANT_B_VEHICLE_IDS.mobilio,
    tenantId: TENANT_B_TENANT_ID,
    slug: TENANT_B_VEHICLE_SLUGS[1],
    brand: 'Honda',
    model: 'Mobilio',
    variant: '1.5 E CVT',
    year: 2021,
    transmission: 'CVT',
    fuelType: 'bensin',
    bodyType: 'MPV',
    engineCapacity: 1500,
    mileage: 38_200,
    color: 'Silver',
    price: 185_000_000,
    originalPrice: null,
    plateRegion: 'D',
    taxExpiryDate: '2027-03-31',
    description:
      'Honda Mobilio 2021 CVT, nyaman untuk keluarga, pajak hidup, dan siap digunakan harian di Bandung.',
    status: 'available',
    featured: true,
    location: 'Bandung',
    features: ['AC double blower', 'Kamera belakang', 'Audio touchscreen', 'Kunci remote'],
    ownerCount: 2,
    documents: { stnk: true, bpkb: true },
    createdAt: new Date('2026-10-05T00:00:00.000Z'),
    updatedAt: new Date('2026-10-05T00:00:00.000Z'),
    publishedAt: new Date('2026-10-05T00:00:00.000Z'),
    reservedAt: null,
    soldAt: null,
  },
]

const tenantBVehicleImageRows: NewVehicleImage[] = [
  {
    id: TENANT_B_VEHICLE_IMAGE_IDS.rush,
    tenantId: TENANT_B_TENANT_ID,
    vehicleId: TENANT_B_VEHICLE_IDS.rush,
    provider: 'unsplash',
    providerAssetId: 'photo-1519641471654-76ce0107ad1b',
    url: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85',
    alt: 'Toyota Rush 2022 di showroom Tenant B',
    position: 0,
    isCover: true,
    width: null,
    height: null,
    createdAt: TENANT_B_SEED_TIMESTAMP,
  },
  {
    id: TENANT_B_VEHICLE_IMAGE_IDS.mobilio,
    tenantId: TENANT_B_TENANT_ID,
    vehicleId: TENANT_B_VEHICLE_IDS.mobilio,
    provider: 'unsplash',
    providerAssetId: 'photo-1550355291-bbee04a92027',
    url: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=85',
    alt: 'Honda Mobilio 2021 di showroom Tenant B',
    position: 0,
    isCover: true,
    width: null,
    height: null,
    createdAt: new Date('2026-10-05T00:00:00.000Z'),
  },
]

const allVehicleRows = [...vehicleRows, ...tenantBVehicleRows]
const allVehicleImageRows = [...vehicleImageRows, ...tenantBVehicleImageRows]

export const seedRows = {
  tenants: tenantRows,
  profiles: profileRows,
  domains: domainRows,
  memberships: membershipRows,
  showroomSettings: showroomRows,
  vehicles: allVehicleRows,
  vehicleImages: allVehicleImageRows,
}

/**
 * Upsert the deterministic development dataset.
 *
 * Every row has a stable UUID and every insert uses an upsert, so running this
 * function repeatedly converges on the same data without duplicating rows or
 * touching unrelated records.
 */
export async function seedDatabase(db: SeedDatabase): Promise<SeedResult> {
  await db.transaction(async (tx) => {
    for (const row of tenantRows) {
      await tx.insert(tenants).values(row).onConflictDoUpdate({ target: tenants.id, set: row })
    }

    for (const row of profileRows) {
      await tx.insert(profiles).values(row).onConflictDoUpdate({ target: profiles.id, set: row })
    }

    for (const row of domainRows) {
      await tx
        .insert(tenantDomains)
        .values(row)
        .onConflictDoUpdate({ target: tenantDomains.id, set: row })
    }

    for (const row of membershipRows) {
      await tx
        .insert(tenantMembers)
        .values(row)
        .onConflictDoUpdate({ target: tenantMembers.id, set: row })
    }

    for (const row of showroomRows) {
      await tx
        .insert(showroomSettings)
        .values(row)
        .onConflictDoUpdate({ target: showroomSettings.id, set: row })
    }

    for (const row of allVehicleRows) {
      await tx.insert(vehicles).values(row).onConflictDoUpdate({ target: vehicles.id, set: row })
    }

    for (const row of allVehicleImageRows) {
      await tx
        .insert(vehicleImages)
        .values(row)
        .onConflictDoUpdate({ target: vehicleImages.id, set: row })
    }
  })

  return {
    tenants: tenantRows.length,
    domains: domainRows.length,
    profiles: profileRows.length,
    memberships: membershipRows.length,
    showroomSettings: showroomRows.length,
    vehicles: allVehicleRows.length,
    vehicleImages: allVehicleImageRows.length,
  }
}
