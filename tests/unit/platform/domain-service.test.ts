// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tenantDomains, tenants } from '@/db/schema'
import { FakeDomainProvider } from '@/lib/domains/fake-provider'
import {
  registerCustomDomain,
  verifyCustomDomain,
} from '@/lib/platform/domain-service'
import type { PlatformResult } from '@/lib/platform/types'
import { findTenantByHostname } from '@/lib/tenant/hostname'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { platformOperator, prima, tenantB } from '../tenant/fixtures'

let harness: TenantTestDatabase
const operator = platformOperator.profileId
const fixedNow = new Date('2026-10-19T10:00:00.000Z')
const token = 'test-verification-token'

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

async function register(
  hostname: string,
  deps: { createToken?: () => string; now?: () => Date } = {},
) {
  return registerCustomDomain(
    harness.db,
    operator,
    { tenantId: prima.tenantId, hostname },
    { createToken: () => token, now: () => fixedNow, ...deps },
  )
}

async function verify(
  domainId: string,
  provider = new FakeDomainProvider(),
  deps: { now?: () => Date } = {},
) {
  return verifyCustomDomain(
    harness.db,
    operator,
    { tenantId: prima.tenantId, domainId },
    { provider, now: () => fixedNow, ...deps },
  )
}

async function domainRows() {
  return harness.db.select().from(tenantDomains)
}

describe('custom domain registration', () => {
  it('registers a pending domain with stable DNS instructions', async () => {
    const detail = expectOk(await register(' Showroom.Example.COM. '))

    const domain = detail.domains.find((item) => item.type === 'custom_domain')
    expect(domain).toMatchObject({
      hostname: 'showroom.example.com',
      type: 'custom_domain',
      status: 'pending',
      verifiedAt: null,
      verificationStatus: 'pending',
      verificationToken: token,
      sslStatus: 'none',
      sslProvisionedAt: null,
      lastCheckedAt: null,
    })
    expect(domain?.dnsInstructions).toEqual([
      {
        type: 'TXT',
        name: '_otoweb-verify.showroom.example.com',
        value: `otoweb-verify=${token}`,
        ttl: 300,
        purpose: 'Verifikasi kepemilikan domain',
      },
      {
        type: 'CNAME',
        name: 'showroom.example.com',
        value: 'otoweb.id',
        ttl: 300,
        purpose: 'Arahkan trafik ke platform',
      },
    ])

    const rows = await domainRows()
    expect(rows.filter((row) => row.hostname === 'showroom.example.com')).toHaveLength(1)
  })

  it('keeps the custom domain on its own tenant only', async () => {
    expectOk(await register('showroom.example.com'))

    const other = await verifyCustomDomain(
      harness.db,
      operator,
      { tenantId: tenantB.tenantId, domainId: '99999999-9999-4999-8999-999999999999' },
      { provider: new FakeDomainProvider() },
    )
    expect(other).toMatchObject({ ok: false, error: 'not_found' })

    const otherDomains = await harness.db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.tenantId, tenantB.tenantId))
    expect(otherDomains.map((row) => row.hostname)).toEqual([tenantB.hostname])
  })

  it('rejects hostnames under the platform root', async () => {
    await expect(register('new.otoweb.id')).resolves.toMatchObject({
      ok: false,
      error: 'invalid',
    })
    await expect(register('prima.otoweb.id')).resolves.toMatchObject({
      ok: false,
      error: 'invalid',
    })
  })

  it('rejects hostnames already owned by another tenant', async () => {
    expectOk(
      await registerCustomDomain(
        harness.db,
        operator,
        { tenantId: tenantB.tenantId, hostname: 'shared.example.com' },
        { createToken: () => token, now: () => fixedNow },
      ),
    )

    await expect(register('shared.example.com')).resolves.toMatchObject({
      ok: false,
      error: 'conflict',
    })
    await expect(register(prima.hostname)).resolves.toMatchObject({
      ok: false,
      error: 'invalid',
    })
  })

  it('rejects duplicate custom registrations', async () => {
    expectOk(await register('showroom.example.com'))

    await expect(register('showroom.example.com')).resolves.toMatchObject({
      ok: false,
      error: 'conflict',
    })
  })

  it('rejects malformed hostnames and unknown tenants', async () => {
    await expect(register('not a host')).resolves.toMatchObject({
      ok: false,
      error: 'invalid',
    })
    await expect(register('single-label')).resolves.toMatchObject({
      ok: false,
      error: 'invalid',
    })
    await expect(
      registerCustomDomain(
        harness.db,
        operator,
        { tenantId: '99999999-9999-4999-8999-999999999999', hostname: 'showroom.example.com' },
        { createToken: () => token },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })
  })

  it('denies showroom owners before any write', async () => {
    const before = (await domainRows()).length

    await expect(
      registerCustomDomain(
        harness.db,
        prima.profileId,
        { tenantId: prima.tenantId, hostname: 'owner.example.com' },
        { createToken: () => token },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' })

    expect((await domainRows()).length).toBe(before)
  })
})

