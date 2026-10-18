// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  profiles,
  showroomSettings,
  tenantDomains,
  tenantMembers,
  tenants,
} from '@/db/schema'
import {
  assignTenantOwner,
  createPlatformTenant,
  disableTenant,
  getPlatformTenant,
  listPlatformTenants,
  setTenantPlan,
  setTenantStatus,
  setTenantSubdomain,
} from '@/lib/platform/tenant-service'
import type { PlatformResult } from '@/lib/platform/types'
import { findTenantByHostname } from '@/lib/tenant/hostname'
import { findTenantBySlug } from '@/lib/tenant/memberships'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { platformOperator, prima, tenantB } from '../tenant/fixtures'

let harness: TenantTestDatabase
const operator = platformOperator.profileId

beforeEach(async () => {
  harness = await createTenantTestDatabase()
}, 30_000)

afterEach(async () => {
  await harness.close()
})

function expectOk<T>(result: PlatformResult<T>): T {
  expect(result.ok, result.ok ? undefined : result.message).toBe(true)
  if (!result.ok) throw new Error(result.message)
  return result.data
}

async function tenantCount(): Promise<number> {
  return (await harness.db.select({ id: tenants.id }).from(tenants)).length
}

describe('platform tenant inspection', () => {
  it('lists every tenant with its domains, owners, and record counts', async () => {
    const list = expectOk(await listPlatformTenants(harness.db, operator))

    expect(list).toHaveLength(2)

    const primaSummary = list.find((tenant) => tenant.id === prima.tenantId)
    expect(primaSummary).toMatchObject({
      slug: prima.tenantSlug,
      status: 'active',
      plan: 'starter',
      hostnames: [prima.hostname],
      ownerCount: 1,
      memberCount: 2,
      vehicleCount: 12,
      leadCount: 0,
    })

    const tenantBSummary = list.find((tenant) => tenant.id === tenantB.tenantId)
    expect(tenantBSummary).toMatchObject({
      slug: tenantB.tenantSlug,
      status: 'trial',
      plan: 'trial',
      hostnames: [tenantB.hostname],
      ownerCount: 1,
      memberCount: 1,
      vehicleCount: 0,
      leadCount: 0,
    })
  })

  it('returns full detail for one tenant', async () => {
    const detail = expectOk(
      await getPlatformTenant(harness.db, operator, prima.tenantId),
    )

    expect(detail.id).toBe(prima.tenantId)
    expect(detail.domains.map((domain) => domain.hostname)).toEqual([prima.hostname])
    expect(detail.domains[0]?.type).toBe('platform_subdomain')
    expect(detail.owners).toHaveLength(1)
    expect(detail.owners[0]?.userId).toBe(prima.profileId)
    expect(detail.members).toHaveLength(2)
    expect(detail.members.some((member) => member.role === 'platform_admin')).toBe(true)
    expect(detail.showroomDisplayName).toBe('Prima Auto Gallery')
    expect(detail.vehicleCount).toBe(12)
  })

  it('reports unknown and malformed tenant ids without leaking another tenant', async () => {
    await expect(
      getPlatformTenant(harness.db, operator, '99999999-9999-4999-8999-999999999999'),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })
    await expect(
      getPlatformTenant(harness.db, operator, 'tenant-b'),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })
  })
})

