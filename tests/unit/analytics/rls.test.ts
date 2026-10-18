// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { analyticsEvents } from '@/db/schema'

import { createTenantTestDatabase, tableRlsState, type TenantTestDatabase } from '../tenant/database'
import { platformOperator, prima, tenantB } from '../tenant/fixtures'

let harness: TenantTestDatabase

const primaAccess = { tenantId: prima.tenantId, userId: prima.profileId }
const tenantBAccess = { tenantId: tenantB.tenantId, userId: tenantB.profileId }
const noAccess = { tenantId: null, userId: null }

beforeEach(async () => {
  harness = await createTenantTestDatabase()
  await harness.db.insert(analyticsEvents).values([
    { tenantId: prima.tenantId, eventType: 'vehicle_view' },
    { tenantId: prima.tenantId, eventType: 'whatsapp_click' },
    { tenantId: tenantB.tenantId, eventType: 'vehicle_view' },
  ])
}, 30_000)

afterEach(async () => {
  await harness.close()
})

async function countAdEvents(
  access: typeof primaAccess | typeof noAccess,
): Promise<number> {
  let count = -1
  await harness.rawAsTenant(access, async (client) => {
    const result = await client.query<{ count: number }>(
      'select count(*)::int as count from analytics_events',
    )
    count = result.rows[0]?.count ?? -1
  })
  return count
}

describe('analytics_events row-level security', () => {
  it('forces RLS on the analytics table', async () => {
    await expect(tableRlsState(harness.db, 'analytics_events')).resolves.toEqual({
      enabled: true,
      forced: true,
    })
  })

  it('shows each tenant only its own events', async () => {
    await expect(countAdEvents(primaAccess)).resolves.toBe(2)
    await expect(countAdEvents(tenantBAccess)).resolves.toBe(1)
  })

  it('shows no events without a tenant session', async () => {
    await expect(countAdEvents(noAccess)).resolves.toBe(0)
  })

  it('shows every tenant to a verified platform operator', async () => {
    let count = -1
    await harness.rawAsTenant(
      {
        tenantId: prima.tenantId,
        userId: platformOperator.profileId,
        platformAdmin: true,
      },
      async (client) => {
        const result = await client.query<{ count: number }>(
          'select count(*)::int as count from analytics_events',
        )
        count = result.rows[0]?.count ?? -1
      },
    )

    expect(count).toBe(3)
  })

  it('rejects a cross-tenant insert', async () => {
    await expect(
      harness.rawAsTenant(primaAccess, async (client) => {
        await client.query(
          "insert into analytics_events (tenant_id, event_type) values ($1, 'vehicle_view')",
          [tenantB.tenantId],
        )
      }),
    ).rejects.toThrow(/row-level security|violates/i)
  })

  it('does not allow one tenant to update another tenant events', async () => {
    await harness.rawAsTenant(primaAccess, async (client) => {
      await client.query(
        "update analytics_events set event_type = 'vehicle_share' where tenant_id = $1",
        [tenantB.tenantId],
      )
    })

    const tenantBRows = await harness.db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.tenantId, tenantB.tenantId))

    expect(tenantBRows).toHaveLength(1)
    expect(tenantBRows[0]?.eventType).toBe('vehicle_view')
  })
})
