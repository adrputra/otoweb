// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { leads, vehicles } from '@/db/schema'
import {
  getAdminLeadStats,
  listAdminLeads,
} from '@/lib/admin/lead-queries'
import { updateLeadStatus } from '@/lib/admin/lead-service'

import {
  createTenantTestDatabase,
  type TenantTestDatabase,
} from '../tenant/database'
import {
  PRIMA_VEHICLE_ID,
  prima,
  tenantB,
  tenantBVehicle,
} from '../tenant/fixtures'

const PRIMA_NEW_LEAD = '77777777-7777-4777-8777-777777777701'
const PRIMA_OLD_LEAD = '77777777-7777-4777-8777-777777777702'
const TENANT_B_LEAD = '77777777-7777-4777-8777-777777777703'

let harness: TenantTestDatabase

const actor = {
  tenantId: prima.tenantId,
  userId: prima.profileId,
  isPlatformAdmin: false,
}

beforeEach(async () => {
  harness = await createTenantTestDatabase()
  await harness.db.insert(vehicles).values(tenantBVehicle)
  await harness.db.insert(leads).values([
    {
      id: PRIMA_OLD_LEAD,
      tenantId: prima.tenantId,
      vehicleId: PRIMA_VEHICLE_ID,
      name: 'Rizky',
      phone: '081299001122',
      email: 'rizky@example.com',
      message: 'Old inquiry',
      source: 'contact_form',
      status: 'contacted',
      createdAt: new Date('2026-10-17T00:00:00.000Z'),
      updatedAt: new Date('2026-10-17T00:00:00.000Z'),
    },
    {
      id: PRIMA_NEW_LEAD,
      tenantId: prima.tenantId,
      name: 'Amanda',
      phone: '081299001133',
      message: 'New inquiry',
      source: 'whatsapp',
      status: 'new',
      createdAt: new Date('2026-10-19T00:00:00.000Z'),
      updatedAt: new Date('2026-10-19T00:00:00.000Z'),
    },
    {
      id: TENANT_B_LEAD,
      tenantId: tenantB.tenantId,
      name: 'Tenant B lead',
      phone: '081299001144',
      message: 'Tenant B inquiry',
      source: 'manual',
      status: 'qualified',
    },
  ])
}, 30_000)

afterEach(async () => {
  await harness.close()
})

describe('admin lead queries', () => {
  it('lists only the active tenant leads, newest first', async () => {
    const rows = await listAdminLeads(harness.db, prima.tenantId)

    expect(rows.map((row) => row.id)).toEqual([PRIMA_NEW_LEAD, PRIMA_OLD_LEAD])
    expect(rows.map((row) => row.id)).not.toContain(TENANT_B_LEAD)
  })

  it('adds a same-tenant vehicle label without leaking another tenant vehicle', async () => {
    await harness.db.insert(leads).values({
      id: '77777777-7777-4777-8777-777777777704',
      tenantId: prima.tenantId,
      vehicleId: tenantBVehicle.id,
      name: 'Anomaly',
      message: 'Foreign vehicle reference',
    })

    const rows = await listAdminLeads(harness.db, prima.tenantId)
    const withVehicle = rows.find((row) => row.id === PRIMA_OLD_LEAD)
    const anomaly = rows.find(
      (row) => row.id === '77777777-7777-4777-8777-777777777704',
    )

    expect(withVehicle?.vehicleLabel).toContain('Toyota')
    expect(anomaly?.vehicleId).toBe(tenantBVehicle.id)
    expect(anomaly?.vehicleLabel).toBeUndefined()
  })

  it('counts each status for the tenant only', async () => {
    await expect(getAdminLeadStats(harness.db, prima.tenantId)).resolves.toEqual({
      total: 2,
      new: 1,
      contacted: 1,
      qualified: 0,
      won: 0,
      lost: 0,
    })

    await expect(getAdminLeadStats(harness.db, tenantB.tenantId)).resolves.toEqual({
      total: 1,
      new: 0,
      contacted: 0,
      qualified: 1,
      won: 0,
      lost: 0,
    })
  })
})

describe('admin lead status updates', () => {
  it('persists every roadmap status and updates the timestamp', async () => {
    for (const status of ['contacted', 'qualified', 'won', 'lost', 'new'] as const) {
      const result = await updateLeadStatus(harness.db, actor, {
        leadId: PRIMA_NEW_LEAD,
        status,
      })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.data.status).toBe(status)
    }

    const [row] = await harness.db.select().from(leads).where(eq(leads.id, PRIMA_NEW_LEAD))
    expect(row?.status).toBe('new')
    expect(row?.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-10-18T00:00:00.000Z').getTime(),
    )
  })

  it('rejects an unknown status without writing', async () => {
    const result = await updateLeadStatus(harness.db, actor, {
      leadId: PRIMA_NEW_LEAD,
      status: 'closed',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid')

    const [row] = await harness.db.select().from(leads).where(eq(leads.id, PRIMA_NEW_LEAD))
    expect(row?.status).toBe('new')
  })

  it('rejects a cross-tenant lead id without writing', async () => {
    const result = await updateLeadStatus(harness.db, actor, {
      leadId: TENANT_B_LEAD,
      status: 'won',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('not_found')

    const [row] = await harness.db
      .select()
      .from(leads)
      .where(eq(leads.id, TENANT_B_LEAD))
    expect(row?.status).toBe('qualified')
    expect(row?.tenantId).toBe(tenantB.tenantId)
  })

  it('rejects an unknown lead id', async () => {
    const result = await updateLeadStatus(harness.db, actor, {
      leadId: '77777777-7777-4777-8777-777777777799',
      status: 'won',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('not_found')
  })
})
