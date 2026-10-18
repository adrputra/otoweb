// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { analyticsEvents, leads, vehicles } from '@/db/schema'
import { formatConversionPercent } from '@/lib/analytics/format'
import {
  conversionPercent,
  getAdminAnalyticsSummary,
} from '@/lib/admin/analytics-queries'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { prima, tenantB, tenantBVehicle } from '../tenant/fixtures'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
  await harness.db.insert(vehicles).values(tenantBVehicle)
}, 30_000)

afterEach(async () => {
  await harness.close()
})

async function primaVehicles() {
  return harness.db
    .select()
    .from(vehicles)
    .where(eq(vehicles.tenantId, prima.tenantId))
    .limit(3)
}

describe('conversionPercent', () => {
  it('returns one-decimal conversion and a zero-safe denominator', () => {
    expect(conversionPercent(1, 7)).toBe(14.3)
    expect(conversionPercent(3, 4)).toBe(75)
    expect(conversionPercent(1, 3)).toBe(33.3)
    expect(conversionPercent(0, 0)).toBe(0)
    expect(conversionPercent(5, 0)).toBe(0)
  })

  it('formats the dashboard value with one decimal place', () => {
    expect(formatConversionPercent(14.3)).toBe('14.3%')
    expect(formatConversionPercent(75)).toBe('75.0%')
    expect(formatConversionPercent(0)).toBe('0.0%')
    expect(formatConversionPercent(Number.NaN)).toBe('0.0%')
  })
})

describe('getAdminAnalyticsSummary', () => {
  it('aggregates views, clicks, new leads, conversion, and most viewed', async () => {
    const [first, second, third] = await primaVehicles()

    await harness.db.insert(analyticsEvents).values([
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: first!.id },
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: first!.id },
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: first!.id },
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: second!.id },
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: second!.id },
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: third!.id },
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: third!.id },
      { tenantId: prima.tenantId, eventType: 'whatsapp_click' },
      { tenantId: prima.tenantId, eventType: 'whatsapp_click' },
      { tenantId: prima.tenantId, eventType: 'contact_submit' },
    ])

    await harness.db.insert(leads).values([
      {
        tenantId: prima.tenantId,
        name: 'New lead',
        phone: '081200000001',
        source: 'contact_form',
        status: 'new',
      },
      {
        tenantId: prima.tenantId,
        name: 'Contacted lead',
        phone: '081200000002',
        source: 'contact_form',
        status: 'contacted',
      },
      {
        tenantId: tenantB.tenantId,
        name: 'Other tenant lead',
        phone: '081200000003',
        source: 'contact_form',
        status: 'new',
      },
    ])

    const summary = await getAdminAnalyticsSummary(harness.db, prima.tenantId)

    expect(summary.vehicleViews).toBe(7)
    expect(summary.whatsappClicks).toBe(2)
    expect(summary.newLeads).toBe(1)
    expect(summary.conversionPercent).toBe(14.3)

    expect(summary.mostViewedVehicles).toHaveLength(3)
    expect(summary.mostViewedVehicles[0]).toMatchObject({
      vehicleId: first!.id,
      views: 3,
    })

    const expectedTieOrder = [second!, third!].sort(
      (a, b) =>
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model) ||
        a.id.localeCompare(b.id),
    )
    expect(summary.mostViewedVehicles.slice(1).map((vehicle) => vehicle.vehicleId)).toEqual(
      expectedTieOrder.map((vehicle) => vehicle.id),
    )
    expect(summary.mostViewedVehicles.every((vehicle) => vehicle.views > 0)).toBe(true)
  })

  it('does not include another tenant events or vehicles', async () => {
    const [primaVehicle] = await primaVehicles()

    await harness.db.insert(analyticsEvents).values([
      { tenantId: prima.tenantId, eventType: 'vehicle_view', vehicleId: primaVehicle!.id },
      {
        tenantId: tenantB.tenantId,
        eventType: 'vehicle_view',
        vehicleId: tenantBVehicle.id,
      },
      {
        // Even a malformed cross-tenant row cannot surface through the join.
        tenantId: prima.tenantId,
        eventType: 'vehicle_view',
        vehicleId: tenantBVehicle.id,
      },
    ])

    const primaSummary = await getAdminAnalyticsSummary(harness.db, prima.tenantId)
    const tenantBSummary = await getAdminAnalyticsSummary(harness.db, tenantB.tenantId)

    expect(primaSummary.vehicleViews).toBe(2)
    expect(primaSummary.mostViewedVehicles).toHaveLength(1)
    expect(primaSummary.mostViewedVehicles[0]?.vehicleId).toBe(primaVehicle!.id)

    expect(tenantBSummary.vehicleViews).toBe(1)
    expect(tenantBSummary.mostViewedVehicles).toHaveLength(1)
    expect(tenantBSummary.mostViewedVehicles[0]?.vehicleId).toBe(tenantBVehicle.id)
  })

  it('returns zero values and an empty list for a tenant with no activity', async () => {
    const summary = await getAdminAnalyticsSummary(
      harness.db,
      '99999999-9999-4999-8999-999999999999',
    )

    expect(summary).toEqual({
      vehicleViews: 0,
      whatsappClicks: 0,
      newLeads: 0,
      conversionPercent: 0,
      mostViewedVehicles: [],
    })
  })

  it('respects the most-viewed limit', async () => {
    const seeded = await primaVehicles()
    await harness.db.insert(analyticsEvents).values(
      seeded.map((vehicle) => ({
        tenantId: prima.tenantId,
        eventType: 'vehicle_view' as const,
        vehicleId: vehicle.id,
      })),
    )

    const summary = await getAdminAnalyticsSummary(harness.db, prima.tenantId, {
      mostViewedLimit: 2,
    })

    expect(summary.mostViewedVehicles).toHaveLength(2)
  })
})
