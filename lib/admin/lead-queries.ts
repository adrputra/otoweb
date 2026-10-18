import { and, asc, desc, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { leads, vehicles } from '@/db/schema'
import type * as schema from '@/db/schema'
import { leadVehicleLabel, toLead } from '@/lib/admin/lead-mapper'
import { requireTenantId } from '@/lib/tenant/scoped-queries'
import type { Lead, LeadStatus } from '@/lib/types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface AdminLeadStats {
  total: number
  new: number
  contacted: number
  qualified: number
  won: number
  lost: number
}

function vehicleLabelFromRow(row: {
  brand: string | null
  model: string | null
  variant: string | null
  year: number | null
}): string | undefined {
  if (!row.brand || !row.model || !row.variant || row.year === null) return undefined
  return leadVehicleLabel({
    brand: row.brand,
    model: row.model,
    variant: row.variant,
    year: row.year,
  })
}

/** Every lead for the tenant, newest first, with same-tenant vehicle context. */
export async function listAdminLeads(
  db: Database,
  tenantId: string,
): Promise<Lead[]> {
  const id = requireTenantId(tenantId)

  const rows = await db
    .select({
      lead: leads,
      vehicleBrand: vehicles.brand,
      vehicleModel: vehicles.model,
      vehicleVariant: vehicles.variant,
      vehicleYear: vehicles.year,
    })
    .from(leads)
    .leftJoin(
      vehicles,
      and(eq(vehicles.id, leads.vehicleId), eq(vehicles.tenantId, id)),
    )
    .where(eq(leads.tenantId, id))
    .orderBy(desc(leads.createdAt), desc(leads.id))

  return rows.map((row) =>
    toLead(
      row.lead,
      vehicleLabelFromRow({
        brand: row.vehicleBrand,
        model: row.vehicleModel,
        variant: row.vehicleVariant,
        year: row.vehicleYear,
      }),
    ),
  )
}

/** Counts used by the admin lead dashboard and the admin home. */
export async function getAdminLeadStats(
  db: Database,
  tenantId: string,
): Promise<AdminLeadStats> {
  const id = requireTenantId(tenantId)

  const rows = await db
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.tenantId, id))
    .orderBy(asc(leads.status))

  const stats: AdminLeadStats = {
    total: rows.length,
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
  }

  for (const row of rows) {
    stats[row.status as LeadStatus] += 1
  }

  return stats
}
