import { vehicles as mockVehicles } from '@/data'
import type { NewVehicle } from '@/db/schema'
import {
  PRIMA_DOMAIN_ID,
  PRIMA_MEMBER_ID,
  PRIMA_PROFILE_ID,
  PRIMA_SETTINGS_ID,
  PRIMA_TENANT_ID,
  TENANT_B_DOMAIN_ID,
  TENANT_B_MEMBER_ID,
  TENANT_B_PROFILE_ID,
  TENANT_B_SETTINGS_ID,
  TENANT_B_TENANT_ID,
  seededVehicleId,
  seededVehicleImageId,
} from '@/db/seed-core'

export interface TenantFixture {
  key: 'prima' | 'tenant-b'
  tenantId: string
  tenantName: string
  tenantSlug: string
  tenantStatus: 'active' | 'trial'
  hostname: string
  domainId: string
  profileId: string
  memberId: string
  settingsId: string
}

/** Deterministic identifiers for the committed F003 development fixtures. */
export const prima: TenantFixture = {
  key: 'prima',
  tenantId: PRIMA_TENANT_ID,
  tenantName: 'Prima Auto Gallery',
  tenantSlug: 'prima-auto-gallery',
  tenantStatus: 'active',
  hostname: 'prima.otoweb.id',
  domainId: PRIMA_DOMAIN_ID,
  profileId: PRIMA_PROFILE_ID,
  memberId: PRIMA_MEMBER_ID,
  settingsId: PRIMA_SETTINGS_ID,
}

export const tenantB: TenantFixture = {
  key: 'tenant-b',
  tenantId: TENANT_B_TENANT_ID,
  tenantName: 'Tenant B Test Showroom',
  tenantSlug: 'tenant-b-test-showroom',
  tenantStatus: 'trial',
  hostname: 'tenant-b.otoweb.id',
  domainId: TENANT_B_DOMAIN_ID,
  profileId: TENANT_B_PROFILE_ID,
  memberId: TENANT_B_MEMBER_ID,
  settingsId: TENANT_B_SETTINGS_ID,
}

export const tenantFixtures = { prima, 'tenant-b': tenantB } as const

export const PRIMA_VEHICLE_ID = seededVehicleId(0)
export const PRIMA_VEHICLE_IMAGE_ID = seededVehicleImageId(0)
export const TENANT_B_VEHICLE_ID = '33333333-3333-4333-8333-333333333301'
export const TENANT_B_VEHICLE_IMAGE_ID = '44444444-4444-4444-8444-444444444401'
export const TENANT_B_VEHICLE_SLUG = 'tenant-b-isolation-vehicle'

/** A tenant-b vehicle created only inside isolation tests. */
export const tenantBVehicle: NewVehicle = {
  id: TENANT_B_VEHICLE_ID,
  tenantId: TENANT_B_TENANT_ID,
  slug: TENANT_B_VEHICLE_SLUG,
  brand: 'Test',
  model: 'Isolation',
  variant: 'Tenant B',
  year: 2026,
  transmission: 'AT',
  fuelType: 'bensin',
  bodyType: 'SUV',
  engineCapacity: 1500,
  mileage: 10,
  color: 'Hitam',
  price: 250_000_000,
  originalPrice: null,
  plateRegion: 'B',
  taxExpiryDate: '2027-10-18',
  description: 'A tenant-b vehicle used to prove cross-tenant isolation.',
  status: 'available',
  featured: false,
  location: 'Bandung',
  features: ['Uji isolasi'],
  ownerCount: 1,
  documents: { stnk: true, bpkb: true },
  createdAt: new Date('2026-10-18T00:00:00.000Z'),
  updatedAt: new Date('2026-10-18T00:00:00.000Z'),
  publishedAt: new Date('2026-10-18T00:00:00.000Z'),
  reservedAt: null,
  soldAt: null,
}

/** Cross-tenant attempts used by the isolation suites. */
export const attacks = {
  primaTenant: prima.tenantId,
  tenantBTenant: tenantB.tenantId,
  primaVehicleSlug: mockVehicles[0]?.slug ?? 'missing-fixture-slug',
  tenantBVehicleSlug: TENANT_B_VEHICLE_SLUG,
  externalTenantId: '99999999-9999-4999-8999-999999999999',
  unknownHostname: 'unknown.otoweb.id',
  malformedHostname: 'not a hostname/path',
} as const
