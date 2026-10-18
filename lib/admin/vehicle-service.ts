import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { vehicleImages, vehicles } from '@/db/schema'
import type * as schema from '@/db/schema'
import { resolveMediaProviderOrNull } from '@/lib/media/provider'
import type { MediaProvider } from '@/lib/media/types'
import { getTenantVehicleById, listTenantVehicleImages } from '@/lib/tenant/scoped-queries'
import { withTenantSession } from '@/lib/tenant/session'
import {
  slugifyVehicle,
  vehicleActionSchema,
  vehicleIdSchema,
  vehicleInputSchema,
  type VehicleInput,
} from '@/lib/validation/vehicle'
import type { Vehicle } from '@/lib/types'

import {
  cleanupUnreferencedMedia,
  type MediaCandidate,
  type MediaCleanupSummary,
} from './media-cleanup'
import { groupVehicleImages, toAdminVehicle } from './vehicle-mapper'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>
type VehicleRow = typeof vehicles.$inferSelect

export interface TenantActor {
  tenantId: string
  userId: string
  isPlatformAdmin: boolean
}

export type VehicleServiceError = 'invalid' | 'not_found' | 'forbidden' | 'conflict'

export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: VehicleServiceError
      fieldErrors?: Record<string, string[]>
      message?: string
    }

function invalid(fieldErrors: Record<string, string[]>): ServiceResult<never> {
  return {
    ok: false,
    error: 'invalid',
    fieldErrors,
    message: 'Periksa kembali data kendaraan.',
  }
}

function notFound(): ServiceResult<never> {
  return { ok: false, error: 'not_found', message: 'Kendaraan tidak ditemukan.' }
}

function conflict(message: string): ServiceResult<never> {
  return { ok: false, error: 'conflict', message }
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    const messages = fieldErrors[key] ?? []
    if (!messages.includes(issue.message)) messages.push(issue.message)
    fieldErrors[key] = messages
  }

  return fieldErrors
}

function parseVehicleInput(input: unknown): ServiceResult<VehicleInput> {
  const parsed = vehicleInputSchema.safeParse(input)
  if (!parsed.success) return invalid(toFieldErrors(parsed.error.issues))
  return { ok: true, data: parsed.data }
}

function parseVehicleId(input: unknown): string | null {
  const parsed = vehicleIdSchema.safeParse(input)
  return parsed.success ? parsed.data : null
}

const PUBLIC_STATUSES = new Set<VehicleRow['status']>(['available', 'reserved', 'sold'])

function slugBase(input: VehicleInput): string {
  return slugifyVehicle(input.brand, input.model, input.variant, input.year)
}

async function uniqueSlug(tx: Database, tenantId: string, base: string): Promise<string> {
  const clean = slugifyVehicle(base)

  for (let attempt = 1; attempt <= 500; attempt += 1) {
    const candidate = attempt === 1 ? clean : `${clean}-${attempt}`
    const existing = await tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(and(eq(vehicles.tenantId, tenantId), eq(vehicles.slug, candidate)))
      .limit(1)

    if (existing.length === 0) return candidate
  }

  throw new Error('Unable to generate a unique vehicle slug')
}

function statusForCreate(input: VehicleInput): VehicleRow['status'] {
  if (input.publication === 'draft') return 'draft'
  if (input.publication === 'archived') return 'archived'
  return 'available'
}

function statusForUpdate(input: VehicleInput, current: VehicleRow): VehicleRow['status'] {
  if (input.publication === 'draft') return 'draft'
  if (input.publication === 'archived') return 'archived'
  return PUBLIC_STATUSES.has(current.status) ? current.status : 'available'
}

function vehicleValues(input: VehicleInput) {
  return {
    brand: input.brand,
    model: input.model,
    variant: input.variant,
    year: input.year,
    transmission: input.transmission,
    fuelType: input.fuel,
    bodyType: input.bodyType,
    engineCapacity: input.engineCc,
    mileage: input.mileageKm,
    color: input.color,
    price: input.price,
    plateRegion: input.plateRegion,
    taxExpiryDate: input.taxExpiry,
    description: input.description,
    featured: input.featured,
    location: input.location,
    features: input.features,
    ownerCount: input.ownerCount,
    documents: input.documents,
  }
}

async function mapWithImages(tx: Database, tenantId: string, row: VehicleRow): Promise<Vehicle> {
  const images = await listTenantVehicleImages(tx, tenantId, row.id)
  return toAdminVehicle(row, groupVehicleImages(images).get(row.id) ?? [])
}