describe('platform tenant creation', () => {
  it('creates the tenant, default profile, subdomain, and owner in one operation', async () => {
    const ownerUserId = '50000000-0000-4000-8000-000000000098'

    const detail = expectOk(
      await createPlatformTenant(harness.db, operator, {
        name: 'QA Showroom',
        slug: 'QA-Showroom',
        plan: 'Growth',
        status: 'trial',
        subdomain: ' QA-SHOWROOM.OtoWeb.ID ',
        ownerUserId,
      }),
    )

    expect(detail).toMatchObject({
      name: 'QA Showroom',
      slug: 'qa-showroom',
      plan: 'growth',
      status: 'trial',
      hostnames: ['qa-showroom.otoweb.id'],
    })
    expect(detail.owners.some((owner) => owner.userId === ownerUserId)).toBe(true)

    const settings = await harness.db
      .select()
      .from(showroomSettings)
      .where(eq(showroomSettings.tenantId, detail.id))
    expect(settings[0]?.displayName).toBe('QA Showroom')

    const domain = await harness.db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.hostname, 'qa-showroom.otoweb.id'))
    expect(domain[0]?.verifiedAt).toBeInstanceOf(Date)

    const profile = await harness.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ownerUserId))
    expect(profile).toHaveLength(1)

    expect(expectOk(await listPlatformTenants(harness.db, operator))).toHaveLength(3)
  })

  it('rejects a duplicate slug atomically', async () => {
    const before = await tenantCount()

    const result = await createPlatformTenant(harness.db, operator, {
      name: 'Duplicate',
      slug: prima.tenantSlug,
      plan: 'starter',
      status: 'active',
    })

    expect(result).toMatchObject({ ok: false, error: 'conflict' })
    expect(await tenantCount()).toBe(before)
  })

  it('rejects a duplicate hostname atomically', async () => {
    const before = await tenantCount()

    const result = await createPlatformTenant(harness.db, operator, {
      name: 'Duplicate host',
      slug: 'duplicate-host',
      plan: 'starter',
      status: 'active',
      subdomain: prima.hostname,
    })

    expect(result).toMatchObject({ ok: false, error: 'conflict' })
    expect(await tenantCount()).toBe(before)
  })

  it('rejects invalid create input without writing', async () => {
    const before = await tenantCount()

    const result = await createPlatformTenant(harness.db, operator, {
      name: '',
      slug: 'Bad Slug',
      plan: 'has spaces',
      status: 'unknown',
      subdomain: 'not-a-host',
      ownerUserId: 'not-a-uuid',
    })

    expect(result).toMatchObject({ ok: false, error: 'invalid' })
    expect(await tenantCount()).toBe(before)
  })
})

describe('platform owner assignment', () => {
  it('provisions a profile and creates an owner membership', async () => {
    const userId = '50000000-0000-4000-8000-000000000097'

    const detail = expectOk(
      await assignTenantOwner(harness.db, operator, {
        tenantId: tenantB.tenantId,
        userId,
      }),
    )

    expect(detail.owners.some((owner) => owner.userId === userId)).toBe(true)
    expect(
      await harness.db.select().from(profiles).where(eq(profiles.id, userId)),
    ).toHaveLength(1)

    const memberships = await harness.db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, userId))
    expect(memberships).toHaveLength(1)
    expect(memberships[0]).toMatchObject({ role: 'owner', status: 'active' })
  })

  it('upserts an existing membership instead of duplicating it', async () => {
    const before = (
      await harness.db
        .select()
        .from(tenantMembers)
        .where(eq(tenantMembers.tenantId, prima.tenantId))
    ).length

    expectOk(
      await assignTenantOwner(harness.db, operator, {
        tenantId: prima.tenantId,
        userId: prima.profileId,
      }),
    )

    const after = await harness.db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, prima.tenantId))
    expect(after).toHaveLength(before)
    expect(after.find((member) => member.userId === prima.profileId)?.role).toBe('owner')
  })

  it('never downgrades an existing platform-operator membership', async () => {
    expectOk(
      await assignTenantOwner(harness.db, operator, {
        tenantId: tenantB.tenantId,
        userId: platformOperator.profileId,
      }),
    )

    const membership = await harness.db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.id, platformOperator.memberId))
    expect(membership[0]?.role).toBe('platform_admin')
  })

  it('rejects malformed and unknown requests', async () => {
    await expect(
      assignTenantOwner(harness.db, operator, {
        tenantId: tenantB.tenantId,
        userId: 'owner',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })

    await expect(
      assignTenantOwner(harness.db, operator, {
        tenantId: '99999999-9999-4999-8999-999999999999',
        userId: '50000000-0000-4000-8000-000000000096',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })
  })
})

