// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tenantDomains, tenants } from '@/db/schema'
import { findTenantByHostname, normalizeHostname } from '@/lib/tenant/hostname'

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
    await expect(
      findTenantByHostname(harness.db, 'unknown.otoweb.id'),
    ).resolves.toEqual({ ok: false, error: 'unknown_hostname' })
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
