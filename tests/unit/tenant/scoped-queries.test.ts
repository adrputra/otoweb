// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { vehicleImages, vehicles } from '@/db/schema'
import { withTenantSession } from '@/lib/tenant/session'
import {
  TenantScopeError,
  getShowroomSettings,
  getTenantById,
  getTenantVehicleBySlug,
  listTenantDomains,
  listTenantMembers,
  listTenantVehicleImages,
  listTenantVehicles,
  requireTenantId,
} from '@/lib/tenant/scoped-queries'

import {
  TENANT_B_VEHICLE_IMAGE_ID,
  prima,
  tenantB,
  tenantBVehicle,
} from './fixtures'
import { createTenantTestDatabase, type TenantTestDatabase } from './database'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
  await harness.db.insert(vehicles).values(tenantBVehicle)
  await harness.db.insert(vehicleImages).values({
    id: TENANT_B_VEHICLE_IMAGE_ID,
    tenantId: tenantB.tenantId,
    vehicleId: tenantBVehicle.id as string,
    provider: 'test',
    providerAssetId: 'tenant-b-image',
    url: 'https://example.test/tenant-b.jpg',
    alt: 'Tenant B isolation vehicle',
    position: 0,
    isCover: true,
  })
}, 30_000)

afterEach(async () => {
  await harness.close()
})

const primaAccess = { tenantId: prima.tenantId, userId: prima.profileId }
const tenantBAccess = { tenantId: tenantB.tenantId, userId: tenantB.profileId }

describe('tenant-scoped queries', () => {
  it('returns only prima vehicles from a prima context', async () => {
    const rows = await harness.asTenant(primaAccess, (db) => listTenantVehicles(db, prima.tenantId))

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.tenantId === prima.tenantId)).toBe(true)
    expect(rows.some((row) => row.id === tenantBVehicle.id)).toBe(false)
    expect(rows.some((row) => row.slug === tenantBVehicle.slug)).toBe(false)
  })

  it('returns only tenant-b vehicles from a tenant-b context', async () => {
    const rows = await harness.asTenant(tenantBAccess, (db) =>
      listTenantVehicles(db, tenantB.tenantId),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(tenantBVehicle.id)
    expect(rows.every((row) => row.tenantId === tenantB.tenantId)).toBe(true)
  })

  it('returns null for another tenant vehicle requested by exact slug', async () => {
    await expect(
      harness.asTenant(primaAccess, (db) =>
        getTenantVehicleBySlug(db, prima.tenantId, tenantBVehicle.slug),
      ),
    ).resolves.toBeNull()

    await expect(
      harness.asTenant(tenantBAccess, (db) =>
        getTenantVehicleBySlug(db, tenantB.tenantId, tenantBVehicle.slug),
      ),
    ).resolves.toMatchObject({ id: tenantBVehicle.id, tenantId: tenantB.tenantId })
  })

  it('returns only the tenant settings for the active tenant', async () => {
    const primaSettings = await harness.asTenant(primaAccess, (db) =>
      getShowroomSettings(db, prima.tenantId),
    )
    const tenantBSettings = await harness.asTenant(tenantBAccess, (db) =>
      getShowroomSettings(db, tenantB.tenantId),
    )

    expect(primaSettings?.tenantId).toBe(prima.tenantId)
    expect(primaSettings?.displayName).toBe('Prima Auto Gallery')
    expect(tenantBSettings?.tenantId).toBe(tenantB.tenantId)
    expect(tenantBSettings?.displayName).toBe('Tenant B Test Showroom')
    expect(primaSettings?.displayName).not.toBe(tenantBSettings?.displayName)
  })

  it('returns null for another tenant settings row', async () => {
    await expect(
      harness.asTenant(primaAccess, (db) => getShowroomSettings(db, tenantB.tenantId)),
    ).resolves.toBeNull()
    await expect(
      harness.asTenant(primaAccess, (db) => getTenantById(db, tenantB.tenantId)),
    ).resolves.toBeNull()
  })

  it('returns only tenant-b images for the tenant-b vehicle', async () => {
    const tenantBImages = await harness.asTenant(tenantBAccess, (db) =>
      listTenantVehicleImages(db, tenantB.tenantId, tenantBVehicle.id as string),
    )
    const primaImages = await harness.asTenant(primaAccess, (db) =>
      listTenantVehicleImages(db, prima.tenantId, tenantBVehicle.id as string),
    )

    expect(tenantBImages).toHaveLength(1)
    expect(tenantBImages[0]?.tenantId).toBe(tenantB.tenantId)
    expect(primaImages).toEqual([])
  })

  it('returns only the active tenant domains', async () => {
    const primaDomains = await harness.asTenant(primaAccess, (db) =>
      listTenantDomains(db, prima.tenantId),
    )
    const tenantBDomains = await harness.asTenant(tenantBAccess, (db) =>
      listTenantDomains(db, tenantB.tenantId),
    )
    const crossTenant = await harness.asTenant(primaAccess, (db) =>
      listTenantDomains(db, tenantB.tenantId),
    )

    expect(primaDomains.map((row) => row.hostname)).toEqual([prima.hostname])
    expect(tenantBDomains.map((row) => row.hostname)).toEqual([tenantB.hostname])
    expect(crossTenant).toEqual([])
  })

  it('returns only the active tenant memberships', async () => {
    const primaMembers = await harness.asTenant(primaAccess, (db) =>
      listTenantMembers(db, prima.tenantId),
    )
    const tenantBMembers = await harness.asTenant(tenantBAccess, (db) =>
      listTenantMembers(db, tenantB.tenantId),
    )

    expect(primaMembers).toHaveLength(1)
    expect(primaMembers[0]?.tenantId).toBe(prima.tenantId)
    expect(primaMembers.some((row) => row.tenantId === tenantB.tenantId)).toBe(false)

    expect(tenantBMembers).toHaveLength(1)
    expect(tenantBMembers[0]?.tenantId).toBe(tenantB.tenantId)
  })
})