/** Create a tenant-owned vehicle from validated input. */
export async function createVehicle(
  db: Database,
  actor: TenantActor,
  input: unknown,
): Promise<ServiceResult<Vehicle>> {
  const parsed = parseVehicleInput(input)
  if (!parsed.ok) return parsed

  const now = new Date()

  return withTenantSession(db, actor, async (tx) => {
    const status = statusForCreate(parsed.data)
    const slug = await uniqueSlug(tx, actor.tenantId, slugBase(parsed.data))

    const [row] = await tx
      .insert(vehicles)
      .values({
        tenantId: actor.tenantId,
        slug,
        ...vehicleValues(parsed.data),
        originalPrice: null,
        status,
        createdAt: now,
        updatedAt: now,
        publishedAt: status === 'available' ? now : null,
        reservedAt: null,
        soldAt: null,
      })
      .returning()

    if (!row) return notFound()
    return { ok: true as const, data: toAdminVehicle(row, []) }
  })
}

/** Update an existing tenant vehicle. The slug is immutable after insert. */
export async function updateVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  input: unknown,
): Promise<ServiceResult<Vehicle>> {
  const id = parseVehicleId(vehicleId)
  if (!id) return invalid({ id: ['ID kendaraan tidak valid'] })

  const parsed = parseVehicleInput(input)
  if (!parsed.ok) return parsed

  const now = new Date()

  return withTenantSession(db, actor, async (tx) => {
    const current = await getTenantVehicleById(tx, actor.tenantId, id)
    if (!current) return notFound()

    const status = statusForUpdate(parsed.data, current)

    const publishedAt =
      status === 'draft'
        ? null
        : status === 'available'
          ? (current.publishedAt ?? now)
          : current.publishedAt

    const reservedAt =
      status === 'draft' ? null : status === 'available' ? null : current.reservedAt

    const soldAt = status === 'draft' || status === 'available' ? null : current.soldAt

    const [row] = await tx
      .update(vehicles)
      .set({
        ...vehicleValues(parsed.data),
        status,
        updatedAt: now,
        publishedAt,
        reservedAt,
        soldAt,
      })
      .where(and(eq(vehicles.tenantId, actor.tenantId), eq(vehicles.id, id)))
      .returning()

    if (!row) return notFound()
    return { ok: true as const, data: await mapWithImages(tx, actor.tenantId, row) }
  })
}

async function transitionVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  action: 'publish' | 'reserve' | 'sell' | 'archive',
): Promise<ServiceResult<Vehicle>> {
  const id = parseVehicleId(vehicleId)
  if (!id) return invalid({ id: ['ID kendaraan tidak valid'] })

  const now = new Date()

  return withTenantSession(db, actor, async (tx) => {
    const current = await getTenantVehicleById(tx, actor.tenantId, id)
    if (!current) return notFound()

    const patch: Partial<typeof vehicles.$inferInsert> & { updatedAt: Date } = {
      updatedAt: now,
    }

    switch (action) {
      case 'publish': {
        if (PUBLIC_STATUSES.has(current.status)) break
        patch.status = 'available'
        patch.publishedAt = current.publishedAt ?? now
        patch.reservedAt = null
        patch.soldAt = null
        break
      }
      case 'reserve': {
        if (current.status === 'reserved') break
        if (current.status !== 'available') {
          return conflict('Hanya unit tersedia yang dapat dipesan.')
        }
        patch.status = 'reserved'
        patch.reservedAt = now
        break
      }
      case 'sell': {
        if (current.status === 'sold') break
        if (current.status !== 'available' && current.status !== 'reserved') {
          return conflict('Hanya unit tersedia atau dipesan yang dapat ditandai terjual.')
        }
        patch.status = 'sold'
        patch.soldAt = now
        break
      }
      case 'archive': {
        if (current.status === 'archived') break
        patch.status = 'archived'
        break
      }
    }

    const [row] = await tx
      .update(vehicles)
      .set(patch)
      .where(and(eq(vehicles.tenantId, actor.tenantId), eq(vehicles.id, id)))
      .returning()

    if (!row) return notFound()
    return { ok: true as const, data: await mapWithImages(tx, actor.tenantId, row) }
  })
}