describe('platform subdomain management', () => {
  it('updates the primary platform subdomain in place and resolves only the new host', async () => {
    const detail = expectOk(
      await setTenantSubdomain(harness.db, operator, {
        tenantId: prima.tenantId,
        hostname: '  Prima-New.OtoWeb.ID. ',
      }),
    )

    expect(detail.hostnames).toEqual(['prima-new.otoweb.id'])
    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })

    const resolved = await findTenantByHostname(harness.db, 'prima-new.otoweb.id')
    expect(resolved.ok).toBe(true)
    if (resolved.ok) expect(resolved.tenant.id).toBe(prima.tenantId)

    const rows = await harness.db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, prima.tenantId))
    expect(rows).toHaveLength(1)
  })

  it('rejects a hostname owned by another tenant and leaves the current host intact', async () => {
    await expect(
      setTenantSubdomain(harness.db, operator, {
        tenantId: prima.tenantId,
        hostname: tenantB.hostname,
      }),
    ).resolves.toMatchObject({ ok: false, error: 'conflict' })

    const resolved = await findTenantByHostname(harness.db, prima.hostname)
    expect(resolved.ok).toBe(true)
  })

  it('inserts a platform subdomain when a tenant has none', async () => {
    const created = expectOk(
      await createPlatformTenant(harness.db, operator, {
        name: 'No Domain Showroom',
        slug: 'no-domain-showroom',
        plan: 'starter',
        status: 'active',
      }),
    )
    expect(created.domains).toHaveLength(0)

    const updated = expectOk(
      await setTenantSubdomain(harness.db, operator, {
        tenantId: created.id,
        hostname: 'no-domain-showroom.otoweb.test',
      }),
    )

    expect(updated.hostnames).toEqual(['no-domain-showroom.otoweb.test'])
    const resolved = await findTenantByHostname(harness.db, 'no-domain-showroom.otoweb.test')
    expect(resolved.ok).toBe(true)
    if (resolved.ok) expect(resolved.tenant.id).toBe(created.id)
  })

  it('rejects malformed hostnames and unknown tenants', async () => {
    await expect(
      setTenantSubdomain(harness.db, operator, {
        tenantId: prima.tenantId,
        hostname: 'not a host',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })

    await expect(
      setTenantSubdomain(harness.db, operator, {
        tenantId: '99999999-9999-4999-8999-999999999999',
        hostname: 'new.otoweb.id',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })
  })
})

describe('platform plan, status, and disable', () => {
  it('persists plan and lifecycle status changes', async () => {
    const planned = expectOk(
      await setTenantPlan(harness.db, operator, { tenantId: prima.tenantId, plan: ' Scale ' }),
    )
    expect(planned.plan).toBe('scale')

    const suspended = expectOk(
      await setTenantStatus(harness.db, operator, {
        tenantId: prima.tenantId,
        status: 'suspended',
      }),
    )
    expect(suspended.status).toBe('suspended')

    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toEqual({
      ok: false,
      error: 'tenant_unavailable',
    })
  })

  it('disables a tenant so public host and slug resolution fail closed', async () => {
    const detail = expectOk(await disableTenant(harness.db, operator, prima.tenantId))
    expect(detail.status).toBe('disabled')

    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toEqual({
      ok: false,
      error: 'tenant_unavailable',
    })
    await expect(findTenantBySlug(harness.db, prima.tenantSlug)).resolves.toBeNull()

    expectOk(
      await setTenantStatus(harness.db, operator, {
        tenantId: prima.tenantId,
        status: 'active',
      }),
    )
    const restored = await findTenantByHostname(harness.db, prima.hostname)
    expect(restored.ok).toBe(true)
  })

  it('rejects invalid plan and status values', async () => {
    await expect(
      setTenantPlan(harness.db, operator, { tenantId: prima.tenantId, plan: 'bad plan' }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })

    await expect(
      setTenantStatus(harness.db, operator, {
        tenantId: prima.tenantId,
        status: 'archived',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })
  })
})

describe('platform authorization at the data layer', () => {
  it('denies showroom owners before any read or write', async () => {
    await expect(listPlatformTenants(harness.db, prima.profileId)).resolves.toMatchObject({
      ok: false,
      error: 'forbidden',
    })

    const before = await tenantCount()
    await expect(
      createPlatformTenant(harness.db, prima.profileId, {
        name: 'Owner Attempt',
        slug: 'owner-attempt',
        plan: 'starter',
        status: 'active',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' })
    expect(await tenantCount()).toBe(before)

    await expect(
      setTenantStatus(harness.db, prima.profileId, {
        tenantId: tenantB.tenantId,
        status: 'disabled',
      }),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' })

    const tenantBRow = await harness.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantB.tenantId))
    expect(tenantBRow[0]?.status).toBe('trial')
  })

  it('enforces the same decision under the restricted RLS role', async () => {
    await harness.rawAsTenant(
      { tenantId: null, userId: platformOperator.profileId, platformAdmin: false },
      async () => {
        const result = await listPlatformTenants(harness.db, platformOperator.profileId)
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.data).toHaveLength(2)
      },
    )

    await harness.rawAsTenant(
      { tenantId: null, userId: prima.profileId, platformAdmin: false },
      async () => {
        await expect(
          listPlatformTenants(harness.db, prima.profileId),
        ).resolves.toMatchObject({ ok: false, error: 'forbidden' })
      },
    )
  })
})
