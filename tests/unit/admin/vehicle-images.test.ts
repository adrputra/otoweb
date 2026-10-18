// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { and, asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { vehicleImages } from '@/db/schema'
import {
  deleteVehicleImage,
  reorderVehicleImages,
  setVehicleImageCover,
  uploadVehicleImage,
} from '@/lib/admin/vehicle-image-service'
import { listAdminVehicles } from '@/lib/admin/vehicle-queries'
import {
  createVehicle,
  deleteVehicle,
  duplicateVehicle,
  publishVehicle,
  type TenantActor,
} from '@/lib/admin/vehicle-service'
import { createFakeMediaProvider, type FakeMediaProvider } from '@/lib/media/fake'
import { MAX_IMAGE_BYTES } from '@/lib/media/limits'
import { getPublicVehicleBySlug } from '@/lib/public/queries'
import type { VehicleInput } from '@/lib/validation/vehicle'

import { createHighResolutionImages, createPngFixture } from '../../helpers/image-fixtures'
import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { PRIMA_VEHICLE_ID, prima, tenantB } from '../tenant/fixtures'

let harness: TenantTestDatabase
let highResolution: Uint8Array[]
const directories: string[] = []

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

const retry = { attempts: 2, baseDelayMs: 0, sleep: async () => {} }

let counter = 0

function vehicleInput(overrides: Partial<VehicleInput> = {}): VehicleInput {
  counter += 1
  return {
    brand: 'Toyota',
    model: 'Fortuner',
    variant: `Media ${counter}`,
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
    description: 'Unit uji pengelolaan foto dengan resolusi tinggi.',
    featured: false,
    location: 'Jakarta Selatan',
    features: ['Kamera parkir'],
    ownerCount: 1,
    documents: { stnk: true, bpkb: true },
    publication: 'draft',
    ...overrides,
  }
}

async function createDraft(overrides: Partial<VehicleInput> = {}): Promise<string> {
  const created = await createVehicle(harness.db, primaActor, vehicleInput(overrides))
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error('failed to create fixture vehicle')
  return created.data.id
}

async function makeProvider(options: { failUploads?: number; failDestroys?: number } = {}) {
  const baseDir = await mkdtemp(join(tmpdir(), 'otoweb-images-'))
  directories.push(baseDir)
  return createFakeMediaProvider({ baseDir, ...options })
}

async function upload(
  vehicleId: string,
  provider: FakeMediaProvider,
  bytes: Uint8Array,
  filename = 'foto.png',
  alt?: string,
) {
  return uploadVehicleImage(
    harness.db,
    primaActor,
    vehicleId,
    { bytes, filename, alt },
    provider,
    { retry },
  )
}

async function rows(vehicleId: string) {
  return harness.db
    .select()
    .from(vehicleImages)
    .where(
      and(eq(vehicleImages.tenantId, prima.tenantId), eq(vehicleImages.vehicleId, vehicleId)),
    )
    .orderBy(asc(vehicleImages.position), asc(vehicleImages.id))
}

beforeAll(async () => {
  harness = await createTenantTestDatabase()
  highResolution = createHighResolutionImages(15)
}, 120_000)

