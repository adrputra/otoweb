// @vitest-environment node
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { vehicleImages, vehicles } from '@/db/schema'
import { listAdminVehicles } from '@/lib/admin/vehicle-queries'
import {
  archiveVehicle,
  createVehicle,
  deleteVehicle,
  duplicateVehicle,
  publishVehicle,
  reserveVehicle,
  sellVehicle,
  updateVehicle,
  type TenantActor,
} from '@/lib/admin/vehicle-service'
import { getPublicVehicleBySlug, listPublicVehicles } from '@/lib/public/queries'
import { authorizeTenantAccess } from '@/lib/tenant/guards'
import { resolveTenantContext } from '@/lib/tenant/context'
import type { TenantIdentity, TenantMembership } from '@/lib/tenant/types'
import type { VehicleInput } from '@/lib/validation/vehicle'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { PRIMA_VEHICLE_ID, TENANT_B_VEHICLE_ID, tenantB, prima } from '../tenant/fixtures'

let harness: TenantTestDatabase

const primaActor: TenantActor = {
  tenantId: prima.tenantId,
  userId: prima.profileId,
  isPlatformAdmin: false,
}

const tenantBActor: TenantActor = {
  tenantId: tenantB.tenantId,
  userId: tenantB.profileId,
  isPlatformAdmin: false,
}

let counter = 0

function input(overrides: Partial<VehicleInput> = {}): VehicleInput {
  counter += 1

  return {
    brand: 'Toyota',
    model: 'Fortuner',
    variant: `Uji ${counter}`,
    year: 2024,
    transmission: 'AT',
    fuel: 'diesel',
    bodyType: 'SUV',
    engineCc: 2393,
    mileageKm: 12_500,
    color: 'Putih',
    price: 485_000_000,
    plateRegion: 'B 1234 XYZ',
    taxExpiry: '2027-09-12',
    description: 'Unit uji dengan riwayat servis yang jelas.',
    featured: false,
    location: 'Jakarta Selatan',
    features: ['Kamera parkir'],
    ownerCount: 1,
    documents: { stnk: true, bpkb: true },
    publication: 'draft',
    ...overrides,
  }
}

async function storedRow(id: string) {
  const rows = await harness.db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1)
  return rows[0] ?? null
}

beforeAll(async () => {
  harness = await createTenantTestDatabase()
}, 30_000)

afterAll(async () => {
  await harness?.close()
})

describe('create and publish (US1)', () => {
  it('creates a stored draft, then publishes it into the public inventory', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ variant: 'Publikasi' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const draftRow = await storedRow(created.data.id)
    expect(draftRow).toMatchObject({
      tenantId: prima.tenantId,
      status: 'draft',
      slug: created.data.slug,
    })
    expect(draftRow?.publishedAt).toBeNull()

    const adminList = await listAdminVehicles(harness.db, prima.tenantId)
    expect(adminList.some((vehicle) => vehicle.id === created.data.id)).toBe(true)
    expect(created.data.publication).toBe('draft')

    await expect(
      getPublicVehicleBySlug(harness.db, prima.tenantId, created.data.slug),
    ).resolves.toBeNull()

    const published = await publishVehicle(harness.db, primaActor, created.data.id)
    expect(published.ok).toBe(true)
    if (!published.ok) return

    const publishedRow = await storedRow(created.data.id)
    expect(publishedRow?.status).toBe('available')
    expect(publishedRow?.publishedAt).toBeInstanceOf(Date)
    expect(published.data.publication).toBe('published')

    const publicVehicle = await getPublicVehicleBySlug(
      harness.db,
      prima.tenantId,
      created.data.slug,
    )
    expect(publicVehicle).toMatchObject({
      id: created.data.id,
      brand: 'Toyota',
      publication: 'published',
    })

    const publicList = await listPublicVehicles(harness.db, prima.tenantId)
    expect(publicList.some((vehicle) => vehicle.id === created.data.id)).toBe(true)
  })

  it('creates directly public when requested', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ publication: 'published' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    await expect(
      getPublicVehicleBySlug(harness.db, prima.tenantId, created.data.slug),
    ).resolves.toMatchObject({ id: created.data.id })
  })

  it('generates unique slugs for identical vehicles', async () => {
    const first = await createVehicle(harness.db, primaActor, input({ variant: 'Sama' }))
    const second = await createVehicle(harness.db, primaActor, input({ variant: 'Sama' }))

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.data.slug).not.toBe(second.data.slug)
  })
})

