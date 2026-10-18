import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { vehicleImages } from '@/db/schema'
import type * as schema from '@/db/schema'
import { getTenantVehicleById, listTenantVehicleImages } from '@/lib/tenant/scoped-queries'
import { isUuid, withTenantSession } from '@/lib/tenant/session'
import { inspectImage } from '@/lib/media/inspect'
import { MAX_VEHICLE_IMAGES, MAX_ALT_LENGTH } from '@/lib/media/limits'
import { uploadWithRetry, type RetryOptions } from '@/lib/media/retry'
import type { MediaProvider } from '@/lib/media/types'
import { thumbnailImageUrl } from '@/lib/media/urls'
import type { VehicleImage } from '@/lib/types'
import { imageAltSchema } from '@/lib/validation/vehicle-image'

import { cleanupUnreferencedMedia, type MediaCleanupSummary } from './media-cleanup'
import type { TenantActor } from './vehicle-service'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>
type VehicleImageRow = typeof vehicleImages.$inferSelect

export type VehicleImageServiceError = 'invalid' | 'not_found' | 'conflict' | 'provider'

export type VehicleImageServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: VehicleImageServiceError
      message: string
      fieldErrors?: Record<string, string[]>
    }

export interface UploadVehicleImageInput {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly alt?: string
}

export interface UploadVehicleImageOptions {
  readonly folder?: string
  readonly retry?: RetryOptions
}

export interface UploadVehicleImageData {
  readonly image: VehicleImage
  readonly deduplicated: boolean
}

export interface DeleteVehicleImageData {
  readonly id: string
  readonly images: VehicleImage[]
  readonly media: MediaCleanupSummary
}

function invalid(
  message: string,
  fieldErrors?: Record<string, string[]>,
): VehicleImageServiceResult<never> {
  return { ok: false, error: 'invalid', message, fieldErrors }
}

function notFound(): VehicleImageServiceResult<never> {
  return { ok: false, error: 'not_found', message: 'Kendaraan tidak ditemukan.' }
}

function providerFailure(message = 'Gagal mengunggah foto. Coba lagi.'): VehicleImageServiceResult<never> {
  return { ok: false, error: 'provider', message }
}

function toVehicleImage(row: VehicleImageRow): VehicleImage {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    order: row.position,
    isCover: row.isCover,
    thumbnailUrl: thumbnailImageUrl(row.url, 480),
    provider: row.provider,
    providerAssetId: row.providerAssetId,
    width: row.width,
    height: row.height,
  }
}

function sortRows(rows: readonly VehicleImageRow[]): VehicleImageRow[] {
  return [...rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

function safeFolder(folder: string): string {
  const cleaned = folder
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '-'))
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/')

  return cleaned || 'otoweb/vehicles'
}

function assetPublicId(
  folder: string,
  tenantId: string,
  vehicleId: string,
  bytes: Uint8Array,
): string {
  const digest = createHash('sha256').update(bytes).digest('hex')
  return `${safeFolder(folder)}/${tenantId}/${vehicleId}/${digest}`
}

function deriveAlt(filename: string): string {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, '')
  const readable = withoutExtension.replace(/[-_]+/g, ' ').trim().slice(0, MAX_ALT_LENGTH)
  return readable || 'Foto kendaraan'
}

function parseAlt(input: UploadVehicleImageInput): VehicleImageServiceResult<string> {
  const value = input.alt === undefined ? deriveAlt(input.filename) : input.alt
  const parsed = imageAltSchema.safeParse(value)

  if (!parsed.success) {
    return invalid('Periksa keterangan foto.', {
      alt: parsed.error.issues.map((issue) => issue.message),
    })
  }

  return { ok: true, data: parsed.data ?? deriveAlt(input.filename) }
}

interface UploadPreparation {
  readonly publicId: string
  readonly existing: VehicleImageRow | null
}

/** List a vehicle's images in stored position order. */
export async function listVehicleImages(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
): Promise<VehicleImageServiceResult<VehicleImage[]>> {
  if (!isUuid(vehicleId)) return invalid('ID kendaraan tidak valid.', { id: ['ID tidak valid'] })

  return withTenantSession(db, actor, async (tx) => {
    const vehicle = await getTenantVehicleById(tx, actor.tenantId, vehicleId)
    if (!vehicle) return notFound()

    const rows = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    return { ok: true as const, data: sortRows(rows).map(toVehicleImage) }
  })
}

/**
 * Upload one image. Content is validated first, the provider upload happens
 * outside any database transaction, and the row insert re-checks the vehicle,
 * count, and deterministic asset identity before writing.
 */