afterAll(async () => {
  await harness?.close()
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe('US1 — upload with progress and reliability', () => {
  it('stores 15 high-resolution images in one vehicle workflow', async () => {
    const vehicleId = await createDraft({ variant: 'Lima Belas Foto' })
    const provider = await makeProvider()

    const uploadedIds: string[] = []

    for (const [index, bytes] of highResolution.entries()) {
      const result = await upload(vehicleId, provider, bytes, `foto-${index + 1}.png`)
      expect(result.ok).toBe(true)
      if (result.ok) {
        uploadedIds.push(result.data.image.id)
        expect(result.data.deduplicated).toBe(false)
        expect(result.data.image.thumbnailUrl).toBe(result.data.image.url)
      }
    }

    const stored = await rows(vehicleId)
    expect(stored).toHaveLength(15)
    expect(stored.map((row) => row.position)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    ])
    expect(stored.every((row) => row.width === 3000 && row.height === 2000)).toBe(true)
    expect(stored.every((row) => row.provider === 'fake')).toBe(true)
    expect(stored.filter((row) => row.isCover)).toHaveLength(1)
    expect(stored.find((row) => row.isCover)?.id).toBe(uploadedIds[0])
    expect(provider.uploads).toHaveLength(15)

    const admin = await listAdminVehicles(harness.db, prima.tenantId)
    const mapped = admin.find((vehicle) => vehicle.id === vehicleId)
    expect(mapped?.images).toHaveLength(15)
    expect(mapped?.images.map((image) => image.id)).toEqual(uploadedIds)
  }, 120_000)

  it('deduplicates identical content instead of storing a second row', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider()
    const bytes = createPngFixture({ width: 900, height: 700 })

    const first = await upload(vehicleId, provider, bytes, 'sama.png')
    const second = await upload(vehicleId, provider, bytes, 'sama.png')

    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: true, data: { deduplicated: true } })
    expect(await rows(vehicleId)).toHaveLength(1)
    expect(provider.uploads).toHaveLength(1)
  })

  it('retries transient provider failures without duplicating rows', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider({ failUploads: 1 })

    const result = await upload(vehicleId, provider, createPngFixture({ width: 800, height: 600 }))

    expect(result.ok).toBe(true)
    expect(await rows(vehicleId)).toHaveLength(1)
    expect(provider.uploads).toHaveLength(2)
  })

  it('rejects invalid content, dimensions, size, count, and alt text before storing', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider()

    const unsupported = await upload(vehicleId, provider, new TextEncoder().encode('not an image'))
    expect(unsupported).toMatchObject({ ok: false, error: 'invalid' })
    if (!unsupported.ok) expect(unsupported.fieldErrors?.file).toBeDefined()

    const tooSmall = await upload(
      vehicleId,
      provider,
      createPngFixture({ width: 320, height: 200 }),
    )
    expect(tooSmall).toMatchObject({ ok: false, error: 'invalid' })

    const tooLarge = await upload(vehicleId, provider, new Uint8Array(MAX_IMAGE_BYTES + 1))
    expect(tooLarge).toMatchObject({ ok: false, error: 'invalid' })

    const badAlt = await upload(
      vehicleId,
      provider,
      createPngFixture({ width: 800, height: 600 }),
      'foto.png',
      'x'.repeat(161),
    )
    expect(badAlt).toMatchObject({ ok: false, error: 'invalid' })
    if (!badAlt.ok) expect(badAlt.fieldErrors?.alt).toBeDefined()

    expect(await rows(vehicleId)).toHaveLength(0)
    expect(provider.uploads).toHaveLength(0)

    const fullVehicle = await createDraft({ variant: 'Penuh' })
    await harness.db.insert(vehicleImages).values(
      Array.from({ length: 20 }, (_, index) => ({
        tenantId: prima.tenantId,
        vehicleId: fullVehicle,
        provider: 'test',
        providerAssetId: `existing-${fullVehicle}-${index}`,
        url: `https://example.test/${index}.jpg`,
        alt: `Foto ${index}`,
        position: index,
        isCover: index === 0,
      })),
    )

    const overLimit = await upload(
      fullVehicle,
      provider,
      createPngFixture({ width: 800, height: 600 }),
    )
    expect(overLimit).toMatchObject({ ok: false, error: 'invalid' })
    expect(provider.uploads).toHaveLength(0)
  })
})

