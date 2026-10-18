import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { analyticsEvents, vehicles } from '@/db/schema'
import type * as schema from '@/db/schema'
import { leadVehicleLabel } from '@/lib/lead-mapper'
import { requireTenantId } from '@/lib/tenant/scoped-queries'

import { getAdminLeadStats } from './lead-queries'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface MostViewedVehicle {
  vehicleId: string
  slug: string
  label: string
  views: number
}

export interface AdminAnalyticsSummary {
  vehicleViews: number
  whatsappClicks: number
  newLeads: number
  conversionPercent: number
  mostViewedVehicles: MostViewedVehicle[]
}

/**
 * New leads divided by vehicle views, one decimal place.
 *
 * A tenant with no views has no funnel to convert, so the value is 0 rather
 * than an error or an invented baseline.
 */
export function conversionPercent(newLeads: number, vehicleViews: number): number {
  if (vehicleViews <= 0) return 0
  return Math.round((newLeads / vehicleViews) * 1000) / 10
}

/** Tenant-scoped metrics used by the admin dashboard. */
export async function getAdminAnalyticsSummary(
  db: Database,
  tenantId: string,
  options: { mostViewedLimit?: number } = {},
): Promise<AdminAnalyticsSummary> {
  const id = requireTenantId(tenantId)
  const limit = Math.max(1, Math.min(options.mostViewedLimit ?? 5, 20))

  const [eventCounts, mostViewedRows, leadStats] = await Promise.all([
    db
      .select({
        eventType: analyticsEvents.eventType,
        total: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.tenantId, id),
          inArray(analyticsEvents.eventType, ['vehicle_view', 'whatsapp_click']),
        ),
      )
      .groupBy(analyticsEvents.eventType),
    db
      .select({
        vehicleId: vehicles.id,
        slug: vehicles.slug,
        brand: vehicles.brand,
        model: vehicles.model,
        variant: vehicles.variant,
        year: vehicles.year,
        views: count(analyticsEvents.id),
      })
      .from(analyticsEvents)
      .innerJoin(
        vehicles,
        and(eq(vehicles.id, analyticsEvents.vehicleId), eq(vehicles.tenantId, id)),
      )
      .where(
        and(
          eq(analyticsEvents.tenantId, id),
          eq(analyticsEvents.eventType, 'vehicle_view'),
        ),
      )
      .groupBy(
        vehicles.id,
        vehicles.slug,
        vehicles.brand,
        vehicles.model,
        vehicles.variant,
        vehicles.year,
      )
      .orderBy(
        desc(count(analyticsEvents.id)),
        asc(vehicles.brand),
        asc(vehicles.model),
        asc(vehicles.id),
      )
      .limit(limit),
    getAdminLeadStats(db, id),
  ])

  const counts = new Map(eventCounts.map((row) => [row.eventType, Number(row.total)]))
  const vehicleViews = counts.get('vehicle_view') ?? 0
  const whatsappClicks = counts.get('whatsapp_click') ?? 0
  const newLeads = leadStats.new

  return {
    vehicleViews,
    whatsappClicks,
    newLeads,
    conversionPercent: conversionPercent(newLeads, vehicleViews),
    mostViewedVehicles: mostViewedRows.map((row) => ({
      vehicleId: row.vehicleId,
      slug: row.slug,
      label:
        leadVehicleLabel({
          brand: row.brand,
          model: row.model,
          variant: row.variant,
          year: row.year,
        }) ?? row.slug,
      views: Number(row.views),
    })),
  }
}
