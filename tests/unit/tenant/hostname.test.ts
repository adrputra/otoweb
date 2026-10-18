// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tenantDomains, tenants } from '@/db/schema'
import {
  findTenantByHostname,
  isLoopbackHostname,
  normalizeHostname,
  normalizeRootDomain,
  platformSubdomainLabel,
  resolvePlatformRootDomains,
} from '@/lib/tenant/hostname'

import { prima, tenantB } from './fixtures'
import { createTenantTestDatabase, type TenantTestDatabase } from './database'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
}, 30_000)

afterEach(async () => {
  await harness.close()
})

describe('normalizeHostname', () => {
  it('accepts and normalizes fixture hostnames', () => {
    expect(normalizeHostname(prima.hostname)).toBe(prima.hostname)
    expect(normalizeHostname(tenantB.hostname)).toBe(tenantB.hostname)
    expect(normalizeHostname('  PRIMA.OTOWEB.ID  ')).toBe(prima.hostname)
    expect(normalizeHostname('prima.otoweb.id.')).toBe(prima.hostname)
    expect(normalizeHostname('prima.otoweb.id:3000')).toBe(prima.hostname)
    expect(normalizeHostname('tenant-b.otoweb.id:443')).toBe(tenantB.hostname)
  })

  it.each([
    '',
    '   ',
    'not a hostname/path',
    'https://prima.otoweb.id',
    'prima.otoweb.id/path',
    'prima.otoweb.id?x=1',
    'user@prima.otoweb.id',
    'prima.otoweb.id:abc',
    'prima.otoweb.id:70000',
    '-prima.otoweb.id',
    'prima-.otoweb.id',
    'prima..otoweb.id',
    '[::1]:3000',
    `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.id`,
  ])('rejects malformed input: %s', (value) => {
    expect(normalizeHostname(value)).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(normalizeHostname(null)).toBeNull()
    expect(normalizeHostname(undefined)).toBeNull()
  })
})

