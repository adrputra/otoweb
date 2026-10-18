// @vitest-environment node
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { eq } from 'drizzle-orm'

import { leads, showroomSettings, tenantMembers, vehicles } from '@/db/schema'

import { platformOperator, prima, tenantB, tenantBVehicle } from './fixtures'
import {
  createTenantTestDatabase,
  tablePolicyCount,
  tableRlsState,
  type TenantTestDatabase,
} from './database'

let harness: TenantTestDatabase

const primaAccess = { tenantId: prima.tenantId, userId: prima.profileId }
const tenantBAccess = { tenantId: tenantB.tenantId, userId: tenantB.profileId }
const noAccess = { tenantId: null, userId: null }

const crossTenantInsert = {
  slug: 'cross-tenant-attack',
  brand: 'Attack',
  model: 'Injected',
  variant: 'Cross tenant',
}

const PRIMA_LEAD_ID = '66666666-6666-4666-8666-666666666601'
const TENANT_B_LEAD_ID = '66666666-6666-4666-8666-666666666602'

beforeEach(async () => {
  harness = await createTenantTestDatabase()
  await harness.db.insert(vehicles).values(tenantBVehicle)
  await harness.db.insert(leads).values([
    {
      id: PRIMA_LEAD_ID,
      tenantId: prima.tenantId,
      name: 'Prima lead',
      phone: '081299001122',
      message: 'Prima inquiry',
    },
    {
      id: TENANT_B_LEAD_ID,
      tenantId: tenantB.tenantId,
      name: 'Tenant B lead',
      phone: '081299001133',
      message: 'Tenant B inquiry',
    },
  ])
}, 30_000)

afterEach(async () => {
  await harness.close()
})

async function countRows(
  access: typeof primaAccess | typeof noAccess,
  table: string,
): Promise<number> {
  let count = -1
  await harness.rawAsTenant(access, async (client) => {
    const result = await client.query<{ count: number }>(
      `select count(*)::int as count from ${table}`,
    )
    count = result.rows[0]?.count ?? -1
  })
  return count
}

const TENANT_TABLES = [
  'tenants',
  'tenant_domains',
  'profiles',
  'tenant_members',
  'showroom_settings',
  'vehicles',
  'vehicle_images',
  'leads',
  'analytics_events',
] as const

describe('row-level security configuration', () => {
  it.each(TENANT_TABLES)('enables and forces RLS on %s', async (table) => {
    await expect(tableRlsState(harness.db, table)).resolves.toEqual({
      enabled: true,
      forced: true,
    })
  })

  it.each(TENANT_TABLES)('attaches at least one policy to %s', async (table) => {
    await expect(tablePolicyCount(harness.db, table)).resolves.toBeGreaterThan(0)
  })
})

