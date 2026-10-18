// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'

import { resolveRequestTenantContext, assertServerOnly } from '@/lib/tenant/server'
import type { TenantDirectory } from '@/lib/tenant/directory'
import type { HostnameTenantResult, TenantIdentity, TenantMembership } from '@/lib/tenant/types'

import { prima, tenantB } from './fixtures'

const primaTenant: TenantIdentity = {
  id: prima.tenantId,
  name: prima.tenantName,
  slug: prima.tenantSlug,
  status: prima.tenantStatus,
  plan: 'starter',
}

const primaMembership: TenantMembership = {
  id: prima.memberId,
  tenantId: prima.tenantId,
  userId: prima.profileId,
  role: 'owner',
  status: 'active',
  tenant: primaTenant,
}

function directory(overrides: Partial<TenantDirectory> = {}): TenantDirectory {
  return {
    findTenantByHostname: async (): Promise<HostnameTenantResult> => ({
      ok: true,
      tenant: primaTenant,
    }),
    findTenantById: async () => primaTenant,
    listMembershipsForUser: async () => [primaMembership],
    ...overrides,
  }
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('resolveRequestTenantContext', () => {
  it('does not touch the directory for an anonymous request', async () => {
    let called = false
    const deps = directory({
      listMembershipsForUser: async () => {
        called = true
        return []
      },
    })

    await expect(resolveRequestTenantContext(null, { directory: deps })).resolves.toEqual({
      ok: false,
      error: 'unauthenticated',
    })
    expect(called).toBe(false)
  })

  it('uses the request hostname to resolve the tenant', async () => {
    let observedHost: string | null | undefined
    const deps = directory({
      findTenantByHostname: async (hostname) => {
        observedHost = hostname
        return { ok: true, tenant: primaTenant }
      },
    })

    const result = await resolveRequestTenantContext({ id: prima.profileId }, {
      directory: deps,
      hostname: 'prima.otoweb.id',
    })

    expect(observedHost).toBe('prima.otoweb.id')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(prima.tenantId)
  })

  it('falls back to the single membership when the hostname is unknown', async () => {
    const deps = directory({
      findTenantByHostname: async () => ({ ok: false, error: 'unknown_hostname' }),
    })

    const result = await resolveRequestTenantContext({ id: prima.profileId }, {
      directory: deps,
      hostname: 'localhost:3000',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(prima.tenantId)
  })

  it('denies when the hostname points at another tenant', async () => {
    const deps = directory({
      findTenantByHostname: async () => ({
        ok: true,
        tenant: {
          id: tenantB.tenantId,
          name: tenantB.tenantName,
          slug: tenantB.tenantSlug,
          status: tenantB.tenantStatus,
          plan: 'trial',
        },
      }),
    })

    const result = await resolveRequestTenantContext({ id: prima.profileId }, {
      directory: deps,
      hostname: tenantB.hostname,
    })

    expect(result).toEqual({ ok: false, error: 'tenant_mismatch' })
  })

  it('fails closed when the directory throws', async () => {
    const deps = directory({
      findTenantByHostname: async () => {
        throw new Error('database unavailable')
      },
    })

    await expect(
      resolveRequestTenantContext({ id: prima.profileId }, {
        directory: deps,
        hostname: prima.hostname,
      }),
    ).resolves.toEqual({ ok: false, error: 'tenant_unavailable' })
  })

  it('fails closed when membership loading throws', async () => {
    const deps = directory({
      listMembershipsForUser: async () => {
        throw new Error('database unavailable')
      },
    })

    await expect(
      resolveRequestTenantContext({ id: prima.profileId }, {
        directory: deps,
        hostname: prima.hostname,
      }),
    ).resolves.toEqual({ ok: false, error: 'tenant_unavailable' })
  })
})

describe('assertServerOnly', () => {
  it('runs on the server', () => {
    expect(() => assertServerOnly('test-module')).not.toThrow()
  })

  it('refuses a browser-like context', () => {
    ;(globalThis as { window?: unknown }).window = {}
    expect(() => assertServerOnly('test-module')).toThrow(/server-only/)
  })
})