describe('findTenantByHostname', () => {
  it('resolves both fixtures', async () => {
    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toMatchObject({
      ok: true,
      tenant: { id: prima.tenantId, status: 'active' },
    })
    await expect(findTenantByHostname(harness.db, tenantB.hostname)).resolves.toMatchObject({
      ok: true,
      tenant: { id: tenantB.tenantId, status: 'trial' },
    })
  })

  it('normalizes case, port, and trailing dots before lookup', async () => {
    const result = await findTenantByHostname(harness.db, ' PRIMA.OTOWEB.ID.:3000 ')
    expect(result).toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })

  it('never substitutes a default for an unknown hostname', async () => {
    await expect(findTenantByHostname(harness.db, 'unknown.otoweb.id')).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('rejects malformed hostnames', async () => {
    await expect(findTenantByHostname(harness.db, 'not a hostname/path')).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('rejects an inactive domain', async () => {
    await harness.db
      .update(tenantDomains)
      .set({ status: 'disabled' })
      .where(eq(tenantDomains.id, prima.domainId))

    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('rejects an unverified domain', async () => {
    await harness.db
      .update(tenantDomains)
      .set({ verifiedAt: null })
      .where(eq(tenantDomains.id, prima.domainId))

    await expect(findTenantByHostname(harness.db, prima.hostname)).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('reports a suspended tenant as unavailable', async () => {
    await harness.db
      .update(tenants)
      .set({ status: 'suspended' })
      .where(eq(tenants.id, tenantB.tenantId))

    await expect(findTenantByHostname(harness.db, tenantB.hostname)).resolves.toEqual({
      ok: false,
      error: 'tenant_unavailable',
    })
  })
})

describe('root domain helpers', () => {
  it('normalizes configured roots and rejects malformed values', () => {
    expect(normalizeRootDomain(' OTOWEB.ID ')).toBe('otoweb.id')
    expect(normalizeRootDomain('otoweb.id.')).toBe('otoweb.id')
    expect(normalizeRootDomain('localhost')).toBe('localhost')
    expect(normalizeRootDomain('otoweb.id/path')).toBeNull()
    expect(normalizeRootDomain('')).toBeNull()
  })

  it('extracts only single-label subdomains of a root', () => {
    expect(platformSubdomainLabel('prima.otoweb.id', 'otoweb.id')).toBe('prima')
    expect(platformSubdomainLabel('PRIMA.OTOWEB.ID:3000', 'otoweb.id')).toBe('prima')
    expect(platformSubdomainLabel('prima.localhost', 'localhost')).toBe('prima')
    expect(platformSubdomainLabel('otoweb.id', 'otoweb.id')).toBeNull()
    expect(platformSubdomainLabel('a.b.otoweb.id', 'otoweb.id')).toBeNull()
    expect(platformSubdomainLabel('prima.nototoweb.id', 'otoweb.id')).toBeNull()
    expect(platformSubdomainLabel('prima.otoweb.id.evil.example', 'otoweb.id')).toBeNull()
  })

  it('recognizes only bare loopback hosts', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('localhost:3000')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('prima.localhost')).toBe(false)
    expect(isLoopbackHostname('localhost.evil.example')).toBe(false)
  })

  it('adds localhost only outside production', () => {
    expect(resolvePlatformRootDomains({ NODE_ENV: 'production' })).toEqual({
      rootDomains: ['otoweb.id'],
      developmentRootDomains: [],
    })
    expect(
      resolvePlatformRootDomains({ NODE_ENV: 'production', TENANT_ROOT_DOMAIN: 'otoweb.test' }),
    ).toEqual({
      rootDomains: ['otoweb.test'],
      developmentRootDomains: [],
    })
    expect(resolvePlatformRootDomains({ NODE_ENV: 'development' })).toEqual({
      rootDomains: ['otoweb.id'],
      developmentRootDomains: ['localhost'],
    })
    expect(
      resolvePlatformRootDomains({ NODE_ENV: 'development', TENANT_ROOT_DOMAIN: 'localhost' }),
    ).toEqual({
      rootDomains: ['localhost'],
      developmentRootDomains: ['localhost'],
    })
    expect(
      resolvePlatformRootDomains({ NODE_ENV: 'production', TENANT_ROOT_DOMAIN: 'not a host' }),
    ).toEqual({
      rootDomains: ['otoweb.id'],
      developmentRootDomains: [],
    })
  })
})

describe('wildcard hostname resolution', () => {
  const productionOptions = { rootDomains: ['otoweb.id'], developmentRootDomains: [] }
  const developmentOptions = { rootDomains: ['otoweb.id'], developmentRootDomains: ['localhost'] }

  it('resolves a slug subdomain without an exact tenant domain row', async () => {
    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.otoweb.id', productionOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
    await expect(
      findTenantByHostname(harness.db, 'tenant-b-test-showroom.otoweb.id', productionOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: tenantB.tenantId } })
  })

  it('honors a configured platform root', async () => {
    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.otoweb.test', {
        rootDomains: ['otoweb.test'],
        developmentRootDomains: [],
      }),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })

    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.otoweb.test', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('does not resolve unknown, multi-label, unrelated, or spoofed hosts', async () => {
    await expect(
      findTenantByHostname(harness.db, 'unknown.otoweb.id', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
    await expect(
      findTenantByHostname(harness.db, 'a.b.otoweb.id', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
    await expect(
      findTenantByHostname(
        harness.db,
        'prima-auto-gallery.otoweb.id.evil.example',
        productionOptions,
      ),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.example.com', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('does not fall through to wildcard after an inactive exact domain', async () => {
    const tenantId = '99999999-9999-4999-8999-999999999901'
    const slug = 'inactive-domain-showroom'

    await harness.db.insert(tenants).values({
      id: tenantId,
      name: 'Inactive Domain Showroom',
      slug,
      status: 'active',
      plan: 'starter',
    })
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999902',
      tenantId,
      hostname: `${slug}.otoweb.id`,
      type: 'platform_subdomain',
      status: 'disabled',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
    })

    await expect(
      findTenantByHostname(harness.db, `${slug}.otoweb.id`, productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })

    await harness.db
      .update(tenantDomains)
      .set({ status: 'active' })
      .where(eq(tenantDomains.id, '99999999-9999-4999-8999-999999999902'))

    await expect(
      findTenantByHostname(harness.db, `${slug}.otoweb.id`, productionOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: tenantId } })
  })

  it('reports a suspended wildcard tenant as unavailable', async () => {
    const tenantId = '99999999-9999-4999-8999-999999999903'
    const slug = 'suspended-wildcard'

    await harness.db.insert(tenants).values({
      id: tenantId,
      name: 'Suspended Wildcard',
      slug,
      status: 'suspended',
      plan: 'starter',
    })

    await expect(
      findTenantByHostname(harness.db, `${slug}.otoweb.id`, productionOptions),
    ).resolves.toEqual({ ok: false, error: 'tenant_unavailable' })
  })

  it('resolves development aliases derived from platform subdomains', async () => {
    await expect(
      findTenantByHostname(harness.db, 'prima.localhost', developmentOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
    await expect(
      findTenantByHostname(harness.db, 'tenant-b.localhost', developmentOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: tenantB.tenantId } })
    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.localhost', developmentOptions),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })

  it('fails closed for unknown local subdomains and outside development', async () => {
    await expect(
      findTenantByHostname(harness.db, 'unknown.localhost', developmentOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
    await expect(
      findTenantByHostname(harness.db, 'prima.localhost', productionOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })

  it('fails closed when a development alias is ambiguous', async () => {
    const tenantId = '99999999-9999-4999-8999-999999999904'

    await harness.db.insert(tenants).values({
      id: tenantId,
      name: 'Second Prima Alias',
      slug: 'second-prima-alias',
      status: 'active',
      plan: 'starter',
    })
    await harness.db.insert(tenantDomains).values({
      id: '99999999-9999-4999-8999-999999999905',
      tenantId,
      hostname: 'prima.otoweb.test',
      type: 'platform_subdomain',
      status: 'active',
      verifiedAt: new Date('2026-10-18T00:00:00.000Z'),
    })

    await expect(
      findTenantByHostname(harness.db, 'prima.localhost', developmentOptions),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
  })
})