export async function uploadVehicleImage(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  input: UploadVehicleImageInput,
  provider: MediaProvider,
  options: UploadVehicleImageOptions = {},
): Promise<VehicleImageServiceResult<UploadVehicleImageData>> {
  if (!isUuid(vehicleId)) return invalid('ID kendaraan tidak valid.', { id: ['ID tidak valid'] })

  const inspection = inspectImage(input.bytes)
  if (!inspection.ok) {
    return invalid(inspection.message, { file: [inspection.message] })
  }

  const alt = parseAlt(input)
  if (!alt.ok) return alt

  const folder = options.folder ?? 'otoweb/vehicles'
  const publicId = assetPublicId(folder, actor.tenantId, vehicleId, input.bytes)

  const preparation = await withTenantSession<
    VehicleImageServiceResult<UploadPreparation>
  >(db, actor, async (tx) => {
    const vehicle = await getTenantVehicleById(tx, actor.tenantId, vehicleId)
    if (!vehicle) return notFound()

    const rows = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    const existing = rows.find(
      (row) => row.provider === provider.key && row.providerAssetId === publicId,
    )
    if (existing) return { ok: true as const, data: { publicId, existing } }

    if (rows.length >= MAX_VEHICLE_IMAGES) {
      return invalid(`Maksimal ${MAX_VEHICLE_IMAGES} foto per kendaraan.`, {
        images: [`Maksimal ${MAX_VEHICLE_IMAGES} foto per kendaraan.`],
      })
    }

    return { ok: true as const, data: { publicId, existing: null } }
  })

  if (!preparation.ok) return preparation
  if (preparation.data.existing) {
    return {
      ok: true,
      data: { image: toVehicleImage(preparation.data.existing), deduplicated: true },
    }
  }

  let uploaded
  try {
    uploaded = await uploadWithRetry(
      provider,
      {
        bytes: input.bytes,
        filename: input.filename,
        contentType: inspection.image.contentType,
        publicId,
        width: inspection.image.width,
        height: inspection.image.height,
      },
      options.retry,
    )
  } catch {
    return providerFailure()
  }

  const stored = await withTenantSession<VehicleImageServiceResult<UploadVehicleImageData>>(
    db,
    actor,
    async (tx) => {
      const vehicle = await getTenantVehicleById(tx, actor.tenantId, vehicleId)
      if (!vehicle) return notFound()

      const rows = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
      const existing = rows.find(
        (row) => row.provider === provider.key && row.providerAssetId === uploaded.assetId,
      )
      if (existing) {
        return { ok: true as const, data: { image: toVehicleImage(existing), deduplicated: true } }
      }

      if (rows.length >= MAX_VEHICLE_IMAGES) {
        return invalid(`Maksimal ${MAX_VEHICLE_IMAGES} foto per kendaraan.`, {
          images: [`Maksimal ${MAX_VEHICLE_IMAGES} foto per kendaraan.`],
        })
      }

      const position = rows.reduce((max, row) => Math.max(max, row.position), -1) + 1
      const [row] = await tx
        .insert(vehicleImages)
        .values({
          tenantId: actor.tenantId,
          vehicleId,
          provider: uploaded.provider,
          providerAssetId: uploaded.assetId,
          url: uploaded.url,
          alt: alt.data,
          position,
          isCover: !rows.some((item) => item.isCover),
          width: uploaded.width,
          height: uploaded.height,
        })
        .returning()

      if (!row) return providerFailure('Foto tersimpan tetapi tidak dapat dibaca kembali.')
      return { ok: true as const, data: { image: toVehicleImage(row), deduplicated: false } }
    },
  )

  if (!stored.ok) {
    // The provider already accepted the bytes, but no row references them (for
    // example because the vehicle was deleted mid-upload). Best-effort cleanup
    // is reference-counted, so a concurrent insert for the same asset wins.
    await cleanupUnreferencedMedia(
      db,
      [{ provider: uploaded.provider, assetId: uploaded.assetId }],
      provider,
    )
  }

  return stored
}

/**
 * Rewrite positions to the requested order. The id list must be the exact
 * current set, which makes partial or foreign reorders atomic no-ops.
 */
export async function reorderVehicleImages(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  imageIds: readonly string[],
): Promise<VehicleImageServiceResult<VehicleImage[]>> {
  if (!isUuid(vehicleId)) return invalid('ID kendaraan tidak valid.', { id: ['ID tidak valid'] })
  if (imageIds.length === 0) return invalid('Tidak ada foto untuk diurutkan.')
  if (new Set(imageIds).size !== imageIds.length) {
    return invalid('Daftar urutan foto berisi duplikat.')
  }
  if (imageIds.some((id) => !isUuid(id))) return invalid('ID foto tidak valid.')

  return withTenantSession(db, actor, async (tx) => {
    const vehicle = await getTenantVehicleById(tx, actor.tenantId, vehicleId)
    if (!vehicle) return notFound()

    const rows = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    if (rows.length !== imageIds.length) {
      return invalid('Daftar urutan foto tidak cocok dengan foto kendaraan ini.')
    }

    const currentIds = new Set(rows.map((row) => row.id))
    if (!imageIds.every((id) => currentIds.has(id))) {
      return invalid('Daftar urutan foto memuat foto yang tidak dikenal.')
    }

    for (const [index, id] of imageIds.entries()) {
      await tx
        .update(vehicleImages)
        .set({ position: index })
        .where(
          and(
            eq(vehicleImages.tenantId, actor.tenantId),
            eq(vehicleImages.vehicleId, vehicleId),
            eq(vehicleImages.id, id),
          ),
        )
    }

    const updated = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    return { ok: true as const, data: sortRows(updated).map(toVehicleImage) }
  })
}

