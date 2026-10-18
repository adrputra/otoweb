import { describe, expect, it } from 'vitest'

import { resolveTenantContext } from '@/lib/tenant/context'
import type { TenantIdentity, TenantMembership, TenantRole } from '@/lib/tenant/types'

import { prima, tenantB } from './fixtures'

function identity(fixture: typeof prima, overrides: Partial<TenantIdentity> = {}): TenantIdentity {
  return {
    id: fixture.tenantId,
    name: fixture.tenantName,
    slug: fixture.tenantSlug,
    status: fixture.tenantStatus,
    plan: 'starter',
    ...overrides,
  }
}

function membership(
  fixture: typeof prima,
  role: TenantRole = 'owner',
  status = 'active',
  tenantOverrides: Partial<TenantIdentity> = {},
  userId: string = fixture.profileId,
): TenantMembership {
  return {
    id: fixture.memberId,
    tenantId: fixture.tenantId,
    userId,
    role,
    status,
    tenant: identity(fixture, tenantOverrides),
  }
}

const primaTenant = identity(prima)
const tenantBTenant = identity(tenantB)
const primaMember = { id: prima.profileId }
const tenantBMember = { id: tenantB.profileId }

describe('resolveTenantContext', () => {
  it('denies an unauthenticated request', () => {
    expect(resolveTenantContext({ user: null, memberships: [] })).toEqual({
      ok: false,
      error: 'unauthenticated',
    })
  })

  it('denies a user with no memberships', () => {
    expect(resolveTenantContext({ user: primaMember, memberships: [] })).toEqual({
      ok: false,
      error: 'no_membership',
    })
  })

  it('ignores memberships that belong to another user', () => {
    expect(
      resolveTenantContext({
        user: tenantBMember,
        memberships: [membership(prima)],
      }),
    ).toEqual({ ok: false, error: 'no_membership' })
  })

  it('resolves the single active prima membership', () => {
    const result = resolveTenantContext({
      user: primaMember,
      memberships: [membership(prima)],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(prima.tenantId)
    expect(result.context.role).toBe('owner')
    expect(result.context.membershipId).toBe(prima.memberId)
    expect(result.context.isPlatformAdmin).toBe(false)
  })

  it('resolves the single active tenant-b membership', () => {
    const result = resolveTenantContext({
      user: tenantBMember,
      memberships: [membership(tenantB)],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(tenantB.tenantId)
  })

  it('denies an inactive membership', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima, 'owner', 'invited')],
      }),
    ).toEqual({ ok: false, error: 'inactive_membership' })
  })

  it('denies a suspended tenant even with an active membership', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima, 'owner', 'active', { status: 'suspended' })],
      }),
    ).toEqual({ ok: false, error: 'tenant_unavailable' })
  })

  it('denies an explicit tenant outside the membership', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima)],
        requestedTenant: tenantBTenant,
        requestedTenantId: tenantB.tenantId,
      }),
    ).toEqual({ ok: false, error: 'tenant_mismatch' })
  })

  it('reports an unknown requested tenant without leaking existence', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima)],
        requestedTenant: null,
        requestedTenantId: '99999999-9999-4999-8999-999999999999',
      }),
    ).toEqual({ ok: false, error: 'unknown_tenant' })
  })

  it('denies a hostname that conflicts with the membership', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima)],
        hostnameTenant: tenantBTenant,
      }),
    ).toEqual({ ok: false, error: 'tenant_mismatch' })
  })

  it('denies conflicting explicit and hostname tenants', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima)],
        requestedTenant: primaTenant,
        requestedTenantId: prima.tenantId,
        hostnameTenant: tenantBTenant,
      }),
    ).toEqual({ ok: false, error: 'tenant_mismatch' })
  })

  it('denies multiple memberships with no disambiguator', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [
          membership(prima),
          membership(tenantB, 'owner', 'active', {}, prima.profileId),
        ],
      }),
    ).toEqual({ ok: false, error: 'ambiguous' })
  })

  it('uses the hostname to disambiguate multiple memberships', () => {
    const result = resolveTenantContext({
      user: primaMember,
      memberships: [
        membership(prima),
        membership(tenantB, 'owner', 'active', {}, prima.profileId),
      ],
      hostnameTenant: tenantBTenant,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(tenantB.tenantId)
  })

  it('denies an inactive membership for the selected tenant', () => {
    expect(
      resolveTenantContext({
        user: primaMember,
        memberships: [membership(prima, 'owner', 'invited')],
        requestedTenant: primaTenant,
        requestedTenantId: prima.tenantId,
      }),
    ).toEqual({ ok: false, error: 'inactive_membership' })
  })

  it('allows a platform administrator to cross tenants explicitly', () => {
    const result = resolveTenantContext({
      user: primaMember,
      memberships: [membership(prima, 'platform_admin')],
      requestedTenant: tenantBTenant,
      requestedTenantId: tenantB.tenantId,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(tenantB.tenantId)
    expect(result.context.role).toBe('platform_admin')
    expect(result.context.membershipId).toBeNull()
    expect(result.context.isPlatformAdmin).toBe(true)
  })

  it('keeps a platform administrator on their own single membership without a signal', () => {
    const result = resolveTenantContext({
      user: primaMember,
      memberships: [membership(prima, 'platform_admin')],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.context.tenant.id).toBe(prima.tenantId)
    expect(result.context.membershipId).toBe(prima.memberId)
  })

  it('denies a non-admin requesting a tenant they do not belong to even by hostname', () => {
    expect(
      resolveTenantContext({
        user: tenantBMember,
        memberships: [membership(tenantB)],
        hostnameTenant: primaTenant,
      }),
    ).toEqual({ ok: false, error: 'tenant_mismatch' })
  })
})