describe('edit (US2)', () => {
  it('updates fields and preserves the public slug', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ publication: 'published' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const updated = await updateVehicle(harness.db, primaActor, created.data.id, {
      ...input({ brand: 'Honda', price: 300_000_000 }),
      publication: 'published',
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return

    expect(updated.data.slug).toBe(created.data.slug)
    expect(updated.data.brand).toBe('Honda')
    expect(updated.data.price).toBe(300_000_000)

    const row = await storedRow(created.data.id)
    expect(row?.brand).toBe('Honda')
    expect(row?.slug).toBe(created.data.slug)
  })

  it('unpublishes a vehicle when saved as draft', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ publication: 'published' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const updated = await updateVehicle(harness.db, primaActor, created.data.id, {
      ...input(),
      publication: 'draft',
    })
    expect(updated.ok).toBe(true)

    const row = await storedRow(created.data.id)
    expect(row?.status).toBe('draft')
    expect(row?.publishedAt).toBeNull()
    await expect(
      getPublicVehicleBySlug(harness.db, prima.tenantId, created.data.slug),
    ).resolves.toBeNull()
  })
})

describe('lifecycle actions (US3)', () => {
  it('reserves, sells, and archives a published unit', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ publication: 'published' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const reserved = await reserveVehicle(harness.db, primaActor, created.data.id)
    expect(reserved.ok).toBe(true)
    if (reserved.ok) expect(reserved.data.availability).toBe('reserved')
    expect((await storedRow(created.data.id))?.reservedAt).toBeInstanceOf(Date)

    const sold = await sellVehicle(harness.db, primaActor, created.data.id)
    expect(sold.ok).toBe(true)
    if (sold.ok) expect(sold.data.availability).toBe('sold')
    expect((await storedRow(created.data.id))?.soldAt).toBeInstanceOf(Date)

    const archived = await archiveVehicle(harness.db, primaActor, created.data.id)
    expect(archived.ok).toBe(true)
    if (archived.ok) expect(archived.data.publication).toBe('archived')

    await expect(
      getPublicVehicleBySlug(harness.db, prima.tenantId, created.data.slug),
    ).resolves.toBeNull()

    const conflictResult = await reserveVehicle(harness.db, primaActor, created.data.id)
    expect(conflictResult).toMatchObject({ ok: false, error: 'conflict' })
  })

  it('duplicates a unit with its images into a draft copy', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ variant: 'Duplikat' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    await harness.db.insert(vehicleImages).values({
      tenantId: prima.tenantId,
      vehicleId: created.data.id,
      provider: 'test',
      providerAssetId: 'test-image',
      url: 'https://example.test/vehicle.jpg',
      alt: 'Uji duplikat',
      position: 0,
      isCover: true,
    })

    const copy = await duplicateVehicle(harness.db, primaActor, created.data.id)
    expect(copy.ok).toBe(true)
    if (!copy.ok) return

    expect(copy.data.id).not.toBe(created.data.id)
    expect(copy.data.slug).toBe(`${created.data.slug}-copy`)
    expect(copy.data.publication).toBe('draft')
    expect(copy.data.images).toHaveLength(1)

    const row = await storedRow(copy.data.id)
    expect(row?.status).toBe('draft')

    const secondCopy = await duplicateVehicle(harness.db, primaActor, created.data.id)
    expect(secondCopy.ok).toBe(true)
    if (secondCopy.ok) expect(secondCopy.data.slug).toBe(`${created.data.slug}-copy-2`)
  })

  it('deletes a unit and cascades its images', async () => {
    const created = await createVehicle(harness.db, primaActor, input({ variant: 'Hapus' }))
    expect(created.ok).toBe(true)
    if (!created.ok) return

    await harness.db.insert(vehicleImages).values({
      tenantId: prima.tenantId,
      vehicleId: created.data.id,
      provider: 'test',
      providerAssetId: 'delete-image',
      url: 'https://example.test/delete.jpg',
      alt: 'Uji hapus',
      position: 0,
      isCover: true,
    })

    const deleted = await deleteVehicle(harness.db, primaActor, created.data.id)
    expect(deleted).toMatchObject({ ok: true })

    expect(await storedRow(created.data.id)).toBeNull()
    const images = await harness.db
      .select({ id: vehicleImages.id })
      .from(vehicleImages)
      .where(
        and(
          eq(vehicleImages.tenantId, prima.tenantId),
          eq(vehicleImages.vehicleId, created.data.id),
        ),
      )
    expect(images).toEqual([])
  })
})