/** Choose exactly one cover; every other row is cleared atomically. */
export async function setVehicleImageCover(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  imageId: unknown,
): Promise<VehicleImageServiceResult<VehicleImage[]>> {
  if (!isUuid(vehicleId)) return invalid('ID kendaraan tidak valid.', { id: ['ID tidak valid'] })
  if (!isUuid(imageId)) return invalid('ID foto tidak valid.', { imageId: ['ID tidak valid'] })

  return withTenantSession(db, actor, async (tx) => {
    const vehicle = await getTenantVehicleById(tx, actor.tenantId, vehicleId)
    if (!vehicle) return notFound()

    const rows = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    const target = rows.find((row) => row.id === imageId)
    if (!target) {
      return { ok: false as const, error: 'not_found' as const, message: 'Foto tidak ditemukan.' }
    }

    if (!target.isCover) {
      await tx
        .update(vehicleImages)
        .set({ isCover: false })
        .where(
          and(
            eq(vehicleImages.tenantId, actor.tenantId),
            eq(vehicleImages.vehicleId, vehicleId),
          ),
        )

      await tx
        .update(vehicleImages)
        .set({ isCover: true })
        .where(
          and(
            eq(vehicleImages.tenantId, actor.tenantId),
            eq(vehicleImages.vehicleId, vehicleId),
            eq(vehicleImages.id, imageId),
          ),
        )
    }

    const updated = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    return { ok: true as const, data: sortRows(updated).map(toVehicleImage) }
  })
}

/**
 * Delete one image, compact positions, promote a new cover when needed, and
 * destroy the provider asset only if no other row references it.
 */
export async function deleteVehicleImage(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  imageId: unknown,
  provider: MediaProvider | null = null,
): Promise<VehicleImageServiceResult<DeleteVehicleImageData>> {
  if (!isUuid(vehicleId)) return invalid('ID kendaraan tidak valid.', { id: ['ID tidak valid'] })
  if (!isUuid(imageId)) return invalid('ID foto tidak valid.', { imageId: ['ID tidak valid'] })

  const deleted = await withTenantSession<
    | VehicleImageServiceResult<{
        id: string
        rows: VehicleImageRow[]
        candidate: { provider: string; assetId: string | null }
      }>
  >(db, actor, async (tx) => {
    const vehicle = await getTenantVehicleById(tx, actor.tenantId, vehicleId)
    if (!vehicle) return notFound()

    const rows = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    const target = rows.find((row) => row.id === imageId)
    if (!target) {
      return { ok: false as const, error: 'not_found' as const, message: 'Foto tidak ditemukan.' }
    }

    await tx
      .delete(vehicleImages)
      .where(
        and(
          eq(vehicleImages.tenantId, actor.tenantId),
          eq(vehicleImages.vehicleId, vehicleId),
          eq(vehicleImages.id, imageId),
        ),
      )

    const remaining = sortRows(rows.filter((row) => row.id !== imageId))
    const hasCover = remaining.some((row) => row.isCover)
    const promotedId = target.isCover && !hasCover ? (remaining[0]?.id ?? null) : null

    for (const [index, row] of remaining.entries()) {
      const nextCover = promotedId ? row.id === promotedId : row.isCover
      if (row.position !== index || row.isCover !== nextCover) {
        await tx
          .update(vehicleImages)
          .set({ position: index, isCover: nextCover })
          .where(
            and(
              eq(vehicleImages.tenantId, actor.tenantId),
              eq(vehicleImages.vehicleId, vehicleId),
              eq(vehicleImages.id, row.id),
            ),
          )
      }
    }

    const updated = await listTenantVehicleImages(tx, actor.tenantId, vehicleId)
    return {
      ok: true as const,
      data: {
        id: imageId,
        rows: sortRows(updated),
        candidate: { provider: target.provider, assetId: target.providerAssetId },
      },
    }
  })

  if (!deleted.ok) return deleted

  const media = await cleanupUnreferencedMedia(db, [deleted.data.candidate], provider)

  return {
    ok: true,
    data: {
      id: deleted.data.id,
      images: deleted.data.rows.map(toVehicleImage),
      media,
    },
  }
}
