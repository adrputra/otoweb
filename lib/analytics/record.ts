import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { analyticsEvents, type AnalyticsEventMetadata } from '@/db/schema'
import type * as schema from '@/db/schema'
import {
  getTenantVehicleById,
  getTenantVehicleBySlug,
  requireTenantId,
} from '@/lib/tenant/scoped-queries'
import { isUuid } from '@/lib/tenant/session'

import {
  isAnalyticsEventType,
  normalizeAnalyticsFilters,
  normalizeAnalyticsPath,
  normalizeShareMethod,
  normalizeVehicleSlug,
  type AnalyticsEventType,
} from './events'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface AnalyticsRecordInput {
  eventType: AnalyticsEventType
  vehicleSlug?: string | null
  vehicleId?: string | null
  path?: string | null
  metadata?: AnalyticsEventMetadata
}

function sanitizeMetadata(
  input: AnalyticsRecordInput,
  vehicleSlug: string | undefined,
): AnalyticsEventMetadata {
  const metadata: AnalyticsEventMetadata = {}
  const filters = normalizeAnalyticsFilters(input.metadata?.filters)
  if (filters) metadata.filters = filters
  // Only the WhatsApp event carries the slug as metadata; other events link
  // the vehicle through `vehicle_id`.
  if (vehicleSlug && input.eventType === 'whatsapp_click') {
    metadata.vehicleSlug = vehicleSlug
  }
  const method = normalizeShareMethod(input.metadata?.method)
  if (method) metadata.method = method
  return metadata
}

/**
 * Record one analytics event inside a tenant.
 *
 * Analytics is deliberately best-effort: every failure (invalid tenant,
 * missing table, transient database error) resolves to `false` and never
 * rejects. Public rendering, lead capture, and redirects must not depend on
 * this succeeding.
 */
export async function recordAnalyticsEvent(
  db: Database,
  tenantId: string,
  input: AnalyticsRecordInput,
): Promise<boolean> {
  try {
    const id = requireTenantId(tenantId)
    if (!isAnalyticsEventType(input.eventType)) return false

    const slug = normalizeVehicleSlug(input.vehicleSlug)
    let vehicleId: string | null = null

    if (input.vehicleId && isUuid(input.vehicleId)) {
      const vehicle = await getTenantVehicleById(db, id, input.vehicleId)
      vehicleId = vehicle?.id ?? null
    } else if (slug) {
      const vehicle = await getTenantVehicleBySlug(db, id, slug)
      vehicleId = vehicle?.id ?? null
    }

    await db.insert(analyticsEvents).values({
      tenantId: id,
      eventType: input.eventType,
      vehicleId,
      metadata: sanitizeMetadata(input, slug),
      path: normalizeAnalyticsPath(input.path) ?? null,
    })

    return true
  } catch {
    return false
  }
}
