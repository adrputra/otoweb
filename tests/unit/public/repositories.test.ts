// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { vehicles } from '@/db/schema'
import {
  getPublicVehicleBySlug,
  getShowroomForTenant,
  listFeaturedVehicles,
  listPublicVehicleBrands,
  listPublicVehicles,
  listRelatedPublicVehicles,
  normalizeVehicleFilters,
} from '@/lib/public/queries'
import type { TenantIdentity } from '@/lib/tenant/types'
import type { VehicleFilters } from '@/lib/types'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { prima, TENANT_B_VEHICLE_ID, TENANT_B_VEHICLE_SLUG, tenantB, tenantBVehicle } from '../tenant/fixtures'

let database: TenantTestDatabase

const PRIMA_FORTUNER_SLUG = 'toyota-fortuner-2021-1'
const PRIMA_DRAFT_SLUG = 'toyota-raize-2022-10'

const primaTenant: TenantIdentity = {
  id: prima.tenantId,
  name: prima.tenantName,
  slug: prima.tenantSlug,
  status: prima.tenantStatus,
  plan: 'starter',
}

const tenantBTenant: TenantIdentity = {
  id: tenantB.tenantId,
  name: tenantB.tenantName,
  slug: tenantB.tenantSlug,
  status: tenantB.tenantStatus,
  plan: 'trial',
}

beforeAll(async () => {
  database = await createTenantTestDatabase()
  await database.asOwner(async (db) => {
    await db.insert(vehicles).values(tenantBVehicle)
  })
})

afterAll(async () => {
  await database?.close()
})

describe('public showroom mapping', () => {
  it('maps the stored Prima settings without touching another tenant', async () => {
    const showroom = await getShowroomForTenant(database.db, primaTenant)

    expect(showroom.id).toBe(prima.tenantId)
    expect(showroom.name).toBe('Prima Auto Gallery')
    expect(showroom.tagline).toContain('Pilihan mobil')
    expect(showroom.contact.whatsapp).toBe('6281299001122')
    expect(showroom.colors.primary).toBe('#b88a44')
    expect(showroom.address.city).toBe('Jakarta Selatan')
    expect(showroom.heroImageUrl).toContain('images.unsplash.com')
    expect(showroom.heroImageUrl).toContain('w=2200')
    expect(showroom.hero.headline).toBe(showroom.name)
    expect(showroom.seo.title).toContain('Prima Auto Gallery')
  })

  it('maps the Tenant B settings, not Prima data', async () => {
    const showroom = await getShowroomForTenant(database.db, tenantBTenant)

    expect(showroom.id).toBe(tenantB.tenantId)
    expect(showroom.name).toBe('Tenant B Test Showroom')
    expect(showroom.colors.primary).toBe('#0f766e')
    expect(showroom.contact.whatsapp).toBe('6281200000002')
    expect(showroom.address.city).toBe('Bandung')
  })
})

