import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { vehicles } from '@/db/schema'
import type * as schema from '@/db/schema'
import {
  getTenantVehicleById,
  listTenantVehicleImages,
  listTenantVehicles,
  requireTenantId,
} from '@/lib/tenant/scoped-queries'
import type { Vehicle } from '@/lib/types'

import { groupVehicleImages, toAdminVehicle } from './vehicle-mapper'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface AdminVehicleStats {
  available: number
  reserved: number
  sold: number
  draft: number
  archived: number
}

/** Every vehicle for the tenant, newest first, including drafts and archived. */
export async function listAdminVehicles(db: Database, tenantId: string): Promise<Vehicle[]> {
  const id = requireTenantId(tenantId)
  const [rows, images] = await Promise.all([
    listTenantVehicles(db, id),
    listTenantVehicleImages(db, id),
  ])
  const grouped = groupVehicleImages(images)

  return rows.map((row) => toAdminVehicle(row, grouped.get(row.id) ?? []))
}

/** One tenant vehicle by id, or null for unknown/cross-tenant ids. */
export async function getAdminVehicleById(
  db: Database,
  tenantId: string,
  vehicleId: string,
): Promise<Vehicle | null> {
  const id = requireTenantId(tenantId)
  const row = await getTenantVehicleById(db, id, vehicleId)
  if (!row) return null

  const images = await listTenantVehicleImages(db, id, vehicleId)
  return toAdminVehicle(row, groupVehicleImages(images).get(row.id) ?? [])
}

/** Counts used by the admin dashboard. */
export async function getAdminVehicleStats(
  db: Database,
  tenantId: string,
): Promise<AdminVehicleStats> {
  const id = requireTenantId(tenantId)
  const rows = await db
    .select({ status: vehicles.status })
    .from(vehicles)
    .where(eq(vehicles.tenantId, id))

  const stats: AdminVehicleStats = {
    available: 0,
    reserved: 0,
    sold: 0,
    draft: 0,
    archived: 0,
  }

  for (const row of rows) {
    stats[row.status] += 1
  }

  return stats
}
