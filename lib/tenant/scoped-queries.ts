import { and, asc, desc, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import {
  profiles,
  showroomSettings,
  tenantDomains,
  tenantMembers,
  tenants,
  vehicleImages,
  vehicles,
} from '@/db/schema'
import type * as schema from '@/db/schema'

import { isUuid } from './session'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export type TenantScopeErrorCode = 'missing_tenant_id' | 'invalid_tenant_id' | 'invalid_vehicle_id'

export class TenantScopeError extends Error {
  constructor(readonly code: TenantScopeErrorCode) {
    super(`Tenant-scoped query rejected: ${code}`)
    this.name = 'TenantScopeError'
  }
}

/**
 * Require a valid tenant identifier before touching the database. There is no
 * opt-out: an unscoped tenant query is a bug, not a fallback.
 */
export function requireTenantId(tenantId: string | null | undefined): string {
  if (!tenantId) throw new TenantScopeError('missing_tenant_id')
  if (!isUuid(tenantId)) throw new TenantScopeError('invalid_tenant_id')
  return tenantId
}

export async function getTenantById(db: Database, tenantId: string) {
  const id = requireTenantId(tenantId)

  const rows = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1)

  return rows[0] ?? null
}

export async function listTenantDomains(db: Database, tenantId: string) {
  const id = requireTenantId(tenantId)

  return db
    .select()
    .from(tenantDomains)
    .where(eq(tenantDomains.tenantId, id))
    .orderBy(asc(tenantDomains.hostname))
}

export async function getShowroomSettings(db: Database, tenantId: string) {
  const id = requireTenantId(tenantId)

  const rows = await db
    .select()
    .from(showroomSettings)
    .where(eq(showroomSettings.tenantId, id))
    .limit(1)

  return rows[0] ?? null
}

export async function listTenantVehicles(db: Database, tenantId: string) {
  const id = requireTenantId(tenantId)

  return db
    .select()
    .from(vehicles)
    .where(eq(vehicles.tenantId, id))
    .orderBy(desc(vehicles.createdAt), asc(vehicles.slug))
}

export async function getTenantVehicleBySlug(db: Database, tenantId: string, slug: string) {
  const id = requireTenantId(tenantId)
  if (!slug) return null

  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.tenantId, id), eq(vehicles.slug, slug)))
    .limit(1)

  return rows[0] ?? null
}

export async function getTenantVehicleById(db: Database, tenantId: string, vehicleId: string) {
  const id = requireTenantId(tenantId)
  if (!isUuid(vehicleId)) throw new TenantScopeError('invalid_vehicle_id')

  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.tenantId, id), eq(vehicles.id, vehicleId)))
    .limit(1)

  return rows[0] ?? null
}

export async function listTenantVehicleImages(db: Database, tenantId: string, vehicleId?: string) {
  const id = requireTenantId(tenantId)
  if (vehicleId !== undefined && !isUuid(vehicleId)) {
    throw new TenantScopeError('invalid_vehicle_id')
  }

  const scope = vehicleId
    ? and(eq(vehicleImages.tenantId, id), eq(vehicleImages.vehicleId, vehicleId))
    : eq(vehicleImages.tenantId, id)

  return db
    .select()
    .from(vehicleImages)
    .where(scope)
    .orderBy(asc(vehicleImages.position), asc(vehicleImages.id))
}

export async function listTenantMembers(db: Database, tenantId: string) {
  const id = requireTenantId(tenantId)

  return db
    .select({
      id: tenantMembers.id,
      tenantId: tenantMembers.tenantId,
      userId: tenantMembers.userId,
      role: tenantMembers.role,
      status: tenantMembers.status,
      fullName: profiles.fullName,
    })
    .from(tenantMembers)
    .leftJoin(profiles, eq(profiles.id, tenantMembers.userId))
    .where(eq(tenantMembers.tenantId, id))
    .orderBy(asc(tenantMembers.createdAt), asc(tenantMembers.id))
}