describe('row-level security tenant isolation', () => {
  it('returns only prima rows under a prima setting', async () => {
    const offered = await harness.asTenant(primaAccess, (db) =>
      db.select({ id: vehicles.id, tenantId: vehicles.tenantId }).from(vehicles),
    )

    expect(offered.length).toBeGreaterThan(0)
    expect(offered.every((row) => row.tenantId === prima.tenantId)).toBe(true)
    expect(offered.some((row) => row.id === tenantBVehicle.id)).toBe(false)
  })

  it('returns only tenant-b rows under a tenant-b setting', async () => {
    const rows = await harness.asTenant(tenantBAccess, (db) =>
      db.select({ id: vehicles.id, tenantId: vehicles.tenantId }).from(vehicles),
    )

    expect(rows.length).toBeGreaterThanOrEqual(3)
    expect(rows.some((row) => row.id === tenantBVehicle.id)).toBe(true)
    expect(rows.every((row) => row.tenantId === tenantB.tenantId)).toBe(true)
  })

  it('cannot select another tenant row by exact id', async () => {
    let rows = -1
    await harness.rawAsTenant(primaAccess, async (client) => {
      const result = await client.query('select id from vehicles where id = $1', [
        tenantBVehicle.id,
      ])
      rows = result.rows.length
    })

    expect(rows).toBe(0)
  })

  it('isolates settings, memberships, domains, profiles, and images', async () => {
    await expect(countRows(primaAccess, 'showroom_settings')).resolves.toBe(1)
    await expect(countRows(primaAccess, 'tenant_members')).resolves.toBe(2)
    await expect(countRows(primaAccess, 'tenant_domains')).resolves.toBe(1)
    await expect(countRows(primaAccess, 'tenants')).resolves.toBe(1)

    let profileIds: string[] = []
    let imageTenantIds: string[] = []
    await harness.rawAsTenant(primaAccess, async (client) => {
      const profiles = await client.query<{ id: string }>('select id from profiles')
      profileIds = profiles.rows.map((row) => row.id)
      const images = await client.query<{ tenant_id: string }>('select tenant_id from vehicle_images')
      imageTenantIds = images.rows.map((row) => row.tenant_id)
    })

    expect(profileIds.sort()).toEqual([prima.profileId, platformOperator.profileId].sort())
    expect(profileIds).not.toContain(tenantB.profileId)
    expect(imageTenantIds.length).toBeGreaterThan(0)
    expect(imageTenantIds.every((id) => id === prima.tenantId)).toBe(true)
  })

  it('rejects inserting another tenant row under a prima setting', async () => {
    await expect(
      harness.rawAsTenant(primaAccess, async (client) => {
        await client.query(
          `insert into vehicles
            (tenant_id, slug, brand, model, variant, year, transmission, fuel_type,
             body_type, engine_capacity, mileage, color, price, plate_region,
             tax_expiry_date, description, status, featured, location, features)
           values ($1,$2,$3,$4,$5,2026,'AT','bensin','SUV',1500,10,'Hitam',100,
                   'B','2027-10-18','cross-tenant insert','available',false,'Bandung','[]'::jsonb)`,
          [
            tenantB.tenantId,
            crossTenantInsert.slug,
            crossTenantInsert.brand,
            crossTenantInsert.model,
            crossTenantInsert.variant,
          ],
        )
      }),
    ).rejects.toThrow()

    const rows = await harness.db.select({ id: vehicles.id }).from(vehicles)
    expect(rows.some((row) => row.id === tenantBVehicle.id)).toBe(true)
  })

  it('rejects updating another tenant row under a prima setting', async () => {
    let affected = -1
    await harness.rawAsTenant(primaAccess, async (client) => {
      const result = await client.query<{ id: string }>(
        `update vehicles set price = 1 where id = $1 returning id`,
        [tenantBVehicle.id],
      )
      affected = result.rows.length
    })

    expect(affected).toBe(0)

    const [row] = await harness.db
      .select({ price: vehicles.price })
      .from(vehicles)
      .where(sql`${vehicles.id} = ${tenantBVehicle.id}`)
    expect(row?.price).toBe(tenantBVehicle.price)
  })

  it('rejects deleting another tenant row under a prima setting', async () => {
    let affected = -1
    await harness.rawAsTenant(primaAccess, async (client) => {
      const result = await client.query<{ id: string }>(
        `delete from vehicles where id = $1 returning id`,
        [tenantBVehicle.id],
      )
      affected = result.rows.length
    })

    expect(affected).toBe(0)

    const rows = await harness.db.select({ id: vehicles.id }).from(vehicles)
    expect(rows.some((row) => row.id === tenantBVehicle.id)).toBe(true)
  })

  it('rejects a cross-tenant settings update without changing tenant-b data', async () => {
    let affected = -1
    await harness.rawAsTenant(primaAccess, async (client) => {
      const result = await client.query<{ id: string }>(
        `update showroom_settings set display_name = 'hijacked' where tenant_id = $1 returning id`,
        [tenantB.tenantId],
      )
      affected = result.rows.length
    })

    expect(affected).toBe(0)

    const [settings] = await harness.db
      .select({ displayName: showroomSettings.displayName })
      .from(showroomSettings)
      .where(eq(showroomSettings.tenantId, tenantB.tenantId))
    expect(settings?.displayName).toBe('Tenant B Test Showroom')
  })

  it('returns no rows when no tenant setting is present', async () => {
    await expect(countRows(noAccess, 'vehicles')).resolves.toBe(0)
    await expect(countRows(noAccess, 'showroom_settings')).resolves.toBe(0)
    await expect(countRows(noAccess, 'tenant_members')).resolves.toBe(0)
    await expect(countRows(noAccess, 'tenant_domains')).resolves.toBe(0)
  })

  it('rejects an insert when no tenant setting is present', async () => {
    await expect(
      harness.rawAsTenant(noAccess, async (client) => {
        await client.query(
          `insert into vehicles
            (tenant_id, slug, brand, model, variant, year, transmission, fuel_type,
             body_type, engine_capacity, mileage, color, price, plate_region,
             tax_expiry_date, description, status, featured, location, features)
           values ($1,$2,$3,$4,$5,2026,'AT','bensin','SUV',1500,10,'Hitam',100,
                   'B','2027-10-18','unscoped insert','available',false,'Bandung','[]'::jsonb)`,
          [
            prima.tenantId,
            'unscoped-insert',
            'Attack',
            'Unscoped',
            'No tenant',
          ],
        )
      }),
    ).rejects.toThrow()
  })

  it('allows a tenant to write its own rows', async () => {
    let affected = -1
    await harness.rawAsTenant(tenantBAccess, async (client) => {
      const result = await client.query<{ id: string }>(
        `update vehicles set price = price + 1 where id = $1 returning id`,
        [tenantBVehicle.id],
      )
      affected = result.rows.length
    })

    expect(affected).toBe(1)
  })

  it('lets a real platform administrator read across tenants', async () => {
    await harness.db
      .update(tenantMembers)
      .set({ role: 'platform_admin' })
      .where(eq(tenantMembers.id, prima.memberId))

    let count = -1
    await harness.rawAsTenant(
      { tenantId: null, userId: prima.profileId, platformAdmin: true },
      async (client) => {
        const result = await client.query<{ count: number }>(
          'select count(*)::int as count from vehicles',
        )
        count = result.rows[0]?.count ?? -1
      },
    )

    expect(count).toBeGreaterThan(1)
  })

  it('does not let a caller self-promote by setting the platform flag', async () => {
    let count = -1
    await harness.rawAsTenant(
      { tenantId: null, userId: prima.profileId, platformAdmin: true },
      async (client) => {
        const result = await client.query<{ count: number }>(
          'select count(*)::int as count from vehicles',
        )
        count = result.rows[0]?.count ?? -1
      },
    )

    // prima is an owner, not a platform_admin, so the flag alone grants nothing.
    expect(count).toBe(0)
  })
})

