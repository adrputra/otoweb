import type { Lead as LeadRow, Vehicle as VehicleRow } from '@/db/schema'
import type { Lead } from '@/lib/types'

/** Optional vehicle display text for a lead row. */
export function leadVehicleLabel(
  vehicle:
    | Pick<VehicleRow, 'brand' | 'model' | 'variant' | 'year'>
    | null
    | undefined,
): string | undefined {
  if (!vehicle) return undefined
  return `${vehicle.brand} ${vehicle.model} ${vehicle.variant} (${vehicle.year})`
}

/**
 * Map a stored lead to the view model. Anonymous WhatsApp leads have no
 * contact identity; the view model uses empty strings rather than `null` so
 * rendering never prints "null".
 */
export function toLead(row: LeadRow, vehicleLabel?: string): Lead {
  return {
    id: row.id,
    name: row.name ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    vehicleId: row.vehicleId ?? undefined,
    vehicleLabel,
    source: row.source,
    message: row.message ?? '',
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