describe('US2 — ordering, cover, and optimization', () => {
  it('persists reordering and rejects partial or foreign id sets atomically', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider()
    const ids: string[] = []

    for (let index = 0; index < 3; index += 1) {
      const result = await upload(
        vehicleId,
        provider,
        createPngFixture({ width: 800, height: 600, color: [index * 60, 40, 90] }),
        `urut-${index}.png`,
      )
      expect(result.ok).toBe(true)
      if (result.ok) ids.push(result.data.image.id)
    }

    const reversed = [...ids].reverse()
    const reordered = await reorderVehicleImages(harness.db, primaActor, vehicleId, reversed)
    expect(reordered.ok).toBe(true)
    expect((await rows(vehicleId)).map((row) => row.id)).toEqual(reversed)
    expect((await rows(vehicleId)).map((row) => row.position)).toEqual([0, 1, 2])

    const partial = await reorderVehicleImages(
      harness.db,
      primaActor,
      vehicleId,
      reversed.slice(0, 2),
    )
    expect(partial).toMatchObject({ ok: false, error: 'invalid' })
    expect((await rows(vehicleId)).map((row) => row.id)).toEqual(reversed)

    const otherVehicle = await createDraft()
    const foreignUpload = await upload(
      otherVehicle,
      provider,
      createPngFixture({ width: 800, height: 600 }),
    )
    expect(foreignUpload.ok).toBe(true)
    if (!foreignUpload.ok) return

    const foreign = await reorderVehicleImages(harness.db, primaActor, vehicleId, [
      ...reversed.slice(0, 2),
      foreignUpload.data.image.id,
    ])
    expect(foreign).toMatchObject({ ok: false, error: 'invalid' })
    expect((await rows(vehicleId)).map((row) => row.id)).toEqual(reversed)
  })

  it('persists the cover and makes it the public hero', async () => {
    const vehicleId = await createDraft({ publication: 'published' })
    const provider = await makeProvider()
    const ids: string[] = []

    for (let index = 0; index < 3; index += 1) {
      const result = await upload(
        vehicleId,
        provider,
        createPngFixture({ width: 800, height: 600, color: [index * 50, 80, 120] }),
        `cover-${index}.png`,
      )
      if (result.ok) ids.push(result.data.image.id)
    }

    const published = await publishVehicle(harness.db, primaActor, vehicleId)
    expect(published.ok).toBe(true)
    if (!published.ok) return

    const chosen = ids[2] as string
    const cover = await setVehicleImageCover(harness.db, primaActor, vehicleId, chosen)
    expect(cover.ok).toBe(true)

    const stored = await rows(vehicleId)
    expect(stored.filter((row) => row.isCover)).toHaveLength(1)
    expect(stored.find((row) => row.isCover)?.id).toBe(chosen)

    const admin = await listAdminVehicles(harness.db, prima.tenantId)
    expect(admin.find((vehicle) => vehicle.id === vehicleId)?.images[0]?.id).toBe(ids[0])

    const publicVehicle = await getPublicVehicleBySlug(
      harness.db,
      prima.tenantId,
      published.data.slug,
    )
    expect(publicVehicle?.images[0]).toMatchObject({ id: chosen, isCover: true })
    expect(publicVehicle?.images.filter((image) => image.isCover)).toHaveLength(1)
  })
})

