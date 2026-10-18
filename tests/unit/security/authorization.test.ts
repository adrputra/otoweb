import { describe, expect, it } from 'vitest'

import {
  assertContextTenant,
  authorizeTenantAccess,
  requireTenantAccess,
} from '@/lib/tenant/guards'
import { can, ROLE_CAPABILITIES } from '@/lib/tenant/permissions'
import type {
  TenantCapability,
  TenantContext,
  TenantContextResult,
  TenantRole,
} from '@/lib/tenant/types'

import { prima, tenantB } from '../tenant/fixtures'

const tenant = {
  id: prima.tenantId,
  name: prima.tenantName,
  slug: prima.tenantSlug,
  status: prima.tenantStatus,
  plan: 'starter',
} as const

function context(role: TenantRole, overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: role === 'staff' ? tenantB.profileId : prima.profileId,
    tenant,
    role,
    membershipId: role === 'platform_admin' ? null : prima.memberId,
    isPlatformAdmin: role === 'platform_admin',
    ...overrides,
  }
}

const ALL_CAPABILITIES: TenantCapability[] = [
  'view',
  'manage_vehicles',
  'manage_leads',
  'manage_staff',
  'manage_settings',
]

describe('role capability matrix', () => {
  it('gives owners every capability', () => {
    expect(ALL_CAPABILITIES.every((capability) => can(context('owner'), capability))).toBe(true)
  })

  it('lets staff view and manage vehicles/leads but not staff or settings', () => {
    const staff = context('staff')
    expect(can(staff, 'view')).toBe(true)
    expect(can(staff, 'manage_vehicles')).toBe(true)
    expect(can(staff, 'manage_leads')).toBe(true)
    expect(can(staff, 'manage_staff')).toBe(false)
    expect(can(staff, 'manage_settings')).toBe(false)
  })

  it('gives platform administrators every capability', () => {
    expect(
      ALL_CAPABILITIES.every((capability) => can(context('platform_admin'), capability)),
    ).toBe(true)
  })

  it('denies a missing context for every capability', () => {
    expect(ALL_CAPABILITIES.every((capability) => !can(null, capability))).toBe(true)
    expect(ALL_CAPABILITIES.every((capability) => !can(undefined, capability))).toBe(true)
  })

  it('declares a complete capability set for every role', () => {
    for (const role of Object.keys(ROLE_CAPABILITIES) as TenantRole[]) {
      expect(ROLE_CAPABILITIES[role].size).toBeGreaterThan(0)
    }
  })
})

describe('tenant boundary', () => {
  it('accepts the context tenant and rejects a foreign tenant', () => {
    expect(assertContextTenant(context('owner'), prima.tenantId)).toEqual({ ok: true })
    expect(assertContextTenant(context('owner'), tenantB.tenantId)).toEqual({
      ok: false,
      error: 'tenant_mismatch',
    })
  })

  it('rejects malformed tenant identifiers without touching data', () => {
    expect(assertContextTenant(context('owner'), 'not-a-uuid')).toEqual({
      ok: false,
      error: 'tenant_mismatch',
    })
  })

  it('lets a platform administrator cross the tenant boundary explicitly', () => {
    expect(assertContextTenant(context('platform_admin'), tenantB.tenantId)).toEqual({ ok: true })
  })
})

describe('authorizeTenantAccess', () => {
  const okResult: TenantContextResult = { ok: true, context: context('owner') }

  it('propagates a context denial unchanged', () => {
    expect(
      authorizeTenantAccess({ ok: false, error: 'unauthenticated' }, prima.tenantId, 'view'),
    ).toEqual({ ok: false, error: 'unauthenticated' })
  })

  it('rejects a tenant mismatch before capability evaluation', () => {
    expect(authorizeTenantAccess(okResult, tenantB.tenantId, 'view')).toEqual({
      ok: false,
      error: 'tenant_mismatch',
    })
  })

  it('rejects a missing capability', () => {
    expect(
      authorizeTenantAccess(
        { ok: true, context: context('staff') },
        prima.tenantId,
        'manage_settings',
      ),
    ).toEqual({ ok: false, error: 'forbidden' })
  })

  it('returns the authorized context for an allowed request', () => {
    const access = authorizeTenantAccess(okResult, prima.tenantId, 'manage_settings')
    expect(access.ok).toBe(true)
    if (access.ok) expect(access.context.tenant.id).toBe(prima.tenantId)
  })
})

describe('requireTenantAccess', () => {
  it('throws a typed error for a forbidden request', () => {
    expect(() =>
      requireTenantAccess(
        { ok: true, context: context('staff') },
        prima.tenantId,
        'manage_settings',
      ),
    ).toThrowError(/Tenant access denied/)
  })

  it('returns the context for an allowed request', () => {
    expect(
      requireTenantAccess(
        { ok: true, context: context('owner') },
        prima.tenantId,
        'manage_settings',
      ).tenant.id,
    ).toBe(prima.tenantId)
  })
})