export async function publishVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
): Promise<ServiceResult<Vehicle>> {
  return transitionVehicle(db, actor, vehicleId, 'publish')
}

export async function reserveVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
): Promise<ServiceResult<Vehicle>> {
  return transitionVehicle(db, actor, vehicleId, 'reserve')
}

export async function sellVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
): Promise<ServiceResult<Vehicle>> {
  return transitionVehicle(db, actor, vehicleId, 'sell')
}

export async function archiveVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
): Promise<ServiceResult<Vehicle>> {
  return transitionVehicle(db, actor, vehicleId, 'archive')
}

/** Copy a vehicle and its image rows into a new draft with a unique slug. */
export async function duplicateVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
): Promise<ServiceResult<Vehicle>> {
  const id = parseVehicleId(vehicleId)
  if (!id) return invalid({ id: ['ID kendaraan tidak valid'] })

  const now = new Date()

  return withTenantSession(db, actor, async (tx) => {
    const current = await getTenantVehicleById(tx, actor.tenantId, id)
    if (!current) return notFound()

    const slug = await uniqueSlug(tx, actor.tenantId, `${current.slug}-copy`)
    const [row] = await tx
      .insert(vehicles)
      .values({
        tenantId: actor.tenantId,
        slug,
        brand: current.brand,
        model: current.model,
        variant: current.variant,
        year: current.year,
        transmission: current.transmission,
        fuelType: current.fuelType,
        bodyType: current.bodyType,
        engineCapacity: current.engineCapacity,
        mileage: current.mileage,
        color: current.color,
        price: current.price,
        originalPrice: current.originalPrice,
        plateRegion: current.plateRegion,
        taxExpiryDate: current.taxExpiryDate,
        description: current.description,
        status: 'draft',
        featured: false,
        location: current.location,
        features: current.features,
        ownerCount: current.ownerCount,
        documents: current.documents,
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        reservedAt: null,
        soldAt: null,
      })
      .returning()

    if (!row) return notFound()

    const images = await listTenantVehicleImages(tx, actor.tenantId, id)
    const copiedImages =
      images.length > 0
        ? await tx
            .insert(vehicleImages)
            .values(
              images.map((image) => ({
                tenantId: actor.tenantId,
                vehicleId: row.id,
                provider: image.provider,
                providerAssetId: image.providerAssetId,
                url: image.url,
                alt: image.alt,
                position: image.position,
                isCover: image.isCover,
                width: image.width,
                height: image.height,
                createdAt: now,
              })),
            )
            .returning()
        : []

    return {
      ok: true as const,
      data: toAdminVehicle(row, groupVehicleImages(copiedImages).get(row.id) ?? []),
    }
  })
}

/** Permanently remove a tenant vehicle. Image rows cascade; provider assets are
 * cleaned up only when no remaining row references them. */
export interface DeleteVehicleOptions {
  readonly mediaProvider?: MediaProvider
}

export interface DeleteVehicleData {
  readonly id: string
  readonly media: MediaCleanupSummary
}

export async function deleteVehicle(
  db: Database,
  actor: TenantActor,
  vehicleId: unknown,
  options: DeleteVehicleOptions = {},
): Promise<ServiceResult<DeleteVehicleData>> {
  const id = parseVehicleId(vehicleId)
  if (!id) return invalid({ id: ['ID kendaraan tidak valid'] })

  const removed = await withTenantSession<
    | ServiceResult<{ id: string; candidates: MediaCandidate[] }>
  >(db, actor, async (tx) => {
    const rows = await listTenantVehicleImages(tx, actor.tenantId, id)

    const deleted = await tx
      .delete(vehicles)
      .where(and(eq(vehicles.tenantId, actor.tenantId), eq(vehicles.id, id)))
      .returning({ id: vehicles.id })

    if (deleted.length === 0) return notFound()

    return {
      ok: true as const,
      data: {
        id: deleted[0].id,
        candidates: rows.map((row) => ({
          provider: row.provider,
          assetId: row.providerAssetId,
        })),
      },
    }
  })

  if (!removed.ok) return removed

  let provider: MediaProvider | null = options.mediaProvider ?? null
  if (!provider) {
    try {
      provider = resolveMediaProviderOrNull()
    } catch {
      provider = null
    }
  }

  const media = await cleanupUnreferencedMedia(db, removed.data.candidates, provider)

  return { ok: true as const, data: { id: removed.data.id, media } }
}

export { vehicleActionSchema }