describe('transaction-local tenant session', () => {
  it('applies RLS settings inside the transaction and resets them afterwards', async () => {
    let inside = -1
    let after = -1

    await harness.rawAsTenant({ tenantId: null, userId: null }, async () => {
      const rows = await withTenantSession(
        harness.db,
        { tenantId: prima.tenantId, userId: prima.profileId },
        (tx) => tx.select({ id: vehicles.id }).from(vehicles),
      )
      inside = rows.length

      const post = await harness.db.select({ id: vehicles.id }).from(vehicles)
      after = post.length
    })

    expect(inside).toBeGreaterThan(0)
    expect(after).toBe(0)
  })

  it('rejects a missing tenant before opening a transaction', async () => {
    await expect(
      withTenantSession(harness.db, { tenantId: '', userId: prima.profileId }, async () => 1),
    ).rejects.toMatchObject({ code: 'missing_tenant_id' })
  })
})

describe('tenant scope guard', () => {
  it.each([null, undefined, ''])('rejects a missing tenant id: %s', (value) => {
    expect(() => requireTenantId(value)).toThrow(TenantScopeError)
    try {
      requireTenantId(value)
    } catch (error) {
      expect(error).toMatchObject({ code: 'missing_tenant_id' })
    }
  })

  it('rejects a malformed tenant id', () => {
    expect(() => requireTenantId('tenant-b')).toThrow(TenantScopeError)
    try {
      requireTenantId('tenant-b')
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid_tenant_id' })
    }
  })

  it('rejects a malformed vehicle id in an image query', async () => {
    await expect(
      harness.asTenant(primaAccess, (db) =>
        listTenantVehicleImages(db, prima.tenantId, 'not-a-uuid'),
      ),
    ).rejects.toMatchObject({ code: 'invalid_vehicle_id' })
  })
})