describe('tenant and validation boundaries (US4)', () => {
  it('does not read or mutate another tenant vehicle', async () => {
    const tenantBList = await listAdminVehicles(harness.db, tenantB.tenantId)
    expect(tenantBList.some((vehicle) => vehicle.id === PRIMA_VEHICLE_ID)).toBe(false)
    expect(tenantBList.some((vehicle) => vehicle.id === TENANT_B_VEHICLE_ID)).toBe(false)

    const publishAttempt = await publishVehicle(harness.db, tenantBActor, PRIMA_VEHICLE_ID)
    expect(publishAttempt).toMatchObject({ ok: false, error: 'not_found' })

    const deleteAttempt = await deleteVehicle(harness.db, tenantBActor, PRIMA_VEHICLE_ID)
    expect(deleteAttempt).toMatchObject({ ok: false, error: 'not_found' })

    const updateAttempt = await updateVehicle(harness.db, tenantBActor, PRIMA_VEHICLE_ID, input())
    expect(updateAttempt).toMatchObject({ ok: false, error: 'not_found' })

    expect(await storedRow(PRIMA_VEHICLE_ID)).not.toBeNull()
  })

  it('rejects invalid input before writing', async () => {
    const result = await createVehicle(harness.db, primaActor, {
      ...input(),
      brand: '   ',
      price: 0,
      description: 'pendek',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid')
    expect(result.fieldErrors?.brand).toBeDefined()
    expect(result.fieldErrors?.price).toBeDefined()
    expect(result.fieldErrors?.description).toBeDefined()
  })

  it('rejects malformed vehicle ids without touching the database', async () => {
    await expect(deleteVehicle(harness.db, primaActor, 'car-1')).resolves.toMatchObject({
      ok: false,
      error: 'invalid',
    })

    await expect(
      updateVehicle(harness.db, primaActor, 'not-a-uuid', input()),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })
  })
})

describe('manage_vehicles capability boundary (US4)', () => {
  const primaTenant: TenantIdentity = {
    id: prima.tenantId,
    name: prima.tenantName,
    slug: prima.tenantSlug,
    status: prima.tenantStatus,
    plan: 'starter',
  }

  function membership(role: TenantMembership['role'], status = 'active'): TenantMembership {
    return {
      id: prima.memberId,
      tenantId: prima.tenantId,
      userId: prima.profileId,
      role,
      status,
      tenant: primaTenant,
    }
  }

  it('allows owners and staff to manage vehicles', () => {
    for (const role of ['owner', 'staff'] as const) {
      const result = resolveTenantContext({
        user: { id: prima.profileId },
        memberships: [membership(role)],
      })
      expect(authorizeTenantAccess(result, prima.tenantId, 'manage_vehicles').ok).toBe(true)
    }
  })

  it('denies a user without an active membership', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('owner', 'invited')],
    })

    expect(authorizeTenantAccess(result, prima.tenantId, 'manage_vehicles')).toEqual({
      ok: false,
      error: 'inactive_membership',
    })
  })

  it('denies a mismatched tenant before evaluating the role', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('owner')],
    })

    expect(authorizeTenantAccess(result, tenantB.tenantId, 'manage_vehicles')).toEqual({
      ok: false,
      error: 'tenant_mismatch',
    })
  })
})
