// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { findTenantByHostname } from '@/lib/tenant/hostname'

import { createTenantTestDatabase, type TenantTestDatabase } from './database'
import { prima, tenantB } from './fixtures'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
}, 30_000)

afterEach(async () => {
  vi.unstubAllEnvs()
  await harness.close()
})

describe('development host configuration', () => {
  it('enables localhost aliases by default in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await expect(findTenantByHostname(harness.db, 'prima.localhost')).resolves.toMatchObject({
      ok: true,
      tenant: { id: prima.tenantId },
    })
    await expect(findTenantByHostname(harness.db, 'tenant-b.localhost')).resolves.toMatchObject({
      ok: true,
      tenant: { id: tenantB.tenantId },
    })
    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.localhost'),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })

  it('fails closed for unknown local subdomains', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await expect(findTenantByHostname(harness.db, 'unknown.localhost')).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('does not enable localhost aliases in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await expect(findTenantByHostname(harness.db, 'prima.localhost')).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('uses a configured production root for wildcard lookup', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TENANT_ROOT_DOMAIN', 'otoweb.test')

    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.otoweb.test'),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })

    await expect(findTenantByHostname(harness.db, 'prima.localhost')).resolves.toEqual({
      ok: false,
      error: 'unknown_hostname',
    })
  })

  it('falls back to the documented production root for invalid configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TENANT_ROOT_DOMAIN', 'not a hostname/path')

    await expect(
      findTenantByHostname(harness.db, 'prima-auto-gallery.otoweb.id'),
    ).resolves.toMatchObject({ ok: true, tenant: { id: prima.tenantId } })
  })
})
