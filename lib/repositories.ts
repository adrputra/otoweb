import { getAppDatabase } from '@/lib/db/runtime'
import {
  getPublicVehicleBySlug,
  getShowroomForTenant,
  listFeaturedVehicles as listFeaturedVehiclesForTenant,
  listPublicVehicleBrands,
  listPublicVehicles,
  listRelatedPublicVehicles,
  normalizeVehicleFilters,
} from '@/lib/public/queries'
import { getPublicTenant } from '@/lib/public/tenant'
import type { Showroom, Vehicle, VehicleFilters } from '@/lib/types'

async function publicContext() {
  const [db, tenant] = await Promise.all([getAppDatabase(), getPublicTenant()])
  return { db, tenant }
}

/** Stored showroom settings for the request's tenant, or null when unresolved. */
export async function getShowroom(): Promise<Showroom | null> {
  const { db, tenant } = await publicContext()
  if (!tenant) return null
  return getShowroomForTenant(db, tenant)
}

/** Public inventory for the request's tenant with filters and sorting applied. */
export async function listVehicles(
  filters: VehicleFilters | Record<string, string | string[] | number | undefined> = {},
): Promise<Vehicle[]> {
  const { db, tenant } = await publicContext()
  if (!tenant) return []
  return listPublicVehicles(
    db,
    tenant.id,
    normalizeVehicleFilters(filters as Record<string, string | string[] | number | undefined>),
  )
}

/** Featured public vehicles for the request's tenant. */
export async function listFeaturedVehicles(): Promise<Vehicle[]> {
  const { db, tenant } = await publicContext()
  if (!tenant) return []
  return listFeaturedVehiclesForTenant(db, tenant.id)
}

/** Distinct brands in the request tenant's public inventory. */
export async function listVehicleBrands(): Promise<string[]> {
  const { db, tenant } = await publicContext()
  if (!tenant) return []
  return listPublicVehicleBrands(db, tenant.id)
}

/** A public vehicle for the request's tenant, or null for unknown/non-public slugs. */
export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  const { db, tenant } = await publicContext()
  if (!tenant) return null
  return getPublicVehicleBySlug(db, tenant.id, slug)
}

/** Up to three other public units from the same tenant and body type. */
export async function getRelatedVehicles(
  vehicleId: string,
  bodyType: string,
): Promise<Vehicle[]> {
  const { db, tenant } = await publicContext()
  if (!tenant) return []
  return listRelatedPublicVehicles(db, tenant.id, vehicleId, bodyType)
}