describe('US3 — deletion and media policy', () => {
  it('compacts positions and promotes a cover when the cover is deleted', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider()
    const ids: string[] = []

    for (let index = 0; index < 4; index += 1) {
      const result = await upload(
        vehicleId,
        provider,
        createPngFixture({ width: 800, height: 600, color: [20, index * 40, 90] }),
        `hapus-${index}.png`,
      )
      if (result.ok) ids.push(result.data.image.id)
    }

    const chosen = ids[2] as string
    await setVehicleImageCover(harness.db, primaActor, vehicleId, chosen)

    const deleted = await deleteVehicleImage(
      harness.db,
      primaActor,
      vehicleId,
      chosen,
      provider,
    )

    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return

    expect(deleted.data.images).toHaveLength(3)
    expect(deleted.data.images.map((image) => image.order)).toEqual([0, 1, 2])
    expect(deleted.data.images.filter((image) => image.isCover)).toHaveLength(1)
    expect(deleted.data.images.find((image) => image.isCover)?.id).toBe(ids[0])
    expect(deleted.data.media.destroyed).toBe(1)
    expect(provider.destroys).toHaveLength(1)

    const stored = await rows(vehicleId)
    expect(stored.map((row) => row.position)).toEqual([0, 1, 2])
    expect(stored.find((row) => row.isCover)?.id).toBe(ids[0])
  })

  it('deletes a vehicle, cascades rows, and preserves shared assets until the last reference', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider()

    for (let index = 0; index < 3; index += 1) {
      await upload(
        vehicleId,
        provider,
        createPngFixture({ width: 800, height: 600, color: [index * 70, 20, 30] }),
        `bersama-${index}.png`,
      )
    }

    await harness.db.insert(vehicleImages).values({
      tenantId: prima.tenantId,
      vehicleId,
      provider: 'unsplash',
      providerAssetId: 'external-asset',
      url: 'https://images.unsplash.com/photo-external',
      alt: 'Foto eksternal',
      position: 3,
      isCover: false,
    })

    const copy = await duplicateVehicle(harness.db, primaActor, vehicleId)
    expect(copy.ok).toBe(true)
    if (!copy.ok) return

    const firstDelete = await deleteVehicle(harness.db, primaActor, vehicleId, {
      mediaProvider: provider,
    })
    expect(firstDelete.ok).toBe(true)
    if (!firstDelete.ok) return
    expect(firstDelete.data.media.destroyed).toBe(0)
    expect(firstDelete.data.media.failed).toBe(0)
    expect(provider.destroys).toHaveLength(0)
    expect(await rows(vehicleId)).toHaveLength(0)

    const secondDelete = await deleteVehicle(harness.db, primaActor, copy.data.id, {
      mediaProvider: provider,
    })
    expect(secondDelete.ok).toBe(true)
    if (!secondDelete.ok) return
    expect(secondDelete.data.media.destroyed).toBe(3)
    expect(secondDelete.data.media.skipped).toBe(1)
    expect(provider.destroys).toHaveLength(3)
    expect(await rows(copy.data.id)).toHaveLength(0)
  })

  it('does not block vehicle deletion when provider cleanup fails', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider({ failDestroys: 1 })
    const uploaded = await upload(
      vehicleId,
      provider,
      createPngFixture({ width: 800, height: 600 }),
    )
    expect(uploaded.ok).toBe(true)

    const deleted = await deleteVehicle(harness.db, primaActor, vehicleId, {
      mediaProvider: provider,
    })

    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.data.media.destroyed).toBe(0)
    expect(deleted.data.media.failed).toBe(1)
    expect(deleted.data.media.failures).toHaveLength(1)
    expect(await rows(vehicleId)).toHaveLength(0)
  })
})

describe('US4 — tenant boundaries', () => {
  it('rejects cross-tenant upload, reorder, cover, and delete before provider work', async () => {
    const vehicleId = await createDraft()
    const provider = await makeProvider()
    const first = await upload(
      vehicleId,
      provider,
      createPngFixture({ width: 800, height: 600 }),
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const uploadAttempt = await uploadVehicleImage(
      harness.db,
      tenantBActor,
      vehicleId,
      { bytes: createPngFixture({ width: 800, height: 600 }), filename: 'lain.png' },
      provider,
      { retry },
    )
    expect(uploadAttempt).toMatchObject({ ok: false, error: 'not_found' })
    expect(provider.uploads).toHaveLength(1)

    await expect(
      reorderVehicleImages(harness.db, tenantBActor, vehicleId, [first.data.image.id]),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })

    await expect(
      setVehicleImageCover(harness.db, tenantBActor, vehicleId, first.data.image.id),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })

    await expect(
      deleteVehicleImage(harness.db, tenantBActor, vehicleId, first.data.image.id, provider),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })

    expect(await rows(vehicleId)).toHaveLength(1)
    expect(provider.destroys).toHaveLength(0)

    await expect(
      uploadVehicleImage(
        harness.db,
        primaActor,
        'not-a-uuid',
        { bytes: createPngFixture({ width: 800, height: 600 }), filename: 'x.png' },
        provider,
      ),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })
  })

  it('optimizes seeded Unsplash thumbnails without changing the stored URL', async () => {
    const admin = await listAdminVehicles(harness.db, prima.tenantId)
    const seeded = admin.find((vehicle) => vehicle.id === PRIMA_VEHICLE_ID)
    expect(seeded?.images.length).toBeGreaterThan(0)
    expect(seeded?.images[0]?.thumbnailUrl).toContain('w=480')
    expect(seeded?.images[0]?.thumbnailUrl).toContain('auto=format')
    expect(seeded?.images[0]?.url).not.toContain('w=480')
  })
})