describe('public inventory', () => {
  it('returns only the tenant public statuses', async () => {
    const listed = await listPublicVehicles(database.db, prima.tenantId)

    expect(listed).toHaveLength(11)
    expect(listed.every((vehicle) => vehicle.publication === 'published')).toBe(true)
    expect(listed.some((vehicle) => vehicle.slug === PRIMA_DRAFT_SLUG)).toBe(false)
    expect(listed.every((vehicle) => ['available', 'reserved', 'sold'].includes(vehicle.availability))).toBe(true)
  })

  it('excludes another tenant even when they share the inventory surface', async () => {
    const primaList = await listPublicVehicles(database.db, prima.tenantId)
    const tenantBList = await listPublicVehicles(database.db, tenantB.tenantId)

    expect(primaList.some((vehicle) => vehicle.id === TENANT_B_VEHICLE_ID)).toBe(false)
    expect(tenantBList.map((vehicle) => vehicle.id)).toEqual([TENANT_B_VEHICLE_ID])
  })

  it('lists distinct tenant brands in sorted order', async () => {
    await expect(listPublicVehicleBrands(database.db, prima.tenantId)).resolves.toEqual([
      'Honda',
      'Mitsubishi',
      'Suzuki',
      'Toyota',
    ])
  })

  it('filters by brand, fuel, transmission, year, price, and mileage', async () => {
    const toyota = await listPublicVehicles(database.db, prima.tenantId, { brand: 'Toyota' })
    const diesel = await listPublicVehicles(database.db, prima.tenantId, { fuel: 'diesel' })
    const cvt = await listPublicVehicles(database.db, prima.tenantId, { transmission: 'CVT' })
    const year2022 = await listPublicVehicles(database.db, prima.tenantId, { year: 2022 })
    const cheap = await listPublicVehicles(database.db, prima.tenantId, {
      maxPrice: 250_000_000,
    })
    const lowMileage = await listPublicVehicles(database.db, prima.tenantId, {
      maxMileage: 20_000,
    })

    expect(toyota).toHaveLength(5)
    expect(toyota.every((vehicle) => vehicle.brand === 'Toyota')).toBe(true)
    expect(diesel.length).toBeGreaterThan(0)
    expect(diesel.every((vehicle) => vehicle.fuel === 'diesel')).toBe(true)
    expect(cvt.length).toBeGreaterThan(0)
    expect(cvt.every((vehicle) => vehicle.transmission === 'CVT')).toBe(true)
    expect(year2022.length).toBeGreaterThan(0)
    expect(year2022.every((vehicle) => vehicle.year === 2022)).toBe(true)
    expect(cheap.length).toBeGreaterThan(0)
    expect(cheap.every((vehicle) => vehicle.price <= 250_000_000)).toBe(true)
    expect(lowMileage.length).toBeGreaterThan(0)
    expect(lowMileage.every((vehicle) => vehicle.mileageKm <= 20_000)).toBe(true)
  })

  it('sorts by newest, price, year, and mileage with a stable order', async () => {
    const newest = await listPublicVehicles(database.db, prima.tenantId, { sort: 'terbaru' })
    const cheapest = await listPublicVehicles(database.db, prima.tenantId, {
      sort: 'harga-terendah',
    })
    const mostExpensive = await listPublicVehicles(database.db, prima.tenantId, {
      sort: 'harga-tertinggi',
    })
    const newestYear = await listPublicVehicles(database.db, prima.tenantId, {
      sort: 'tahun-terbaru',
    })
    const lowestMileage = await listPublicVehicles(database.db, prima.tenantId, {
      sort: 'km-terendah',
    })

    expect(newest[0]?.slug).toBe(PRIMA_FORTUNER_SLUG)
    expect(cheapest.map((vehicle) => vehicle.price)).toEqual(
      [...cheapest.map((vehicle) => vehicle.price)].sort((a, b) => a - b),
    )
    expect(mostExpensive.map((vehicle) => vehicle.price)).toEqual(
      [...mostExpensive.map((vehicle) => vehicle.price)].sort((a, b) => b - a),
    )
    expect(newestYear.map((vehicle) => vehicle.year)).toEqual(
      [...newestYear.map((vehicle) => vehicle.year)].sort((a, b) => b - a),
    )
    expect(lowestMileage.map((vehicle) => vehicle.mileageKm)).toEqual(
      [...lowestMileage.map((vehicle) => vehicle.mileageKm)].sort((a, b) => a - b),
    )
  })

  it('applies normalized string filters against the database', async () => {
    const filters = normalizeVehicleFilters({
      brand: 'Honda',
      transmission: 'AT',
      maxPrice: '350000000',
    })
    const results = await listPublicVehicles(database.db, prima.tenantId, filters)

    expect(results.map((vehicle) => vehicle.slug)).toEqual(['honda-brio-2023-8'])
  })

  it('normalizes query strings and ignores malformed values', () => {
    expect(
      normalizeVehicleFilters({
        brand: ' Toyota ',
        transmission: 'AT',
        fuel: 'bensin',
        year: '2021',
        maxPrice: '300000000',
        sort: 'harga-terendah',
      }),
    ).toEqual({
      brand: 'Toyota',
      model: undefined,
      transmission: 'AT',
      fuel: 'bensin',
      year: 2021,
      minPrice: undefined,
      maxPrice: 300_000_000,
      maxMileage: undefined,
      sort: 'harga-terendah',
    })

    expect(
      normalizeVehicleFilters({
        brand: '',
        transmission: 'XX',
        fuel: 'gas',
        year: '-1',
        maxPrice: 'not-a-number',
        sort: 'unknown',
      }),
    ).toEqual({
      brand: undefined,
      model: undefined,
      transmission: undefined,
      fuel: undefined,
      year: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      maxMileage: undefined,
      sort: 'terbaru',
    })
  })
})

