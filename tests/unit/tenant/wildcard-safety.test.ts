// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tenantDomains, tenants } from '@/db/schema'
import { findTenantByHostname } from '@/lib/tenant/hostname'

import { createTenantTestDatabase, type TenantTestDatabase } from './database'
import { prima, tenantB } from './fixtures'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
}, 30_000)

afterEach(async () => {
  await harness.close()
})

const productionOptions = { rootDomains: ['otoweb.id'], developmentRootDomains: [] }
const developmentOptions = { rootDomains: ['otoweb.id'], developmentRootDomains: ['localhost'] }

describe('wildcard routing safety', () => {
  it('keeps an active verified custom domain authoritative', async () => {
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999911',
      tenantId: tenantB.tenantId,
      hostname: 'showroom.example.com',
      type: 'custom_domain',
      status: 'active',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
      verificationStatus: 'verified',
      sslStatus: 'active',
    })

    await expect(
      findTenantByHostname(harness.db, 'showroom.example.com', productionOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: tenantB.tenantId } })
  })

  it('fails closed when an active custom domain has no active certificate', async () => {
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999915',
      tenantId: tenantB.tenantId,
      hostname: 'ssl-pending.example.com',
      type: 'custom_domain',
      status: 'active',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
      verificationStatus: 'verified',
      sslStatus: 'pending',
    })

    await expect(
      findTenantByHostname(harness.db, 'ssl-pending.example.com', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('does not infer a tenant for an unregistered custom domain', async () => {
    await expect(
      findTenantByHostname(harness.db, 'tenant-b.example.com', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('does not fall through after an inactive exact custom domain', async () => {
    await harness.db.insert(tenants).values({
      id: '99999999-9999-4999-8999-999999999912',
      name: 'Inactive Custom Domain',
      slug: 'inactive-custom-domain',
      status: 'active',
      plan: 'starter',
    })
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999913',
      tenantId: '99999999-9999-4999-8999-999999999912',
      hostname: 'inactive.example.com',
      type: 'custom_domain',
      status: 'disabled',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
    })

    await expect(
      findTenantByHostname(harness.db, 'inactive.example.com', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('derives development aliases only from active verified platform subdomains', async () => {
    await harness.db.insert(tenants).values({
      id: '99999999-9999-4999-8999-999999999914',
      name: 'Disabled Alias',
      slug: 'disabled-alias-tenant',
      status: 'active',
      plan: 'starter',
    })
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999915',
      tenantId: '99999999-9999-4999-8999-999999999914',
      hostname: 'disabled-alias.otoweb.id',
      type: 'platform_subdomain',
      status: 'disabled',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
    })

    await expect(
      findTenantByHostname(harness.db, 'disabled-alias.localhost', developmentOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('does not derive a localhost alias from a custom domain', async () => {
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999916',
      tenantId: tenantB.tenantId,
      hostname: 'prima.custom.example',
      type: 'custom_domain',
      status: 'active',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
    })

    await expect(
      findTenantByHostname(harness.db, 'prima.localhost', developmentOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })

  it('reports a suspended alias target as unavailable', async () => {
    await harness.db
      .update(tenants)
      .set({ status: 'suspended' })
      .where(eq(tenants.id, prima.tenantId))

    await expect(
      findTenantByHostname(harness.db, 'prima.localhost', developmentOptions),
    ).resolves.toEqual({ ok: false, error: 'tenant_unavailable' })
  })

  it('never crosses tenants when resolving wildcard hosts', async () => {
    const result = await findTenantByHostname(
      harness.db,
      'tenant-b-test-showroom.otoweb.id',
      productionOptions,
    )

    expect(result).toMatchObject({ ok: true, tenant: { id: tenantB.tenantId } })
    if (result.ok) expect(result.tenant.id).not.toBe(prima.tenantId)
  })
})
