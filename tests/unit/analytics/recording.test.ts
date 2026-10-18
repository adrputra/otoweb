// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { analyticsEvents, vehicles } from '@/db/schema'
import { vehicles as mockVehicles } from '@/data'
import { recordAnalyticsEvent } from '@/lib/analytics/record'
import type { AnalyticsEventType } from '@/lib/analytics/events'

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

async function rowsFor(tenantId: string) {
  return harness.db.select().from(analyticsEvents).where(eq(analyticsEvents.tenantId, tenantId))
}

describe('recordAnalyticsEvent', () => {
  it('records every event type for the tenant', async () => {
    const eventTypes: AnalyticsEventType[] = [
      'vehicle_view',
      'inventory_search',
      'filter_use',
      'whatsapp_click',
      'contact_submit',
      'vehicle_share',
    ]

    for (const eventType of eventTypes) {
      await expect(
        recordAnalyticsEvent(harness.db, prima.tenantId, { eventType }),
      ).resolves.toBe(true)
    }

    const rows = await rowsFor(prima.tenantId)
    expect(rows.map((row) => row.eventType).sort()).toEqual([...eventTypes].sort())
    await expect(rowsFor(tenantB.tenantId)).resolves.toHaveLength(0)
  })

  it('links a vehicle view to a same-tenant vehicle by slug', async () => {
    const slug = mockVehicles[0]!.slug

    await recordAnalyticsEvent(harness.db, prima.tenantId, {
      eventType: 'vehicle_view',
      vehicleSlug: slug,
      path: '/cars/example?utm=1',
    })

    const [row] = await rowsFor(prima.tenantId)
    expect(row?.vehicleId).toBeTruthy()
    expect(row?.path).toBe('/cars/example')
    expect(row?.metadata).toEqual({})
  })

  it('keeps a foreign slug unlinked instead of attaching another tenant vehicle', async () => {
    await recordAnalyticsEvent(harness.db, prima.tenantId, {
      eventType: 'vehicle_view',
      vehicleSlug: tenantBVehicle.slug,
    })

    const [row] = await rowsFor(prima.tenantId)
    expect(row?.vehicleId).toBeNull()
  })

  it('links a server WhatsApp event by the lead vehicle id', async () => {
    const [seeded] = await harness.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.tenantId, prima.tenantId))
      .limit(1)

    await recordAnalyticsEvent(harness.db, prima.tenantId, {
      eventType: 'whatsapp_click',
      vehicleId: seeded?.id,
      vehicleSlug: seeded?.slug,
    })

    const [row] = await rowsFor(prima.tenantId)
    expect(row?.vehicleId).toBe(seeded?.id)
    expect(row?.metadata).toEqual({ vehicleSlug: seeded?.slug })
  })

  it('stores bounded filters and share metadata only', async () => {
    await recordAnalyticsEvent(harness.db, prima.tenantId, {
      eventType: 'filter_use',
      metadata: {
        filters: { brand: 'Toyota', secret: 'drop-me', fuel: 'x'.repeat(65) },
        vehicleSlug: 'a'.repeat(300),
      },
    })
    await recordAnalyticsEvent(harness.db, prima.tenantId, {
      eventType: 'vehicle_share',
      vehicleSlug: 'toyota-fortuner-2021-1',
      metadata: { method: 'clipboard' },
    })

    const rows = await rowsFor(prima.tenantId)
    const filterRow = rows.find((row) => row.eventType === 'filter_use')
    const shareRow = rows.find((row) => row.eventType === 'vehicle_share')

    expect(filterRow?.metadata).toEqual({ filters: { brand: 'Toyota' } })
    expect(shareRow?.metadata).toEqual({ method: 'clipboard' })
  })

  it('rejects a missing or malformed tenant without throwing', async () => {
    await expect(
      recordAnalyticsEvent(harness.db, '', { eventType: 'vehicle_view' }),
    ).resolves.toBe(false)
    await expect(
      recordAnalyticsEvent(harness.db, 'not-a-uuid', { eventType: 'vehicle_view' }),
    ).resolves.toBe(false)
    await expect(rowsFor(prima.tenantId)).resolves.toHaveLength(0)
  })

  it('returns false instead of throwing when the insert fails', async () => {
    const failingDatabase = {
      insert: () => {
        throw new Error('analytics store unavailable')
      },
    } as unknown as Parameters<typeof recordAnalyticsEvent>[0]

    await expect(
      recordAnalyticsEvent(failingDatabase, prima.tenantId, {
        eventType: 'vehicle_view',
      }),
    ).resolves.toBe(false)
  })
})