describe('featured vehicles', () => {
  it('returns only stored featured public vehicles for the tenant', async () => {
    const featured = await listFeaturedVehicles(database.db, prima.tenantId)

    expect(featured).toHaveLength(4)
    expect(featured.every((vehicle) => vehicle.featured)).toBe(true)
    expect(featured.some((vehicle) => vehicle.id === TENANT_B_VEHICLE_ID)).toBe(false)
    expect(featured.some((vehicle) => vehicle.slug === PRIMA_DRAFT_SLUG)).toBe(false)
  })
})

describe('vehicle detail and related units', () => {
  it('returns the stored public unit for its own tenant', async () => {
    const vehicle = await getPublicVehicleBySlug(
      database.db,
      prima.tenantId,
      PRIMA_FORTUNER_SLUG,
    )

    expect(vehicle).not.toBeNull()
    expect(vehicle?.brand).toBe('Toyota')
    expect(vehicle?.model).toBe('Fortuner')
    expect(vehicle?.price).toBe(485_000_000)
    expect(vehicle?.taxExpiry).toBe('2026-09-12')
    expect(vehicle?.documents).toEqual({ stnk: true, bpkb: true })
    expect(vehicle?.images.length).toBeGreaterThan(0)
    expect(vehicle?.images[0]?.url).toContain('images.unsplash.com')
  })

  it('returns null for a draft, unknown, or cross-tenant slug', async () => {
    await expect(
      getPublicVehicleBySlug(database.db, prima.tenantId, PRIMA_DRAFT_SLUG),
    ).resolves.toBeNull()
    await expect(
      getPublicVehicleBySlug(database.db, prima.tenantId, 'does-not-exist'),
    ).resolves.toBeNull()
    await expect(
      getPublicVehicleBySlug(database.db, prima.tenantId, TENANT_B_VEHICLE_SLUG),
    ).resolves.toBeNull()
    await expect(
      getPublicVehicleBySlug(database.db, tenantB.tenantId, TENANT_B_VEHICLE_SLUG),
    ).resolves.toMatchObject({ id: TENANT_B_VEHICLE_ID })
  })

  it('returns up to three other public units from the same tenant and body type', async () => {
    const current = await getPublicVehicleBySlug(
      database.db,
      prima.tenantId,
      PRIMA_FORTUNER_SLUG,
    )
    expect(current).not.toBeNull()

    const related = await listRelatedPublicVehicles(
      database.db,
      prima.tenantId,
      current!.id,
      current!.bodyType,
    )

    expect(related).toHaveLength(3)
    expect(related.every((vehicle) => vehicle.id !== current!.id)).toBe(true)
    expect(related.every((vehicle) => vehicle.bodyType === current!.bodyType)).toBe(true)
    expect(related.some((vehicle) => vehicle.id === TENANT_B_VEHICLE_ID)).toBe(false)
  })
})

describe('tenant scope guard', () => {
  it('rejects missing or malformed tenant ids before SQL', async () => {
    await expect(listPublicVehicles(database.db, '', {} as VehicleFilters)).rejects.toThrow(
      'missing_tenant_id',
    )
    await expect(listPublicVehicles(database.db, 'not-a-uuid', {} as VehicleFilters)).rejects.toThrow(
      'invalid_tenant_id',
    )
  })
})
