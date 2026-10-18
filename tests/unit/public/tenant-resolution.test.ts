// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { tenants } from '@/db/schema'
import { findTenantBySlug } from '@/lib/tenant/memberships'
import { resolvePublicTenant } from '@/lib/public/tenant'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { prima, tenantB } from '../tenant/fixtures'

let database: TenantTestDatabase

beforeAll(async () => {
  database = await createTenantTestDatabase()
})

afterAll(async () => {
  await database?.close()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('public tenant resolution', () => {
  it('resolves the seeded tenant slugs', async () => {
    await expect(findTenantBySlug(database.db, 'prima-auto-gallery')).resolves.toMatchObject({
      id: prima.tenantId,
      slug: prima.tenantSlug,
    })
    await expect(findTenantBySlug(database.db, 'tenant-b-test-showroom')).resolves.toMatchObject({
      id: tenantB.tenantId,
      slug: tenantB.tenantSlug,
    })
    await expect(findTenantBySlug(database.db, 'unknown-showroom')).resolves.toBeNull()
    await expect(findTenantBySlug(database.db, '')).resolves.toBeNull()
  })

  it('does not return a suspended tenant by slug', async () => {
    await database.asOwner(async (db) => {
      await db.update(tenants).set({ status: 'suspended' }).where(eq(tenants.id, prima.tenantId))
    })

    await expect(findTenantBySlug(database.db, 'prima-auto-gallery')).resolves.toBeNull()

    await database.asOwner(async (db) => {
      await db.update(tenants).set({ status: 'active' }).where(eq(tenants.id, prima.tenantId))
    })
  })

  it('resolves public tenants from verified hostnames', async () => {
    await expect(
      resolvePublicTenant({ db: database.db, hostname: 'prima.otoweb.id' }),
    ).resolves.toMatchObject({ id: prima.tenantId })
    await expect(
      resolvePublicTenant({ db: database.db, hostname: 'tenant-b.otoweb.id' }),
    ).resolves.toMatchObject({ id: tenantB.tenantId })
  })

  it('normalizes hostname case and ports', async () => {
    await expect(
      resolvePublicTenant({ db: database.db, hostname: 'PRIMA.otoweb.id:3000' }),
    ).resolves.toMatchObject({ id: prima.tenantId })
  })

  it('returns no tenant for an unknown hostname outside development', async () => {
    vi.stubEnv('NODE_ENV', 'test')

    await expect(
      resolvePublicTenant({ db: database.db, hostname: 'unknown.otoweb.id' }),
    ).resolves.toBeNull()
  })

  it('uses the configured slug only as a development convenience', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SHOWROOM_SLUG', 'prima-auto-gallery')

    await expect(
      resolvePublicTenant({ db: database.db, hostname: 'localhost:3000' }),
    ).resolves.toMatchObject({ id: prima.tenantId })
  })

  it('does not fall back in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SHOWROOM_SLUG', 'prima-auto-gallery')

    await expect(
      resolvePublicTenant({ db: database.db, hostname: 'unknown.otoweb.id' }),
    ).resolves.toBeNull()
  })
})