describe('custom domain verification and SSL', () => {
  it('verifies ownership, activates SSL, and routes the custom host', async () => {
    const registered = expectOk(await register('showroom.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    const provider = new FakeDomainProvider()
    const detail = expectOk(await verify(domain.id, provider))
    const updated = detail.domains.find((item) => item.id === domain.id)

    expect(updated).toMatchObject({
      status: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
    })
    expect(updated?.verifiedAt).toBe(fixedNow.toISOString())
    expect(updated?.sslProvisionedAt).toBe(fixedNow.toISOString())
    expect(updated?.lastCheckedAt).toBe(fixedNow.toISOString())
    expect(provider.calls.map((call) => call.operation)).toEqual([
      'verifyDns',
      'provisionCertificate',
    ])
    expect(provider.calls[0]).toMatchObject({
      hostname: 'showroom.example.com',
      token,
      recordName: '_otoweb-verify.showroom.example.com',
      recordValue: `otoweb-verify=${token}`,
    })

    await expect(findTenantByHostname(harness.db, 'showroom.example.com')).resolves.toMatchObject(
      { ok: true, tenant: { id: prima.tenantId } },
    )
    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toMatchObject({
      ok: true,
      tenant: { id: prima.tenantId },
    })
  })

  it('keeps a pending DNS result non-routable with a recorded check time', async () => {
    const registered = expectOk(await register('pending.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    const detail = expectOk(await verify(domain.id, new FakeDomainProvider({ dns: 'pending' })))
    expect(detail.domains.find((item) => item.id === domain.id)).toMatchObject({
      status: 'pending',
      verificationStatus: 'pending',
      sslStatus: 'none',
      lastCheckedAt: fixedNow.toISOString(),
      verifiedAt: null,
    })
    await expect(
      findTenantByHostname(harness.db, 'pending.example.com'),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('records a failed DNS check and allows retry with the same token', async () => {
    const registered = expectOk(await register('retry.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    const failed = expectOk(
      await verify(domain.id, new FakeDomainProvider({ dns: 'failed' })),
    )
    expect(failed.domains.find((item) => item.id === domain.id)).toMatchObject({
      status: 'pending',
      verificationStatus: 'failed',
      sslStatus: 'none',
      lastCheckedAt: fixedNow.toISOString(),
    })
    await expect(
      findTenantByHostname(harness.db, 'retry.example.com'),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })

    const retried = expectOk(await verify(domain.id))
    expect(retried.domains.find((item) => item.id === domain.id)).toMatchObject({
      status: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
      verificationToken: token,
    })
  })

  it('does not route verified ownership when certificate provisioning fails', async () => {
    const registered = expectOk(await register('ssl-fail.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    const failed = expectOk(
      await verify(domain.id, new FakeDomainProvider({ ssl: 'failed' })),
    )
    expect(failed.domains.find((item) => item.id === domain.id)).toMatchObject({
      status: 'pending',
      verificationStatus: 'verified',
      sslStatus: 'failed',
      verifiedAt: fixedNow.toISOString(),
    })
    await expect(
      findTenantByHostname(harness.db, 'ssl-fail.example.com'),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })

    const retried = expectOk(await verify(domain.id))
    expect(retried.domains.find((item) => item.id === domain.id)).toMatchObject({
      status: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
    })
    await expect(
      findTenantByHostname(harness.db, 'ssl-fail.example.com'),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })

  it('fails closed for an active custom row whose SSL is not active', async () => {
    const registered = expectOk(await register('guarded.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    await harness.db
      .update(tenantDomains)
      .set({
        status: 'active',
        verifiedAt: fixedNow,
        verificationStatus: 'verified',
        sslStatus: 'pending',
      })
      .where(eq(tenantDomains.id, domain.id))

    await expect(
      findTenantByHostname(harness.db, 'guarded.example.com'),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('is idempotent once the domain is active', async () => {
    const registered = expectOk(await register('idempotent.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    expectOk(await verify(domain.id))

    const provider = new FakeDomainProvider()
    const detail = expectOk(await verify(domain.id, provider))
    expect(detail.domains.find((item) => item.id === domain.id)).toMatchObject({
      status: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
    })
    expect(provider.calls).toEqual([])
  })

  it('reports unknown custom domains without leaking another tenant', async () => {
    await expect(
      verifyCustomDomain(
        harness.db,
        operator,
        { tenantId: tenantB.tenantId, domainId: prima.domainId },
        { provider: new FakeDomainProvider() },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'not_found' })

    await expect(
      verifyCustomDomain(
        harness.db,
        operator,
        { tenantId: prima.tenantId, domainId: 'not-a-uuid' },
        { provider: new FakeDomainProvider() },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'invalid' })
  })

  it('denies showroom owners before verification', async () => {
    const registered = expectOk(await register('owner-verify.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')

    await expect(
      verifyCustomDomain(
        harness.db,
        prima.profileId,
        { tenantId: prima.tenantId, domainId: domain.id },
        { provider: new FakeDomainProvider() },
      ),
    ).resolves.toMatchObject({ ok: false, error: 'forbidden' })

    const rows = await harness.db
      .select()
      .from(tenantDomains)
      .where(eq(tenantDomains.id, domain.id))
    expect(rows[0]?.status).toBe('pending')
  })
})

describe('custom domain routing fallback', () => {
  it('keeps the platform subdomain available while a custom domain is pending', async () => {
    expectOk(await register('pending-fallback.example.com'))

    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toMatchObject({
      ok: true,
      tenant: { id: prima.tenantId },
    })
    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.otoweb.id'),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })

  it('fails both hosts closed when the tenant is suspended', async () => {
    const registered = expectOk(await register('suspended.example.com'))
    const domain = registered.domains.find((item) => item.type === 'custom_domain')
    if (!domain) throw new Error('missing custom domain')
    expectOk(await verify(domain.id))

    await harness.db
      .update(tenants)
      .set({ status: 'suspended' })
      .where(eq(tenants.id, prima.tenantId))

    await expect(findTenantByHostname(harness.db, 'suspended.example.com')).resolves.toEqual({
      ok: false,
      error: 'tenant_unavailable',
    })
    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toEqual({
      ok: false,
      error: 'tenant_unavailable',
    })
  })
})
