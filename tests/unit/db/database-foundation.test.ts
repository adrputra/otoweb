// @vitest-environment node
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getDatabase } from '@/db/client'
import { showroom as mockShowroom, vehicles as mockVehicles } from '@/data'
import { PRIMA_TENANT_ID, seedDatabase } from '@/db/seed-core'
import * as schema from '@/db/schema'
import type { Vehicle as MockVehicle } from '@/lib/types'

function expectedStatus(vehicle: MockVehicle): string {
  if (vehicle.publication === 'draft') return 'draft'
  if (vehicle.publication === 'archived') return 'archived'
  return vehicle.availability
}

const migrationsFolder = fileURLToPath(new URL('../../../db/migrations', import.meta.url))

const requiredTables = [
  'profiles',
  'showroom_settings',
  'tenant_domains',
  'tenant_members',
  'tenants',
  'vehicle_images',
  'vehicles',
]

let client: PGlite
let db: PgliteDatabase<typeof schema>

beforeAll(async () => {
  client = new PGlite()
  db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder })
  await seedDatabase(db)
}, 30_000)

afterAll(async () => {
  await client.close()
})

describe('database foundation migrations', () => {
  it('creates every required table from an empty database', async () => {
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `)

    const tableNames = result.rows.map((row) => row.table_name)

    expect(tableNames).toEqual(expect.arrayContaining(requiredTables))
  })

  it('creates the declared enum types and tenant foreign keys', async () => {
    const enumResult = await db.execute<{ typname: string }>(sql`
      select typname
      from pg_type
      where typname in (
        'tenant_status',
        'tenant_domain_type',
        'tenant_member_role',
        'vehicle_transmission',
        'vehicle_fuel_type',
        'vehicle_status'
      )
      order by typname
    `)

    expect(enumResult.rows.map((row) => row.typname)).toEqual([
      'tenant_domain_type',
      'tenant_member_role',
      'tenant_status',
      'vehicle_fuel_type',
      'vehicle_status',
      'vehicle_transmission',
    ])

    const foreignKeys = await db.execute<{ table_name: string }>(sql`
      select distinct tc.table_name
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY'
        and ccu.table_name = 'tenants'
      order by tc.table_name
    `)

    expect(foreignKeys.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        'showroom_settings',
        'tenant_domains',
        'tenant_members',
        'vehicle_images',
        'vehicles',
      ]),
    )
  })

  it('is safe to apply the migrations a second time', async () => {
    await expect(migrate(db, { migrationsFolder })).resolves.toBeUndefined()

    const result = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'tenants',
          'tenant_domains',
          'profiles',
          'tenant_members',
          'showroom_settings',
          'vehicles',
          'vehicle_images'
        )
    `)

    expect(result.rows[0]?.count).toBe(requiredTables.length)
  })
})