describe('lead capture isolation', () => {
  it('shows only the session tenant leads', async () => {
    await expect(countRows(primaAccess, 'leads')).resolves.toBe(1)
    await expect(countRows(tenantBAccess, 'leads')).resolves.toBe(1)
    await expect(countRows(noAccess, 'leads')).resolves.toBe(0)
  })

  it('cannot select another tenant lead by id', async () => {
    const rows = await harness.asTenant(primaAccess, (db) =>
      db.select({ id: leads.id }).from(leads).where(eq(leads.id, TENANT_B_LEAD_ID)),
    )

    expect(rows).toHaveLength(0)
  })

  it('cannot update another tenant lead', async () => {
    const rows = await harness.asTenant(primaAccess, (db) =>
      db
        .update(leads)
        .set({ status: 'won' })
        .where(eq(leads.id, TENANT_B_LEAD_ID))
        .returning({ id: leads.id }),
    )

    expect(rows).toHaveLength(0)
    await expect(
      harness.asOwner((db) =>
        db.select().from(leads).where(eq(leads.id, TENANT_B_LEAD_ID)),
      ),
    ).resolves.toMatchObject([{ status: 'new' }])
  })

  it('cannot insert a lead for another tenant', async () => {
    await expect(
      harness.asTenant(primaAccess, (db) =>
        db.insert(leads).values({
          tenantId: tenantB.tenantId,
          name: 'Injected',
          message: 'Cross tenant insert',
        }),
      ),
    ).rejects.toThrow()

    const tenantBRows = await harness.asOwner((db) =>
      db.select().from(leads).where(eq(leads.tenantId, tenantB.tenantId)),
    )
    expect(tenantBRows.map((row) => row.name)).toEqual(['Tenant B lead'])
  })

  it('cannot delete another tenant lead', async () => {
    const rows = await harness.asTenant(primaAccess, (db) =>
      db.delete(leads).where(eq(leads.id, TENANT_B_LEAD_ID)).returning({ id: leads.id }),
    )

    expect(rows).toHaveLength(0)
    await expect(
      harness.asOwner((db) =>
        db.select().from(leads).where(eq(leads.id, TENANT_B_LEAD_ID)),
      ),
    ).resolves.toHaveLength(1)
  })
})