describe('database foundation seed', () => {
  it('creates both development showrooms and their configuration', async () => {
    const tenantRows = await db.select().from(schema.tenants)
    const domainRows = await db.select().from(schema.tenantDomains)
    const profileRows = await db.select().from(schema.profiles)
    const memberRows = await db.select().from(schema.tenantMembers)
    const settingsRows = await db.select().from(schema.showroomSettings)

    expect(tenantRows).toHaveLength(2)
    expect(tenantRows.map((tenant) => tenant.name).sort()).toEqual([
      'Prima Auto Gallery',
      'Tenant B Test Showroom',
    ])

    expect(domainRows).toHaveLength(2)
    expect(domainRows.map((domain) => domain.hostname).sort()).toEqual([
      'prima.otoweb.id',
      'tenant-b.otoweb.id',
    ])

    expect(profileRows).toHaveLength(2)
    expect(memberRows).toHaveLength(2)
    expect(memberRows.every((member) => member.role === 'owner')).toBe(true)

    expect(settingsRows).toHaveLength(2)
    const primaSettings = settingsRows.find((settings) => settings.tenantId === PRIMA_TENANT_ID)
    expect(primaSettings?.displayName).toBe('Prima Auto Gallery')
    expect(primaSettings?.phone).toBe(mockShowroom.contact.phone)
    expect(primaSettings?.whatsapp).toBe(mockShowroom.contact.whatsapp)
    expect(primaSettings?.email).toBe(mockShowroom.contact.email)
    expect(primaSettings?.primaryColor).toBe(mockShowroom.colors.primary)
    expect(primaSettings?.seoTitle).toBe(mockShowroom.seo.title)
  })

  it('migrates all twelve mock vehicles and images into the database', async () => {
    const vehicleRows = await db.select().from(schema.vehicles)
    const imageRows = await db.select().from(schema.vehicleImages)

    expect(vehicleRows).toHaveLength(12)
    expect(imageRows).toHaveLength(12)
    expect(vehicleRows.every((vehicle) => vehicle.tenantId === PRIMA_TENANT_ID)).toBe(true)

    for (const mockVehicle of mockVehicles) {
      const vehicle = vehicleRows.find((row) => row.slug === mockVehicle.slug)

      expect(vehicle, `missing seed vehicle ${mockVehicle.slug}`).toBeDefined()
      expect(vehicle).toMatchObject({
        brand: mockVehicle.brand,
        model: mockVehicle.model,
        variant: mockVehicle.variant,
        year: mockVehicle.year,
        transmission: mockVehicle.transmission,
        fuelType: mockVehicle.fuel,
        bodyType: mockVehicle.bodyType,
        engineCapacity: mockVehicle.engineCc,
        mileage: mockVehicle.mileageKm,
        color: mockVehicle.color,
        price: mockVehicle.price,
        originalPrice: mockVehicle.originalPrice ?? null,
        plateRegion: mockVehicle.plateRegion,
        taxExpiryDate: mockVehicle.taxExpiry,
        description: mockVehicle.description,
        featured: mockVehicle.featured,
        location: mockVehicle.location,
        features: mockVehicle.features,
        ownerCount: mockVehicle.ownerCount,
        documents: mockVehicle.documents,
        status: expectedStatus(mockVehicle),
      })

      const image = imageRows.find((row) => row.vehicleId === vehicle?.id)
      expect(image, `missing image for ${mockVehicle.slug}`).toBeDefined()
      expect(image).toMatchObject({
        tenantId: PRIMA_TENANT_ID,
        provider: 'unsplash',
        providerAssetId: mockVehicle.images[0].id,
        url: mockVehicle.images[0].url,
        alt: mockVehicle.images[0].alt,
        position: mockVehicle.images[0].order,
        isCover: mockVehicle.images[0].isCover,
      })
    }
  })

  it('preserves draft, reserved, sold, and featured semantics', async () => {
    const vehicleRows = await db.select().from(schema.vehicles)
    const bySlug = new Map(vehicleRows.map((vehicle) => [vehicle.slug, vehicle]))

    const draft = bySlug.get(mockVehicles[9].slug)
    const sold = bySlug.get(mockVehicles[10].slug)
    const reserved = vehicleRows.filter((vehicle) => vehicle.status === 'reserved')
    const featured = vehicleRows.filter((vehicle) => vehicle.featured)

    expect(draft?.status).toBe('draft')
    expect(sold?.status).toBe('sold')
    expect(sold?.soldAt).toBeInstanceOf(Date)
    expect(reserved).toHaveLength(2)
    expect(featured).toHaveLength(4)
  })

  it('is idempotent when the seed runs again', async () => {
    const before = {
      tenants: (await db.select().from(schema.tenants)).length,
      domains: (await db.select().from(schema.tenantDomains)).length,
      profiles: (await db.select().from(schema.profiles)).length,
      memberships: (await db.select().from(schema.tenantMembers)).length,
      settings: (await db.select().from(schema.showroomSettings)).length,
      vehicles: (await db.select().from(schema.vehicles)).length,
      images: (await db.select().from(schema.vehicleImages)).length,
    }

    await seedDatabase(db)

    const after = {
      tenants: (await db.select().from(schema.tenants)).length,
      domains: (await db.select().from(schema.tenantDomains)).length,
      profiles: (await db.select().from(schema.profiles)).length,
      memberships: (await db.select().from(schema.tenantMembers)).length,
      settings: (await db.select().from(schema.showroomSettings)).length,
      vehicles: (await db.select().from(schema.vehicles)).length,
      images: (await db.select().from(schema.vehicleImages)).length,
    }

    expect(after).toEqual(before)
    expect(after).toEqual({
      tenants: 2,
      domains: 2,
      profiles: 2,
      memberships: 2,
      settings: 2,
      vehicles: 12,
      images: 12,
    })
  })
})

describe('database configuration', () => {
  it('fails with a clear message when DATABASE_URL is missing', () => {
    const previous = process.env.DATABASE_URL
    delete process.env.DATABASE_URL

    try {
      expect(() => getDatabase()).toThrow(/DATABASE_URL/)
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous
    }
  })
})
